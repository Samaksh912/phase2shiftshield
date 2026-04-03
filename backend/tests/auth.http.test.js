const test = require("node:test");
const assert = require("node:assert/strict");
const { buildApp } = require("../src/app");
const { invokeApp } = require("./http-test-utils");
const { createTestDataStore } = require("./test-helpers");

function createFakeVerificationService({ shouldApprove = true } = {}) {
  return {
    requestedPhones: [],
    verifiedOtps: [],
    async requestOtp(phone) {
      this.requestedPhones.push(phone);
      return {
        otp_sent: true,
        auth_type: "twilio_verify",
        message: "OTP sent successfully"
      };
    },
    async verifyOtp(phone, otp) {
      this.verifiedOtps.push({ phone, otp });
      if (!shouldApprove) {
        const error = new Error("Invalid otp");
        error.statusCode = 401;
        error.code = "invalid_otp";
        throw error;
      }
      return { approved: true };
    }
  };
}

test("rider-facing routes reject missing or invalid JWTs with 401", async () => {
  const app = buildApp({
    quoteService: {
      async generateQuote() {
        return { quote: { id: "unused" } };
      }
    }
  });

  const missingAuthCases = [
    { method: "POST", url: "/api/quotes/generate", body: { week_start: "2026-04-06" } },
    { method: "GET", url: "/api/policies/current" },
    { method: "GET", url: "/api/policies/history" },
    { method: "GET", url: "/api/claims" },
    { method: "GET", url: "/api/wallet" },
    { method: "GET", url: "/api/auth/me" }
  ];

  for (const request of missingAuthCases) {
    const response = await invokeApp(app, {
      ...request,
      headers: request.body ? { "content-type": "application/json" } : {}
    });

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, {
      error: "unauthorized",
      message: "Missing or invalid authorization header"
    });
  }

  const invalidTokenResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/wallet",
    headers: {
      authorization: "Bearer definitely-not-a-jwt"
    }
  });

  assert.equal(invalidTokenResponse.status, 401);
  assert.deepEqual(invalidTokenResponse.body, {
    error: "unauthorized",
    message: "Missing or invalid authorization header"
  });
});

test("request-otp returns a demo-safe success response for signup", async () => {
  const { dataStore } = createTestDataStore();
  const verificationService = createFakeVerificationService();
  const app = buildApp({ dataStore, verificationService });

  const response = await invokeApp(app, {
    method: "POST",
    url: "/api/auth/request-otp",
    headers: { "content-type": "application/json" },
    body: {
      phone: "9012345678",
      purpose: "signup"
    }
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    otp_sent: true,
    auth_type: "twilio_verify",
    phone: "+919012345678",
    message: "OTP sent successfully"
  });
  assert.deepEqual(verificationService.requestedPhones, ["+919012345678"]);
});

test("signup creates a demo-safe rider session and wallet-ready profile", async () => {
  const { dataStore } = createTestDataStore();
  const verificationService = createFakeVerificationService();
  const app = buildApp({ dataStore, verificationService });

  const response = await invokeApp(app, {
    method: "POST",
    url: "/api/auth/signup",
    headers: { "content-type": "application/json" },
    body: {
      name: "Demo Rider",
      phone: "9012345678",
      platform: "swiggy",
      city_id: "lucknow",
      zone_id: "lucknow_gomti_nagar",
      shifts_covered: "both",
      payout_preference: "wallet",
      otp: "123456"
    }
  });

  assert.equal(response.status, 201);
  assert.equal(typeof response.body.token, "string");
  assert.equal(response.body.rider.phone, "9012345678");
  assert.equal(response.body.rider.city_id, "lucknow");
  assert.equal(response.body.rider.zone_id, "lucknow_gomti_nagar");
  assert.equal(response.body.rider.active_days_last_30, 8);
  assert.equal(response.body.session.auth_type, "twilio_verify");
  assert.equal(response.body.session.expires_in, 604800);
  assert.deepEqual(verificationService.verifiedOtps, [{ phone: "+919012345678", otp: "123456" }]);

  const rider = await dataStore.getRiderByPhone("9012345678");
  const platformRider = await dataStore.getMockPlatformRiderByPhone("9012345678");
  const wallet = await dataStore.getWalletByRiderId(rider.id);

  assert.ok(rider);
  assert.ok(platformRider);
  assert.ok(wallet);
  assert.equal(wallet.balance, 0);
});

test("signup rejects a bad OTP", async () => {
  const { dataStore } = createTestDataStore();
  const verificationService = createFakeVerificationService({ shouldApprove: false });
  const app = buildApp({ dataStore, verificationService });

  const response = await invokeApp(app, {
    method: "POST",
    url: "/api/auth/signup",
    headers: { "content-type": "application/json" },
    body: {
      name: "Demo Rider",
      phone: "9012345678",
      platform: "swiggy",
      city_id: "lucknow",
      zone_id: "lucknow_gomti_nagar",
      shifts_covered: "both",
      payout_preference: "wallet",
      otp: "000000"
    }
  });

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, {
    error: "invalid_signup_otp",
    message: "Invalid otp"
  });
});

test("signup rejects duplicate phone registration", async () => {
  const { dataStore } = createTestDataStore();
  const verificationService = createFakeVerificationService();
  const app = buildApp({ dataStore, verificationService });

  const response = await invokeApp(app, {
    method: "POST",
    url: "/api/auth/signup",
    headers: { "content-type": "application/json" },
    body: {
      name: "Duplicate Rider",
      phone: "9876543210",
      platform: "swiggy",
      city_id: "bengaluru",
      zone_id: "koramangala",
      shifts_covered: "both",
      payout_preference: "wallet",
      otp: "123456"
    }
  });

  assert.equal(response.status, 409);
  assert.deepEqual(response.body, {
    error: "duplicate_registration",
    message: "A rider is already registered with this phone"
  });
});

test("signup rejects invalid city and zone combinations", async () => {
  const { dataStore } = createTestDataStore();
  const verificationService = createFakeVerificationService();
  const app = buildApp({ dataStore, verificationService });

  const response = await invokeApp(app, {
    method: "POST",
    url: "/api/auth/signup",
    headers: { "content-type": "application/json" },
    body: {
      name: "Broken Rider",
      phone: "9000000000",
      platform: "zomato",
      city_id: "bengaluru",
      zone_id: "lucknow_gomti_nagar",
      shifts_covered: "dinner",
      payout_preference: "upi",
      upi_id: "demo@okaxis",
      otp: "123456"
    }
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    error: "validation_error",
    message: "zone_id does not belong to city_id"
  });
});

test("login succeeds for an existing rider with the fixed demo OTP 9324", async () => {
  const { dataStore } = createTestDataStore();
  const verificationService = createFakeVerificationService();
  const app = buildApp({ dataStore, verificationService });

  const response = await invokeApp(app, {
    method: "POST",
    url: "/api/auth/login",
    headers: { "content-type": "application/json" },
    body: {
      phone: "9876543210",
      otp: "9324"
    }
  });

  assert.equal(response.status, 200);
  assert.equal(typeof response.body.token, "string");
  assert.equal(response.body.rider.id, "11111111-1111-4111-8111-111111111111");
  assert.equal(response.body.rider.city_id, "bengaluru");
  assert.equal(response.body.session.auth_type, "demo_login");
  assert.deepEqual(verificationService.verifiedOtps, []);
});

test("login rejects a bad OTP without calling Twilio", async () => {
  const { dataStore } = createTestDataStore();
  const verificationService = createFakeVerificationService();
  const app = buildApp({ dataStore, verificationService });

  const response = await invokeApp(app, {
    method: "POST",
    url: "/api/auth/login",
    headers: { "content-type": "application/json" },
    body: {
      phone: "9876543210",
      otp: "000000"
    }
  });

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, {
    error: "invalid_login",
    message: "Invalid phone or otp"
  });
  assert.deepEqual(verificationService.verifiedOtps, []);
});

test("login returns 404 when rider does not exist", async () => {
  const { dataStore } = createTestDataStore();
  const verificationService = createFakeVerificationService();
  const app = buildApp({ dataStore, verificationService });

  const response = await invokeApp(app, {
    method: "POST",
    url: "/api/auth/login",
    headers: { "content-type": "application/json" },
    body: {
      phone: "9012345678",
      otp: "123456"
    }
  });

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    error: "not_found",
    message: "Rider not found for this phone"
  });
});

test("/api/auth/me returns the authenticated rider profile and geography summary", async () => {
  const { dataStore } = createTestDataStore();
  const verificationService = createFakeVerificationService();
  const app = buildApp({ dataStore, verificationService });

  const loginResponse = await invokeApp(app, {
    method: "POST",
    url: "/api/auth/login",
    headers: { "content-type": "application/json" },
    body: {
      phone: "9451203344",
      otp: "9324"
    }
  });

  const meResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/auth/me",
    headers: {
      authorization: `Bearer ${loginResponse.body.token}`
    }
  });

  assert.equal(meResponse.status, 200);
  assert.equal(meResponse.body.rider.id, "55555555-5555-4555-8555-666666666666");
  assert.equal(meResponse.body.city.id, "lucknow");
  assert.equal(meResponse.body.zone.id, "lucknow_gomti_nagar");
  assert.equal(meResponse.body.zone.risk_class, "medium");
});
