package handler

import (
	"fmt"
	"strings"

	"composer-config-server/internal/domain"
)

// createOnePiece 校验并新建；返回 saved 与错误文案（空表示成功）
func (h *Piece) createOnePiece(p *domain.Piece) (*domain.Piece, string, int) {
	if err := domain.ValidatePiece(p); err != nil {
		return nil, err.Error(), 400
	}
	slug := strings.TrimSpace(p.Slug)
	if slug == "" {
		base := domain.SlugFromTitle(p.Title)
		found := false
		for i := 0; i < 100; i++ {
			candidate := base
			if i > 0 {
				candidate = fmt.Sprintf("%s-%d", base, i)
			}
			if len(candidate) > domain.MaxSlugLen {
				candidate = candidate[:domain.MaxSlugLen]
				candidate = strings.TrimRight(candidate, "-")
			}
			exists, err := h.Store.SlugExists(candidate)
			if err != nil {
				return nil, "db", 500
			}
			if !exists {
				slug = candidate
				found = true
				break
			}
		}
		if !found {
			return nil, "could not allocate slug", 500
		}
	} else {
		if err := domain.ValidateSlugFormat(slug); err != nil {
			return nil, err.Error(), 400
		}
		exists, err := h.Store.SlugExists(slug)
		if err != nil {
			return nil, "db", 500
		}
		if exists {
			return nil, "slug already taken", 409
		}
	}
	p.Slug = slug
	if err := h.Store.Create(p); err != nil {
		return nil, "save failed", 500
	}
	saved, err := h.Store.GetBySlug(p.Slug)
	if err != nil || saved == nil {
		return nil, "load after create", 500
	}
	return saved, "", 201
}
