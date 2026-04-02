async function safelyCreateNotification(notificationService, payload, logger = console) {
  if (!notificationService || typeof notificationService.createNotification !== "function") {
    return;
  }

  try {
    await notificationService.createNotification(payload);
  } catch (error) {
    if (typeof logger?.warn === "function") {
      logger.warn("notification_create_failed", {
        message: error.message,
        type: payload?.type,
        riderId: payload?.riderId
      });
    }
  }
}

module.exports = {
  safelyCreateNotification
};
