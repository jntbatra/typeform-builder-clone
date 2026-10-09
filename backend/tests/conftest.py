"""Test setup: every test runs against its own freshly seeded, throwaway SQLite file."""

import os
import tempfile

# Must be set before the app is imported, because the engine is created at import time.
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


@pytest.fixture
def client():
    Base.metadata.drop_all(engine)
    # Entering the context runs the app's startup, which creates the tables and seeds them.
    with TestClient(app) as test_client:
        yield test_client
