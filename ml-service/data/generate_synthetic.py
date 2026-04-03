import asyncio
import json
import math
import os
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path

import httpx
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "data" / "synthetic_training_data.csv"
OPEN_METEO_HISTORICAL_URL = os.getenv(
    "OPEN_METEO_HISTORICAL_URL", "https://archive-api.open-meteo.com/v1/archive"
)
OPEN_METEO_AQI_URL = os.getenv(
    "OPEN_METEO_AQI_URL", "https://air-quality-api.open-meteo.com/v1/air-quality"
)
USE_SYNTHETIC_WEATHER_ONLY = os.getenv("USE_SYNTHETIC_WEATHER_ONLY", "false").lower() == "true"


def resolve_seed_path(filename: str) -> Path:
    current = Path(__file__).resolve()

    for parent in current.parents:
        nested_backend_seed = parent / "backend" / "seed" / filename
        if nested_backend_seed.exists():
            return nested_backend_seed

        direct_backend_seed = parent / "seed" / filename
        if direct_backend_seed.exists():
            return direct_backend_seed

    raise FileNotFoundError(
        f"Could not locate backend seed file '{filename}' from {current}. "
        "Expected either backend/seed/<file> or seed/<file> in an ancestor directory."
    )


@dataclass(frozen=True)
class City:
    id: str
    name: str
    state: str
    city_tier: str
    lat: float
    lng: float


@dataclass(frozen=True)
class Zone:
    id: str
    city_id: str
    city_name: str
    name: str
    lat: float
    lng: float
    avg_lunch_earnings: int
    avg_dinner_earnings: int
    risk_class: str
    city_tier: str


CITY_SEED_PATH = resolve_seed_path("cities.json")
ZONES_SEED_PATH = resolve_seed_path("zones.json")


def load_cities() -> dict[str, City]:
    city_rows = json.loads(CITY_SEED_PATH.read_text())
    return {
        row["id"]: City(
            id=row["id"],
            name=row["name"],
            state=row["state"],
            city_tier=row.get("city_tier", "T1"),
            lat=row["lat"],
            lng=row["lng"],
        )
        for row in city_rows
    }


def load_zones() -> list[Zone]:
    cities = load_cities()
    zone_rows = json.loads(ZONES_SEED_PATH.read_text())
    zones: list[Zone] = []
    for row in zone_rows:
        city_id = row["city_id"]
        city = cities.get(city_id)
        if city is None:
            raise ValueError(f"Zone {row['id']} references unknown city_id {city_id}")
        zones.append(
            Zone(
                id=row["id"],
                city_id=city_id,
                city_name=city.name,
                name=row["name"],
                lat=row["lat"],
                lng=row["lng"],
                avg_lunch_earnings=row["avg_lunch_earnings"],
                avg_dinner_earnings=row["avg_dinner_earnings"],
                risk_class=row["risk_class"],
                city_tier=row.get("city_tier", row.get("tier", city.city_tier)),
            )
        )
    return zones


ZONES = load_zones()
ZONE_ENCODING = {zone.id: index for index, zone in enumerate(ZONES)}
START_DATE = date(2024, 4, 1)
END_DATE = date(2026, 3, 31)


def get_season(week_of_year: int) -> int:
    if 22 <= week_of_year <= 39:
      return 2
    if 9 <= week_of_year <= 21:
      return 1
    if 40 <= week_of_year <= 48:
      return 3
    return 0


def zone_risk_multiplier(zone: Zone) -> float:
    base = {"low": 0.88, "medium": 1.0, "high": 1.16}[zone.risk_class]
    tier_adjustment = {"T1": 0.06, "T2": 0.02, "T3": -0.04}.get(zone.city_tier, 0.0)
    return base + tier_adjustment


def iter_dates(start: date, end: date):
    current = start
    while current <= end:
        yield current
        current += timedelta(days=1)


def build_fallback_history(zone: Zone) -> pd.DataFrame:
    rows = []
    risk = zone_risk_multiplier(zone)

    for current_day in iter_dates(START_DATE, END_DATE):
        week_of_year = current_day.isocalendar()[1]
        season = get_season(week_of_year)
        phase = current_day.timetuple().tm_yday / 365.0 * 2 * math.pi

        base_temp = 30.5 + (7.5 if season == 1 else 0) + (2.0 if season == 2 else 0)
        base_rain = 12.0 if season == 2 else 1.2
        base_aqi = 150 + season * 18 + risk * 30

        for shift_type, shift_bias in (("lunch", 1.0), ("dinner", 1.04)):
            baseline = zone.avg_lunch_earnings if shift_type == "lunch" else zone.avg_dinner_earnings
            apparent_temp = base_temp + math.sin(phase * 1.2) * 2.4 + shift_bias
            precipitation = max(0.0, base_rain + math.sin(phase * 4.0) * 8.5 + risk * 2.5)
            aqi = base_aqi + max(0.0, math.cos(phase * 2.0) * 36) + (18 if shift_type == "dinner" else 0)

            rows.append(
                {
                    "zone_id": zone.id,
                    "date": current_day.isoformat(),
                    "week_start": (current_day - timedelta(days=current_day.weekday())).isoformat(),
                    "shift_type": shift_type,
                    "max_apparent_temp": round(apparent_temp, 2),
                    "mean_apparent_temp": round(apparent_temp - 1.8, 2),
                    "max_precipitation": round(precipitation * (1.15 if shift_type == "dinner" else 1.0), 2),
                    "mean_precipitation": round(precipitation * 0.42, 2),
                    "max_aqi": round(aqi, 2),
                    "mean_aqi": round(aqi - 14, 2),
                    "earnings_baseline": baseline,
                }
            )

    return pd.DataFrame(rows)


async def fetch_history_for_zone(zone: Zone) -> pd.DataFrame:
    if USE_SYNTHETIC_WEATHER_ONLY:
        return build_fallback_history(zone)

    weather_params = {
        "latitude": zone.lat,
        "longitude": zone.lng,
        "start_date": START_DATE.isoformat(),
        "end_date": END_DATE.isoformat(),
        "hourly": "apparent_temperature,precipitation,weather_code",
        "timezone": "Asia/Kolkata",
    }
    aqi_params = {
        "latitude": zone.lat,
        "longitude": zone.lng,
        "start_date": START_DATE.isoformat(),
        "end_date": END_DATE.isoformat(),
        "hourly": "us_aqi,pm2_5,pm10",
        "timezone": "Asia/Kolkata",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            weather_response, aqi_response = await asyncio.gather(
                client.get(OPEN_METEO_HISTORICAL_URL, params=weather_params),
                client.get(OPEN_METEO_AQI_URL, params=aqi_params),
            )
        weather_response.raise_for_status()
        aqi_response.raise_for_status()
    except Exception:
        return build_fallback_history(zone)

    weather_json = weather_response.json()
    aqi_json = aqi_response.json()
    weather_hourly = pd.DataFrame(
        {
            "time": weather_json.get("hourly", {}).get("time", []),
            "apparent_temperature": weather_json.get("hourly", {}).get("apparent_temperature", []),
            "precipitation": weather_json.get("hourly", {}).get("precipitation", []),
        }
    )
    aqi_hourly = pd.DataFrame(
        {
            "time": aqi_json.get("hourly", {}).get("time", []),
            "us_aqi": aqi_json.get("hourly", {}).get("us_aqi", []),
        }
    )

    if weather_hourly.empty or aqi_hourly.empty:
        return build_fallback_history(zone)

    frame = weather_hourly.merge(aqi_hourly, on="time", how="inner")
    frame["time"] = pd.to_datetime(frame["time"])
    frame["date"] = frame["time"].dt.date.astype(str)
    frame["hour"] = frame["time"].dt.hour
    frame["week_start"] = (
        frame["time"].dt.normalize()
        - pd.to_timedelta(frame["time"].dt.weekday, unit="D")
    ).dt.date.astype(str)

    rows = []
    for shift_type, start_hour, end_hour in (("lunch", 11, 15), ("dinner", 18, 23)):
        baseline = zone.avg_lunch_earnings if shift_type == "lunch" else zone.avg_dinner_earnings
        shift_frame = frame[(frame["hour"] >= start_hour) & (frame["hour"] < end_hour)]
        for shift_date, day_frame in shift_frame.groupby("date", dropna=False):
            rows.append(
                {
                    "zone_id": zone.id,
                    "date": shift_date,
                    "week_start": day_frame["week_start"].iloc[0],
                    "shift_type": shift_type,
                    "max_apparent_temp": float(day_frame["apparent_temperature"].max()),
                    "mean_apparent_temp": float(day_frame["apparent_temperature"].mean()),
                    "max_precipitation": float(day_frame["precipitation"].max()),
                    "mean_precipitation": float(day_frame["precipitation"].mean()),
                    "max_aqi": float(day_frame["us_aqi"].max()),
                    "mean_aqi": float(day_frame["us_aqi"].mean()),
                    "earnings_baseline": baseline,
                }
            )

    if not rows:
        return build_fallback_history(zone)

    return pd.DataFrame(rows)


def severity_level(row: pd.Series) -> int:
    if row["max_precipitation"] > 50 or row["max_apparent_temp"] > 47 or row["max_aqi"] > 450:
        return 4
    if row["max_precipitation"] >= 30 or row["max_apparent_temp"] >= 45 or row["max_aqi"] >= 400:
        return 3
    if row["max_precipitation"] >= 20 or row["max_apparent_temp"] >= 43 or row["max_aqi"] >= 350:
        return 2
    return 1


def payout_percent(level: int) -> int:
    return {1: 28, 2: 45, 3: 63, 4: 78}[level]


def build_training_rows(history_frame: pd.DataFrame) -> pd.DataFrame:
    frame = history_frame.copy()
    frame["date"] = pd.to_datetime(frame["date"])
    frame["week_start"] = pd.to_datetime(frame["week_start"])
    frame["zone_encoded"] = frame["zone_id"].map(ZONE_ENCODING)
    frame["week_of_year"] = frame["week_start"].dt.isocalendar().week.astype(int)
    frame["season"] = frame["week_of_year"].apply(get_season)

    frame["eligible"] = (
        (frame["max_precipitation"] >= 15)
        | (frame["max_apparent_temp"] >= 42)
        | (frame["max_aqi"] >= 301)
    )
    frame["severity_level"] = frame.apply(
        lambda row: severity_level(row) if row["eligible"] else 0, axis=1
    )
    frame["payout_percent"] = frame["severity_level"].apply(lambda value: payout_percent(value) if value else 0)
    frame["claim_cost"] = frame["earnings_baseline"] * (frame["payout_percent"] / 100.0)

    weekly = (
        frame.groupby(["zone_id", "week_start", "shift_type"], as_index=False)
        .agg(
            zone_encoded=("zone_encoded", "first"),
            week_of_year=("week_of_year", "first"),
            season=("season", "first"),
            avg_max_temp=("max_apparent_temp", "mean"),
            avg_max_rain=("max_precipitation", "mean"),
            avg_max_aqi=("max_aqi", "mean"),
            trigger_count=("eligible", "sum"),
            earnings_baseline=("earnings_baseline", "first"),
            expected_weekly_claim_cost=("claim_cost", "sum"),
        )
        .sort_values(["zone_id", "shift_type", "week_start"])
    )
    weekly["trigger_freq_4w"] = weekly.groupby(["zone_id", "shift_type"])["trigger_count"].transform(
        lambda series: series.shift(1).rolling(4, min_periods=1).sum().fillna(0)
    )
    weekly["shift_type"] = weekly["shift_type"].map({"lunch": 0, "dinner": 1})
    weekly["expected_weekly_claim_cost"] = weekly["expected_weekly_claim_cost"].round(2)
    return weekly[
        [
            "zone_id",
            "week_start",
            "zone_encoded",
            "week_of_year",
            "season",
            "avg_max_temp",
            "avg_max_rain",
            "avg_max_aqi",
            "trigger_freq_4w",
            "shift_type",
            "earnings_baseline",
            "expected_weekly_claim_cost",
        ]
    ]


async def generate_training_data() -> pd.DataFrame:
    zone_frames = await asyncio.gather(*(fetch_history_for_zone(zone) for zone in ZONES))
    history = pd.concat(zone_frames, ignore_index=True)
    training = build_training_rows(history)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    training.to_csv(OUTPUT_PATH, index=False)
    return training


def main() -> None:
    training = asyncio.run(generate_training_data())
    print(f"Wrote {len(training)} rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
