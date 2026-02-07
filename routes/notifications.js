const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middlewares/auth');

// All routes require authentication
router.use(authenticate);

// Get all notifications
router.get('/', notificationController.getNotifications);

// Get unread count
router.get('/unread-count', notificationController.getUnreadCount);

// Mark notification(s) as read
router.patch('/mark-read', notificationController.markAsRead);

// Mark all as read
router.patch('/mark-all-read', notificationController.markAllAsRead);

// Delete notification
router.delete('/:id', notificationController.deleteNotification);

// Search endpoint
router.get('/search', notificationController.search);

module.exports = router;
