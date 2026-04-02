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
        self.assertGreaterEqual(prediction["premium"], 20)
        self.assertLessEqual(prediction["premium"], 50)
        self.assertTrue(prediction["explanation"]["top_factors"])

    async def test_recalibrated_premium_range_for_representative_supported_cases(self) -> None:
        representative_requests = [
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
            ),
            PremiumRequest(
                zone_id="whitefield",
                week_start="2026-04-06",
                shift_type="dinner",
                earnings_baseline_lunch=350,
                earnings_baseline_dinner=580,
                recent_trigger_count=2,
                forecast_override={
                    "avg_max_temp": 41.5,
                    "avg_max_rain": 10.0,
                    "avg_max_aqi": 295.0,
                    "daily": {
                        "apparent_temperature_max": [39, 40, 41, 42, 42, 41, 40],
                        "precipitation_sum": [2, 6, 12, 17, 14, 8, 3],
                        "daily_max_aqi": [220, 248, 286, 301, 294, 252, 236],
                    },
                },
            ),
            PremiumRequest(
                zone_id="bhubaneswar_patrapada",
                week_start="2026-04-06",
                shift_type="lunch",
                earnings_baseline_lunch=260,
                earnings_baseline_dinner=430,
                recent_trigger_count=0,
                forecast_override={
                    "avg_max_temp": 35.2,
                    "avg_max_rain": 5.5,
                    "avg_max_aqi": 170.0,
                    "daily": {
                        "apparent_temperature_max": [34, 35, 35, 36, 36, 35, 34],
                        "precipitation_sum": [0, 1, 4, 7, 5, 2, 1],
                        "daily_max_aqi": [145, 158, 171, 182, 176, 168, 159],
                    },
                },
            ),
        ]

        observed_premiums = []
        for request in representative_requests:
            prediction = await premium_predict(request)
            self.assertGreaterEqual(prediction["premium"], 20)
            self.assertLessEqual(prediction["premium"], 50)
            observed_premiums.append(prediction["premium"])

        self.assertEqual(observed_premiums, [20, 44, 20])


if __name__ == "__main__":
    unittest.main()
