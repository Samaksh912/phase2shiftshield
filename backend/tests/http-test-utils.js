const http = require("node:http");
const { Duplex } = require("node:stream");

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

module.exports = {
  invokeApp
};
