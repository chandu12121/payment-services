const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        uppercase: true
    },
    action: {
        type: {
            type: String,
            enum: ['ROUTE', 'URL', 'NONE'],
            default: 'NONE'
        },
        target: String,
        label: String
    },
    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        default: 'MEDIUM'
    },
    channels: {
        type: [String],
        enum: ['IN_APP', 'EMAIL', 'SMS', 'PUSH'],
        default: ['IN_APP']
    },
    status: {
        type: String,
        enum: ['PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED'],
        default: 'PENDING',
        index: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    sentAt: Date,
    readAt: Date
}, {
    timestamps: true,
    collection: 'notification'
});

// Index for efficient queries
notificationSchema.index({ user: 1, status: 1, createdAt: -1 });

// Virtual for time ago
notificationSchema.virtual('timeAgo').get(function () {
    const now = new Date();
    const diff = now - this.createdAt;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
});

// Set toJSON to include virtuals
notificationSchema.set('toJSON', { virtuals: true });
notificationSchema.set('toObject', { virtuals: true });

// Static method to create notification
notificationSchema.statics.createNotification = async function (data) {
    if (!data.sentAt && data.status === 'DELIVERED') {
        data.sentAt = new Date();
    }
    return await this.create(data);
};

// Static method to mark as read
notificationSchema.statics.markAsRead = async function (userId, notificationIds) {
    return await this.updateMany(
        { user: userId, _id: { $in: notificationIds } },
        {
            $set: {
                status: 'READ',
                readAt: new Date()
            }
        }
    );
};

// Static method to mark all as read
notificationSchema.statics.markAllAsRead = async function (userId) {
    return await this.updateMany(
        { user: userId, status: { $ne: 'READ' } },
        {
            $set: {
                status: 'READ',
                readAt: new Date()
            }
        }
    );
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function (userId) {
    return await this.countDocuments({ user: userId, status: { $ne: 'READ' } });
};

module.exports = mongoose.model('Notification', notificationSchema);
