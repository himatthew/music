package handler

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"composer-config-server/internal/domain"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (h *Piece) UpdateBySlug(c *gin.Context) {
	slug := strings.TrimSpace(c.Param("slug"))
	if slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "slug required"})
		return
	}
	if err := domain.ValidateSlugFormat(slug); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var p domain.Piece
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON: " + err.Error()})
		return
	}
	p.Slug = slug
	if err := domain.ValidatePiece(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	old, err := h.Store.GetBySlug(slug)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db"})
		return
	}
	if old == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	if err := h.Store.UpdateBySlug(slug, &p); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "save failed"})
		return
	}
	saved, err := h.Store.GetBySlug(slug)
	if err != nil || saved == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "load after update"})
		return
	}
	c.JSON(http.StatusOK, saved)
}

const maxBatchPieces = 20

type batchBody struct {
	Pieces []domain.Piece `json:"pieces"`
}

type batchItemResult struct {
	Index int    `json:"index"`
	Slug  string `json:"slug,omitempty"`
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
	ID    string `json:"id,omitempty"`
}

func (h *Piece) BatchCreate(c *gin.Context) {
	var body batchBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON: " + err.Error()})
		return
	}
	if len(body.Pieces) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "pieces: at least one required"})
		return
	}
	if len(body.Pieces) > maxBatchPieces {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("pieces: max %d", maxBatchPieces)})
		return
	}

	results := make([]batchItemResult, 0, len(body.Pieces))
	for i := range body.Pieces {
		p := &body.Pieces[i]
		saved, msg, _ := h.createOnePiece(p)
		r := batchItemResult{Index: i, Slug: p.Slug, OK: msg == ""}
		if msg != "" {
			r.Error = msg
		} else if saved != nil {
			r.ID = saved.ID
		}
		results = append(results, r)
	}
	c.JSON(http.StatusOK, gin.H{"results": results})
}
