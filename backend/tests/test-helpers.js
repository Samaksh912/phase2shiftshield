const fs = require("fs");
const os = require("os");
const path = require("path");
const { LocalDataStore } = require("../src/utils/storage");
const { getConfig } = require("../src/utils/config");

function createTestDataStore() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "shiftshield-claims-"));
  const config = {
    ...getConfig(),
    localStorePath: path.join(tempDir, "local-db.json")
  };
  const dataStore = new LocalDataStore(config);
  return { dataStore, tempDir, config };
}

module.exports = {
  createTestDataStore
};
