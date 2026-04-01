const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { getConfig } = require("./config");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

class LocalDataStore {
  constructor(config = getConfig()) {
    this.config = config;
    this.ensureStore();
  }

  ensureStore() {
    const dirPath = path.dirname(this.config.localStorePath);
    fs.mkdirSync(dirPath, { recursive: true });

    if (!fs.existsSync(this.config.localStorePath)) {
      const zones = readJson(this.config.zonesSeedPath);
      const mockRiders = readJson(this.config.ridersSeedPath);
      const riders = mockRiders.map((rider) => ({
        id: rider.id,
        phone: rider.phone,
        name: rider.name,
        platform: rider.platform,
        zone_id: rider.zone_id,
        shifts_covered: rider.shifts_covered,
        payout_preference: rider.payout_preference,
        upi_id: rider.upi_id,
        lunch_baseline: rider.avg_lunch_earnings,
        dinner_baseline: rider.avg_dinner_earnings,
        last_app_active: rider.last_active,
        created_at: rider.created_at
      }));

      const initialState = {
        riders,
        zones,
        trigger_events: [
          {
            id: crypto.randomUUID(),
            zone_id: "koramangala",
            trigger_type: "aqi",
            severity_level: 2,
            payout_percent: 42,
            shift_type: "dinner",
            condition_a_data: {
              max_aqi: 338,
              threshold: 301
            },
            condition_b_data: {
              proxies_confirmed: ["traffic_density_drop", "active_rider_count_drop"]
            },
            detected_at: "2026-03-20T14:30:00Z"
          },
          {
            id: crypto.randomUUID(),
            zone_id: "whitefield",
            trigger_type: "rain",
            severity_level: 3,
            payout_percent: 63,
            shift_type: "lunch",
            condition_a_data: {
              precipitation_mm: 33,
              threshold: 15
            },
            condition_b_data: {
              proxies_confirmed: ["traffic_density_drop", "restaurant_availability_drop", "active_rider_count_drop"]
            },
            detected_at: "2026-03-27T08:00:00Z"
          }
        ],
        policy_quotes: []
      };

      fs.writeFileSync(this.config.localStorePath, JSON.stringify(initialState, null, 2));
    }
  }

  readStore() {
    return readJson(this.config.localStorePath);
  }

  writeStore(store) {
    fs.writeFileSync(this.config.localStorePath, JSON.stringify(store, null, 2));
  }

  async getRiderById(riderId) {
    const store = this.readStore();
    return store.riders.find((rider) => rider.id === riderId) || null;
  }

  async getZoneById(zoneId) {
    const store = this.readStore();
    return store.zones.find((zone) => zone.id === zoneId) || null;
  }

  async countRecentTriggers(zoneId, sinceIso) {
    const store = this.readStore();
    const sinceTs = new Date(sinceIso).getTime();
    return store.trigger_events.filter(
      (event) => event.zone_id === zoneId && new Date(event.detected_at).getTime() > sinceTs
    ).length;
  }

  async hasActiveDisruption(zoneId, sinceIso) {
    const count = await this.countRecentTriggers(zoneId, sinceIso);
    return count > 0;
  }

  async saveQuote(quote) {
    const store = this.readStore();
    const storedQuote = {
      id: crypto.randomUUID(),
      ...quote,
      created_at: new Date().toISOString()
    };

    store.policy_quotes.push(storedQuote);
    this.writeStore(store);
    return storedQuote;
  }
}

class SupabaseDataStore {
  constructor(config = getConfig()) {
    this.config = config;
    this.client = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: {
        persistSession: false
      }
    });
  }

  async getRiderById(riderId) {
    const { data, error } = await this.client.from("riders").select("*").eq("id", riderId).maybeSingle();
    if (error) {
      throw error;
    }
    return data;
  }

  async getZoneById(zoneId) {
    const { data, error } = await this.client.from("zones").select("*").eq("id", zoneId).maybeSingle();
    if (error) {
      throw error;
    }
    return data;
  }

  async countRecentTriggers(zoneId, sinceIso) {
    const { count, error } = await this.client
      .from("trigger_events")
      .select("id", { count: "exact", head: true })
      .eq("zone_id", zoneId)
      .gt("detected_at", sinceIso);
    if (error) {
      throw error;
    }
    return count || 0;
  }

  async hasActiveDisruption(zoneId, sinceIso) {
    const count = await this.countRecentTriggers(zoneId, sinceIso);
    return count > 0;
  }

  async saveQuote(quote) {
    const payload = {
      rider_id: quote.rider_id,
      zone_id: quote.zone_id,
      week_start: quote.week_start,
      shifts_covered: quote.shifts_covered,
      risk_score: quote.risk_score,
      risk_band: quote.risk_band,
      premium: quote.premium,
      payout_cap: quote.payout_cap,
      explanation_json: quote.explanation,
      valid_until: new Date(quote.valid_until).toISOString()
    };

    const { data, error } = await this.client.from("policy_quotes").insert(payload).select("*").single();
    if (error) {
      throw error;
    }
    return data;
  }
}

function createDataStore(config = getConfig()) {
  if (config.supabaseUrl && config.supabaseServiceKey) {
    return new SupabaseDataStore(config);
  }
  return new LocalDataStore(config);
}

module.exports = {
  LocalDataStore,
  SupabaseDataStore,
  createDataStore
};
