const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env")
});
const { buildApp } = require("./app");
const { getConfig } = require("./utils/config");

const config = getConfig();
const app = buildApp();

app.listen(config.port, config.host, () => {
  console.log(`ShiftShield backend listening on http://${config.host}:${config.port}`);
});
