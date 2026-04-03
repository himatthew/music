#!/usr/bin/env python3
"""
从「长音{n}.mp3」生成与参考短音同长度的「短音{n}.mp3」：
  1) 对整段长音做结尾 10ms 淡出（fadeout）
  2) 再截断到参考短音的时长（默认与 短音6.mp3 一致）

依赖：Python 3、pydub，且系统 PATH 中需有 ffmpeg/ffprobe（brew install ffmpeg）。

用法：
  python3 scripts/long_to_short_audio.py
  python3 scripts/long_to_short_audio.py --dir public/audio --ref 短音6.mp3
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from pydub import AudioSegment

FADE_MS = 10


def parse_numbers(s: str) -> list[int]:
    s = s.strip()
    if "-" in s and "," not in s:
        a, b = s.split("-", 1)
        return list(range(int(a), int(b) + 1))
    return [int(x.strip()) for x in s.split(",") if x.strip()]


def main() -> int:
    ap = argparse.ArgumentParser(description="长音 → 短音（淡出 + 按参考时长截断）")
    ap.add_argument(
        "--dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "public" / "audio",
        help="音频目录（默认项目 public/audio）",
    )
    ap.add_argument(
        "--ref",
        default="短音6.mp3",
        help="参考时长：取该文件长度（毫秒）作为截断目标",
    )
    ap.add_argument("--numbers", default="1-7", help="处理的长音编号，如 1-7 或 3,5")
    ap.add_argument("--fade-ms", type=int, default=FADE_MS, help="结尾淡出毫秒数")
    args = ap.parse_args()

    d: Path = args.dir
    if not d.is_dir():
        print(f"目录不存在: {d}", file=sys.stderr)
        return 1

    ref_path = d / args.ref
    if not ref_path.is_file():
        print(f"参考文件不存在: {ref_path}", file=sys.stderr)
        return 1

    ref_audio = AudioSegment.from_file(ref_path, format="mp3")
    target_ms = len(ref_audio)
    print(f"参考 {ref_path.name} 时长: {target_ms} ms → 截断目标")

    nums = parse_numbers(args.numbers)
    fade_ms = max(0, int(args.fade_ms))

    for n in nums:
        src = d / f"长音{n}.mp3"
        if not src.is_file():
            print(f"跳过（不存在）: {src}")
            continue
        audio = AudioSegment.from_file(src, format="mp3")
        if fade_ms > 0:
            audio = audio.fade_out(fade_ms)
        truncated = audio[:target_ms]
        dst = d / f"短音{n}.mp3"
        truncated.export(dst, format="mp3")
        print(f"已写入 {dst.name}  长度 {len(truncated)} ms（源 {len(audio)} ms 淡出后截断）")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
