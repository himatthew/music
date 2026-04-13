package repository

import (
	"encoding/json"
	"strings"
	"time"

	"composer-config-server/internal/domain"
)

type storedPayload struct {
	TransposeSemitones int                   `json:"transposeSemitones"`
	Theme              map[string]any        `json:"theme,omitempty"`
	Scenes             []domain.Scene        `json:"scenes"`
}

func mustMarshalPiece(p *domain.Piece) string {
	pl := storedPayload{
		TransposeSemitones: p.TransposeSemitones,
		Theme:              p.Theme,
		Scenes:             p.Scenes,
	}
	b, err := json.Marshal(pl)
	if err != nil {
		panic(err)
	}
	return string(b)
}

func unmarshalPiece(id, slug, title, payload string, createdAt time.Time) (*domain.Piece, error) {
	var pl storedPayload
	if err := json.Unmarshal([]byte(payload), &pl); err != nil {
		return nil, err
	}
	return &domain.Piece{
		ID:                 id,
		Slug:               slug,
		Title:              title,
		TransposeSemitones: pl.TransposeSemitones,
		Theme:              pl.Theme,
		Scenes:             pl.Scenes,
		CreatedAt:          createdAt.UTC().Format(time.RFC3339),
	}, nil
}

func mustMarshalEmptyMelodies(n int) string {
	if n <= 0 {
		return "[]"
	}
	arr := make([]interface{}, n)
	b, err := json.Marshal(arr)
	if err != nil {
		panic(err)
	}
	return string(b)
}

// normalizeSubmittedMelodiesJSON 将 DB 中 JSON 规范为长度 n（与 scenes 对齐），元素为 null 或对象
func normalizeSubmittedMelodiesJSON(db string, n int) (json.RawMessage, error) {
	if n <= 0 {
		return json.RawMessage("[]"), nil
	}
	var arr []interface{}
	if strings.TrimSpace(db) != "" {
		if err := json.Unmarshal([]byte(db), &arr); err != nil {
			return nil, err
		}
	}
	for len(arr) < n {
		arr = append(arr, nil)
	}
	if len(arr) > n {
		arr = arr[:n]
	}
	b, err := json.Marshal(arr)
	if err != nil {
		return nil, err
	}
	return json.RawMessage(b), nil
}

func pieceFromRecord(rec *PieceRecord) (*domain.Piece, error) {
	p, err := unmarshalPiece(rec.ID, rec.Slug, rec.Title, rec.Payload, rec.CreatedAt)
	if err != nil {
		return nil, err
	}
	p.SubmissionOpen = rec.SubmissionOpen
	raw, err := normalizeSubmittedMelodiesJSON(rec.SubmittedMelodies, len(p.Scenes))
	if err != nil {
		return nil, err
	}
	p.SubmittedMelodies = raw
	return p, nil
}
