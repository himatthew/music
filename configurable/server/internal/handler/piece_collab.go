package handler

import (
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"

	"composer-config-server/internal/domain"
	"composer-config-server/internal/repository"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type submissionOpenBody struct {
	Open bool `json:"open"`
}

func (h *Piece) PutSubmissionOpen(c *gin.Context) {
	slug := strings.TrimSpace(c.Param("slug"))
	if slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "slug required"})
		return
	}
	if err := domain.ValidateSlugFormat(slug); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var body submissionOpenBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON: " + err.Error()})
		return
	}
	if err := h.Store.UpdateSubmissionOpen(slug, body.Open); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "db"})
		return
	}
	saved, err := h.Store.GetBySlug(slug)
	if err != nil || saved == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "load after update"})
		return
	}
	c.JSON(http.StatusOK, saved)
}

func (h *Piece) PutSceneMelody(c *gin.Context) {
	slug := strings.TrimSpace(c.Param("slug"))
	if slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "slug required"})
		return
	}
	if err := domain.ValidateSlugFormat(slug); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	idxStr := strings.TrimSpace(c.Param("sceneIndex"))
	sceneIndex, err := strconv.Atoi(idxStr)
	if err != nil || idxStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sceneIndex required"})
		return
	}
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "read body"})
		return
	}
	if len(body) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "body required"})
		return
	}
	err = h.Store.UpdateSceneMelody(slug, sceneIndex, body)
	if err != nil {
		if errors.Is(err, repository.ErrSubmissionClosed) {
			c.JSON(http.StatusForbidden, gin.H{"error": "当前总谱已关闭提交"})
			return
		}
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	saved, err := h.Store.GetBySlug(slug)
	if err != nil || saved == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "load after update"})
		return
	}
	c.JSON(http.StatusOK, saved)
}
