import os

from fastapi.testclient import TestClient

from notes_api.main import app, settings

client = TestClient(app)
AUTH = {"Authorization": f"Bearer {settings.api_token}"}


def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert res.json()["db"] == "up"


def test_create_requires_token():
    res = client.post("/notes", json={"title": "nope"})
    assert res.status_code == 401


def test_create_get_delete_roundtrip():
    res = client.post("/notes", json={"title": "Groceries", "body": "milk, eggs"}, headers=AUTH)
    assert res.status_code == 201
    note = res.json()
    assert note["title"] == "Groceries"

    fetched = client.get(f"/notes/{note['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["body"] == "milk, eggs"

    assert any(n["id"] == note["id"] for n in client.get("/notes").json())

    assert client.delete(f"/notes/{note['id']}", headers=AUTH).status_code == 204
    assert client.get(f"/notes/{note['id']}").status_code == 404


def test_rejects_empty_title():
    res = client.post("/notes", json={"title": ""}, headers=AUTH)
    assert res.status_code == 422


def test_uses_configured_database():
    assert os.path.exists(settings.database_path)
