const { v2: cloudinary } = require('cloudinary');

/**
 * Upload file to Cloudinary
 * This service is currently unused as we upload directly in controllers
 * Kept for potential future use or reference
 * 
 * @param {Buffer} buffer - File buffer from multer
 * @param {Object} options - Upload options (folder, resource_type, etc.)
 * @returns {Promise<Object>} - Cloudinary upload result
 */
const uploadFile = async (buffer, options = {}) => {
    if (!buffer) {
        throw new Error('No file buffer provided');
    }

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: options.folder || 'payflow-pro',
                resource_type: options.resource_type || 'auto',
                public_id: options.public_id || undefined,
                tags: options.tags || []
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        stream.end(buffer);
    });
};

/**
 * Delete file from Cloudinary
 * @param {String} publicId - Cloudinary public ID
 * @returns {Promise<Object>} - Cloudinary delete result
 */
const deleteFile = async (publicId) => {
    if (!publicId) {
        throw new Error('Public ID is required');
    }

    try {
        const result = await cloudinary.uploader.destroy(publicId);
        return result;
    } catch (error) {
        console.error('Cloudinary delete error:', error);
        throw new Error('Failed to delete file from Cloudinary');
    }
};

module.exports = {
    uploadFile,
    deleteFile
};

