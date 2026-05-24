const aiLearning = require('./aiLearning');
const { createAiGateway } = require('./aiGateway');

/**
 * Standalone AI Engine
 * Uses learned knowledge, personality, and context to generate intelligent responses
 * Independent from the main server - can be used in any Node.js application
 */

class StandaloneAI {
    constructor(options = {}) {
        this.options = {
            model: options.model || process.env.DEFAULT_TEXT_MODEL || 'openai:gpt-4o-mini',
            useLocalOnly: options.useLocalOnly || false,
            recordConversations: options.recordConversations !== false,
            enableLearning: options.enableLearning !== false,
            timeout: options.timeout || 60000,
            ...options
        };
        
        this.aiGateway = createAiGateway();
        this.conversationHistory = [];
        this.maxHistoryLength = options.maxHistory || 10;
    }

    /**
     * Teach the AI a new rule
     */
    teach(rule, category = 'rules') {
        const result = aiLearning.addRule(rule, category);
        console.log(`[AI Learning] Added ${category}:`, rule);
        return result;
    }

    /**
     * Add a custom instruction
     */
    addInstruction(instruction) {
        const result = aiLearning.addCustomInstruction(instruction);
        console.log(`[AI Learning] Added instruction:`, instruction);
        return result;
    }

    /**
     * Set personality trait
     */
    setTrait(trait, category = 'traits') {
        const result = aiLearning.addTrait(trait, category);
        console.log(`[AI Learning] Added trait:`, trait);
        return result;
    }

    /**
     * Set brand voice and context
     */
    setBrandVoice(brandVoice) {
        const context = aiLearning.getContext();
        context.brandVoice = brandVoice;
        aiLearning.setContext(context);
        return context;
    }

    /**
     * Set domain and audience context
     */
    setContext(domain, audience = 'general') {
        const context = aiLearning.getContext();
        context.domain = domain;
        context.audience = audience;
        aiLearning.setContext(context);
        return context;
    }

    /**
     * Main chat/response method
     */
    async chat(userMessage, options = {}) {
        try {
            // Add to conversation history
            this.conversationHistory.push({
                role: 'user',
                content: userMessage,
                timestamp: new Date()
            });

            // Build enhanced system prompt with learned knowledge
            const systemPrompt = aiLearning.buildSystemPrompt(
                options.systemPrompt || 'You are a helpful, intelligent AI assistant.'
            );

            // Prepare messages for AI
            const messages = this._buildMessageContext(userMessage);

            // Get response from AI
            const response = await this.aiGateway.generateText({
                model: options.model || this.options.model,
                prompt: userMessage,
                systemPrompt: systemPrompt
            });

            // Add to conversation history
            this.conversationHistory.push({
                role: 'assistant',
                content: response,
                timestamp: new Date()
            });

            // Record conversation if learning is enabled
            if (this.options.recordConversations && this.options.enableLearning) {
                aiLearning.recordConversation(userMessage, response, {
                    model: options.model || this.options.model,
                    context: options.context || {}
                });
            }

            // Trim history if it gets too long
            if (this.conversationHistory.length > this.maxHistoryLength) {
                this.conversationHistory.shift();
            }

            return {
                response,
                timestamp: new Date(),
                model: options.model || this.options.model,
                learningApplied: this.options.enableLearning
            };

        } catch (error) {
            console.error('[StandaloneAI Error]:', error);
            throw error;
        }
    }

    /**
     * Build message context from conversation history
     */
    _buildMessageContext(userMessage) {
        const recentHistory = this.conversationHistory.slice(-6);
        return recentHistory.map(msg => ({
            role: msg.role,
            content: msg.content
        })).concat([{
            role: 'user',
            content: userMessage
        }]);
    }

    /**
     * Rate a response (for continuous learning)
     */
    rateLastResponse(rating, feedback = null) {
        if (this.conversationHistory.length >= 2) {
            const lastUserMsg = this.conversationHistory[this.conversationHistory.length - 2];
            const lastAIMsg = this.conversationHistory[this.conversationHistory.length - 1];
            
            // Find the conversation record
            const training = aiLearning.getTrainingData();
            const lastConv = training.conversations[training.conversations.length - 1];
            
            if (lastConv) {
                aiLearning.rateConversation(lastConv.id, rating, feedback);
                console.log(`[AI Learning] Rated response: ${rating}/5 - ${feedback || ''}`);
            }
        }
    }

    /**
     * Get conversation history
     */
    getHistory() {
        return this.conversationHistory;
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
    }

    /**
     * Get AI stats and knowledge
     */
    getStats() {
        return aiLearning.getLearningStats();
    }

    /**
     * Get all learned knowledge
     */
    getKnowledge() {
        return {
            knowledgeBase: aiLearning.getKnowledgeBase(),
            personality: aiLearning.getPersonality(),
            context: aiLearning.getContext(),
            trainingData: aiLearning.getTrainingData()
        };
    }

    /**
     * Export learned data for backup/sharing
     */
    exportLearning() {
        return aiLearning.exportLearningData();
    }

    /**
     * Import learned data from backup/external source
     */
    importLearning(data) {
        return aiLearning.importLearningData(data);
    }

    /**
     * Delete a specific rule
     */
    deleteRule(ruleId) {
        return aiLearning.deleteRule(ruleId);
    }

    /**
     * Update a specific rule
     */
    updateRule(ruleId, updates) {
        return aiLearning.updateRule(ruleId, updates);
    }

    /**
     * Get available models
     */
    getAvailableModels() {
        return this.aiGateway.models;
    }

    /**
     * Multi-turn conversation with context awareness
     */
    async converse(userMessages) {
        const results = [];
        
        for (const message of userMessages) {
            const result = await this.chat(message);
            results.push(result);
        }
        
        return results;
    }

    /**
     * Generate response with custom system prompt
     */
    async generateWithSystemPrompt(userMessage, customSystemPrompt) {
        return this.chat(userMessage, { systemPrompt: customSystemPrompt });
    }
}

// Export for use in other modules
module.exports = StandaloneAI;

// Example usage for direct execution
if (require.main === module) {
    (async () => {
        console.log('🤖 Initializing Standalone AI Engine...\n');

        const ai = new StandaloneAI({
            model: 'openai:gpt-4o-mini',
            recordConversations: true,
            enableLearning: true
        });

        // Teach the AI some custom rules
        ai.teach('Always be helpful and respectful', 'rules');
        ai.teach('Respond in markdown format when appropriate', 'guidelines');
        ai.setTrait('helpful');
        ai.setTrait('curious');
        ai.setBrandVoice('Professional yet friendly');
        ai.setContext('software development', 'developers');

        console.log('\n📚 AI Knowledge Loaded:');
        console.log(JSON.stringify(ai.getStats(), null, 2));

        // Test the AI
        console.log('\n💬 Starting conversation...\n');

        try {
            const response1 = await ai.chat('What is machine learning?');
            console.log('User: What is machine learning?');
            console.log('AI:', response1.response);
            console.log('');

            const response2 = await ai.chat('Can you explain it more simply?');
            console.log('User: Can you explain it more simply?');
            console.log('AI:', response2.response);
            console.log('');

            // Rate the response
            ai.rateLastResponse(5, 'Very clear explanation');

            console.log('\n✅ Conversation complete');
            console.log('📊 Updated Stats:');
            console.log(JSON.stringify(ai.getStats(), null, 2));

        } catch (error) {
            console.error('❌ Error:', error.message);
        }
    })();
}
