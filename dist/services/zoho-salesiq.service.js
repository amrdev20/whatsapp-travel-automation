"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const events_1 = __importDefault(require("events"));
class ZohoSalesIQService extends events_1.default {
    constructor() {
        super();
        this.baseUrl = 'https://salesiq.zoho.com/api/v2';
        this.conversations = new Map();
        this.agentControlMap = new Map(); // phone -> isAgentControlled
        this.initializeWebSocket();
    }
    /**
     * Initialize WebSocket connection for real-time agent events
     */
    initializeWebSocket() {
        // This will listen for agent takeover events
        // WebSocket URL from Zoho SalesIQ
    }
    /**
     * Create or get visitor in SalesIQ
     */
    async createOrGetVisitor(phone, message) {
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/portals/${process.env.ZOHO_PORTAL_ID}/visitors`, {
                phone,
                name: phone,
                info: {
                    first_message: message,
                    channel: 'API'
                }
            }, {
                headers: {
                    'Authorization': `Zoho-oauthtoken ${await this.getAccessToken()}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data.visitor;
        }
        catch (error) {
            console.error('Failed to create visitor in SalesIQ:', error);
            throw error;
        }
    }
    /**
     * Start a new conversation or get existing one
     */
    async startConversation(phone, initialMessage) {
        try {
            const visitor = await this.createOrGetVisitor(phone, initialMessage);
            const response = await axios_1.default.post(`${this.baseUrl}/portals/${process.env.ZOHO_PORTAL_ID}/conversations`, {
                visitor_id: visitor.id,
                department_id: process.env.ZOHO_DEPARTMENT_ID,
                question: initialMessage,
                source: 'API'
            }, {
                headers: {
                    'Authorization': `Zoho-oauthtoken ${await this.getAccessToken()}`,
                    'Content-Type': 'application/json'
                }
            });
            const conversation = {
                id: response.data.id,
                visitorId: visitor.id,
                status: 'active',
                messages: []
            };
            this.conversations.set(phone, conversation);
            return conversation.id;
        }
        catch (error) {
            console.error('Failed to start conversation:', error);
            throw error;
        }
    }
    /**
     * Send message to SalesIQ conversation
     */
    async sendMessage(phone, message, sender, metadata) {
        try {
            let conversation = this.conversations.get(phone);
            if (!conversation) {
                const conversationId = await this.startConversation(phone, message);
                conversation = this.conversations.get(phone);
            }
            // Send to Zoho SalesIQ
            await axios_1.default.post(`${this.baseUrl}/portals/${process.env.ZOHO_PORTAL_ID}/conversations/${conversation.id}/messages`, {
                text: message,
                sender_type: sender,
                metadata: {
                    ...metadata,
                    timestamp: new Date().toISOString(),
                    phone
                }
            }, {
                headers: {
                    'Authorization': `Zoho-oauthtoken ${await this.getAccessToken()}`,
                    'Content-Type': 'application/json'
                }
            });
            // Add to local cache
            conversation.messages.push({
                id: Date.now().toString(),
                text: message,
                sender,
                timestamp: new Date()
            });
            // Show in SalesIQ dashboard with context
            if (sender === 'bot' && metadata?.basketId) {
                await this.updateConversationInfo(phone, {
                    booking_stage: metadata.stage,
                    basket_id: metadata.basketId,
                    price: metadata.price,
                    route: metadata.route
                });
            }
        }
        catch (error) {
            console.error('Failed to send message to SalesIQ:', error);
        }
    }
    /**
     * Check if agent has taken control
     */
    async isAgentInControl(phone) {
        // Check local cache first
        if (this.agentControlMap.has(phone)) {
            return this.agentControlMap.get(phone);
        }
        try {
            const conversation = this.conversations.get(phone);
            if (!conversation)
                return false;
            // Check conversation status in Zoho
            const response = await axios_1.default.get(`${this.baseUrl}/portals/${process.env.ZOHO_PORTAL_ID}/conversations/${conversation.id}`, {
                headers: {
                    'Authorization': `Zoho-oauthtoken ${await this.getAccessToken()}`
                }
            });
            const hasAgent = response.data.agent_id !== null;
            const isAgentActive = response.data.status === 'agent_taken';
            const inControl = hasAgent && isAgentActive;
            this.agentControlMap.set(phone, inControl);
            return inControl;
        }
        catch (error) {
            console.error('Failed to check agent control:', error);
            return false;
        }
    }
    /**
     * Handle agent takeover event (called from webhook)
     */
    async handleAgentTakeover(conversationId, agentId) {
        // Find phone by conversation ID
        const phone = Array.from(this.conversations.entries())
            .find(([_, conv]) => conv.id === conversationId)?.[0];
        if (phone) {
            console.log(`🎯 Agent ${agentId} took control of conversation ${phone}`);
            this.agentControlMap.set(phone, true);
            // Update conversation status
            const conversation = this.conversations.get(phone);
            if (conversation) {
                conversation.status = 'agent_taken';
                conversation.agentId = agentId;
            }
            // Emit event for the chat controller
            this.emit('agent_takeover', { phone, agentId, conversationId });
        }
    }
    /**
     * Handle agent release control
     */
    async handleAgentRelease(conversationId) {
        const phone = Array.from(this.conversations.entries())
            .find(([_, conv]) => conv.id === conversationId)?.[0];
        if (phone) {
            console.log(`🤖 Agent released control of conversation ${phone}, returning to AI`);
            this.agentControlMap.set(phone, false);
            const conversation = this.conversations.get(phone);
            if (conversation) {
                conversation.status = 'active';
                conversation.agentId = undefined;
            }
            this.emit('agent_release', { phone, conversationId });
        }
    }
    /**
     * Update conversation with booking details
     */
    async updateConversationInfo(phone, details) {
        try {
            const conversation = this.conversations.get(phone);
            if (!conversation)
                return;
            await axios_1.default.put(`${this.baseUrl}/portals/${process.env.ZOHO_PORTAL_ID}/conversations/${conversation.id}/info`, {
                custom_fields: details
            }, {
                headers: {
                    'Authorization': `Zoho-oauthtoken ${await this.getAccessToken()}`,
                    'Content-Type': 'application/json'
                }
            });
        }
        catch (error) {
            console.error('Failed to update conversation info:', error);
        }
    }
    /**
     * Get agent's message to send to user
     */
    async getAgentMessage(phone) {
        try {
            const conversation = this.conversations.get(phone);
            if (!conversation)
                return null;
            // Poll for new agent messages
            const response = await axios_1.default.get(`${this.baseUrl}/portals/${process.env.ZOHO_PORTAL_ID}/conversations/${conversation.id}/messages`, {
                headers: {
                    'Authorization': `Zoho-oauthtoken ${await this.getAccessToken()}`
                }
            });
            const messages = response.data.messages;
            const lastAgentMessage = messages
                .filter((m) => m.sender_type === 'agent')
                .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())[0];
            return lastAgentMessage?.text || null;
        }
        catch (error) {
            console.error('Failed to get agent message:', error);
            return null;
        }
    }
    /**
     * Get OAuth access token
     */
    async getAccessToken() {
        // Implementation for OAuth token refresh
        // This would use refresh token to get new access token
        return process.env.ZOHO_ACCESS_TOKEN || '';
    }
}
exports.default = new ZohoSalesIQService();
