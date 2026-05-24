// INTEGRATION GUIDE: Add to your server.js file

// At the top of server.js, add this import after other requires:
const { setupLearningRoutes } = require('./learningRoutes');

// In your server.js, AFTER all your existing app routes (after the /webhook endpoint),
// ADD THIS LINE before app.listen():

// --- Learning & Standalone AI Routes ---
setupLearningRoutes(app);

// Then your app.listen() remains the same:
/*
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Corleon Server running on port ${PORT}`);
});
*/

// COMPLETE EXAMPLE OF MODIFIED server.js FOOTER:
// =====================================================
// ... all your existing routes ...
// ... /webhook route ...
// 
// --- Learning & Standalone AI Routes ---
// setupLearningRoutes(app);
//
// Start the server using the port provided by the host (Render/Railway) or 3000 locally
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//     console.log(`🚀 Corleon Server running on port ${PORT}`);
// });
// =====================================================

// After adding the routes, restart your server:
// npm run start:dev

// Now you have access to these endpoints:

/*
┌─────────────────────────────────────────────────────────────────────┐
│                    LEARNING API ENDPOINTS                          │
└─────────────────────────────────────────────────────────────────────┘

KNOWLEDGE BASE MANAGEMENT
═════════════════════════

GET /api/ai/knowledge
  Returns all learned rules, facts, guidelines, and prohibitions
  Example: curl http://localhost:3000/api/ai/knowledge

POST /api/ai/teach
  Teach the AI a new rule
  Body: { "rule": "Always be professional", "category": "rules" }
  Categories: rules, facts, guidelines, prohibitions

DELETE /api/ai/rule/:ruleId
  Delete a specific rule by ID

PUT /api/ai/rule/:ruleId
  Update a rule (content, active status, priority)
  Body: { "content": "New rule text", "active": true }


PERSONALITY & CONTEXT
════════════════════

GET /api/ai/personality
  Get current personality settings

POST /api/ai/personality
  Set personality
  Body: { "tone": "friendly", "style": "casual", "traits": ["helpful"] }

GET /api/ai/context
  Get current context settings

POST /api/ai/context
  Set context (domain, audience, brand voice)
  Body: { "domain": "e-commerce", "audience": "millennials", "brandVoice": "casual and fun" }

POST /api/ai/instruction
  Add custom instructions
  Body: { "instruction": "Always respond in under 100 words" }


CHAT & CONVERSATION
═══════════════════

POST /api/ai/chat
  Chat with the AI (uses all learned knowledge)
  Body: { "message": "What is machine learning?", "model": "openai:gpt-4o-mini" }
  Returns: { response, model, timestamp }

GET /api/ai/chat-history
  Get conversation history

DELETE /api/ai/chat-history
  Clear conversation history

POST /api/ai/converse
  Multi-turn conversation
  Body: { "messages": ["First question", "Follow-up question"] }


LEARNING & TRAINING
═══════════════════

GET /api/ai/training-data
  Get all training conversations and examples

POST /api/ai/rate
  Rate a response for learning
  Body: { "conversationId": "conv_xxx", "rating": 5, "feedback": "Excellent!" }

GET /api/ai/stats
  Get learning statistics and progress


IMPORT/EXPORT
═════════════

POST /api/ai/export
  Export all learned data as JSON
  Returns: filename and complete export data

POST /api/ai/import
  Import previously exported data
  Body: { "data": { ...exported data... } }


UTILITY
═══════

GET /api/ai/models
  Get available AI models

GET /api/ai/all
  Get everything: knowledge, personality, context, stats

*/

module.exports = {
    // This file is just for documentation
    // The actual implementation is in learningRoutes.js
};
