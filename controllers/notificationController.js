const Notification = require('../models/Notification');
const Transaction = require('../models/Transactions');
const Invoice = require('../models/Invoice');

// Get all notifications for the user
exports.getNotifications = async (req, res) => {
    try {
        const { page = 1, limit = 20, unreadOnly = false } = req.query;
        const userId = req.user.userId;

        const query = { user: userId };
        if (unreadOnly === 'true') {
            query.status = { $ne: 'READ' };
        }

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .lean();

        const total = await Notification.countDocuments(query);
        const unreadCount = await Notification.getUnreadCount(userId);

        res.json({
            success: true,
            notifications,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            },
            unreadCount
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications',
            error: error.message
        });
    }
};

// Get unread count
exports.getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.userId;
        const count = await Notification.getUnreadCount(userId);

        res.json({
            success: true,
            count
        });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get unread count',
            error: error.message
        });
    }
};

// Mark notification(s) as read
exports.markAsRead = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { notificationIds } = req.body;

        if (!notificationIds || !Array.isArray(notificationIds)) {
            return res.status(400).json({
                success: false,
                message: 'notificationIds array is required'
            });
        }

        await Notification.markAsRead(userId, notificationIds);

        res.json({
            success: true,
            message: 'Notifications marked as read'
        });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark notifications as read',
            error: error.message
        });
    }
};

// Mark all as read
exports.markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.userId;
        await Notification.markAllAsRead(userId);

        res.json({
            success: true,
            message: 'All notifications marked as read'
        });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark all notifications as read',
            error: error.message
        });
    }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;

        const notification = await Notification.findOneAndDelete({
            _id: id,
            user: userId
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.json({
            success: true,
            message: 'Notification deleted'
        });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete notification',
            error: error.message
        });
    }
};

// Search across transactions and invoices
exports.search = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { q: query, limit = 10 } = req.query;

        if (!query || query.trim() === '') {
            return res.json({
                success: true,
                results: []
            });
        }

        const searchRegex = new RegExp(query, 'i');

        // Search transactions
        const transactions = await Transaction.find({
            userId,
            $or: [
                { transactionId: searchRegex },
                { description: searchRegex },
                { paymentMethod: searchRegex }
            ]
        })
            .select('transactionId amount status description createdAt')
            .limit(limit)
            .lean();

        // Search invoices
        const invoices = await Invoice.find({
            userId,
            $or: [
                { invoiceId: searchRegex },
                { description: searchRegex }
            ]
        })
            .select('invoiceId amount status description createdAt')
            .limit(limit)
            .lean();

        // Format results
        const results = [
            ...transactions.map(t => ({
                id: t._id,
                type: 'transaction',
                title: t.description || `Transaction ${t.transactionId}`,
                amount: `₹${t.amount.toLocaleString('en-IN')}`,
                date: new Date(t.createdAt).toLocaleDateString('en-IN'),
                path: '/transactions',
                metadata: {
                    transactionId: t.transactionId,
                    status: t.status
                }
            })),
            ...invoices.map(i => ({
                id: i._id,
                type: 'invoice',
                title: `Invoice ${i.invoiceId}`,
                amount: `₹${i.amount.toLocaleString('en-IN')}`,
                date: new Date(i.createdAt).toLocaleDateString('en-IN'),
                path: '/invoices',
                metadata: {
                    invoiceId: i.invoiceId,
                    status: i.status
                }
            }))
        ];

        // Add page suggestions
        const pages = [
            { id: 'dashboard', type: 'page', title: 'Dashboard', path: '/' },
            { id: 'pay', type: 'page', title: 'Pay Now', path: '/pay' },
            { id: 'transactions', type: 'page', title: 'Transactions', path: '/transactions' },
            { id: 'invoices', type: 'page', title: 'Invoices', path: '/invoices' },
            { id: 'profile', type: 'page', title: 'Profile Settings', path: '/profile' }
        ].filter(page => page.title.toLowerCase().includes(query.toLowerCase()));

        results.push(...pages);

        res.json({
            success: true,
            results: results.slice(0, limit),
            total: results.length
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            message: 'Search failed',
            error: error.message
        });
    }
};
