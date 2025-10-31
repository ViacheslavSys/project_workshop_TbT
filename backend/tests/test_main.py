import os
from unittest.mock import MagicMock, patch

with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}):
    with patch("app.services.llm_service.OpenAI") as mock_openai:
        mock_client = MagicMock()
        mock_openai.return_value = mock_client

        from app.api.routes_health import get_db
        from app.main import app
        from fastapi.testclient import TestClient


def override_get_db():
    class DummySession:
        def execute(self, *args, **kwargs):
            return None

        def close(self):
            pass

    yield DummySession()


app.dependency_overrides = {}
app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}
