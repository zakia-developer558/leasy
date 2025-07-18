const express = require('express');
const router = express.Router();
const { getNotificationPreferences, updateNotificationPreferences, listNotifications, markNotificationsRead, getUnreadNotificationCount } = require('../../controllers/notificationController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

router.get('/notification-preferences', authMiddleware, getNotificationPreferences);
router.put('/notification-preferences', authMiddleware, updateNotificationPreferences);
router.get('/notifications', authMiddleware, listNotifications);
router.post('/notifications/mark-read', authMiddleware, markNotificationsRead);
router.get('/notifications/unread-count', authMiddleware, getUnreadNotificationCount);

module.exports = router; 