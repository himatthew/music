package config

import (
	"os"
	"path/filepath"
)

// Addr 监听地址，默认 :8080
func Addr() string {
	if v := os.Getenv("COMPOSER_API_ADDR"); v != "" {
		return v
	}
	return ":8080"
}

// DBPath SQLite 路径
func DBPath() string {
	if v := os.Getenv("COMPOSER_DB_PATH"); v != "" {
		return v
	}
	dir, _ := os.Getwd()
	return filepath.Join(dir, "data", "pieces.db")
}
