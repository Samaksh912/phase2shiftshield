from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from model.predict import ensure_model_loaded, predict_quote


class PremiumRequest(BaseModel):
    zone_id: str
    week_start: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    shift_type: str
    earnings_baseline_lunch: int = 400
    earnings_baseline_dinner: int = 650
    recent_trigger_count: int = 0
    forecast_override: Optional[Dict[str, Any]] = None


app = FastAPI(title="ShiftShield Premium ML Service")
app.state.model_loaded = False


@app.on_event("startup")
async def startup_event() -> None:
    await ensure_model_loaded()
    app.state.model_loaded = True


@app.get("/health")
async def health() -> Dict[str, Any]:
    return {
        "status": "ok",
        "service": "ml",
        "model_loaded": bool(app.state.model_loaded),
    }


@app.post("/premium/predict")
async def premium_predict(request: PremiumRequest) -> Dict[str, Any]:
    try:
        return await predict_quote(request.model_dump())
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
