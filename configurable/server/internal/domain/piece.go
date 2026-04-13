package domain

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"unicode"
)

var slugPattern = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`)

// Piece 与前端 / configurable/piece.schema.json 对齐
type Piece struct {
	ID                 string          `json:"id,omitempty"`
	Title              string          `json:"title"`
	Slug               string          `json:"slug"`
	TransposeSemitones int             `json:"transposeSemitones"`
	Theme              map[string]any  `json:"theme,omitempty"`
	Scenes             []Scene         `json:"scenes"`
	CreatedAt          string          `json:"createdAt,omitempty"`
	SubmissionOpen     bool            `json:"submissionOpen"`
	SubmittedMelodies  json.RawMessage `json:"submittedMelodies,omitempty"`
}

type Scene struct {
	ID           string       `json:"id"`
	Lyrics       []string     `json:"lyrics"`
	LyricTones   []int        `json:"lyricTones,omitempty"`
	Palette      []PaletteEnt `json:"palette"`
	PairLadders  PairLadders  `json:"pairLadders"`
}

type PaletteEnt struct {
	ID  string `json:"id"`
	T   string `json:"t"`
	Low *bool  `json:"low,omitempty"`
}

type PairLadders struct {
	Left  []LadderSeg `json:"left"`
	Right []LadderSeg `json:"right"`
}

type LadderSeg struct {
	Role string `json:"role"`
	ID   string `json:"id,omitempty"`
	T    string `json:"t"`
	Low  *bool  `json:"low,omitempty"`
}

const (
	maxTitle   = 200
	MaxSlugLen = 63
	maxScenes  = 32
	maxLyrics  = 256
)

// ValidatePiece 校验创建/更新请求体（无 id）
func ValidatePiece(p *Piece) error {
	if p == nil {
		return fmt.Errorf("body required")
	}
	t := strings.TrimSpace(p.Title)
	if t == "" || len(t) > maxTitle {
		return fmt.Errorf("title: required, max %d chars", maxTitle)
	}
	p.Title = t

	if len(p.Scenes) < 1 || len(p.Scenes) > maxScenes {
		return fmt.Errorf("scenes: need 1..%d items", maxScenes)
	}
	if p.TransposeSemitones < -12 || p.TransposeSemitones > 12 {
		return fmt.Errorf("transposeSemitones: -12..12")
	}

	for i := range p.Scenes {
		if err := validateScene(&p.Scenes[i], i); err != nil {
			return err
		}
	}
	return nil
}

func validateScene(s *Scene, idx int) error {
	s.ID = strings.TrimSpace(s.ID)
	if s.ID == "" {
		return fmt.Errorf("scenes[%d].id required", idx)
	}
	if len(s.Lyrics) < 1 || len(s.Lyrics) > maxLyrics {
		return fmt.Errorf("scenes[%d].lyrics: length 1..%d", idx, maxLyrics)
	}
	if len(s.LyricTones) > 0 && len(s.LyricTones) != len(s.Lyrics) {
		return fmt.Errorf("scenes[%d]: lyricTones length must match lyrics", idx)
	}
	for _, n := range s.LyricTones {
		if n < 1 || n > 5 {
			return fmt.Errorf("scenes[%d]: lyricTones must be 1..5", idx)
		}
	}
	if len(s.Palette) < 1 {
		return fmt.Errorf("scenes[%d].palette required", idx)
	}
	ids := map[string]struct{}{}
	for _, e := range s.Palette {
		if strings.TrimSpace(e.ID) == "" || strings.TrimSpace(e.T) == "" {
			return fmt.Errorf("scenes[%d].palette: id and t required", idx)
		}
		ids[e.ID] = struct{}{}
	}
	if err := validateLadder("left", s.PairLadders.Left, idx, ids); err != nil {
		return err
	}
	return validateLadder("right", s.PairLadders.Right, idx, ids)
}

func validateLadder(side string, segs []LadderSeg, sceneIdx int, paletteIDs map[string]struct{}) error {
	for i, seg := range segs {
		if seg.Role != "pick" && seg.Role != "hint" {
			return fmt.Errorf("scenes[%d].pairLadders.%s[%d]: role must be pick|hint", sceneIdx, side, i)
		}
		if strings.TrimSpace(seg.T) == "" {
			return fmt.Errorf("scenes[%d].pairLadders.%s[%d]: t required", sceneIdx, side, i)
		}
		if seg.ID != "" {
			if _, ok := paletteIDs[seg.ID]; !ok {
				return fmt.Errorf("scenes[%d].pairLadders.%s[%d]: id %q not in palette", sceneIdx, side, i, seg.ID)
			}
		}
	}
	return nil
}

// ValidateSlugFormat 仅格式，存在性由仓库层
func ValidateSlugFormat(slug string) error {
	slug = strings.TrimSpace(slug)
	if len(slug) > MaxSlugLen {
		return fmt.Errorf("slug: max %d chars", MaxSlugLen)
	}
	if !slugPattern.MatchString(slug) {
		return fmt.Errorf("slug: use lowercase letters, digits, hyphens; start/end with alphanumeric")
	}
	return nil
}

// SlugFromTitle 由标题生成候选 slug（不保证唯一）
func SlugFromTitle(title string) string {
	var b strings.Builder
	title = strings.TrimSpace(strings.ToLower(title))
	for _, r := range title {
		switch {
		case unicode.IsLetter(r) && r < 128:
			b.WriteRune(r)
		case unicode.IsDigit(r):
			b.WriteRune(r)
		case r == ' ' || r == '-' || r == '_':
			if b.Len() > 0 && b.String()[b.Len()-1] != '-' {
				b.WriteRune('-')
			}
		}
	}
	s := strings.Trim(b.String(), "-")
	if s == "" {
		s = "piece"
	}
	if len(s) > MaxSlugLen {
		s = s[:MaxSlugLen]
	}
	return s
}
