const crypto = require("crypto");

function verifySignature(razorpay_order_id, razorpay_payment_id, signature, secret) {
  if (!razorpay_order_id || !razorpay_payment_id || !signature || !secret) {
    return false;
  }
  
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
    
  // Use timingSafeEqual to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch (error) {
    return false;
  }
}

module.exports = {
  verifySignature
};