// Learning API Routes
// Add these routes to your server.js after the existing routes

const aiLearning = require('./aiLearning');
const StandaloneAI = require('./standaloneAI');

// Initialize standalone AI instance
const standaloneAI = new StandaloneAI({
    model: process.env.DEFAULT_TEXT_MODEL || 'openai:gpt-4o-mini',
    recordConversations: true,
    enableLearning: true
});

/**
 * GET /api/ai/knowledge
 * Retrieve all learned knowledge
 */
function setupLearningRoutes(app) {
    app.get('/api/ai/knowledge', (req, res) => {
        try {
            const knowledge = aiLearning.getKnowledgeBase();
            res.json(knowledge);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/ai/teach
     * Teach the AI a new rule
     * Body: { rule: string, category?: 'rules' | 'facts' | 'guidelines' | 'prohibitions' }
     */
    app.post('/api/ai/teach', (req, res) => {
        try {
            const { rule, category = 'rules' } = req.body;
            
            if (!rule || !rule.trim()) {
                return res.status(400).json({ error: 'Rule is required' });
            }
            
            const newRule = aiLearning.addRule(rule, category);
            res.status(201).json({ 
                success: true, 
                rule: newRule,
                message: `AI learned: ${rule}`
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/ai/instruction
     * Add a custom instruction
     * Body: { instruction: string }
     */
    app.post('/api/ai/instruction', (req, res) => {
        try {
            const { instruction } = req.body;
            
            if (!instruction || !instruction.trim()) {
                return res.status(400).json({ error: 'Instruction is required' });
            }
            
            const newInstruction = aiLearning.addCustomInstruction(instruction);
            res.status(201).json({
                success: true,
                instruction: newInstruction,
                message: 'Custom instruction added'
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * DELETE /api/ai/rule/:ruleId
     * Delete a specific rule
     */
    app.delete('/api/ai/rule/:ruleId', (req, res) => {
        try {
            const { ruleId } = req.params;
            const success = aiLearning.deleteRule(ruleId);
            
            if (success) {
                res.json({ success: true, message: 'Rule deleted' });
            } else {
                res.status(404).json({ error: 'Rule not found' });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * PUT /api/ai/rule/:ruleId
     * Update a specific rule
     * Body: { content?: string, active?: boolean, priority?: string }
     */
    app.put('/api/ai/rule/:ruleId', (req, res) => {
        try {
            const { ruleId } = req.params;
            const updates = req.body;
            
            const updated = aiLearning.updateRule(ruleId, updates);
            
            if (updated) {
                res.json({ success: true, rule: updated });
            } else {
                res.status(404).json({ error: 'Rule not found' });
            }
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/ai/personality
     * Get current AI personality
     */
    app.get('/api/ai/personality', (req, res) => {
        try {
            const personality = aiLearning.getPersonality();
            res.json(personality);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/ai/personality
     * Set AI personality
     * Body: { tone?: string, style?: string, traits?: string[], values?: string[] }
     */
    app.post('/api/ai/personality', (req, res) => {
        try {
            const personality = aiLearning.setPersonality(req.body);
            res.json({ success: true, personality });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/ai/context
     * Get current AI context
     */
    app.get('/api/ai/context', (req, res) => {
        try {
            const context = aiLearning.getContext();
            res.json(context);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/ai/context
     * Set AI context
     * Body: { domain?: string, audience?: string, brandVoice?: string, customInstructions?: string[] }
     */
    app.post('/api/ai/context', (req, res) => {
        try {
            const context = aiLearning.setContext(req.body);
            res.json({ success: true, context });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/ai/stats
     * Get AI learning statistics
     */
    app.get('/api/ai/stats', (req, res) => {
        try {
            const stats = aiLearning.getLearningStats();
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/ai/training-data
     * Get training data and conversation history
     */
    app.get('/api/ai/training-data', (req, res) => {
        try {
            const data = aiLearning.getTrainingData();
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/ai/rate
     * Rate a conversation response
     * Body: { conversationId: string, rating: number, feedback?: string }
     */
    app.post('/api/ai/rate', (req, res) => {
        try {
            const { conversationId, rating, feedback } = req.body;
            
            if (!conversationId || !rating || rating < 1 || rating > 5) {
                return res.status(400).json({ error: 'Valid conversationId and rating (1-5) required' });
            }
            
            const result = aiLearning.rateConversation(conversationId, rating, feedback);
            res.json({ success: true, result });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/ai/chat
     * Chat with the standalone AI (uses learned knowledge)
     * Body: { message: string, model?: string }
     */
    app.post('/api/ai/chat', async (req, res) => {
        try {
            const { message, model } = req.body;
            
            if (!message || !message.trim()) {
                return res.status(400).json({ error: 'Message is required' });
            }
            
            const response = await standaloneAI.chat(message, { model });
            res.json({
                success: true,
                message,
                response: response.response,
                model: response.model,
                timestamp: response.timestamp
            });
        } catch (error) {
            console.error('Chat error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/ai/chat-history
     * Get conversation history
     */
    app.get('/api/ai/chat-history', (req, res) => {
        try {
            const history = standaloneAI.getHistory();
            res.json(history);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * DELETE /api/ai/chat-history
     * Clear conversation history
     */
    app.delete('/api/ai/chat-history', (req, res) => {
        try {
            standaloneAI.clearHistory();
            res.json({ success: true, message: 'Chat history cleared' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/ai/export
     * Export all learned data
     */
    app.post('/api/ai/export', (req, res) => {
        try {
            const exportData = aiLearning.exportLearningData();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            res.json({
                success: true,
                filename: `ai-learning-export-${timestamp}.json`,
                data: exportData
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/ai/import
     * Import learned data
     * Body: { data: object }
     */
    app.post('/api/ai/import', (req, res) => {
        try {
            const { data } = req.body;
            
            if (!data) {
                return res.status(400).json({ error: 'Data is required' });
            }
            
            const result = aiLearning.importLearningData(data);
            res.json({ success: true, ...result });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/ai/models
     * Get available models for the standalone AI
     */
    app.get('/api/ai/models', (req, res) => {
        try {
            const models = standaloneAI.getAvailableModels();
            res.json(models);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * POST /api/ai/converse
     * Multi-turn conversation
     * Body: { messages: string[] }
     */
    app.post('/api/ai/converse', async (req, res) => {
        try {
            const { messages } = req.body;
            
            if (!Array.isArray(messages) || messages.length === 0) {
                return res.status(400).json({ error: 'Messages array is required' });
            }
            
            const responses = await standaloneAI.converse(messages);
            res.json({
                success: true,
                conversation: messages.map((msg, i) => ({
                    userMessage: msg,
                    aiResponse: responses[i]?.response
                }))
            });
        } catch (error) {
            console.error('Converse error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * GET /api/ai/all
     * Get everything: knowledge, personality, context, stats
     */
    app.get('/api/ai/all', (req, res) => {
        try {
            const knowledge = aiLearning.getKnowledge();
            const stats = aiLearning.getLearningStats();
            
            res.json({
                knowledge,
                stats,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}

module.exports = {
    setupLearningRoutes,
    standaloneAI,
    aiLearning
};
