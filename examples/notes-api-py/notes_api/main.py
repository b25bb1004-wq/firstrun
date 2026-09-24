"""HTTP API for Quill notes."""

from __future__ import annotations

import secrets

from fastapi import Depends, FastAPI, Header, HTTPException, Response, status
from pydantic import BaseModel, Field

from . import __version__
from .config import Settings
from .db import NoteStore

settings = Settings.from_env()
store = NoteStore(settings.database_path)

app = FastAPI(title="Quill Notes API", version=__version__)


class NoteIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = ""


class NoteOut(NoteIn):
    id: int
    created_at: str


def require_token(authorization: str | None = Header(default=None)) -> None:
    expected = f"Bearer {settings.api_token}"
    if authorization is None or not secrets.compare_digest(authorization, expected):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid or missing token")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "db": "up" if store.ping() else "down", "version": __version__}


@app.get("/notes", response_model=list[NoteOut])
def list_notes() -> list[dict]:
    return store.list(settings.page_size)


@app.get("/notes/{note_id}", response_model=NoteOut)
def get_note(note_id: int) -> dict:
    note = store.get(note_id)
    if note is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "note not found")
    return note


@app.post(
    "/notes",
    response_model=NoteOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_token)],
)
def create_note(note: NoteIn) -> dict:
    return store.create(note.title, note.body)


@app.delete(
    "/notes/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[Depends(require_token)],
)
def delete_note(note_id: int) -> Response:
    if not store.delete(note_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "note not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
