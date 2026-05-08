require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// Set up OpenAI (Only initializes if you have a key in .env)
let openai;
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

app.use(cors());
app.use(express.json());

// THIS IS CRITICAL FOR PUBLISHING: Tells Node to serve the HTML files in the 'public' folder
app.use(express.static('public')); 

// --- AI GENERATION ENDPOINT ---
app.post('/api/generate', async (req, res) => {
    const userPrompt = req.body.prompt;
    console.log(`[Corleon System] Received prompt: "${userPrompt}"`);

    if (!userPrompt) return res.status(400).json({ result: "Please provide a prompt." });

    try {
        if (openai) {
            // Real OpenAI Integration
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: "You are the highly advanced, exclusive AI assistant for the Corleon platform. Be professional and concise." },
                    { role: "user", content: userPrompt }
                ],
            });
            res.json({ result: completion.choices[0].message.content });
        } else {
            // Simulated fallback if API key is missing
            await new Promise(resolve => setTimeout(resolve, 1500));
            res.json({ result: `Corleon Simulated Response to: "${userPrompt}". Add your OpenAI key to the .env file for real responses.` });
        }
    } catch (error) {
        console.error("OpenAI Error:", error.message);
        res.status(500).json({ result: "Corleon System Error: API connection failed." });
    }
});

// --- STRIPE CHECKOUT ENDPOINT ---
app.post('/create-checkout-session', async (req, res) => {
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{ price: 'price_12345_placeholder', quantity: 1 }],
            mode: 'subscription',
            success_url: 'https://your-future-domain.com/app.html',
            cancel_url: 'https://your-future-domain.com/',
        });
        res.json({ url: session.url });
    } catch (error) {
        console.error("Stripe Error:", error.message);
        res.status(500).json({ error: "Checkout failed. Ensure Stripe keys are set." });
    }
});

// Start the server using the port provided by the host (Render/Railway) or 3000 locally
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Corleon Server running on port ${PORT}`);
});