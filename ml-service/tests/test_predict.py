import unittest

from main import PremiumRequest, app, health, premium_predict, startup_event
from model.predict import ZONES


def make_request(
    zone_id: str,
    *,
    shift_type: str = "both",
    earnings_baseline_lunch: int = 420,
    earnings_baseline_dinner: int = 680,
    recent_trigger_count: int = 1,
    forecast_override=None,
) -> PremiumRequest:
    default_forecast = {
        "avg_max_temp": 40.1,
        "avg_max_rain": 8.0,
        "avg_max_aqi": 242.0,
        "daily": {
            "apparent_temperature_max": [38, 39, 40, 41, 41, 40, 39],
            "precipitation_sum": [0, 4, 10, 16, 11, 5, 2],
            "daily_max_aqi": [188, 214, 261, 284, 272, 236, 218],
        },
    }
    return PremiumRequest(
        zone_id=zone_id,
        week_start="2026-04-06",
        shift_type=shift_type,
        earnings_baseline_lunch=earnings_baseline_lunch,
        earnings_baseline_dinner=earnings_baseline_dinner,
        recent_trigger_count=recent_trigger_count,
        forecast_override=forecast_override or default_forecast,
    )


class PremiumPredictTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        await startup_event()

    async def test_health_and_prediction(self) -> None:
        health_payload = await health()
        self.assertEqual(health_payload["status"], "ok")
        self.assertEqual(health_payload["service"], "ml")
        self.assertTrue(app.state.model_loaded)

        prediction = await premium_predict(make_request("koramangala"))

        self.assertIsInstance(prediction["risk_score"], float)
        self.assertIn(prediction["risk_band"], {"low", "medium", "high"})
        self.assertGreaterEqual(prediction["premium"], 20)
        self.assertLessEqual(prediction["premium"], 50)
        self.assertTrue(prediction["explanation"]["top_factors"])

    async def test_tiered_premium_range_for_representative_supported_cases(self) -> None:
        representative_requests = [
            make_request("koramangala"),
            make_request(
                "whitefield",
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
            make_request(
                "bhubaneswar_patrapada",
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

        self.assertEqual(observed_premiums, [30, 45, 21])
        self.assertGreater(observed_premiums[0], observed_premiums[2])
        self.assertGreater(observed_premiums[1], observed_premiums[0])

    async def test_city_tier_differentiation_affects_premium_under_similar_conditions(self) -> None:
        shared_forecast = {
            "avg_max_temp": 38.5,
            "avg_max_rain": 6.5,
            "avg_max_aqi": 220.0,
            "daily": {
                "apparent_temperature_max": [37, 38, 39, 40, 39, 38, 37],
                "precipitation_sum": [0, 2, 6, 9, 7, 3, 1],
                "daily_max_aqi": [190, 205, 221, 234, 228, 214, 201],
            },
        }
        t1_medium = await premium_predict(
            make_request(
                "koramangala",
                shift_type="dinner",
                earnings_baseline_lunch=320,
                earnings_baseline_dinner=520,
                recent_trigger_count=1,
                forecast_override=shared_forecast,
            )
        )
        t2_medium = await premium_predict(
            make_request(
                "lucknow_gomti_nagar",
                shift_type="dinner",
                earnings_baseline_lunch=320,
                earnings_baseline_dinner=520,
                recent_trigger_count=1,
                forecast_override=shared_forecast,
            )
        )
        t3_low = await premium_predict(
            make_request(
                "bhubaneswar_patrapada",
                shift_type="dinner",
                earnings_baseline_lunch=320,
                earnings_baseline_dinner=520,
                recent_trigger_count=1,
                forecast_override=shared_forecast,
            )
        )

        self.assertGreater(t1_medium["premium"], t2_medium["premium"])
        self.assertGreater(t2_medium["premium"], t3_low["premium"])

    async def test_zone_risk_differentiation_affects_premium_within_same_city_tier(self) -> None:
        shared_forecast = {
            "avg_max_temp": 38.5,
            "avg_max_rain": 6.5,
            "avg_max_aqi": 220.0,
            "daily": {
                "apparent_temperature_max": [37, 38, 39, 40, 39, 38, 37],
                "precipitation_sum": [0, 2, 6, 9, 7, 3, 1],
                "daily_max_aqi": [190, 205, 221, 234, 228, 214, 201],
            },
        }
        high_risk_t1 = await premium_predict(
            make_request(
                "whitefield",
                shift_type="dinner",
                earnings_baseline_lunch=320,
                earnings_baseline_dinner=520,
                recent_trigger_count=1,
                forecast_override=shared_forecast,
            )
        )
        low_risk_t1 = await premium_predict(
            make_request(
                "indiranagar",
                shift_type="dinner",
                earnings_baseline_lunch=320,
                earnings_baseline_dinner=520,
                recent_trigger_count=1,
                forecast_override=shared_forecast,
            )
        )

        self.assertGreater(high_risk_t1["premium"], low_risk_t1["premium"])

    async def test_loaded_zones_have_valid_city_hierarchy_metadata(self) -> None:
        self.assertGreaterEqual(len(ZONES), 10)
        self.assertTrue(all(zone.city_id for zone in ZONES.values()))
        self.assertTrue(all(zone.city_name for zone in ZONES.values()))
        self.assertEqual(sum(1 for zone in ZONES.values() if zone.city_id == "bengaluru"), 5)


if __name__ == "__main__":
    unittest.main()
