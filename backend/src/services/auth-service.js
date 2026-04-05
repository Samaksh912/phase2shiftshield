const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { getConfig } = require("../utils/config");
const { normalizePhone, isNormalizedPhone } = require("../utils/phone");

const DEMO_LOGIN_OTP_BY_PHONE = {
  "9876543210": "9324",
  "9123456780": "2841",
  "9988776655": "6157",
  "9345678123": "4408",
  "9451203344": "7712"
};
const DEMO_SIGNUP_OTP_BY_PHONE = {
  "9012345678": "1201",
  "9012345679": "1202",
  "9012345680": "1203",
  "9012345681": "1204",
  "9012345682": "1205"
};
const TOKEN_EXPIRES_IN = "7d";
const TOKEN_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60;
const OTP_VERIFICATION_EXPIRES_IN = "10m";
const OTP_VERIFICATION_EXPIRES_IN_SECONDS = 10 * 60;
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

function getDemoLoginOtp(rawPhone, normalizedPhone) {
  const candidates = buildPhoneCandidates(rawPhone, normalizedPhone);
  for (const candidate of candidates) {
    if (DEMO_LOGIN_OTP_BY_PHONE[candidate]) {
      return DEMO_LOGIN_OTP_BY_PHONE[candidate];
    }
  }
  return null;
}

function getDemoSignupOtp(rawPhone, normalizedPhone) {
  const candidates = buildPhoneCandidates(rawPhone, normalizedPhone);
  for (const candidate of candidates) {
    if (DEMO_SIGNUP_OTP_BY_PHONE[candidate]) {
      return DEMO_SIGNUP_OTP_BY_PHONE[candidate];
    }
  }
  return null;
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

  signVerificationToken(normalizedPhone, purpose) {
    return jwt.sign(
      {
        phone: normalizedPhone,
        otp_purpose: purpose,
        token_type: "otp_verification"
      },
      this.config.jwtSecret,
      { expiresIn: OTP_VERIFICATION_EXPIRES_IN }
    );
  }

  verifyVerificationToken(token, expectedPhone, expectedPurpose) {
    if (typeof token !== "string" || !token.trim()) {
      throw buildError("verification_token is required", {
        statusCode: 401,
        code: "invalid_verification_token"
      });
    }

    let payload;
    try {
      payload = jwt.verify(token.trim(), this.config.jwtSecret);
    } catch (_error) {
      throw buildError("Invalid verification token", {
        statusCode: 401,
        code: "invalid_verification_token"
      });
    }

    if (
      payload?.token_type !== "otp_verification" ||
      payload?.otp_purpose !== expectedPurpose ||
      payload?.phone !== expectedPhone
    ) {
      throw buildError("Invalid verification token", {
        statusCode: 401,
        code: "invalid_verification_token"
      });
    }

    return payload;
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

  async requestSignupOtp({ phone }) {
    const rawPhone = typeof phone === "string" ? phone.trim() : "";
    const normalizedPhone = normalizePhone(phone);

    if (!isNormalizedPhone(normalizedPhone)) {
      throw buildError("phone must be a valid Indian mobile number or E.164 phone number");
    }

    if (!getDemoSignupOtp(rawPhone, normalizedPhone)) {
      throw buildError("No demo signup OTP is configured for this phone", {
        statusCode: 400,
        code: "demo_signup_unavailable"
      });
    }

    return {
      otp_sent: true,
      auth_type: "demo_signup",
      message: "Demo signup OTP requested successfully",
      phone: normalizedPhone
    };
  }

  async verifySignupOtp({ phone, otp }) {
    const rawPhone = typeof phone === "string" ? phone.trim() : "";
    const normalizedPhone = normalizePhone(phone);
    const code = typeof otp === "string" ? otp.trim() : "";

    if (!isNormalizedPhone(normalizedPhone) || !code) {
      throw buildError("Invalid phone or otp", {
        statusCode: 401,
        code: "invalid_signup_otp"
      });
    }

    const expectedOtp = getDemoSignupOtp(rawPhone, normalizedPhone);
    if (!expectedOtp || code !== expectedOtp) {
      throw buildError("Invalid otp", {
        statusCode: 401,
        code: "invalid_signup_otp"
      });
    }

    return {
      verified: true,
      auth_type: "demo_signup",
      phone: normalizedPhone,
      verification_token: this.signVerificationToken(normalizedPhone, "signup"),
      expires_in: OTP_VERIFICATION_EXPIRES_IN_SECONDS
    };
  }

  async requestLoginOtp({ phone }) {
    const rawPhone = typeof phone === "string" ? phone.trim() : "";
    const normalizedPhone = normalizePhone(phone);

    if (!isNormalizedPhone(normalizedPhone)) {
      throw buildError("phone must be a valid Indian mobile number or E.164 phone number");
    }

    const rider = await this.findRiderByPhone(rawPhone, normalizedPhone);
    if (!rider) {
      throw buildError("Rider not found for this phone", {
        statusCode: 404,
        code: "not_found"
      });
    }

    if (!getDemoLoginOtp(rawPhone, normalizedPhone)) {
      throw buildError("No demo login OTP is configured for this rider", {
        statusCode: 400,
        code: "demo_login_unavailable"
      });
    }

    return {
      otp_sent: true,
      auth_type: "demo_login",
      phone: normalizedPhone,
      message: "Demo login OTP requested successfully"
    };
  }

  async verifyLoginOtp({ phone, otp }) {
    const rawPhone = typeof phone === "string" ? phone.trim() : "";
    const normalizedPhone = normalizePhone(phone);
    const code = typeof otp === "string" ? otp.trim() : "";

    if (!isNormalizedPhone(normalizedPhone) || !code) {
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

    const expectedOtp = getDemoLoginOtp(rawPhone, normalizedPhone);
    if (!expectedOtp || code !== expectedOtp) {
      throw buildError("Invalid phone or otp", {
        statusCode: 401,
        code: "invalid_login"
      });
    }

    return {
      verified: true,
      auth_type: "demo_login",
      phone: normalizedPhone,
      verification_token: this.signVerificationToken(normalizedPhone, "login"),
      expires_in: OTP_VERIFICATION_EXPIRES_IN_SECONDS
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
    const verificationToken =
      typeof payload?.verification_token === "string" ? payload.verification_token.trim() : "";

    if (
      !name ||
      !normalizedPhone ||
      !platform ||
      !cityId ||
      !zoneId ||
      !shiftsCovered ||
      !payoutPreference ||
      (!otp && !verificationToken)
    ) {
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

    const existingRider = await this.findRiderByPhone(rawPhone, normalizedPhone);
    if (existingRider) {
      throw buildError("A rider is already registered with this phone", {
        statusCode: 409,
        code: "duplicate_registration"
      });
    }

    if (verificationToken) {
      this.verifyVerificationToken(verificationToken, normalizedPhone, "signup");
    } else {
      const expectedOtp = getDemoSignupOtp(rawPhone, normalizedPhone);
      if (!expectedOtp || otp !== expectedOtp) {
        throw buildError("Invalid otp", {
          statusCode: 401,
          code: "invalid_signup_otp"
        });
      }
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
        rider_id: rider.id,
        balance: 0,
        updated_at: timestamp
      });
    }

    const token = this.signToken(rider);
    return buildSessionPayload(token, rider, zone, platformRider, "demo_signup");
  }

  async login({ phone, otp, verification_token: verificationTokenValue }) {
    const rawPhone = typeof phone === "string" ? phone.trim() : "";
    const normalizedPhone = normalizePhone(phone);
    const verificationToken =
      typeof verificationTokenValue === "string" ? verificationTokenValue.trim() : "";

    if (
      !isNormalizedPhone(normalizedPhone) ||
      ((!verificationToken) && (typeof otp !== "string" || !otp.trim()))
    ) {
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

    if (verificationToken) {
      this.verifyVerificationToken(verificationToken, normalizedPhone, "login");
    } else {
      const expectedOtp = getDemoLoginOtp(rawPhone, normalizedPhone);
      if (!expectedOtp || otp.trim() !== expectedOtp) {
        throw buildError("Invalid phone or otp", {
          statusCode: 401,
          code: "invalid_login"
        });
      }
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

  async deleteAccount({ riderId }) {
    const rider = await this.dataStore.getRiderById(riderId);
    if (!rider) {
      throw buildError("Rider not found", { statusCode: 404, code: "not_found" });
    }
    await this.dataStore.deleteRiderAccount(riderId);
    return { deleted: true };
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
