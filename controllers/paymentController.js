const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_demo');

/**
 * @desc    Create a Stripe checkout session for Cart Items
 * @route   POST /api/payment/create-checkout-session
 * @access  Private (Needs JWT)
 */
const createCheckoutSession = async (req, res) => {
    try {
        const { orderItems, customerEmail } = req.body;

        // Map your local cart items into Stripe's line_items array format
        const line_items = orderItems.map((item) => {
            return {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: item.name,
                        images: [item.image || 'https://via.placeholder.com/150'], // Optional product image
                    },
                    // Stripe expects price in cents (e.g., $10.00 => 1000)
                    unit_amount: Math.round(item.price * 100),
                },
                quantity: item.qty,
            };
        });

        // Generate the Secure Checkout Session URL via Stripe
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            shipping_address_collection: {
                allowed_countries: ['US', 'CA', 'GB'],
            },
            line_items,
            mode: 'payment',
            customer_email: customerEmail,
            success_url: `${process.env.FRONTEND_URL}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/cart`,
        });

        // Return the session ID to the client to redirect the user
        res.status(200).json({ sessionId: session.id, url: session.url });

    } catch (error) {
        console.error('Stripe Error:', error.message);
        res.status(500).json({ error: 'Failed to create payment session' });
    }
};

/**
 * @desc    Handle Stripe Webhooks for Payment Confirmation
 * @route   POST /api/payment/webhook
 * @access  Public (Called by Stripe Server directly)
 */
const stripeWebhook = async (req, res) => {
    const payload = req.body;
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        event = stripe.webhooks.constructEvent(payload, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle successful checkout payment
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        // Fulfill the purchase (e.g., save in MongoDB, update status to PAID, send confirmation email)
        console.log(`Payment successful for Session ID: ${session.id}`);
    }

    res.status(200).end();
};

module.exports = { createCheckoutSession, stripeWebhook };
