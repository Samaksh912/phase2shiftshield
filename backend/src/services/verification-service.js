const { getConfig } = require("../utils/config");

function buildError(message, { statusCode = 500, code = "server_error" } = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

class TwilioVerificationService {
  constructor(config = getConfig()) {
    this.config = config;
    this.client = null;
  }

  ensureConfigured() {
    if (!this.config.twilioAccountSid || !this.config.twilioAuthToken || !this.config.twilioVerifyServiceSid) {
      throw buildError("Phone verification service is not configured", {
        statusCode: 503,
        code: "verification_unavailable"
      });
    }
  }

  getClient() {
    this.ensureConfigured();

    if (this.client) {
      return this.client;
    }

    let createTwilioClient;
    try {
      createTwilioClient = require("twilio");
    } catch (_error) {
      throw buildError("Phone verification service dependency is not installed", {
        statusCode: 503,
        code: "verification_unavailable"
      });
    }

    this.client = createTwilioClient(this.config.twilioAccountSid, this.config.twilioAuthToken);
    return this.client;
  }

  async requestOtp(phone) {
    try {
      const client = this.getClient();
      await client.verify.v2
        .services(this.config.twilioVerifyServiceSid)
        .verifications.create({ to: phone, channel: "sms" });
      return {
        otp_sent: true,
        auth_type: "twilio_verify",
        message: "OTP sent successfully"
      };
    } catch (error) {
      if (error?.code || error?.status || error?.statusCode) {
        throw buildError(error.message || "Unable to send verification code", {
          statusCode: error.status || error.statusCode || 502,
          code: "verification_request_failed"
        });
      }

      throw buildError("Unable to send verification code", {
        statusCode: 502,
        code: "verification_request_failed"
      });
    }
  }

  async verifyOtp(phone, otp) {
    try {
      const client = this.getClient();
      const result = await client.verify.v2
        .services(this.config.twilioVerifyServiceSid)
        .verificationChecks.create({ to: phone, code: otp });

      if (result.status !== "approved") {
        throw buildError("Invalid otp", {
          statusCode: 401,
          code: "invalid_otp"
        });
      }

      return { approved: true };
    } catch (error) {
      if (error.code === "invalid_otp") {
        throw error;
      }

      if (error?.code || error?.status || error?.statusCode) {
        throw buildError(error.message || "Unable to verify otp", {
          statusCode: error.status || error.statusCode || 502,
          code: "verification_check_failed"
        });
      }

      throw buildError("Unable to verify otp", {
        statusCode: 502,
        code: "verification_check_failed"
      });
    }
  }
}

module.exports = {
  TwilioVerificationService
};
