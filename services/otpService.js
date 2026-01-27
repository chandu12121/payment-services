const crypto = require('crypto');

/**
 * Generate a random numeric OTP
 * @param {number} length - Length of the OTP (default: 6)
 * @returns {string} - The generated OTP
 */
const generateOTP = (length = 6) => {
    // Generate a buffer of random bytes
    const buffer = crypto.randomBytes(length);

    // Convert to a string of digits
    // modulo 10 ensures we get digits 0-9
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += (buffer[i] % 10).toString();
    }

    return otp;
};

/**
 * Verify an OTP (utility function)
 * NB: Controller currently implements its own comparison logic against DB,
 * but this is provided for completeness or stateless verification tokens.
 * 
 * @param {string} inputOtp - The OTP provided by user
 * @param {string} storedOtp - The OTP stored in DB/Session
 * @returns {boolean} - True if valid
 */
const verifyOTP = (inputOtp, storedOtp) => {
    if (!inputOtp || !storedOtp) return false;
    return inputOtp === storedOtp;
};

module.exports = {
    generateOTP,
    verifyOTP
};
