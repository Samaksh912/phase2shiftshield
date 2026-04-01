import unittest

from main import PremiumRequest, app, health, premium_predict, startup_event


class PremiumPredictTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        await startup_event()

    async def test_health_and_prediction(self) -> None:
        health_payload = await health()
        self.assertEqual(health_payload["status"], "ok")
        self.assertEqual(health_payload["service"], "ml")
        self.assertTrue(app.state.model_loaded)

        prediction = await premium_predict(
          PremiumRequest(
                zone_id="koramangala",
                week_start="2026-04-06",
                shift_type="both",
                earnings_baseline_lunch=420,
                earnings_baseline_dinner=680,
                recent_trigger_count=1,
                forecast_override={
                    "avg_max_temp": 40.1,
                    "avg_max_rain": 8.0,
                    "avg_max_aqi": 242.0,
                    "daily": {
                        "apparent_temperature_max": [38, 39, 40, 41, 41, 40, 39],
                        "precipitation_sum": [0, 4, 10, 16, 11, 5, 2],
                        "daily_max_aqi": [188, 214, 261, 284, 272, 236, 218],
                    },
                },
            )
        )

        self.assertIsInstance(prediction["risk_score"], float)
        self.assertIn(prediction["risk_band"], {"low", "medium", "high"})
        self.assertGreaterEqual(prediction["premium"], 15)
        self.assertTrue(prediction["explanation"]["top_factors"])


if __name__ == "__main__":
    unittest.main()
