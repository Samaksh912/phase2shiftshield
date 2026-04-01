import json
from pathlib import Path

import joblib
import pandas as pd
import xgboost as xgb
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split

from data.generate_synthetic import OUTPUT_PATH, generate_training_data


ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = ROOT / "model" / "premium_model.joblib"
METADATA_PATH = ROOT / "model" / "feature_importance.json"

FEATURE_COLUMNS = [
    "zone_encoded",
    "week_of_year",
    "season",
    "avg_max_temp",
    "avg_max_rain",
    "avg_max_aqi",
    "trigger_freq_4w",
    "shift_type",
    "earnings_baseline"
]


async def train_model() -> dict:
    if not OUTPUT_PATH.exists():
        await generate_training_data()

    frame = pd.read_csv(OUTPUT_PATH)
    X = frame[FEATURE_COLUMNS]
    y = frame["expected_weekly_claim_cost"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    model = xgb.XGBRegressor(
        n_estimators=180,
        max_depth=5,
        learning_rate=0.08,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
    )
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    mae = float(mean_absolute_error(y_test, predictions))

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)

    importance = dict(zip(FEATURE_COLUMNS, model.feature_importances_.tolist()))
    METADATA_PATH.write_text(json.dumps({"mae": mae, "feature_importance": importance}, indent=2))
    return {"mae": mae, "rows": len(frame)}


def main() -> None:
    import asyncio

    result = asyncio.run(train_model())
    print(f"Model saved to {MODEL_PATH} with MAE={result['mae']:.2f} on {result['rows']} rows")


if __name__ == "__main__":
    main()
