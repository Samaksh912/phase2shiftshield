const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { getConfig } = require("../utils/config");
const { normalizePhone, isNormalizedPhone } = require("../utils/phone");

const DEMO_LOGIN_OTP = "9324";
const TOKEN_EXPIRES_IN = "7d";
const TOKEN_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60;
const VALID_PLATFORMS = new Set(["swiggy", "zomato"]);
const VALID_SHIFTS = new Set(["lunch", "dinner", "both"]);
const VALID_PAYOUT_PREFERENCES = new Set(["wallet", "upi"]);

function buildError(message, { statusCode = 400, code = "validation_error" } = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
function isValidUpiId(upiId) {
  return typeof upiId === "string" && /^[A-Za-z0-9._-]{2,}@[A-Za-z]{2,}$/.test(upiId.trim());
}

function buildPhoneCandidates(rawPhone, normalizedPhone) {
  const values = new Set();
  const raw = typeof rawPhone === "string" ? rawPhone.trim() : "";

  if (raw) {
    values.add(raw);
  }
  if (normalizedPhone) {
    values.add(normalizedPhone);
  }
  if (normalizedPhone.startsWith("+91") && normalizedPhone.length === 13) {
    values.add(normalizedPhone.slice(3));
  }

  return Array.from(values);
}

function buildSessionPayload(token, rider, zone, platformRider, authType) {
  return {
    token,
    rider: {
      id: rider.id,
      name: rider.name,
      phone: rider.phone,
      platform: rider.platform,
      city_id: zone.city_id,
      zone_id: rider.zone_id,
      shifts_covered: rider.shifts_covered,
      payout_preference: rider.payout_preference,
      active_days_last_30: platformRider.active_days_last_30
    },
    session: {
      auth_type: authType,
      expires_in: TOKEN_EXPIRES_IN_SECONDS
    }
  };
}

class AuthService {
  constructor({ dataStore, verificationService }) {
    this.dataStore = dataStore;
    this.verificationService = verificationService;
    this.config = getConfig();
  }

  signToken(rider) {
    return jwt.sign(
      {
        rider_id: rider.id,
        phone: rider.phone
      },
      this.config.jwtSecret,
      { expiresIn: TOKEN_EXPIRES_IN }
    );
  }

  async validateGeography(cityId, zoneId) {
    const [city, zone] = await Promise.all([
      this.dataStore.getCityById(cityId),
      this.dataStore.getZoneById(zoneId)
    ]);

    if (!city) {
      throw buildError("city_id is invalid");
    }

    if (!zone) {
      throw buildError("zone_id is invalid");
    }

    if (zone.city_id !== city.id) {
      throw buildError("zone_id does not belong to city_id");
    }

    return { city, zone };
  }

  async findRiderByPhone(rawPhone, normalizedPhone) {
    const candidates = buildPhoneCandidates(rawPhone, normalizedPhone);
    for (const candidate of candidates) {
      const rider = await this.dataStore.getRiderByPhone(candidate);
      if (rider) {
        return rider;
      }
    }
    return null;
  }

  async requestOtp({ phone, purpose }) {
    const rawPhone = typeof phone === "string" ? phone.trim() : "";
    const normalizedPhone = normalizePhone(phone);

    if (!isNormalizedPhone(normalizedPhone)) {
      throw buildError("phone must be a valid Indian mobile number or E.164 phone number");
    }

    const verification = await this.verificationService.requestOtp(normalizedPhone);

    return {
      ...verification,
      phone: normalizedPhone
    };
  }

  async signup(payload) {
    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    const rawPhone = typeof payload?.phone === "string" ? payload.phone.trim() : "";
    const normalizedPhone = normalizePhone(payload?.phone);
    const platform = typeof payload?.platform === "string" ? payload.platform.trim().toLowerCase() : "";
    const cityId = typeof payload?.city_id === "string" ? payload.city_id.trim() : "";
    const zoneId = typeof payload?.zone_id === "string" ? payload.zone_id.trim() : "";
    const shiftsCovered =
      typeof payload?.shifts_covered === "string" ? payload.shifts_covered.trim().toLowerCase() : "";
    const payoutPreference =
      typeof payload?.payout_preference === "string" ? payload.payout_preference.trim().toLowerCase() : "";
    const upiId = typeof payload?.upi_id === "string" && payload.upi_id.trim() ? payload.upi_id.trim() : null;
    const otp = typeof payload?.otp === "string" ? payload.otp.trim() : "";

    if (!name || !normalizedPhone || !platform || !cityId || !zoneId || !shiftsCovered || !payoutPreference || !otp) {
      throw buildError("Missing required signup fields");
    }

    if (!isNormalizedPhone(normalizedPhone)) {
      throw buildError("phone must be a valid Indian mobile number or E.164 phone number");
    }

    if (!VALID_PLATFORMS.has(platform)) {
      throw buildError("platform must be swiggy or zomato");
    }

    if (!VALID_SHIFTS.has(shiftsCovered)) {
      throw buildError("shifts_covered must be lunch, dinner, or both");
    }

    if (!VALID_PAYOUT_PREFERENCES.has(payoutPreference)) {
      throw buildError("payout_preference must be wallet or upi");
    }

    if (payoutPreference === "upi" && !isValidUpiId(upiId)) {
      throw buildError("upi_id is required when payout_preference is upi");
    }

    try {
      await this.verificationService.verifyOtp(normalizedPhone, otp);
    } catch (error) {
      if (error.code === "invalid_otp") {
        throw buildError("Invalid otp", {
          statusCode: 401,
          code: "invalid_signup_otp"
        });
      }
      throw error;
    }

    const existingRider = await this.findRiderByPhone(rawPhone, normalizedPhone);
    if (existingRider) {
      throw buildError("A rider is already registered with this phone", {
        statusCode: 409,
        code: "duplicate_registration"
      });
    }

    const { zone } = await this.validateGeography(cityId, zoneId);
    const timestamp = new Date().toISOString();
    const storedPhone = /^\d{10}$/.test(rawPhone) ? rawPhone : normalizedPhone;

    const rider = await this.dataStore.createRider({
      id: crypto.randomUUID(),
      phone: storedPhone,
      name,
      platform,
      zone_id: zone.id,
      shifts_covered: shiftsCovered,
      payout_preference: payoutPreference,
      upi_id: upiId,
      lunch_baseline: zone.avg_lunch_earnings,
      dinner_baseline: zone.avg_dinner_earnings,
      last_app_active: timestamp,
      created_at: timestamp
    });

    const platformRider = await this.dataStore.createMockPlatformRider({
      id: crypto.randomUUID(),
      phone: storedPhone,
      platform,
      zone_id: zone.id,
      rider_status: "active",
      avg_lunch_earnings: zone.avg_lunch_earnings,
      avg_dinner_earnings: zone.avg_dinner_earnings,
      active_days_per_week: 2,
      active_days_last_30: 8,
      last_active: timestamp,
      account_age_months: 6
    });

    if (payoutPreference === "wallet") {
      await this.dataStore.createWallet({
        id: `wallet-${rider.id}`,
        rider_id: rider.id,
        balance: 0,
        updated_at: timestamp
      });
    }

    const token = this.signToken(rider);
    return buildSessionPayload(token, rider, zone, platformRider, "twilio_verify");
  }

  async login({ phone, otp }) {
    const rawPhone = typeof phone === "string" ? phone.trim() : "";
    const normalizedPhone = normalizePhone(phone);

    if (!isNormalizedPhone(normalizedPhone) || typeof otp !== "string" || !otp.trim()) {
      throw buildError("Invalid phone or otp", {
        statusCode: 401,
        code: "invalid_login"
      });
    }

    const rider = await this.findRiderByPhone(rawPhone, normalizedPhone);
    if (!rider) {
      throw buildError("Rider not found for this phone", {
        statusCode: 404,
        code: "not_found"
      });
    }

    if (otp.trim() !== DEMO_LOGIN_OTP) {
      throw buildError("Invalid phone or otp", {
        statusCode: 401,
        code: "invalid_login"
      });
    }

    const [zone, platformRider] = await Promise.all([
      this.dataStore.getZoneById(rider.zone_id),
      this.dataStore.getMockPlatformRiderByPhone(rider.phone)
    ]);

    if (!zone || !platformRider) {
      throw buildError("Rider profile is incomplete", {
        statusCode: 500,
        code: "server_error"
      });
    }

    const token = this.signToken(rider);
    return buildSessionPayload(token, rider, zone, platformRider, "demo_login");
  }

  async getSessionProfile({ riderId, phone }) {
    const rider = await this.dataStore.getRiderById(riderId);
    if (!rider || rider.phone !== phone) {
      throw buildError("Authenticated rider not found", {
        statusCode: 404,
        code: "not_found"
      });
    }

    const [zone, city] = await Promise.all([
      this.dataStore.getZoneById(rider.zone_id),
      this.dataStore.getZoneById(rider.zone_id).then((currentZone) =>
        currentZone ? this.dataStore.getCityById(currentZone.city_id) : null
      )
    ]);
    const platformRider = await this.dataStore.getMockPlatformRiderByPhone(rider.phone);

    if (!zone || !city || !platformRider) {
      throw buildError("Authenticated rider profile is incomplete", {
        statusCode: 500,
        code: "server_error"
      });
    }

    return {
      rider: {
        id: rider.id,
        name: rider.name,
        phone: rider.phone,
        platform: rider.platform,
        city_id: city.id,
        zone_id: rider.zone_id,
        shifts_covered: rider.shifts_covered,
        payout_preference: rider.payout_preference,
        active_days_last_30: platformRider.active_days_last_30
      },
      city: {
        id: city.id,
        name: city.name,
        state: city.state,
        city_tier: city.city_tier
      },
      zone: {
        id: zone.id,
        name: zone.name,
        city_id: zone.city_id,
        city_tier: zone.city_tier || zone.tier || city.city_tier,
        risk_class: zone.risk_class
      }
    };
  }
}

module.exports = {
  AuthService
};
