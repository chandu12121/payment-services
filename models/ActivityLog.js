const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['login', 'update', 'security', 'auth', 'other'],
        required: true,
        index: true
    },
    action: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    ip: {
        type: String
    },
    device: {
        type: String
    },
    status: {
        type: String,
        enum: ['success', 'failure'],
        default: 'success'
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

// Index for efficient queries by user and date
activityLogSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);
