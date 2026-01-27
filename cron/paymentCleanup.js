const cron = require('node-cron');
const Booking = require('../models/Bookings');
const logger = require('../utils/logger');

// Run every hour: '0 * * * *'
const startPaymentCleanupJob = () => {
    cron.schedule('0 * * * *', async () => {
        logger.info('Running Payment Cleanup Job...');
        try {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            // Find bookings that are 'pending' and older than 24h
            const result = await Booking.updateMany(
                { status: 'pending', createdAt: { $lt: twentyFourHoursAgo } },
                { $set: { status: 'rejected' } }
            );

            if (result.modifiedCount > 0) {
                logger.info(`Cleanup Job: Rejected ${result.modifiedCount} pending bookings.`);
            } else {
                logger.info('Cleanup Job: No pending bookings to reject.');
            }
        } catch (error) {
            logger.error('Error in Payment Cleanup Job:', error);
        }
    });
};

module.exports = startPaymentCleanupJob;
