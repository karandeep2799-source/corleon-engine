const fs = require('fs');
const path = require('path');

const LEARNING_DIR = path.join(__dirname, 'data', 'ai-learning');
const KNOWLEDGE_BASE_FILE = path.join(LEARNING_DIR, 'knowledge-base.json');
const TRAINING_DATA_FILE = path.join(LEARNING_DIR, 'training-data.json');
const PERSONALITY_FILE = path.join(LEARNING_DIR, 'personality.json');
const CONTEXT_FILE = path.join(LEARNING_DIR, 'context.json');

// Ensure learning directories exist
function ensureLearningDirs() {
    if (!fs.existsSync(LEARNING_DIR)) {
        fs.mkdirSync(LEARNING_DIR, { recursive: true });
    }
}

// Initialize learning files if they don't exist
function initializeLearningFiles() {
    ensureLearningDirs();
    
    if (!fs.existsSync(KNOWLEDGE_BASE_FILE)) {
        fs.writeFileSync(KNOWLEDGE_BASE_FILE, JSON.stringify({
            rules: [],
            facts: [],
            guidelines: [],
            prohibitions: [],
            lastUpdated: new Date().toISOString()
        }, null, 2));
    }
    
    if (!fs.existsSync(TRAINING_DATA_FILE)) {
        fs.writeFileSync(TRAINING_DATA_FILE, JSON.stringify({
            conversations: [],
            examples: [],
            patterns: [],
            feedback: [],
            lastUpdated: new Date().toISOString()
        }, null, 2));
    }
    
    if (!fs.existsSync(PERSONALITY_FILE)) {
        fs.writeFileSync(PERSONALITY_FILE, JSON.stringify({
            tone: 'professional',
            style: 'clear and concise',
            values: [],
            traits: [],
            preferences: [],
            lastUpdated: new Date().toISOString()
        }, null, 2));
    }

    if (!fs.existsSync(CONTEXT_FILE)) {
        fs.writeFileSync(CONTEXT_FILE, JSON.stringify({
            domain: 'general',
            audience: 'general',
            constraints: [],
            customInstructions: [],
            brandVoice: '',
            lastUpdated: new Date().toISOString()
        }, null, 2));
    }
}

// Read learning data
function readLearningFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error);
    }
    return null;
}

// Write learning data
function writeLearningFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error(`Error writing ${filePath}:`, error);
        return false;
    }
}

// --- KNOWLEDGE BASE FUNCTIONS ---

function addRule(rule, category = 'rules') {
    const kb = readLearningFile(KNOWLEDGE_BASE_FILE) || { rules: [], facts: [], guidelines: [], prohibitions: [] };
    
    const newRule = {
        id: `rule_${Date.now()}`,
        content: rule,
        category: category,
        addedAt: new Date().toISOString(),
        priority: 'normal',
        active: true
    };
    
    if (!kb[category]) kb[category] = [];
    kb[category].push(newRule);
    kb.lastUpdated = new Date().toISOString();
    
    writeLearningFile(KNOWLEDGE_BASE_FILE, kb);
    return newRule;
}

function getKnowledgeBase() {
    initializeLearningFiles();
    return readLearningFile(KNOWLEDGE_BASE_FILE) || { rules: [], facts: [], guidelines: [], prohibitions: [] };
}

function deleteRule(ruleId) {
    const kb = readLearningFile(KNOWLEDGE_BASE_FILE) || { rules: [], facts: [], guidelines: [], prohibitions: [] };
    
    for (const category in kb) {
        if (Array.isArray(kb[category])) {
            kb[category] = kb[category].filter(r => r.id !== ruleId);
        }
    }
    
    kb.lastUpdated = new Date().toISOString();
    return writeLearningFile(KNOWLEDGE_BASE_FILE, kb);
}

function updateRule(ruleId, updates) {
    const kb = readLearningFile(KNOWLEDGE_BASE_FILE) || { rules: [], facts: [], guidelines: [], prohibitions: [] };
    
    for (const category in kb) {
        if (Array.isArray(kb[category])) {
            const rule = kb[category].find(r => r.id === ruleId);
            if (rule) {
                Object.assign(rule, updates, { lastModified: new Date().toISOString() });
                kb.lastUpdated = new Date().toISOString();
                writeLearningFile(KNOWLEDGE_BASE_FILE, kb);
                return rule;
            }
        }
    }
    return null;
}

// --- PERSONALITY FUNCTIONS ---

function setPersonality(personalityData) {
    const personality = readLearningFile(PERSONALITY_FILE) || {};
    Object.assign(personality, personalityData, { lastUpdated: new Date().toISOString() });
    writeLearningFile(PERSONALITY_FILE, personality);
    return personality;
}

function getPersonality() {
    initializeLearningFiles();
    return readLearningFile(PERSONALITY_FILE) || {
        tone: 'professional',
        style: 'clear and concise',
        values: [],
        traits: [],
        preferences: []
    };
}

function addTrait(trait, category = 'traits') {
    const personality = getPersonality();
    if (!personality[category]) personality[category] = [];
    
    if (!personality[category].includes(trait)) {
        personality[category].push(trait);
        personality.lastUpdated = new Date().toISOString();
        writeLearningFile(PERSONALITY_FILE, personality);
    }
    
    return personality;
}

// --- CONTEXT FUNCTIONS ---

function setContext(contextData) {
    const context = readLearningFile(CONTEXT_FILE) || {};
    Object.assign(context, contextData, { lastUpdated: new Date().toISOString() });
    writeLearningFile(CONTEXT_FILE, context);
    return context;
}

function getContext() {
    initializeLearningFiles();
    return readLearningFile(CONTEXT_FILE) || {
        domain: 'general',
        audience: 'general',
        constraints: [],
        customInstructions: [],
        brandVoice: ''
    };
}

function addCustomInstruction(instruction) {
    const context = getContext();
    if (!context.customInstructions) context.customInstructions = [];
    
    const newInstruction = {
        id: `instr_${Date.now()}`,
        text: instruction,
        addedAt: new Date().toISOString()
    };
    
    context.customInstructions.push(newInstruction);
    context.lastUpdated = new Date().toISOString();
    writeLearningFile(CONTEXT_FILE, context);
    return newInstruction;
}

// --- TRAINING DATA FUNCTIONS ---

function recordConversation(prompt, response, metadata = {}) {
    const training = readLearningFile(TRAINING_DATA_FILE) || { conversations: [], examples: [], patterns: [], feedback: [] };
    
    const conversation = {
        id: `conv_${Date.now()}`,
        prompt,
        response,
        timestamp: new Date().toISOString(),
        metadata,
        rating: null,
        feedback: null
    };
    
    training.conversations.push(conversation);
    training.lastUpdated = new Date().toISOString();
    writeLearningFile(TRAINING_DATA_FILE, training);
    
    return conversation;
}

function addTrainingExample(category, example) {
    const training = readLearningFile(TRAINING_DATA_FILE) || { conversations: [], examples: [], patterns: [], feedback: [] };
    
    const trainingExample = {
        id: `example_${Date.now()}`,
        category,
        content: example,
        addedAt: new Date().toISOString()
    };
    
    training.examples.push(trainingExample);
    training.lastUpdated = new Date().toISOString();
    writeLearningFile(TRAINING_DATA_FILE, training);
    
    return trainingExample;
}

function rateConversation(conversationId, rating, feedback = null) {
    const training = readLearningFile(TRAINING_DATA_FILE) || { conversations: [] };
    
    const conversation = training.conversations.find(c => c.id === conversationId);
    if (conversation) {
        conversation.rating = rating;
        conversation.feedback = feedback;
        conversation.ratedAt = new Date().toISOString();
        training.lastUpdated = new Date().toISOString();
        writeLearningFile(TRAINING_DATA_FILE, training);
    }
    
    return conversation;
}

function getTrainingData() {
    initializeLearningFiles();
    return readLearningFile(TRAINING_DATA_FILE) || { conversations: [], examples: [], patterns: [], feedback: [] };
}

// --- BUILD SYSTEM PROMPT ---

function buildSystemPrompt(basePrompt = '') {
    const kb = getKnowledgeBase();
    const personality = getPersonality();
    const context = getContext();
    
    let systemPrompt = basePrompt || 'You are a helpful AI assistant.';
    
    // Add personality
    if (personality.tone) {
        systemPrompt += `\n\nTone: ${personality.tone}`;
    }
    if (personality.style) {
        systemPrompt += `\nStyle: ${personality.style}`;
    }
    if (personality.values && personality.values.length) {
        systemPrompt += `\nValues: ${personality.values.join(', ')}`;
    }
    
    // Add context
    if (context.domain !== 'general') {
        systemPrompt += `\n\nDomain: ${context.domain}`;
    }
    if (context.brandVoice) {
        systemPrompt += `\nBrand Voice: ${context.brandVoice}`;
    }
    if (context.audience !== 'general') {
        systemPrompt += `\nTarget Audience: ${context.audience}`;
    }
    
    // Add custom instructions
    if (context.customInstructions && context.customInstructions.length) {
        systemPrompt += '\n\nCustom Instructions:';
        context.customInstructions.forEach((instr, i) => {
            systemPrompt += `\n${i + 1}. ${instr.text}`;
        });
    }
    
    // Add rules from knowledge base
    if (kb.rules && kb.rules.length > 0) {
        systemPrompt += '\n\nRules to Follow:';
        kb.rules.filter(r => r.active).forEach((rule, i) => {
            systemPrompt += `\n${i + 1}. ${rule.content}`;
        });
    }
    
    // Add guidelines
    if (kb.guidelines && kb.guidelines.length > 0) {
        systemPrompt += '\n\nGuidelines:';
        kb.guidelines.filter(r => r.active).forEach((guideline, i) => {
            systemPrompt += `\n${i + 1}. ${guideline.content}`;
        });
    }
    
    // Add prohibitions
    if (kb.prohibitions && kb.prohibitions.length > 0) {
        systemPrompt += '\n\nProhibitions (do NOT do these):';
        kb.prohibitions.filter(r => r.active).forEach((prohibition, i) => {
            systemPrompt += `\n${i + 1}. ${prohibition.content}`;
        });
    }
    
    // Add facts
    if (kb.facts && kb.facts.length > 0) {
        systemPrompt += '\n\nFacts to Remember:';
        kb.facts.filter(r => r.active).forEach((fact, i) => {
            systemPrompt += `\n${i + 1}. ${fact.content}`;
        });
    }
    
    return systemPrompt;
}

// --- LEARNING ANALYTICS ---

function getLearningStats() {
    const kb = getKnowledgeBase();
    const training = getTrainingData();
    const personality = getPersonality();
    const context = getContext();
    
    const stats = {
        knowledgeBase: {
            totalRules: (kb.rules || []).length,
            activeBrainRules: (kb.rules || []).filter(r => r.active).length,
            facts: (kb.facts || []).length,
            guidelines: (kb.guidelines || []).length,
            prohibitions: (kb.prohibitions || []).length
        },
        training: {
            conversations: (training.conversations || []).length,
            examples: (training.examples || []).length,
            averageRating: training.conversations && training.conversations.length > 0
                ? (training.conversations.filter(c => c.rating).reduce((sum, c) => sum + c.rating, 0) / 
                   training.conversations.filter(c => c.rating).length).toFixed(2)
                : 'N/A'
        },
        personality: {
            tone: personality.tone || 'not set',
            style: personality.style || 'not set',
            traits: (personality.traits || []).length
        },
        context: {
            domain: context.domain || 'general',
            audience: context.audience || 'general',
            customInstructions: (context.customInstructions || []).length
        }
    };
    
    return stats;
}

// --- EXPORT/IMPORT ---

function exportLearningData() {
    const kb = getKnowledgeBase();
    const training = getTrainingData();
    const personality = getPersonality();
    const context = getContext();
    
    return {
        knowledgeBase: kb,
        trainingData: training,
        personality: personality,
        context: context,
        exportedAt: new Date().toISOString()
    };
}

function importLearningData(data) {
    if (data.knowledgeBase) writeLearningFile(KNOWLEDGE_BASE_FILE, data.knowledgeBase);
    if (data.trainingData) writeLearningFile(TRAINING_DATA_FILE, data.trainingData);
    if (data.personality) writeLearningFile(PERSONALITY_FILE, data.personality);
    if (data.context) writeLearningFile(CONTEXT_FILE, data.context);
    
    return { success: true, message: 'Learning data imported successfully' };
}

// Initialize on module load
ensureLearningDirs();
initializeLearningFiles();

module.exports = {
    // Knowledge Base
    addRule,
    getKnowledgeBase,
    deleteRule,
    updateRule,
    
    // Personality
    setPersonality,
    getPersonality,
    addTrait,
    
    // Context
    setContext,
    getContext,
    addCustomInstruction,
    
    // Training
    recordConversation,
    addTrainingExample,
    rateConversation,
    getTrainingData,
    
    // System Prompt
    buildSystemPrompt,
    
    // Analytics
    getLearningStats,
    
    // Import/Export
    exportLearningData,
    importLearningData
};
