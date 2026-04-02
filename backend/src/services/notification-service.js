class NotificationService {
  constructor({ dataStore }) {
    this.dataStore = dataStore;
  }

  parsePagination(query = {}) {
    const limit = query.limit === undefined ? 20 : Number(query.limit);
    const offset = query.offset === undefined ? 0 : Number(query.offset);

    if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 100) {
      const error = new Error("limit must be a safe positive integer between 1 and 100");
      error.code = "validation_error";
      error.statusCode = 400;
      throw error;
    }

    if (!Number.isSafeInteger(offset) || offset < 0) {
      const error = new Error("offset must be a safe non-negative integer");
      error.code = "validation_error";
      error.statusCode = 400;
      throw error;
    }

    return { limit, offset };
  }

  formatNotification(notification) {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      is_read: notification.is_read,
      created_at: notification.created_at
    };
  }

  async createNotification({ riderId, type, title, message, metadata = null }) {
    return this.dataStore.createNotification({
      rider_id: riderId,
      type,
      title,
      message,
      metadata
    });
  }

  async listNotificationsForRider(riderId, query = {}) {
    const { limit, offset } = this.parsePagination(query);
    const [notifications, total, unreadCount] = await Promise.all([
      this.dataStore.listNotificationsByRiderId(riderId, { limit, offset }),
      this.dataStore.countNotificationsByRiderId(riderId),
      this.dataStore.countUnreadNotificationsByRiderId(riderId)
    ]);

    return {
      notifications: notifications.map((notification) => this.formatNotification(notification)),
      pagination: {
        limit,
        offset,
        total,
        has_more: offset + notifications.length < total
      },
      unread_count: unreadCount
    };
  }
}

module.exports = {
  NotificationService
};
