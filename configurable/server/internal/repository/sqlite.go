package repository

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"composer-config-server/internal/domain"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// ErrSubmissionClosed 总谱已关闭提交
var ErrSubmissionClosed = errors.New("submission closed")

// PieceSummary 列表项（无 scenes 大字段）
type PieceSummary struct {
	ID        string    `json:"id"`
	Slug      string    `json:"slug"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"createdAt"`
}

type PieceRecord struct {
	ID                string `gorm:"primaryKey;size:36"`
	Slug              string `gorm:"uniqueIndex;not null;size:64"`
	Title             string `gorm:"not null;size:200"`
	Payload           string `gorm:"type:text;not null"`
	SubmissionOpen    bool   `gorm:"not null;default:true"`
	SubmittedMelodies string `gorm:"type:text;not null;default:''"`
	CreatedAt         time.Time
}

type Store struct {
	db *gorm.DB
}

func Open(dsnPath string) (*Store, error) {
	if err := ensureDir(dsnPath); err != nil {
		return nil, err
	}
	db, err := gorm.Open(sqlite.Open(dsnPath), &gorm.Config{})
	if err != nil {
		return nil, err
	}
	if err := db.AutoMigrate(&PieceRecord{}); err != nil {
		return nil, err
	}
	return &Store{db: db}, nil
}

func ensureDir(dbPath string) error {
	dir := filepath.Dir(dbPath)
	return os.MkdirAll(dir, 0755)
}

func (s *Store) Create(p *domain.Piece) error {
	id := uuid.New().String()
	p.ID = id
	rec := PieceRecord{
		ID:                id,
		Slug:              p.Slug,
		Title:             p.Title,
		Payload:           mustMarshalPiece(p),
		SubmissionOpen:    true,
		SubmittedMelodies: mustMarshalEmptyMelodies(len(p.Scenes)),
		CreatedAt:         time.Now().UTC(),
	}
	return s.db.Create(&rec).Error
}

func (s *Store) GetBySlug(slug string) (*domain.Piece, error) {
	var rec PieceRecord
	err := s.db.Where("slug = ?", slug).First(&rec).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return pieceFromRecord(&rec)
}

func (s *Store) SlugExists(slug string) (bool, error) {
	var n int64
	err := s.db.Model(&PieceRecord{}).Where("slug = ?", slug).Count(&n).Error
	return n > 0, err
}

// UpdateBySlug 更新标题与 payload（scenes/theme/transpose）；id、slug、created_at 不变
func (s *Store) UpdateBySlug(slug string, p *domain.Piece) error {
	var rec PieceRecord
	err := s.db.Where("slug = ?", slug).First(&rec).Error
	if err != nil {
		return err
	}
	p.ID = rec.ID
	p.Slug = slug
	rec.Title = p.Title
	rec.Payload = mustMarshalPiece(p)
	return s.db.Model(&PieceRecord{}).Where("slug = ?", slug).Updates(map[string]any{
		"title":   rec.Title,
		"payload": rec.Payload,
	}).Error
}

// List 按标题/slug 模糊搜索，按创建时间倒序
func (s *Store) List(query string, limit, offset int) ([]PieceSummary, int64, error) {
	q := s.db.Model(&PieceRecord{})
	query = strings.TrimSpace(query)
	if query != "" {
		like := "%" + query + "%"
		q = q.Where("title LIKE ? OR slug LIKE ?", like, like)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var recs []PieceRecord
	err := q.Order("created_at DESC").Limit(limit).Offset(offset).Find(&recs).Error
	if err != nil {
		return nil, 0, err
	}
	out := make([]PieceSummary, len(recs))
	for i, r := range recs {
		out[i] = PieceSummary{
			ID: r.ID, Slug: r.Slug, Title: r.Title, CreatedAt: r.CreatedAt,
		}
	}
	return out, total, nil
}

// DeleteBySlug 删除一条
func (s *Store) DeleteBySlug(slug string) error {
	res := s.db.Where("slug = ?", slug).Delete(&PieceRecord{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// UpdateSubmissionOpen 更新是否允许各页提交旋律
func (s *Store) UpdateSubmissionOpen(slug string, open bool) error {
	res := s.db.Model(&PieceRecord{}).Where("slug = ?", slug).Update("submission_open", open)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// UpdateSceneMelody 写入某一 scene 的已提交旋律（整页 JSON）
func (s *Store) UpdateSceneMelody(slug string, sceneIndex int, melodyJSON []byte) error {
	var rec PieceRecord
	err := s.db.Where("slug = ?", slug).First(&rec).Error
	if err != nil {
		return err
	}
	if !rec.SubmissionOpen {
		return ErrSubmissionClosed
	}
	base, err := unmarshalPiece(rec.ID, rec.Slug, rec.Title, rec.Payload, rec.CreatedAt)
	if err != nil {
		return err
	}
	n := len(base.Scenes)
	if sceneIndex < 0 || sceneIndex >= n {
		return fmt.Errorf("scene 序号超出范围（有效 0～%d）", n-1)
	}
	lyricsLen := len(base.Scenes[sceneIndex].Lyrics)
	if err := domain.ValidateSceneMelodyJSON(melodyJSON, lyricsLen); err != nil {
		return err
	}
	var one interface{}
	if err := json.Unmarshal(melodyJSON, &one); err != nil {
		return err
	}
	var arr []interface{}
	if strings.TrimSpace(rec.SubmittedMelodies) != "" {
		if err := json.Unmarshal([]byte(rec.SubmittedMelodies), &arr); err != nil {
			return err
		}
	}
	for len(arr) < n {
		arr = append(arr, nil)
	}
	if len(arr) > n {
		arr = arr[:n]
	}
	arr[sceneIndex] = one
	out, err := json.Marshal(arr)
	if err != nil {
		return err
	}
	res := s.db.Model(&PieceRecord{}).Where("slug = ?", slug).Update("submitted_melodies", string(out))
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
