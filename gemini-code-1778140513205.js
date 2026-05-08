// ==========================================
// CORLEON PREMIUM AI SERVER - MASTER FILE
// ==========================================

// 1. Load our secret keys from the .env file
require('dotenv').config();

// 2. Import all necessary packages
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { OpenAI } = require('openai');
const jwt = require('jsonwebtoken');

// 3. Initialize OpenAI & Express
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();
app.use(cors());

// ==========================================
// ROUTE 1: STRIPE WEBHOOKS (MUST BE RAW)
// ==========================================
// This must come BEFORE app.use(express.json()) so Stripe can verify the signature!
app.post('/webhook', express.raw({type: 'application/json'}), (request, response) => {
    const sig = request.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    } catch (err) {
        console.error(`⚠️  Webhook Security Alert: ${err.message}`);
        return response.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Process the verified payment
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        console.log(`=============================================`);
        console.log(`💰 SECURE PAYMENT RECEIVED!`);
        console.log(`Customer Email: ${session.customer_details.email}`);
        console.log(`Session ID: ${session.id}`);
        console.log(`=============================================`);
        
        // FUTURE: Update user in database to "PRO" status here.
    }

    response.send(); // Tell Stripe we got it
});

// ==========================================
// STANDARD MIDDLEWARE (JSON & STATIC FILES)
// ==========================================
app.use(express.json());
app.use(express.static('public')); // Serves your HTML files

// ==========================================
// JWT AUTHENTICATION BOUNCER
// ==========================================
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key"; 

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Get token from "Bearer <token>"

    if (!token) return res.status(401).json({ result: "Access Denied: Please log in." });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ result: "Invalid or expired token." });
        req.user = user; 
        next(); 
    });
};

// ==========================================
// ROUTE 2: LOGIN (TOKEN GENERATOR)
// ==========================================
app.post('/api/login', (req, res) => {
    // FUTURE: Verify email/password against a database here.
    const mockUser = { id: 1, email: "test@corleon.com", isPro: false };
    
    // Generate a 24-hour token for the user
    const accessToken = jwt.sign(mockUser, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token: accessToken });
});

// ==========================================
// ROUTE 3: STRIPE CHECKOUT
// ==========================================
app.post('/create-checkout-session', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price: 'price_12345_placeholder', // TODO: Swap with real Stripe Price ID
                quantity: 1,
            }],
            mode: 'subscription',
            success_url: 'http://localhost:3000/dashboard.html', 
            cancel_url: 'http://localhost:3000/index.html',
        });
        res.json({ url: session.url });
    } catch (error) {
        console.error("Stripe Checkout Error:", error.message);
        res.status(500).json({ error: "Checkout failed" });
    }
});

// ==========================================
// ROUTE 4: PROTECTED AI ENGINE
// ==========================================
app.post('/api/generate', authenticateToken, async (req, res) => {
    const userPrompt = req.body.prompt;
    console.log(`[Corleon System] User ${req.user.email} processing prompt: "${userPrompt}"`);

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: "system", content: "You are the highly advanced, exclusive AI assistant for the Corleon platform. You are helpful, brilliant, and professional." },
                { role: "user", content: userPrompt }
            ],
        });

        const aiResponse = completion.choices[0].message.content;
        res.json({ result: aiResponse });
    } catch (error) {
        console.error("OpenAI Error:", error.message);
        res.status(500).json({ result: "Corleon System Error: API Key missing or invalid." });
    }
});

// ==========================================
// START THE SERVER
// ==========================================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ Corleon Premium Server running on http://localhost:${PORT}`);
});