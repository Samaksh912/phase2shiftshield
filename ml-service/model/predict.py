import asyncio
import json
import os
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List

import httpx
import joblib
import numpy as np

from .train import FEATURE_COLUMNS, METADATA_PATH, MODEL_PATH, train_model


LOADING_FACTOR = float(os.getenv("PREMIUM_LOADING_FACTOR", "0.35"))
OPEN_METEO_WEATHER_URL = os.getenv("OPEN_METEO_WEATHER_URL", "https://api.open-meteo.com/v1/forecast")
OPEN_METEO_AQI_URL = os.getenv("OPEN_METEO_AQI_URL", "https://air-quality-api.open-meteo.com/v1/air-quality")
PREMIUM_FLOOR = 15
PREMIUM_CEILING = 150
_CACHED_MODEL = None


@dataclass(frozen=True)
class ZoneConfig:
    id: str
    lat: float
    lng: float
    name: str


ZONES = {
    "koramangala": ZoneConfig("koramangala", 12.9352, 77.6245, "Koramangala"),
    "indiranagar": ZoneConfig("indiranagar", 12.9784, 77.6408, "Indiranagar"),
    "hsr_layout": ZoneConfig("hsr_layout", 12.9116, 77.6474, "HSR Layout"),
    "whitefield": ZoneConfig("whitefield", 12.9698, 77.7500, "Whitefield"),
    "electronic_city": ZoneConfig("electronic_city", 12.8399, 77.6770, "Electronic City"),
}
ZONE_ENCODING = {zone_id: index for index, zone_id in enumerate(ZONES.keys())}
FALLBACK_FORECAST = {
    "koramangala": {
        "avg_max_temp": 40.0,
        "avg_max_rain": 8.0,
        "avg_max_aqi": 214.0,
        "daily": {
            "apparent_temperature_max": [38, 40, 39, 41, 40, 39, 38],
            "precipitation_sum": [0, 4, 16, 8, 0, 6, 2],
            "daily_max_aqi": [172, 214, 238, 286, 224, 205, 192],
        },
    },
    "indiranagar": {
        "avg_max_temp": 38.0,
        "avg_max_rain": 4.8,
        "avg_max_aqi": 176.0,
        "daily": {
            "apparent_temperature_max": [36, 37, 38, 39, 39, 38, 37],
            "precipitation_sum": [0, 2, 10, 4, 0, 5, 1],
            "daily_max_aqi": [154, 168, 176, 188, 179, 182, 165],
        },
    },
    "hsr_layout": {
        "avg_max_temp": 39.6,
        "avg_max_rain": 7.4,
        "avg_max_aqi": 224.0,
        "daily": {
            "apparent_temperature_max": [38, 39, 40, 41, 40, 39, 38],
            "precipitation_sum": [1, 5, 15, 11, 3, 10, 4],
            "daily_max_aqi": [186, 220, 241, 252, 236, 223, 210],
        },
    },
    "whitefield": {
        "avg_max_temp": 41.4,
        "avg_max_rain": 9.6,
        "avg_max_aqi": 258.0,
        "daily": {
            "apparent_temperature_max": [40, 41, 42, 43, 42, 41, 40],
            "precipitation_sum": [2, 7, 18, 12, 4, 13, 6],
            "daily_max_aqi": [228, 251, 275, 288, 270, 261, 233],
        },
    },
    "electronic_city": {
        "avg_max_temp": 42.1,
        "avg_max_rain": 10.8,
        "avg_max_aqi": 272.0,
        "daily": {
            "apparent_temperature_max": [41, 42, 43, 44, 43, 41, 40],
            "precipitation_sum": [2, 8, 20, 15, 5, 14, 7],
            "daily_max_aqi": [241, 270, 289, 304, 282, 268, 250],
        },
    },
}


def get_season(week_of_year: int) -> int:
    if 22 <= week_of_year <= 39:
        return 2
    if 9 <= week_of_year <= 21:
        return 1
    if 40 <= week_of_year <= 48:
        return 3
    return 0


def average(values: List[float], fallback: float) -> float:
    if not values:
        return fallback
    return float(sum(values) / len(values))


def get_daily_max_aqi(hourly_values: List[float]) -> List[float]:
    max_values = []
    for index in range(7):
        block = hourly_values[index * 24 : (index + 1) * 24]
        max_values.append(max(block) if block else 50)
    return max_values


async def ensure_model_loaded():
    global _CACHED_MODEL

    if _CACHED_MODEL is not None:
        return _CACHED_MODEL

    if not MODEL_PATH.exists():
        await train_model()

    _CACHED_MODEL = joblib.load(MODEL_PATH)
    return _CACHED_MODEL


def load_metadata() -> Dict[str, Any]:
    if not METADATA_PATH.exists():
        return {"feature_importance": {column: 0.0 for column in FEATURE_COLUMNS}}
    return json.loads(METADATA_PATH.read_text())


async def fetch_live_forecast(zone_id: str) -> Dict[str, Any]:
    zone = ZONES[zone_id]
    weather_params = {
        "latitude": zone.lat,
        "longitude": zone.lng,
        "daily": "temperature_2m_max,apparent_temperature_max,precipitation_sum,weather_code",
        "timezone": "Asia/Kolkata",
        "forecast_days": 7,
    }
    aqi_params = {
        "latitude": zone.lat,
        "longitude": zone.lng,
        "hourly": "us_aqi",
        "timezone": "Asia/Kolkata",
        "forecast_days": 7,
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        weather_response, aqi_response = await asyncio.gather(
            client.get(OPEN_METEO_WEATHER_URL, params=weather_params),
            client.get(OPEN_METEO_AQI_URL, params=aqi_params),
        )

    weather_response.raise_for_status()
    aqi_response.raise_for_status()
    weather = weather_response.json()
    aqi = aqi_response.json()
    daily = weather.get("daily", {})
    daily_aqi = get_daily_max_aqi(aqi.get("hourly", {}).get("us_aqi", []))

    return {
        "avg_max_temp": round(average(daily.get("apparent_temperature_max", []), 38.0), 2),
        "avg_max_rain": round(average(daily.get("precipitation_sum", []), 0.0), 2),
        "avg_max_aqi": round(average(daily_aqi, 150.0), 2),
        "daily": {
            "apparent_temperature_max": daily.get("apparent_temperature_max", []),
            "precipitation_sum": daily.get("precipitation_sum", []),
            "daily_max_aqi": daily_aqi,
        },
        "source": "live",
    }


async def get_forecast(payload: Dict[str, Any]) -> Dict[str, Any]:
    if payload.get("forecast_override"):
        forecast = payload["forecast_override"].copy()
        forecast.setdefault("source", forecast.get("source", "override"))
        return forecast

    try:
        return await fetch_live_forecast(payload["zone_id"])
    except Exception:
        forecast = FALLBACK_FORECAST[payload["zone_id"]].copy()
        forecast["source"] = "fallback"
        return forecast


def build_feature_vector(
    zone_id: str,
    week_start: str,
    forecast: Dict[str, Any],
    trigger_count: int,
    shift_type: str,
    baseline: int,
) -> np.ndarray:
    week = datetime.strptime(week_start, "%Y-%m-%d")
    week_of_year = week.isocalendar()[1]
    season = get_season(week_of_year)
    shift_encoded = 0 if shift_type == "lunch" else 1
    values = [
        ZONE_ENCODING[zone_id],
        week_of_year,
        season,
        forecast["avg_max_temp"],
        forecast["avg_max_rain"],
        forecast["avg_max_aqi"],
        trigger_count,
        shift_encoded,
        baseline,
    ]
    return np.array([values], dtype=float)


def explanation_from_forecast(
    forecast: Dict[str, Any],
    recent_trigger_count: int,
    metadata: Dict[str, Any],
) -> List[Dict[str, Any]]:
    importance = metadata.get("feature_importance", {})
    apparent_temp = forecast.get("daily", {}).get("apparent_temperature_max", [])
    precipitation = forecast.get("daily", {}).get("precipitation_sum", [])
    daily_max_aqi = forecast.get("daily", {}).get("daily_max_aqi", [])

    risk_candidates = []
    aqi_days = sum(1 for value in daily_max_aqi if value >= 280)
    if aqi_days:
        risk_candidates.append(
            {
                "factor": "AQI forecast",
                "weight": (importance.get("avg_max_aqi", 0.25) + 0.2) * (aqi_days + 1),
                "detail": f"{aqi_days} days predicted AQI above 280",
            }
        )

    heavy_rain_days = sum(1 for value in precipitation if value >= 15)
    if heavy_rain_days:
        risk_candidates.append(
            {
                "factor": "Rain probability",
                "weight": (importance.get("avg_max_rain", 0.2) + 0.18) * (heavy_rain_days + 1),
                "detail": f"{heavy_rain_days} days forecast above 15mm rain",
            }
        )

    peak_temp = max(apparent_temp) if apparent_temp else forecast["avg_max_temp"]
    if peak_temp >= 40:
        risk_candidates.append(
            {
                "factor": "Heat forecast",
                "weight": (importance.get("avg_max_temp", 0.2) + 0.15) * ((peak_temp - 39) / 2),
                "detail": f"Peak apparent temperature near {round(peak_temp)}°C",
            }
        )

    if recent_trigger_count:
        risk_candidates.append(
            {
                "factor": "Historical triggers",
                "weight": (importance.get("trigger_freq_4w", 0.15) + 0.12) * recent_trigger_count,
                "detail": f"{recent_trigger_count} triggers in the last 4 weeks",
            }
        )

    if not risk_candidates:
        return [
            {
                "factor": "Seasonal baseline",
                "contribution_pct": 100,
                "detail": "No elevated weather risk factors this week",
            }
        ]

    total_weight = sum(candidate["weight"] for candidate in risk_candidates) or 1.0
    normalized = []
    for candidate in sorted(risk_candidates, key=lambda item: item["weight"], reverse=True)[:3]:
        normalized.append(
            {
                "factor": candidate["factor"],
                "contribution_pct": round(candidate["weight"] / total_weight * 100),
                "detail": candidate["detail"],
            }
        )

    diff = 100 - sum(item["contribution_pct"] for item in normalized)
    normalized[0]["contribution_pct"] += diff
    return normalized


def build_summary(risk_band: str, top_factors: List[Dict[str, Any]]) -> str:
    prefix = {
        "low": "Low risk this week.",
        "medium": "Medium risk this week.",
        "high": "High risk this week.",
    }[risk_band]
    detail = " ".join(factor["detail"] + "." for factor in top_factors[:2])
    return f"{prefix} {detail}".strip()


async def predict_quote(payload: Dict[str, Any]) -> Dict[str, Any]:
    zone_id = payload["zone_id"]
    if zone_id not in ZONES:
        raise ValueError("Unsupported zone_id")
    if payload["shift_type"] not in {"lunch", "dinner", "both"}:
        raise ValueError("shift_type must be lunch, dinner, or both")

    model = await ensure_model_loaded()
    metadata = load_metadata()
    forecast = await get_forecast(payload)
    shift_type = payload["shift_type"]
    lunch_baseline = int(payload.get("earnings_baseline_lunch", 400))
    dinner_baseline = int(payload.get("earnings_baseline_dinner", 650))
    recent_trigger_count = int(payload.get("recent_trigger_count", 0))

    shift_results = {}
    covered_shifts = ["lunch", "dinner"] if shift_type == "both" else [shift_type]

    for current_shift in covered_shifts:
        baseline = lunch_baseline if current_shift == "lunch" else dinner_baseline
        feature_vector = build_feature_vector(
            zone_id,
            payload["week_start"],
            forecast,
            recent_trigger_count,
            current_shift,
            baseline,
        )
        expected_claim_cost = max(float(model.predict(feature_vector)[0]), 0.0)
        premium = round(expected_claim_cost * (1 + LOADING_FACTOR))
        shift_results[current_shift] = {
            "expected_claim_cost": round(expected_claim_cost),
            "premium": premium,
            "baseline": baseline,
        }

    if shift_type == "both":
        total_premium = shift_results["lunch"]["premium"] + shift_results["dinner"]["premium"]
        average_baseline = (lunch_baseline + dinner_baseline) / 2.0
    else:
        total_premium = shift_results[shift_type]["premium"]
        average_baseline = shift_results[shift_type]["baseline"]

    total_premium = min(max(total_premium, PREMIUM_FLOOR), PREMIUM_CEILING)
    risk_score = round(min(total_premium / max(average_baseline * 0.5, 1), 1.0), 2)
    if risk_score < 0.33:
        risk_band = "low"
    elif risk_score < 0.66:
        risk_band = "medium"
    else:
        risk_band = "high"

    lunch_shift_max_payout = round(lunch_baseline * 0.80)
    dinner_shift_max_payout = round(dinner_baseline * 0.80)
    if shift_type == "both":
        payout_cap = lunch_shift_max_payout * 6 + dinner_shift_max_payout * 6
    elif shift_type == "lunch":
        payout_cap = lunch_shift_max_payout * 6
    else:
        payout_cap = dinner_shift_max_payout * 6

    top_factors = explanation_from_forecast(forecast, recent_trigger_count, metadata)
    return {
        "risk_score": risk_score,
        "risk_band": risk_band,
        "premium": total_premium,
        "payout_cap": payout_cap,
        "lunch_shift_max_payout": lunch_shift_max_payout,
        "dinner_shift_max_payout": dinner_shift_max_payout,
        "explanation": {
            "top_factors": top_factors,
            "summary": build_summary(risk_band, top_factors),
        },
    }
