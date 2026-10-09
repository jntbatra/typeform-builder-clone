"""FastAPI application entry point."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import forms, public, questions, responses
from .seed import seed_if_empty


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Create tables and load the sample data on first start.
    seed_if_empty()
    yield


app = FastAPI(title="Formflow API", version="1.0.0", lifespan=lifespan)

# The frontend normally proxies /api through Next.js, so CORS only matters when the
# browser calls this API directly. Comma-separated list, e.g. "https://my-app.vercel.app".
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])

app.include_router(forms.router)
app.include_router(questions.router)
app.include_router(responses.router)
app.include_router(public.router)


@app.get("/api/health")
# Also served without the /api prefix, where hosting platforms' health checks look by default.
@app.get("/health", include_in_schema=False)
def health():
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def root():
    """The API has no home page; point a visitor at the docs."""
    return {"name": "Formflow API", "docs": "/docs", "health": "/api/health"}
