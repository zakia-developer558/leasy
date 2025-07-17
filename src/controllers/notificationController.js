const User = require('../models/User');
const Notification = require('../models/Notification');

// GET /api/v1/notification-preferences
const getNotificationPreferences = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('notificationPreferences');
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, preferences: user.notificationPreferences });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/notification-preferences
const updateNotificationPreferences = async (req, res, next) => {
  try {
    const updates = req.body;
    const mandatory = ['payment_success', 'payment_failure'];
    for (const type of mandatory) {
      if (type in updates && updates[type] === false) {
        return res.status(400).json({ success: false, error: `${type.replace('_', ' ')} notifications cannot be disabled.` });
      }
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    for (const key in updates) {
      if (user.notificationPreferences.hasOwnProperty(key)) {
        user.notificationPreferences[key] = updates[key];
      }
    }
    await user.save();
    res.json({ success: true, preferences: user.notificationPreferences });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/notification/notifications?read=all|read|unread&page=1&limit=20
const listNotifications = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { read = 'all', page = 1, limit = 20 } = req.query;
    const query = { user: userId };
    if (read === 'read') query.isRead = true;
    if (read === 'unread') query.isRead = false;
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Notification.countDocuments(query);
    res.json({
      success: true,
      notifications,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/notification/notifications/mark-read
// Body: { ids: ["id1", "id2", ...] }
const markNotificationsRead = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'No notification IDs provided.' });
    }
    await Notification.updateMany({ user: userId, _id: { $in: ids } }, { $set: { isRead: true } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotificationPreferences,
  updateNotificationPreferences,
  listNotifications,
  markNotificationsRead
}; 