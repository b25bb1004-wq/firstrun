"""Runtime settings, read from the environment (and an optional .env file)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Self


def load_dotenv(path: str | os.PathLike[str] = ".env") -> None:
    """Minimal .env loader: KEY=VALUE lines, existing env vars win."""
    env_file = Path(path)
    if not env_file.is_file():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


@dataclass(frozen=True, slots=True)
class Settings:
    database_path: str
    api_token: str
    page_size: int = 50

    @classmethod
    def from_env(cls) -> Self:
        load_dotenv()
        token = os.environ.get("NOTES_API_TOKEN")
        if not token:
            raise RuntimeError("Missing required environment variable NOTES_API_TOKEN")
        return cls(
            database_path=os.environ.get("NOTES_DB_PATH", "notes.db"),
            api_token=token,
            page_size=int(os.environ.get("NOTES_PAGE_SIZE", "50")),
        )
