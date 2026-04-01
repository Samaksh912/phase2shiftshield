const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const http = require("node:http");
const { Duplex } = require("node:stream");
const { buildApp } = require("../src/app");
const { getConfig } = require("../src/utils/config");

function createMockSocket() {
  const socket = new Duplex({
    read() {},
    write(_chunk, _encoding, callback) {
      callback();
    }
  });

  socket.remoteAddress = "127.0.0.1";
  socket.destroyed = false;
  socket.destroy = function destroy(error) {
    this.destroyed = true;
    if (error) {
      this.emit("error", error);
    }
  };
  socket.setTimeout = () => {};
  socket.setNoDelay = () => {};
  socket.setKeepAlive = () => {};
  socket.cork = () => {};
  socket.uncork = () => {};
  return socket;
}

async function invokeApp(app, { method, url, headers = {}, body }) {
  const payload = body ? JSON.stringify(body) : "";
  const socket = createMockSocket();
  const req = new http.IncomingMessage(socket);
  req.method = method;
  req.url = url;
  req.headers = {
    ...headers,
    "content-length": String(Buffer.byteLength(payload))
  };
  req.connection = socket;
  req.socket = socket;
  req.httpVersion = "1.1";
  req.httpVersionMajor = 1;
  req.httpVersionMinor = 1;
  const res = new http.ServerResponse(req);
  const bodyChunks = [];
  const finished = new Promise((resolve, reject) => {
    res.on("finish", resolve);
    res.on("error", reject);
  });

  res.write = (chunk, encoding, callback) => {
    bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    if (typeof callback === "function") {
      callback();
    }
    return true;
  };

  res.end = (chunk, encoding, callback) => {
    if (typeof encoding === "function") {
      callback = encoding;
      encoding = undefined;
    }
    if (chunk) {
      bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    }
    res.finished = true;
    res.headersSent = true;
    if (typeof callback === "function") {
      callback();
    }
    res.emit("finish");
    return res;
  };

  app.handle(req, res);
  process.nextTick(() => {
    req.push(payload);
    req.push(null);
  });
  await finished;

  const text = Buffer.concat(bodyChunks).toString("utf8");
  return {
    status: res.statusCode,
    headers: res.getHeaders(),
    text,
    body: text ? JSON.parse(text) : null
  };
}

test("POST /api/quotes/generate returns blocked purchase reason through the Express app stack", async () => {
  const token = jwt.sign(
    {
      rider_id: "11111111-1111-4111-8111-111111111111",
      phone: "9876543210"
    },
    getConfig().jwtSecret,
    { expiresIn: "7d" }
  );

  const app = buildApp({
    quoteService: {
      async generateQuote() {
        return {
          quote: {
            id: "quote_blocked_1",
            zone_id: "koramangala",
            zone_name: "Koramangala",
            week_start: "2026-04-06",
            week_end: "2026-04-12",
            shifts_covered: "both",
            risk_score: 0.64,
            risk_band: "medium",
            premium: 59,
            payout_cap: 5280,
            lunch_shift_max_payout: 336,
            dinner_shift_max_payout: 544,
            explanation: {
              top_factors: [
                {
                  factor: "Historical triggers",
                  contribution_pct: 100,
                  detail: "1 triggers in the last 4 weeks"
                }
              ],
              summary: "Medium risk this week. 1 triggers in the last 4 weeks."
            },
            coverage_breakdown: {
              lunch_shifts: 6,
              dinner_shifts: 6,
              total_protected_shifts: 12,
              lunch_baseline_per_shift: 420,
              dinner_baseline_per_shift: 680,
              min_payout_pct: 20,
              max_payout_pct: 80
            },
            can_purchase: false,
            reason: "An active disruption event is detected in your zone. Policy purchase is temporarily unavailable.",
            purchase_deadline: "2026-04-05T23:59:00+05:30",
            generated_at: "2026-04-01T06:16:05+05:30"
          }
        };
      }
    }
  });

  const response = await invokeApp(app, {
    method: "POST",
    url: "/api/quotes/generate",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: {
      week_start: "2026-04-06"
    }
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.quote.can_purchase, false);
  assert.equal(
    response.body.quote.reason,
    "An active disruption event is detected in your zone. Policy purchase is temporarily unavailable."
  );
});
