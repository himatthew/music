// 作曲可配置 API：SQLite + Gin。
//
// 开发：cd configurable/server && go run ./cmd/api
//   默认监听 COMPOSER_API_ADDR 或 :8080，数据库 configurable/server/data/pieces.db
//   与 configurable/web 同时调试（Vite 默认 5174）：go run ./cmd/api
//   或 CORS_ORIGIN=http://localhost:5173 go run ./cmd/api
//
// 生产单端口（API + 静态 SPA）：
//  1. cd configurable/web && npm run build
//  2. 将 dist 复制到 configurable/server/cmd/webdist（或 go:embed 指向相对路径）
//  3. 在本文件用 r.StaticFS("/", http.FS(...)) 挂载，r.NoRoute 返回 index.html
//  4. 环境变量 CORS_ORIGIN 可不设（同源）
//
// 开发双进程：终端 A → cd configurable/server && go run ./cmd/api
//           终端 B → cd configurable/web && npm run dev（Vite 将 /api 代理到 8080，见 web/vite.config.js）
package main

import (
	"log"
	"os"

	"composer-config-server/internal/config"
	"composer-config-server/internal/handler"
	"composer-config-server/internal/middleware"
	"composer-config-server/internal/repository"

	"github.com/gin-gonic/gin"
)

func main() {
	gin.SetMode(gin.ReleaseMode)
	if os.Getenv("GIN_MODE") == "debug" {
		gin.SetMode(gin.DebugMode)
	}

	dbPath := config.DBPath()
	store, err := repository.Open(dbPath)
	if err != nil {
		log.Fatalf("db: %v", err)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.RequestID())
	r.Use(middleware.CORS())

	api := r.Group("/api/v1")
	{
		p := &handler.Piece{Store: store}
		api.GET("/pieces/by-slug/:slug", p.GetBySlug)
		api.GET("/pieces", p.List)
		api.DELETE("/pieces/by-slug/:slug", p.DeleteBySlug)
		api.POST("/pieces", middleware.MaxBody(), p.Create)
		api.PUT("/pieces/by-slug/:slug", middleware.MaxBody(), p.UpdateBySlug)
		api.PUT("/pieces/by-slug/:slug/submission-open", middleware.MaxBody(), p.PutSubmissionOpen)
		api.PUT("/pieces/by-slug/:slug/scenes/:sceneIndex/melody", middleware.MaxBody(), p.PutSceneMelody)
		api.POST("/pieces/batch", middleware.MaxBodyBatch(), p.BatchCreate)
	}

	addr := config.Addr()
	if err := r.Run(addr); err != nil {
		log.Fatal(err)
	}
}
