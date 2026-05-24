// Multi-Model Learning System
// Enables your AI to learn from and integrate multiple powerful AI models
// Supports: Claude Sonnet, GPT-4o, Gemini, and more

const aiLearning = require('./aiLearning');

class MultiModelLearner {
    constructor(options = {}) {
        this.models = {
            'openai:gpt-4o': { name: 'GPT-4o', provider: 'openai', capability: 'reasoning' },
            'openai:gpt-4o-mini': { name: 'GPT-4o Mini', provider: 'openai', capability: 'speed' },
            'anthropic:claude-3-5-sonnet-latest': { name: 'Claude 3.5 Sonnet', provider: 'anthropic', capability: 'analysis' },
            'anthropic:claude-3-5-haiku-latest': { name: 'Claude 3.5 Haiku', provider: 'anthropic', capability: 'speed' },
            'gemini:gemini-2.0-flash': { name: 'Gemini 2.0 Flash', provider: 'google', capability: 'multimodal' },
            'offline:ollama:llama3.2': { name: 'Llama 3.2', provider: 'ollama', capability: 'local' }
        };
        
        this.learningStrategies = {
            // Learn from Claude's analytical approach
            'claude-analysis': {
                instruction: 'Analyze problems deeply like Claude, breaking them into components',
                priority: 'high'
            },
            // Learn from GPT-4o's reasoning
            'gpt-reasoning': {
                instruction: 'Reason through problems step-by-step like GPT-4o',
                priority: 'high'
            },
            // Learn from Gemini's multimodal understanding
            'gemini-vision': {
                instruction: 'Consider multiple perspectives and modalities',
                priority: 'medium'
            }
        };
        
        this.modelComparisons = [];
        this.bestPractices = [];
        this.options = options;
    }

    /**
     * Learn from a specific model's response
     */
    learnFromModel(modelId, prompt, response, metadata = {}) {
        const model = this.models[modelId];
        if (!model) {
            throw new Error(`Unknown model: ${modelId}`);
        }

        // Extract insights from the response
        const insights = this._extractInsights(response, model);
        
        // Record the learning
        const learningRecord = {
            id: `learn_${Date.now()}`,
            modelId,
            modelName: model.name,
            provider: model.provider,
            capability: model.capability,
            prompt,
            response,
            insights,
            metadata,
            timestamp: new Date().toISOString()
        };

        // Store in training data
        aiLearning.addTrainingExample('model-learning', learningRecord);

        // Apply learnings as rules
        insights.forEach(insight => {
            const rule = `From ${model.name}: ${insight}`;
            aiLearning.addRule(rule, 'guidelines');
        });

        return learningRecord;
    }

    /**
     * Extract insights from a model's response
     */
    _extractInsights(response, model) {
        const insights = [];
        
        // Claude-specific insights
        if (model.name.includes('Claude')) {
            if (response.includes('Therefore') || response.includes('In conclusion')) {
                insights.push('Use logical progression and clear conclusions');
            }
            if (response.includes('the key')) {
                insights.push('Identify key points and distill information');
            }
        }

        // GPT-specific insights
        if (model.name.includes('GPT')) {
            if (response.includes('step')) {
                insights.push('Break complex tasks into steps');
            }
            if (response.includes('example')) {
                insights.push('Provide concrete examples to illustrate points');
            }
        }

        // Gemini-specific insights
        if (model.name.includes('Gemini')) {
            if (response.includes('consider') || response.includes('perspective')) {
                insights.push('Consider multiple perspectives and viewpoints');
            }
        }

        return insights.length > 0 ? insights : ['Use clear and structured thinking'];
    }

    /**
     * Compare responses from multiple models
     */
    async compareModels(prompt, modelIds, aiGateway) {
        const results = [];
        
        for (const modelId of modelIds) {
            try {
                const response = await aiGateway.generateText({
                    model: modelId,
                    prompt,
                    systemPrompt: 'Provide a clear, detailed response.'
                });

                const result = {
                    model: this.models[modelId],
                    response,
                    length: response.length,
                    timestamp: new Date().toISOString()
                };

                results.push(result);
                
                // Learn from each response
                this.learnFromModel(modelId, prompt, response, { comparison: true });

            } catch (error) {
                console.error(`Error with model ${modelId}:`, error.message);
                results.push({
                    model: this.models[modelId],
                    error: error.message
                });
            }
        }

        this.modelComparisons.push({
            id: `comparison_${Date.now()}`,
            prompt,
            results,
            timestamp: new Date().toISOString()
        });

        return results;
    }

    /**
     * Get best response from multiple models
     */
    async getBestResponse(prompt, modelIds, aiGateway) {
        const results = await this.compareModels(prompt, modelIds, aiGateway);
        
        // Simple heuristic: longer, more detailed responses are often better
        // In production, you'd want more sophisticated ranking
        const bestResult = results
            .filter(r => !r.error)
            .sort((a, b) => b.length - a.length)[0];

        return {
            bestResponse: bestResult.response,
            model: bestResult.model,
            allResults: results
        };
    }

    /**
     * Create a synthesized response from multiple models
     */
    synthesizeResponses(responses) {
        return {
            summary: 'Multi-model analysis complete',
            responses,
            synthesized: `Drawing from ${responses.length} different AI perspectives...`,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Set up continuous learning from a model
     */
    setupContinuousLearning(modelId, learningGoal) {
        const rule = `Continuously learn from ${this.models[modelId]?.name}: ${learningGoal}`;
        aiLearning.addRule(rule, 'rules');
        
        return {
            modelId,
            goal: learningGoal,
            setupAt: new Date().toISOString()
        };
    }

    /**
     * Get model strengths and apply them
     */
    getModelStrengths() {
        return {
            'claude-3-5-sonnet': {
                strengths: ['Deep analysis', 'Nuanced reasoning', 'Long-form content'],
                bestFor: ['Complex analysis', 'Research', 'Strategic thinking']
            },
            'gpt-4o': {
                strengths: ['Versatility', 'Speed', 'Reasoning', 'Code'],
                bestFor: ['General purpose', 'Creative writing', 'Technical tasks']
            },
            'gemini-2.0-flash': {
                strengths: ['Multimodal', 'Vision', 'Fast', 'Creative'],
                bestFor: ['Image understanding', 'Creative tasks', 'Quick processing']
            },
            'llama3.2': {
                strengths: ['Local', 'Privacy', 'Cost-effective', 'Open-source'],
                bestFor: ['Offline use', 'Privacy-critical', 'Budget-conscious']
            }
        };
    }

    /**
     * Build composite learning from all models
     */
    buildCompositeApproach() {
        const strengths = this.getModelStrengths();
        const compositePrompt = `
You combine the best approaches from multiple leading AI models:
- Claude 3.5 Sonnet's deep analytical thinking
- GPT-4o's versatile reasoning and technical prowess
- Gemini 2.0 Flash's creative and multimodal understanding
- Llama 3.2's reliable local processing

Leverage each model's strengths for optimal results.
        `;

        aiLearning.setPersonality({
            tone: 'balanced and insightful',
            style: 'combining multiple approaches',
            traits: [
                'analytically rigorous like Claude',
                'versatile like GPT-4o',
                'creatively thinking like Gemini',
                'grounded like Llama'
            ],
            values: ['depth', 'speed', 'creativity', 'reliability']
        });

        return compositePrompt;
    }

    /**
     * Get learning stats from all models
     */
    getLearningStats() {
        const training = aiLearning.getTrainingData();
        const modelLearnings = training.examples.filter(ex => 
            ex.category === 'model-learning'
        );

        return {
            totalModelsLearned: new Set(modelLearnings.map(m => m.content?.modelId)).size,
            totalInsights: modelLearnings.length,
            modelBreakdown: this._getModelBreakdown(modelLearnings),
            comparisonsRun: this.modelComparisons.length,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get breakdown of learning from each model
     */
    _getModelBreakdown(learnings) {
        const breakdown = {};
        learnings.forEach(learning => {
            const modelId = learning.content?.modelId;
            if (modelId) {
                breakdown[modelId] = (breakdown[modelId] || 0) + 1;
            }
        });
        return breakdown;
    }

    /**
     * Export multi-model learning data
     */
    exportMultiModelLearning() {
        return {
            multiModelLearning: {
                learningStrategies: this.learningStrategies,
                modelComparisons: this.modelComparisons,
                modelStrengths: this.getModelStrengths(),
                compositeApproach: this.buildCompositeApproach(),
                stats: this.getLearningStats()
            },
            exportedAt: new Date().toISOString()
        };
    }
}

module.exports = MultiModelLearner;

// Example usage
if (require.main === module) {
    const learner = new MultiModelLearner();
    
    console.log('🧠 Multi-Model Learning System Initialized');
    console.log('\n📊 Available Models:');
    Object.entries(learner.models).forEach(([id, model]) => {
        console.log(`  - ${model.name}: ${model.capability}`);
    });

    console.log('\n💡 Strengths:');
    console.log(JSON.stringify(learner.getModelStrengths(), null, 2));

    console.log('\n🎯 Composite Approach:');
    console.log(learner.buildCompositeApproach());
}
