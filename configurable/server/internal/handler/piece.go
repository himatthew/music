package handler

import (
	"net/http"
	"strings"

	"composer-config-server/internal/domain"
	"composer-config-server/internal/repository"

	"github.com/gin-gonic/gin"
)

type Piece struct {
	Store *repository.Store
}

func (h *Piece) Create(c *gin.Context) {
	var p domain.Piece
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON: " + err.Error()})
		return
	}
	saved, msg, code := h.createOnePiece(&p)
	if msg != "" {
		c.JSON(code, gin.H{"error": msg})
		return
	}
	c.JSON(http.StatusCreated, saved)
}

func (h *Piece) GetBySlug(c *gin.Context) {
	slug := strings.TrimSpace(c.Param("slug"))
	if slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "slug required"})
		return
	}
	if err := domain.ValidateSlugFormat(slug); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	p, err := h.Store.GetBySlug(slug)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db"})
		return
	}
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, p)
}
