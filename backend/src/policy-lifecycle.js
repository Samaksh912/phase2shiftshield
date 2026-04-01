const { WalletService } = require("./services/wallet-service");
const { PolicyService } = require("./services/policy-service");
const { createDataStore } = require("./utils/storage");

function createPolicyLifecycleRunner({ policyService, logger = console }) {
  return async function runPolicyLifecycleJob() {
    const result = await policyService.runLifecycle();
    if (typeof logger?.info === "function") {
      logger.info("policy_lifecycle_completed", result);
    }
    return result;
  };
}

function createDefaultPolicyService() {
  const dataStore = createDataStore();
  const walletService = new WalletService({ dataStore });
  return new PolicyService({ dataStore, walletService });
}

async function runPolicyLifecycleCli({ policyService, logger } = {}) {
  const effectivePolicyService = policyService || createDefaultPolicyService();
  const runPolicyLifecycleJob = createPolicyLifecycleRunner({
    policyService: effectivePolicyService,
    logger
  });
  return runPolicyLifecycleJob();
}

if (require.main === module) {
  runPolicyLifecycleCli()
    .then((result) => {
      process.stdout.write(`${JSON.stringify(result)}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error.stack || error.message}\n`);
      process.exit(1);
    });
}

module.exports = {
  createDefaultPolicyService,
  createPolicyLifecycleRunner,
  runPolicyLifecycleCli
};
