"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
/**
 * Zoho SalesIQ API Service
 * Handles actual API calls to Zoho SalesIQ
 */
class ZohoSalesIQAPIService {
    constructor() {
        this.baseURL = 'https://salesiq.zoho.com/api/v2';
        // Store conversation IDs mapped to phone numbers
        this.conversationMap = new Map();
        this.accessToken = process.env.ZOHO_ACCESS_TOKEN || '';
        this.refreshToken = process.env.ZOHO_REFRESH_TOKEN || '';
        this.clientId = process.env.ZOHO_CLIENT_ID || '';
        this.clientSecret = process.env.ZOHO_CLIENT_SECRET || '';
        this.widgetCode = process.env.ZOHO_WIDGET_CODE || '';
    }
    /**
     * Refresh access token if needed
     */
    async refreshAccessToken() {
        try {
            const response = await axios_1.default.post('https://accounts.zoho.com/oauth/v2/token', null, {
                params: {
                    refresh_token: this.refreshToken,
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    grant_type: 'refresh_token'
                }
            });
            this.accessToken = response.data.access_token;
            process.env.ZOHO_ACCESS_TOKEN = this.accessToken;
            console.log('✅ Access token refreshed successfully');
        }
        catch (error) {
            console.error('Failed to refresh token:', error.response?.data || error.message);
        }
    }
    /**
     * Make API request with automatic token refresh
     */
    async makeRequest(method, endpoint, data) {
        try {
            const response = await (0, axios_1.default)({
                method,
                url: `${this.baseURL}${endpoint}`,
                headers: {
                    'Authorization': `Zoho-oauthtoken ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                data
            });
            return response.data;
        }
        catch (error) {
            // If unauthorized, try refreshing token
            if (error.response?.status === 401) {
                console.log('Token expired, refreshing...');
                await this.refreshAccessToken();
                // Retry request with new token
                const response = await (0, axios_1.default)({
                    method,
                    url: `${this.baseURL}${endpoint}`,
                    headers: {
                        'Authorization': `Zoho-oauthtoken ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    data
                });
                return response.data;
            }
            console.error(`API Error [${endpoint}]:`, error.response?.data || error.message);
            throw error;
        }
    }
    /**
     * Create or update a visitor in SalesIQ
     */
    async createOrUpdateVisitor(phone, name) {
        try {
            // First, try to get the portal ID (org ID)
            const portals = await this.makeRequest('GET', '/portals');
            if (!portals?.data?.[0]?.id) {
                console.log('No portal found, using alternative approach');
                return { visitor_id: phone }; // Fallback
            }
            const portalId = portals.data[0].id;
            // Create visitor data
            const visitorData = {
                name: name || phone,
                phone: phone,
                info: {
                    phone: phone,
                    source: 'WhatsApp Bot'
                }
            };
            // Try to create/update visitor
            const visitor = await this.makeRequest('POST', `/${portalId}/visitors`, visitorData);
            console.log(`✅ Visitor created/updated: ${phone}`);
            return visitor;
        }
        catch (error) {
            console.log('Could not create visitor via API, will track locally');
            return { visitor_id: phone };
        }
    }
    /**
     * Send a message to SalesIQ
     */
    async sendMessage(phone, message, sender) {
        try {
            // Get or create conversation ID
            let conversationId = this.conversationMap.get(phone);
            if (!conversationId) {
                // Create new conversation
                conversationId = `conv_${phone}_${Date.now()}`;
                this.conversationMap.set(phone, conversationId);
                // Log conversation creation
                console.log(`📝 New conversation created: ${conversationId}`);
            }
            // Since we don't have proper API access, we'll use an alternative approach
            // We can send data to a custom endpoint or use the widget embedding
            // For now, log the message in a format that can be monitored
            const messageData = {
                conversation_id: conversationId,
                phone: phone,
                message: message,
                sender: sender,
                timestamp: new Date().toISOString()
            };
            console.log('💬 SalesIQ Message:', messageData);
            // Try to send via webhook if available
            if (process.env.ZOHO_WEBHOOK_URL) {
                try {
                    await axios_1.default.post(process.env.ZOHO_WEBHOOK_URL, messageData);
                }
                catch (webhookError) {
                    console.log('Webhook not configured or failed');
                }
            }
            // Store message locally for dashboard display
            this.storeMessageLocally(phone, message, sender);
        }
        catch (error) {
            console.error('Failed to send message to SalesIQ:', error.message);
        }
    }
    /**
     * Store message locally for dashboard
     */
    storeMessageLocally(phone, message, sender) {
        // This will be picked up by our local dashboard
        const messageEvent = {
            type: 'message',
            phone: phone,
            message: message,
            sender: sender,
            timestamp: new Date()
        };
        // Emit to any connected dashboards via SSE or WebSocket
        // For now, just log it
        console.log('📊 Dashboard Event:', messageEvent);
    }
    /**
     * Get conversation history
     */
    async getConversationHistory(phone) {
        const conversationId = this.conversationMap.get(phone);
        if (!conversationId) {
            return [];
        }
        // In a real implementation, this would fetch from Zoho API
        // For now, return empty array
        return [];
    }
    /**
     * Mark conversation as handled by agent
     */
    async markAsAgentControlled(phone, agentId) {
        const conversationId = this.conversationMap.get(phone);
        if (conversationId) {
            console.log(`🎯 Agent ${agentId} took control of ${conversationId}`);
            // In real implementation, this would update Zoho
        }
    }
    /**
     * Release conversation from agent control
     */
    async releaseFromAgent(phone) {
        const conversationId = this.conversationMap.get(phone);
        if (conversationId) {
            console.log(`🤖 Released ${conversationId} back to bot`);
            // In real implementation, this would update Zoho
        }
    }
}
exports.default = new ZohoSalesIQAPIService();
