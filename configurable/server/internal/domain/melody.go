package domain

import (
	"encoding/json"
	"fmt"
	"strings"
)

// sceneMelodyWire 与前端 notationState 单页一致（用于校验）
type sceneMelodyWire struct {
	CurrentIndex   int               `json:"currentIndex"`
	Selections     [][]string        `json:"selections"`
	LineRhythm     []bool            `json:"lineRhythm"`
	NotationTrails json.RawMessage   `json:"notationTrails"`
}

// ValidateSceneMelodyJSON 校验单页旋律 JSON 与歌词格数一致
func ValidateSceneMelodyJSON(data []byte, lyricsLen int) error {
	if lyricsLen < 1 {
		return fmt.Errorf("lyricsLen invalid")
	}
	var st sceneMelodyWire
	if err := json.Unmarshal(data, &st); err != nil {
		return fmt.Errorf("invalid melody JSON: %w", err)
	}
	if len(st.Selections) != lyricsLen {
		return fmt.Errorf("selections: 长度须与歌词字数一致（%d）", lyricsLen)
	}
	for i, row := range st.Selections {
		if len(row) < 1 || len(row) > 2 {
			return fmt.Errorf("selections[%d]: 每格须为 1～2 个音", i)
		}
		for _, id := range row {
			if strings.TrimSpace(id) == "" {
				return fmt.Errorf("selections[%d]: 音 ID 不能为空", i)
			}
		}
	}
	if len(st.LineRhythm) != lyricsLen {
		return fmt.Errorf("lineRhythm: 长度须与歌词字数一致（%d）", lyricsLen)
	}
	var trails interface{}
	if err := json.Unmarshal(st.NotationTrails, &trails); err != nil {
		return fmt.Errorf("notationTrails: JSON 无效")
	}
	trArr, ok := trails.([]interface{})
	if !ok || len(trArr) != lyricsLen {
		return fmt.Errorf("notationTrails: 长度须与歌词字数一致（%d）", lyricsLen)
	}
	return nil
}
