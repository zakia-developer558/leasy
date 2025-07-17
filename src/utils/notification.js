const Notification = require('../models/Notification');
const User = require('../models/User');

const MANDATORY_TYPES = ['payment_success', 'payment_failure'];

/**
 * Create a notification for a user, respecting their preferences (except mandatory types).
 * @param {ObjectId} userId - The user to notify
 * @param {String} type - Notification type (must match Notification model enum)
 * @param {Object} data - Extra data for the notification
 */
async function notifyUser(userId, type, data = {}) {
  // Fetch user preferences
  const user = await User.findById(userId).select('notificationPreferences');
  if (!user) return;
  // Check if user wants this notification (unless mandatory)
  if (!MANDATORY_TYPES.includes(type)) {
    if (!user.notificationPreferences[type]) return;
  }
  // Create notification
  await Notification.create({
    user: userId,
    type,
    data,
    isRead: false
  });
}

module.exports = { notifyUser }; 