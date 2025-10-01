from fastapi import FastAPI

from app.api.routes_assets import router as assets_router
from app.api.routes_health import router as health_router
from app.api.routes_portfolios import router as portfolios_router
from app.api.routes_user import router as user_router

app = FastAPI(title="My Project", version="0.1.0")

app.include_router(user_router, prefix="/api")
app.include_router(health_router, prefix="/api")
app.include_router(assets_router, prefix="/api")
app.include_router(portfolios_router, prefix="/api")
