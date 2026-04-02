import asyncio
import json
import os
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

import httpx
import joblib
import numpy as np

from .train import FEATURE_COLUMNS, METADATA_PATH, MODEL_PATH, train_model


LOADING_FACTOR = float(os.getenv("PREMIUM_LOADING_FACTOR", "0.35"))
OPEN_METEO_WEATHER_URL = os.getenv("OPEN_METEO_WEATHER_URL", "https://api.open-meteo.com/v1/forecast")
OPEN_METEO_AQI_URL = os.getenv("OPEN_METEO_AQI_URL", "https://air-quality-api.open-meteo.com/v1/air-quality")
LEGACY_PREMIUM_FLOOR = 15
LEGACY_PREMIUM_CEILING = 150
TARGET_PREMIUM_FLOOR = 20
TARGET_PREMIUM_CEILING = 50
RAW_SIGNAL_WEIGHT = 0.45
TIER_BASE_SCORE = {"T1": 0.16, "T2": 0.08, "T3": 0.02}
ZONE_RISK_BASE_SCORE = {"high": 0.20, "medium": 0.10, "low": 0.00}
WEATHER_DYNAMIC_WEIGHT = 0.18
_CACHED_MODEL = None


@dataclass(frozen=True)
class CityConfig:
    id: str
    name: str
    state: str
    city_tier: str
    lat: float
    lng: float


@dataclass(frozen=True)
class ZoneConfig:
    id: str
    city_id: str
    city_name: str
    lat: float
    lng: float
    name: str
    city_tier: str
    risk_class: str
    avg_lunch_earnings: int
    avg_dinner_earnings: int

CITY_SEED_PATH = Path(__file__).resolve().parents[2] / "backend" / "seed" / "cities.json"
ZONES_SEED_PATH = Path(__file__).resolve().parents[2] / "backend" / "seed" / "zones.json"


def load_cities() -> Dict[str, CityConfig]:
    city_rows = json.loads(CITY_SEED_PATH.read_text())
    return {
        row["id"]: CityConfig(
            id=row["id"],
            name=row["name"],
            state=row["state"],
            city_tier=row.get("city_tier", "T1"),
            lat=row["lat"],
            lng=row["lng"],
        )
        for row in city_rows
    }


def load_zones() -> Dict[str, ZoneConfig]:
    cities = load_cities()
    zone_rows = json.loads(ZONES_SEED_PATH.read_text())
    zones: Dict[str, ZoneConfig] = {}
    for row in zone_rows:
        city_id = row["city_id"]
        city = cities.get(city_id)
        if city is None:
            raise ValueError(f"Zone {row['id']} references unknown city_id {city_id}")

        zones[row["id"]] = ZoneConfig(
            id=row["id"],
            city_id=city_id,
            city_name=city.name,
            lat=row["lat"],
            lng=row["lng"],
            name=row["name"],
            city_tier=row.get("city_tier", row.get("tier", city.city_tier)),
            risk_class=row["risk_class"],
            avg_lunch_earnings=row["avg_lunch_earnings"],
            avg_dinner_earnings=row["avg_dinner_earnings"],
        )
    return zones


def build_fallback_forecast(zone: ZoneConfig) -> Dict[str, Any]:
    tier_temp_base = {"T1": 39.5, "T2": 37.5, "T3": 35.5}.get(zone.city_tier, 38.0)
    risk_rain_base = {"low": 4.0, "medium": 7.0, "high": 10.0}.get(zone.risk_class, 6.0)
    risk_aqi_base = {"low": 165.0, "medium": 220.0, "high": 275.0}.get(zone.risk_class, 200.0)
    temperature = round(tier_temp_base + (zone.avg_dinner_earnings - 500) / 120.0, 2)
    rain = round(risk_rain_base + zone.avg_lunch_earnings / 180.0, 2)
    aqi = round(risk_aqi_base + (18.0 if zone.city_tier == "T1" else 8.0 if zone.city_tier == "T2" else 0.0), 2)

    return {
        "avg_max_temp": temperature,
        "avg_max_rain": rain,
        "avg_max_aqi": aqi,
        "daily": {
            "apparent_temperature_max": [
                round(temperature - 2),
                round(temperature - 1),
                round(temperature),
                round(temperature + 1),
                round(temperature),
                round(temperature - 1),
                round(temperature - 2),
            ],
            "precipitation_sum": [
                max(0, round(rain - 4)),
                max(0, round(rain - 2)),
                round(rain + 3),
                round(rain + 1),
                max(0, round(rain - 3)),
                round(rain),
                max(0, round(rain - 2)),
            ],
            "daily_max_aqi": [
                round(aqi - 28),
                round(aqi - 8),
                round(aqi + 12),
                round(aqi + 22),
                round(aqi + 6),
                round(aqi - 10),
                round(aqi - 18),
            ],
        },
    }


ZONES = load_zones()
ZONE_ENCODING = {zone_id: index for index, zone_id in enumerate(ZONES.keys())}
FALLBACK_FORECAST = {zone_id: build_fallback_forecast(zone) for zone_id, zone in ZONES.items()}


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


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(value, maximum))


def normalized_legacy_premium_signal(raw_total_premium: int) -> float:
    bounded_premium = min(max(raw_total_premium, LEGACY_PREMIUM_FLOOR), LEGACY_PREMIUM_CEILING)
    if LEGACY_PREMIUM_CEILING == LEGACY_PREMIUM_FLOOR:
        return 0.0

    return (bounded_premium - LEGACY_PREMIUM_FLOOR) / (LEGACY_PREMIUM_CEILING - LEGACY_PREMIUM_FLOOR)


def dynamic_weather_score(forecast: Dict[str, Any], recent_trigger_count: int) -> float:
    heat_score = clamp((forecast["avg_max_temp"] - 34.0) / 10.0, 0.0, 1.0)
    rain_score = clamp((forecast["avg_max_rain"] - 2.0) / 18.0, 0.0, 1.0)
    aqi_score = clamp((forecast["avg_max_aqi"] - 120.0) / 220.0, 0.0, 1.0)
    trigger_score = clamp(recent_trigger_count / 3.0, 0.0, 1.0)
    return (
        heat_score * 0.28
        + rain_score * 0.24
        + aqi_score * 0.34
        + trigger_score * 0.14
    )


def pricing_score_for_zone(
    zone: ZoneConfig,
    raw_total_premium: int,
    forecast: Dict[str, Any],
    recent_trigger_count: int,
) -> float:
    raw_signal = normalized_legacy_premium_signal(raw_total_premium)
    return clamp(
        raw_signal * RAW_SIGNAL_WEIGHT
        + TIER_BASE_SCORE.get(zone.city_tier, TIER_BASE_SCORE["T3"])
        + ZONE_RISK_BASE_SCORE.get(zone.risk_class, ZONE_RISK_BASE_SCORE["medium"])
        + dynamic_weather_score(forecast, recent_trigger_count) * WEATHER_DYNAMIC_WEIGHT,
        0.0,
        1.0,
    )


def premium_from_pricing_score(score: float) -> int:
    premium_span = TARGET_PREMIUM_CEILING - TARGET_PREMIUM_FLOOR
    return int(round(TARGET_PREMIUM_FLOOR + clamp(score, 0.0, 1.0) * premium_span))


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
        raw_total_premium = shift_results["lunch"]["premium"] + shift_results["dinner"]["premium"]
    else:
        raw_total_premium = shift_results[shift_type]["premium"]

    zone = ZONES[zone_id]
    pricing_score = pricing_score_for_zone(zone, raw_total_premium, forecast, recent_trigger_count)
    total_premium = premium_from_pricing_score(pricing_score)
    risk_score = round(pricing_score, 2)
    if risk_score < 0.34:
        risk_band = "low"
    elif risk_score < 0.67:
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
