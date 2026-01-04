require('dotenv').config();
const fs = require('fs');

console.log("Checking Environment Variables...");
console.log("PORT:", process.env.PORT);
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("MONGO_URI PRESENT:", !!process.env.MONGO_URI);
console.log("RAZORPAY_KEY_ID PRESENT:", !!process.env.RAZORPAY_KEY_ID);
console.log("RAZORPAY_KEY_SECRET PRESENT:", !!process.env.RAZORPAY_KEY_SECRET);

// Check if we can write to logs
try {
    fs.accessSync('./logs', fs.constants.W_OK);
    console.log("Logs directory is writable");
} catch (err) {
    console.error("Logs directory NOT writable:", err.message);
}
