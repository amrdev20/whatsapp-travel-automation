"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
/**
 * Zoho SalesIQ REST API v2 Service
 * Based on official documentation: https://www.zoho.com/salesiq/help/developer-section/rest-api-v2.html
 */
class ZohoSalesIQV2Service {
    constructor() {
        this.screenName = 'offto'; // Your SalesIQ screen name
        this.baseURL = 'https://salesiq.zoho.com';
        // Store conversation IDs mapped to phone numbers
        this.conversationMap = new Map();
        this.accessToken = process.env.ZOHO_ACCESS_TOKEN || '';
        this.refreshToken = process.env.ZOHO_REFRESH_TOKEN || '';
        this.clientId = process.env.ZOHO_CLIENT_ID || '';
        this.clientSecret = process.env.ZOHO_CLIENT_SECRET || '';
        // You need to get these from your Zoho SalesIQ dashboard
        // Settings -> Developer Space -> App Details
        this.screenName = process.env.ZOHO_SCREEN_NAME || 'offto';
        this.axiosInstance = axios_1.default.create({
            baseURL: this.baseURL,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        // Add request interceptor for auth
        this.axiosInstance.interceptors.request.use((config) => {
            config.headers.Authorization = `Zoho-oauthtoken ${this.accessToken}`;
            return config;
        }, (error) => Promise.reject(error));
        // Add response interceptor for token refresh
        this.axiosInstance.interceptors.response.use((response) => response, async (error) => {
            const originalRequest = error.config;
            if (error.response?.status === 401 && !originalRequest._retry) {
                originalRequest._retry = true;
                await this.refreshAccessToken();
                originalRequest.headers.Authorization = `Zoho-oauthtoken ${this.accessToken}`;
                return this.axiosInstance(originalRequest);
            }
            return Promise.reject(error);
        });
    }
    /**
     * Refresh access token using refresh token
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
            console.log('✅ Zoho access token refreshed successfully');
        }
        catch (error) {
            console.error('Failed to refresh Zoho token:', error.response?.data || error.message);
            throw error;
        }
    }
    /**
     * Get or fetch app_id and department_id from Zoho
     * These are required for creating conversations
     */
    async getAppDetails() {
        try {
            // First, try to get app details
            const appsResponse = await this.axiosInstance.get(`/api/v2/${this.screenName}/apps`);
            // Get the first app (usually there's only one)
            const app_id = appsResponse.data?.data?.[0]?.id || process.env.ZOHO_APP_ID || '';
            // Get departments
            const deptsResponse = await this.axiosInstance.get(`/api/v2/${this.screenName}/departments`);
            // Get the first department or a specific one
            const department_id = deptsResponse.data?.data?.[0]?.id || process.env.ZOHO_DEPARTMENT_ID || '';
            if (!app_id || !department_id) {
                console.log('⚠️ Could not fetch app_id or department_id from API');
                // Use fallback values if available
                return {
                    app_id: process.env.ZOHO_APP_ID || 'default_app',
                    department_id: process.env.ZOHO_DEPARTMENT_ID || 'default_dept'
                };
            }
            return { app_id, department_id };
        }
        catch (error) {
            console.error('Failed to get app details:', error.response?.data || error.message);
            // Return fallback values
            return {
                app_id: process.env.ZOHO_APP_ID || 'default_app',
                department_id: process.env.ZOHO_DEPARTMENT_ID || 'default_dept'
            };
        }
    }
    /**
     * Create a new conversation (as visitor)
     * Based on: https://www.zoho.com/salesiq/help/developer-section/open-conversation-v1.html
     */
    async createConversation(phone, message, name) {
        try {
            // Check if we already have a conversation for this phone
            const existingConvId = this.conversationMap.get(phone);
            if (existingConvId) {
                console.log(`📝 Using existing conversation: ${existingConvId}`);
                return existingConvId;
            }
            // Get app and department IDs
            const { app_id, department_id } = await this.getAppDetails();
            // Create visitor data
            const visitorData = {
                user_id: phone, // Use phone as unique ID
                name: name || phone,
                phone: phone,
                platform: 'WhatsApp'
            };
            // Create conversation request
            const requestData = {
                app_id: app_id,
                department_id: department_id,
                question: message,
                visitor: visitorData
            };
            console.log(`📤 Creating Zoho conversation for ${phone}...`);
            const response = await this.axiosInstance.post(`/api/visitor/v1/${this.screenName}/conversations`, requestData);
            if (response.data?.data?.id) {
                const conversationId = response.data.data.id;
                this.conversationMap.set(phone, conversationId);
                console.log(`✅ Conversation created: ${conversationId}`);
                return conversationId;
            }
            throw new Error('No conversation ID in response');
        }
        catch (error) {
            console.error('Failed to create conversation:', error.response?.data || error.message);
            // If conversation creation fails, return a dummy ID to continue
            const fallbackId = `local_${phone}_${Date.now()}`;
            this.conversationMap.set(phone, fallbackId);
            return fallbackId;
        }
    }
    /**
     * Send a message to an existing conversation
     * Based on: https://www.zoho.com/salesiq/help/developer-section/send-message-operator-conversation-v2.html
     */
    async sendMessage(phone, message, sender = 'visitor') {
        try {
            // Get or create conversation
            let conversationId = this.conversationMap.get(phone);
            if (!conversationId) {
                // Create a new conversation with this message
                conversationId = await this.createConversation(phone, message);
            }
            // Skip if it's a local/fallback ID
            if (conversationId.startsWith('local_')) {
                console.log(`📝 Local conversation, skipping API call`);
                return;
            }
            // Send message to conversation
            const endpoint = `/api/v2/${this.screenName}/conversations/${conversationId}/messages`;
            console.log(`💬 Sending message to conversation ${conversationId}...`);
            const response = await this.axiosInstance.post(endpoint, {
                text: message,
                // Add metadata to identify the sender type
                metadata: {
                    sender_type: sender,
                    phone: phone
                }
            });
            if (response.data?.data) {
                console.log(`✅ Message sent successfully`);
            }
        }
        catch (error) {
            console.error('Failed to send message:', error.response?.data || error.message);
            // Don't throw error to prevent breaking the chat flow
            // Messages will still be stored locally
        }
    }
    /**
     * Get conversation details
     */
    async getConversation(phone) {
        try {
            const conversationId = this.conversationMap.get(phone);
            if (!conversationId || conversationId.startsWith('local_')) {
                return null;
            }
            const response = await this.axiosInstance.get(`/api/v2/${this.screenName}/conversations/${conversationId}`);
            return response.data?.data;
        }
        catch (error) {
            console.error('Failed to get conversation:', error.response?.data || error.message);
            return null;
        }
    }
    /**
     * List all conversations
     */
    async listConversations(status = 'all') {
        try {
            const params = {};
            if (status !== 'all') {
                params.status = status;
            }
            const response = await this.axiosInstance.get(`/api/v2/${this.screenName}/conversations`, { params });
            return response.data?.data || [];
        }
        catch (error) {
            console.error('Failed to list conversations:', error.response?.data || error.message);
            return [];
        }
    }
    /**
     * Mark conversation as handled by agent
     */
    async markAsAgentControlled(phone, agentId) {
        const conversationId = this.conversationMap.get(phone);
        if (conversationId && !conversationId.startsWith('local_')) {
            console.log(`🎯 Agent ${agentId} took control of ${conversationId}`);
            // You can update conversation status here if needed
            // This might require specific API endpoints based on your Zoho setup
        }
    }
    /**
     * Release conversation from agent control
     */
    async releaseFromAgent(phone) {
        const conversationId = this.conversationMap.get(phone);
        if (conversationId && !conversationId.startsWith('local_')) {
            console.log(`🤖 Released ${conversationId} back to bot`);
            // You can update conversation status here if needed
        }
    }
    /**
     * Close a conversation
     */
    async closeConversation(phone) {
        try {
            const conversationId = this.conversationMap.get(phone);
            if (!conversationId || conversationId.startsWith('local_')) {
                return;
            }
            // This endpoint might vary based on your Zoho setup
            await this.axiosInstance.put(`/api/v2/${this.screenName}/conversations/${conversationId}/close`);
            console.log(`📭 Conversation ${conversationId} closed`);
            this.conversationMap.delete(phone);
        }
        catch (error) {
            console.error('Failed to close conversation:', error.response?.data || error.message);
        }
    }
}
exports.default = new ZohoSalesIQV2Service();
