package middleware

import (
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

const maxBodyBytes = 2 << 20       // 2MiB
const maxBatchBodyBytes = 8 << 20 // 8MiB 批量导入

// MaxBody limits JSON body size
func MaxBody() gin.HandlerFunc {
	return maxBody(maxBodyBytes)
}

// MaxBodyBatch 用于 POST /pieces/batch
func MaxBodyBatch() gin.HandlerFunc {
	return maxBody(maxBatchBodyBytes)
}

func maxBody(limit int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.ContentLength > limit {
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{"error": "body too large"})
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, limit)
		c.Next()
	}
}

// CORS dev: CORS_ORIGIN=http://localhost:5173 ; prod same-origin 可不设
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := os.Getenv("CORS_ORIGIN")
		if origin == "" {
			origin = "http://localhost:5174"
		}
		c.Header("Access-Control-Allow-Origin", origin)
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type")
		if c.Request.Method == http.MethodOptions && strings.HasPrefix(c.Request.URL.Path, "/api/") {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

// RequestID attaches X-Request-ID
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader("X-Request-ID")
		if id == "" {
			id = time.Now().UTC().Format("20060102150405.000000000")
		}
		c.Writer.Header().Set("X-Request-ID", id)
		c.Next()
	}
}
