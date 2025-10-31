from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes_assets import router as assets_router
from app.api.routes_dialog import router as dialog_router
from app.api.routes_health import router as health_router
from app.api.routes_portfolios import router as portfolios_router
from app.api.routes_risk_profile import router as risk_profile_router
from app.api.routes_user import router as user_router

app = FastAPI(title="My Project", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(user_router)
app.include_router(health_router)
app.include_router(assets_router)
app.include_router(portfolios_router)
app.include_router(risk_profile_router)
app.include_router(dialog_router)
