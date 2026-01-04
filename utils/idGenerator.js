/**
 * Generate a custom ID with a prefix and random alphanumeric characters
 * @param {string} prefix - The prefix for the ID (e.g., "PA", "IN")
 * @param {number} length - Total length of the ID including prefix (default 10)
 * @returns {string} - The generated ID
 */
const generateCustomId = (prefix, length = 10) => {
    const randomLength = length - prefix.length;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';

    for (let i = 0; i < randomLength; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return `${prefix}${result}`;
};

module.exports = { generateCustomId };
