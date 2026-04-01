const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { getConfig } = require("./config");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function randomId() {
  return crypto.randomUUID();
}

class LocalDataStore {
  constructor(config = getConfig()) {
    this.config = config;
    this.ensureStore();
  }

  ensureStore() {
    const dirPath = path.dirname(this.config.localStorePath);
    fs.mkdirSync(dirPath, { recursive: true });

    const baseState = this.buildInitialState();

    if (!fs.existsSync(this.config.localStorePath)) {
      fs.writeFileSync(this.config.localStorePath, JSON.stringify(baseState, null, 2));
      return;
    }

    const currentState = this.readStore();
    let changed = false;

    for (const [key, value] of Object.entries(baseState)) {
      if (currentState[key] === undefined) {
        currentState[key] = value;
        changed = true;
      }
    }

    if (changed) {
      this.writeStore(currentState);
    }
  }

  buildInitialState() {
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

    return {
      riders,
      zones,
      mock_platform_riders: mockRiders.map((rider) => ({
        id: rider.platform_rider_id || randomId(),
        phone: rider.phone,
        platform: rider.platform,
        zone_id: rider.zone_id,
        rider_status: "active",
        avg_lunch_earnings: rider.avg_lunch_earnings,
        avg_dinner_earnings: rider.avg_dinner_earnings,
        active_days_per_week: 6,
        last_active: rider.last_active,
        account_age_months: rider.account_age_months || 8
      })),
      trigger_events: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          zone_id: "koramangala",
          trigger_type: "aqi",
          severity_level: 2,
          payout_percent: 42,
          shift_type: "dinner",
          condition_a_data: {
            aqi_value: 338,
            threshold: 301,
            duration_minutes: 90
          },
          condition_b_data: {
            traffic_drop: { confirmed: true, drop_pct: 47 },
            restaurant_drop: { confirmed: true, drop_pct: 38 },
            rider_count_drop: { confirmed: false, drop_pct: 22 }
          },
          detected_at: "2026-03-20T14:30:00Z"
        }
      ],
      policy_quotes: [
        {
          id: "quote-seed-001",
          rider_id: "11111111-1111-4111-8111-111111111111",
          zone_id: "koramangala",
          week_start: "2026-03-30",
          shifts_covered: "both",
          risk_score: 0.52,
          risk_band: "medium",
          premium: 52,
          payout_cap: 5280,
          explanation: {
            top_factors: [
              { factor: "AQI forecast", contribution_pct: 48, detail: "3 evenings predicted AQI above 280" }
            ],
            summary: "Medium risk this week. Elevated AQI evenings."
          },
          valid_until: "2026-03-29T23:59:00+05:30",
          created_at: "2026-03-28T10:00:00Z"
        }
      ],
      weekly_policies: [
        {
          id: "policy-asha-active",
          rider_id: "11111111-1111-4111-8111-111111111111",
          quote_id: "quote-seed-001",
          week_start: "2026-03-30",
          week_end: "2026-04-05",
          shifts_covered: "both",
          premium_paid: 52,
          payout_cap: 5280,
          status: "active",
          created_at: "2026-03-28T14:00:00Z"
        }
      ],
      wallets: [
        {
          id: "wallet-asha",
          rider_id: "11111111-1111-4111-8111-111111111111",
          balance: 356,
          updated_at: "2026-03-31T20:16:00Z"
        },
        {
          id: "wallet-rohan",
          rider_id: "22222222-2222-4222-8222-222222222222",
          balance: 50,
          updated_at: "2026-03-30T10:00:00Z"
        }
      ],
      wallet_transactions: [
        {
          id: "txn-seed-1",
          wallet_id: "wallet-asha",
          type: "credit_topup",
          amount: 500,
          reference_type: "wallet",
          reference_id: null,
          description: "Manual top-up (demo)",
          created_at: "2026-03-25T09:00:00Z"
        },
        {
          id: "txn-seed-2",
          wallet_id: "wallet-asha",
          type: "debit_premium",
          amount: -52,
          reference_type: "policy",
          reference_id: "policy-asha-active",
          description: "Weekly premium — Mar 30 to Apr 5",
          created_at: "2026-03-28T14:00:00Z"
        }
      ],
      claims: []
    };
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

  async listActivePoliciesByZoneAndShift(zoneId, shiftType, claimDate) {
    const store = this.readStore();
    return store.weekly_policies
      .filter((policy) => {
        const coversShift = policy.shifts_covered === "both" || policy.shifts_covered === shiftType;
        return (
          policy.status === "active" &&
          coversShift &&
          policy.week_start <= claimDate &&
          policy.week_end >= claimDate
        );
      })
      .map((policy) => ({
        ...policy,
        rider: store.riders.find((rider) => rider.id === policy.rider_id) || null
      }))
      .filter((policy) => policy.rider && policy.rider.zone_id === zoneId);
  }

  async getClaimByUnique(policyId, shiftType, claimDate) {
    const store = this.readStore();
    return (
      store.claims.find(
        (claim) =>
          claim.policy_id === policyId && claim.shift_type === shiftType && claim.claim_date === claimDate
      ) || null
    );
  }

  async createClaim(claim) {
    const store = this.readStore();
    const createdClaim = {
      id: claim.id || randomId(),
      ...claim,
      created_at: claim.created_at || new Date().toISOString()
    };
    store.claims.push(createdClaim);
    this.writeStore(store);
    return createdClaim;
  }

  async deleteClaimById(claimId) {
    const store = this.readStore();
    store.claims = store.claims.filter((claim) => claim.id !== claimId);
    this.writeStore(store);
  }

  async createTriggerEvent(triggerEvent) {
    const store = this.readStore();
    const createdTrigger = {
      id: triggerEvent.id || randomId(),
      ...triggerEvent,
      detected_at: triggerEvent.detected_at || new Date().toISOString()
    };
    store.trigger_events.push(createdTrigger);
    this.writeStore(store);
    return createdTrigger;
  }

  async getTriggerEventById(triggerEventId) {
    const store = this.readStore();
    return store.trigger_events.find((trigger) => trigger.id === triggerEventId) || null;
  }

  async getWalletByRiderId(riderId) {
    const store = this.readStore();
    return store.wallets.find((wallet) => wallet.rider_id === riderId) || null;
  }

  async getWalletById(walletId) {
    const store = this.readStore();
    return store.wallets.find((wallet) => wallet.id === walletId) || null;
  }

  async applyWalletTransaction({ walletId, delta, type, referenceType, referenceId, description }) {
    const store = this.readStore();
    const wallet = store.wallets.find((item) => item.id === walletId);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    const nextBalance = wallet.balance + delta;
    if (nextBalance < 0) {
      const error = new Error("Insufficient wallet balance");
      error.code = "insufficient_balance";
      throw error;
    }

    wallet.balance = nextBalance;
    wallet.updated_at = new Date().toISOString();

    const transaction = {
      id: randomId(),
      wallet_id: walletId,
      type,
      amount: delta,
      reference_type: referenceType || null,
      reference_id: referenceId || null,
      description,
      created_at: new Date().toISOString()
    };
    store.wallet_transactions.push(transaction);
    this.writeStore(store);

    return {
      wallet: { ...wallet },
      transaction
    };
  }

  async listWalletTransactionsByWalletId(walletId) {
    const store = this.readStore();
    return store.wallet_transactions
      .filter((transaction) => transaction.wallet_id === walletId)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  }

  async getMockPlatformRiderByPhone(phone) {
    const store = this.readStore();
    return store.mock_platform_riders.find((rider) => rider.phone === phone) || null;
  }

  async listClaimsByRiderId(riderId) {
    const store = this.readStore();
    return store.claims
      .filter((claim) => claim.rider_id === riderId)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .map((claim) => ({
        ...claim,
        trigger_event: store.trigger_events.find((trigger) => trigger.id === claim.trigger_event_id) || null,
        policy: store.weekly_policies.find((policy) => policy.id === claim.policy_id) || null
      }));
  }

  async getClaimByIdForRider(claimId, riderId) {
    const claims = await this.listClaimsByRiderId(riderId);
    return claims.find((claim) => claim.id === claimId) || null;
  }

  async sumPremiumsPaidForRider(riderId) {
    const store = this.readStore();
    return store.weekly_policies
      .filter((policy) => policy.rider_id === riderId)
      .reduce((sum, policy) => sum + policy.premium_paid, 0);
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

  async listActivePoliciesByZoneAndShift(zoneId, shiftType, claimDate) {
    const { data, error } = await this.client
      .from("weekly_policies")
      .select("*, riders(*)")
      .eq("status", "active")
      .lte("week_start", claimDate)
      .gte("week_end", claimDate);
    if (error) {
      throw error;
    }

    return (data || [])
      .filter((policy) => {
        const coversShift = policy.shifts_covered === "both" || policy.shifts_covered === shiftType;
        return coversShift && policy.riders && policy.riders.zone_id === zoneId;
      })
      .map((policy) => ({
        ...policy,
        rider: policy.riders
      }));
  }

  async getClaimByUnique(policyId, shiftType, claimDate) {
    const { data, error } = await this.client
      .from("claims")
      .select("*")
      .eq("policy_id", policyId)
      .eq("shift_type", shiftType)
      .eq("claim_date", claimDate)
      .maybeSingle();
    if (error) {
      throw error;
    }
    return data;
  }

  async createClaim(claim) {
    const { data, error } = await this.client.from("claims").insert(claim).select("*").single();
    if (error) {
      throw error;
    }
    return data;
  }

  async deleteClaimById(claimId) {
    const { error } = await this.client.from("claims").delete().eq("id", claimId);
    if (error) {
      throw error;
    }
  }

  async createTriggerEvent(triggerEvent) {
    const { data, error } = await this.client
      .from("trigger_events")
      .insert(triggerEvent)
      .select("*")
      .single();
    if (error) {
      throw error;
    }
    return data;
  }

  async getTriggerEventById(triggerEventId) {
    const { data, error } = await this.client
      .from("trigger_events")
      .select("*")
      .eq("id", triggerEventId)
      .maybeSingle();
    if (error) {
      throw error;
    }
    return data;
  }

  async getWalletByRiderId(riderId) {
    const { data, error } = await this.client.from("wallets").select("*").eq("rider_id", riderId).maybeSingle();
    if (error) {
      throw error;
    }
    return data;
  }

  async getWalletById(walletId) {
    const { data, error } = await this.client.from("wallets").select("*").eq("id", walletId).maybeSingle();
    if (error) {
      throw error;
    }
    return data;
  }

  async applyWalletTransaction({ walletId, delta, type, referenceType, referenceId, description }) {
    const wallet = await this.getWalletById(walletId);
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    const nextBalance = wallet.balance + delta;
    if (nextBalance < 0) {
      const error = new Error("Insufficient wallet balance");
      error.code = "insufficient_balance";
      throw error;
    }

    const { data: updatedWallet, error: walletError } = await this.client
      .from("wallets")
      .update({ balance: nextBalance, updated_at: new Date().toISOString() })
      .eq("id", walletId)
      .select("*")
      .single();
    if (walletError) {
      throw walletError;
    }

    const { data: transaction, error: transactionError } = await this.client
      .from("wallet_transactions")
      .insert({
        wallet_id: walletId,
        type,
        amount: delta,
        reference_type: referenceType || null,
        reference_id: referenceId || null,
        description
      })
      .select("*")
      .single();
    if (transactionError) {
      throw transactionError;
    }

    return {
      wallet: updatedWallet,
      transaction
    };
  }

  async listWalletTransactionsByWalletId(walletId) {
    const { data, error } = await this.client
      .from("wallet_transactions")
      .select("*")
      .eq("wallet_id", walletId)
      .order("created_at", { ascending: false });
    if (error) {
      throw error;
    }
    return data || [];
  }

  async getMockPlatformRiderByPhone(phone) {
    const { data, error } = await this.client
      .from("mock_platform_riders")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();
    if (error) {
      throw error;
    }
    return data;
  }

  async listClaimsByRiderId(riderId) {
    const { data, error } = await this.client
      .from("claims")
      .select("*, trigger_events(*), weekly_policies(*)")
      .eq("rider_id", riderId)
      .order("created_at", { ascending: false });
    if (error) {
      throw error;
    }
    return (data || []).map((claim) => ({
      ...claim,
      trigger_event: claim.trigger_events,
      policy: claim.weekly_policies
    }));
  }

  async getClaimByIdForRider(claimId, riderId) {
    const { data, error } = await this.client
      .from("claims")
      .select("*, trigger_events(*), weekly_policies(*)")
      .eq("id", claimId)
      .eq("rider_id", riderId)
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      return null;
    }
    return {
      ...data,
      trigger_event: data.trigger_events,
      policy: data.weekly_policies
    };
  }

  async sumPremiumsPaidForRider(riderId) {
    const { data, error } = await this.client.from("weekly_policies").select("premium_paid").eq("rider_id", riderId);
    if (error) {
      throw error;
    }
    return (data || []).reduce((sum, policy) => sum + policy.premium_paid, 0);
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
