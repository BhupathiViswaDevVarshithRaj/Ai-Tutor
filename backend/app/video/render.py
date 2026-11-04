"""The real renderer (Manim) and compositor (FFmpeg). Used only inside the video worker image."""

import json
import os
import subprocess
import sys
from pathlib import Path

from app.video.pipeline import RenderError
from app.video.script import Scene

SCENES_FILE = Path(__file__).with_name("manim_scenes.py")
SCENE_ENV = "AITUTOR_SCENE"
RENDER_TIMEOUT_SECONDS = 600
FPS = {"l": 15, "m": 30, "h": 60}

# Fonts installed in the worker image (fonts-noto-core) that cover each tutor language.
FONTS = {
    "hi": "Noto Sans Devanagari",
    "te": "Noto Sans Telugu",
    "ta": "Noto Sans Tamil",
    "pa": "Noto Sans Gurmukhi",
    "bn": "Noto Sans Bengali",
}
# ISO 639-2 codes for the subtitle track's language tag.
ISO_639_2 = {"en": "eng", "hi": "hin", "te": "tel", "ta": "tam", "pa": "pan", "bn": "ben"}


def _run(cmd: list[str], timeout: int, what: str, env: dict[str, str] | None = None) -> None:
    try:
        done = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout, check=False, env=env
        )
    except subprocess.TimeoutExpired as exc:
        raise RenderError(f"{what} timed out after {timeout}s") from exc
    except FileNotFoundError as exc:
        raise RenderError(f"{what}: {cmd[0]} is not installed") from exc
    if done.returncode != 0:
        raise RenderError(
            f"{what} failed ({done.returncode}): {(done.stderr or done.stdout)[-1500:]}"
        )


class ManimRenderer:
    def __init__(self, quality: str = "m") -> None:
        self.quality = quality

    def render(
        self, scene: Scene, seconds: float, index: int, workdir: Path, language: str
    ) -> Path:
        spec = workdir / f"scene{index}.json"
        spec.write_text(
            json.dumps(
                {
                    **scene.model_dump(),
                    "seconds": seconds,
                    "font": FONTS.get(language, "Noto Sans"),
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        media = workdir / "manim"
        _run(
            [
                sys.executable,
                "-m",
                "manim",
                "render",
                f"-q{self.quality}",
                "--disable_caching",
                "--format",
                "mp4",
                "--media_dir",
                str(media),
                "-o",
                f"scene{index}",
                str(SCENES_FILE),
                "TemplateScene",
            ],
            RENDER_TIMEOUT_SECONDS,
            f"Rendering scene {index + 1}",
            # The scene reads its description from this variable (see manim_scenes.py).
            env={**os.environ, SCENE_ENV: str(spec)},
        )
        found = sorted(media.rglob(f"scene{index}.mp4"))
        if not found:
            raise RenderError(f"Manim produced no file for scene {index + 1}")
        return found[0]


class FFmpegCompositor:
    def __init__(self, quality: str = "m") -> None:
        self.fps = FPS[quality]

    def compose(
        self,
        clips: list[Path],
        audio: list[Path | None],
        durations: list[float],
        subtitles_srt: Path,
        language: str,
        out: Path,
    ) -> None:
        workdir = out.parent
        parts = []
        for i, (clip, wav, seconds) in enumerate(zip(clips, audio, durations, strict=True)):
            part = workdir / f"part{i}.mp4"
            sound = (
                ["-i", str(wav)]
                if wav
                else ["-f", "lavfi", "-i", "anullsrc=channel_layout=mono:sample_rate=44100"]
            )
            # Hold the last frame / pad the audio so every scene is exactly its planned length.
            _run(
                [
                    "ffmpeg",
                    "-y",
                    "-loglevel",
                    "error",
                    "-i",
                    str(clip),
                    *sound,
                    "-filter_complex",
                    f"[0:v]tpad=stop_mode=clone:stop_duration={seconds}[v];[1:a]apad[a]",
                    "-map",
                    "[v]",
                    "-map",
                    "[a]",
                    "-t",
                    f"{seconds:.3f}",
                    "-r",
                    str(self.fps),
                    "-c:v",
                    "libx264",
                    "-pix_fmt",
                    "yuv420p",
                    "-preset",
                    "veryfast",
                    "-c:a",
                    "aac",
                    "-ar",
                    "44100",
                    "-ac",
                    "1",
                    str(part),
                ],
                300,
                f"Preparing scene {i + 1}",
            )
            parts.append(part)

        listing = workdir / "parts.txt"
        listing.write_text("".join(f"file '{p.as_posix()}'\n" for p in parts), encoding="utf-8")
        joined = workdir / "joined.mp4"
        _run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(listing),
                "-c",
                "copy",
                str(joined),
            ],
            300,
            "Joining scenes",
        )
        _run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-i",
                str(joined),
                "-i",
                str(subtitles_srt),
                "-map",
                "0",
                "-map",
                "1",
                "-c",
                "copy",
                "-c:s",
                "mov_text",
                "-metadata:s:s:0",
                f"language={ISO_639_2.get(language, 'und')}",
                "-movflags",
                "+faststart",
                str(out),
            ],
            300,
            "Adding subtitles",
        )
