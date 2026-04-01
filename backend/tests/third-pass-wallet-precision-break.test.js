const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { Duplex } = require("node:stream");
const jwt = require("jsonwebtoken");
const { buildApp } = require("../src/app");
const { getConfig } = require("../src/utils/config");
const { createTestDataStore } = require("./test-helpers");

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

async function invokeRaw(app, { method, url, headers = {}, rawBody = "" }) {
  const socket = createMockSocket();
  const req = new http.IncomingMessage(socket);
  req.method = method;
  req.url = url;
  req.headers = {
    ...headers,
    "content-length": String(Buffer.byteLength(rawBody))
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
    req.push(rawBody);
    req.push(null);
  });

  await finished;
  const text = Buffer.concat(bodyChunks).toString("utf8");
  return {
    status: res.statusCode,
    text,
    body: text ? JSON.parse(text) : null
  };
}

test("Wallet top-up rejects unsafe integers instead of silently rounding them", async () => {
  const { dataStore } = createTestDataStore();
  const app = buildApp({ dataStore });
  const token = jwt.sign(
    {
      rider_id: "11111111-1111-4111-8111-111111111111",
      phone: "9876543210"
    },
    getConfig().jwtSecret,
    { expiresIn: "7d" }
  );

  const response = await invokeRaw(app, {
    method: "POST",
    url: "/api/wallet/topup",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    rawBody: "{\"amount\":9007199254740993}"
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    error: "validation_error",
    message: "amount must be a safe positive integer"
  });
});
