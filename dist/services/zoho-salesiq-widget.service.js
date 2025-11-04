"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const zoho_salesiq_v2_service_1 = __importDefault(require("./zoho-salesiq-v2.service"));
/**
 * Zoho SalesIQ Service using Widget Integration
 * This approach uses the SalesIQ widget code and webhook system
 */
class ZohoSalesIQWidgetService {
    constructor() {
        this.widgetCode = process.env.ZOHO_WIDGET_CODE || 'siq163b9dc5adadcd3f2e5310b919e80cf1';
        this.webhookSecret = process.env.ZOHO_WEBHOOK_VERIFY_TOKEN || 'offto_webhook_secret_2024';
        // Store chat sessions in memory
        this.chatSessions = new Map();
        this.agentControlMap = new Map();
        // Queue for pending messages to be displayed in widget
        this.pendingMessages = [];
    }
    /**
     * Initialize a chat session for monitoring
     */
    async initializeChat(phone, initialMessage) {
        // Generate unique chat ID
        const chatId = `chat_${phone}_${Date.now()}`;
        // Create visitor session
        const visitor = {
            id: crypto_1.default.createHash('md5').update(phone).digest('hex'),
            name: phone,
            phone: phone
        };
        // Initialize chat session
        const chat = {
            id: chatId,
            visitorId: visitor.id,
            messages: [{
                    text: initialMessage,
                    sender: 'visitor',
                    timestamp: new Date()
                }],
            agentTaken: false
        };
        this.chatSessions.set(phone, chat);
        console.log(`📱 Chat initialized for ${phone} with ID: ${chatId}`);
        // Send initialization data to SalesIQ (via webhook if configured)
        await this.notifySalesIQ('chat_started', {
            chatId,
            visitor,
            message: initialMessage
        });
        return chatId;
    }
    /**
     * Add message to chat history
     */
    async addMessage(phone, message, sender) {
        let chat = this.chatSessions.get(phone);
        if (!chat) {
            // Initialize if not exists
            const chatId = await this.initializeChat(phone, message);
            chat = this.chatSessions.get(phone);
        }
        else {
            // Add message to existing chat
            chat.messages.push({
                text: message,
                sender,
                timestamp: new Date()
            });
        }
        // Notify SalesIQ dashboard
        await this.notifySalesIQ('message_added', {
            chatId: chat.id,
            phone,
            message,
            sender,
            timestamp: new Date()
        });
        console.log(`💬 [${sender}] ${phone}: ${message.substring(0, 50)}...`);
    }
    /**
     * Check if agent has taken control
     */
    isAgentInControl(phone) {
        const chat = this.chatSessions.get(phone);
        return chat?.agentTaken || this.agentControlMap.get(phone) || false;
    }
    /**
     * Handle agent takeover
     */
    handleAgentTakeover(phone) {
        const chat = this.chatSessions.get(phone);
        if (chat) {
            chat.agentTaken = true;
            this.agentControlMap.set(phone, true);
            console.log(`🎯 Agent took control of chat: ${phone}`);
        }
    }
    /**
     * Handle agent release control
     */
    handleAgentRelease(phone) {
        const chat = this.chatSessions.get(phone);
        if (chat) {
            chat.agentTaken = false;
            this.agentControlMap.set(phone, false);
            console.log(`🤖 Agent released control of chat: ${phone}`);
        }
    }
    /**
     * Get chat history
     */
    getChatHistory(phone) {
        return this.chatSessions.get(phone);
    }
    /**
     * Send notification to SalesIQ via REST API v2
     */
    async notifySalesIQ(event, data) {
        console.log(`📤 SalesIQ Event: ${event}`, {
            widgetCode: this.widgetCode.substring(0, 20) + '...',
            data
        });
        // Send to Zoho REST API v2
        if (event === 'message_added' && data.phone && data.message) {
            // Send message to Zoho SalesIQ API v2
            // This will create a conversation if needed and send the message
            await zoho_salesiq_v2_service_1.default.sendMessage(data.phone, data.message, data.sender);
            // Also add to pending messages queue for widget display
            this.pendingMessages.push({
                phone: data.phone,
                message: data.message,
                isBot: data.sender === 'bot',
                timestamp: new Date()
            });
        }
        else if (event === 'chat_started') {
            // Create conversation in Zoho
            await zoho_salesiq_v2_service_1.default.createConversation(data.visitor.phone, data.message || 'New conversation started', data.visitor.name);
        }
    }
    /**
     * Get pending messages for widget
     */
    getPendingMessages() {
        const messages = [...this.pendingMessages];
        this.pendingMessages = []; // Clear after retrieval
        return messages;
    }
    /**
     * Verify webhook signature from SalesIQ
     */
    verifyWebhookSignature(signature, payload) {
        const expectedSignature = crypto_1.default
            .createHmac('sha256', this.webhookSecret)
            .update(payload)
            .digest('hex');
        return signature === expectedSignature;
    }
    /**
     * Generate embed script for frontend
     */
    getEmbedScript() {
        return `
      <script>
        window.$zoho=window.$zoho || {};
        $zoho.salesiq=$zoho.salesiq||{ready:function(){}};

        // Custom integration
        $zoho.salesiq.ready = function() {
          // Set visitor info
          $zoho.salesiq.visitor.name('${new Date().getTime()}');

          // Listen for agent events
          $zoho.salesiq.chat.on('agent_joined', function() {
            // Notify backend that agent joined
            fetch('/api/zoho/agent-takeover', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({event: 'agent_joined'})
            });
          });
        };
      </script>
      <script id="zsiqscript" src="https://salesiq.zohopublic.com/widget?wc=${this.widgetCode}" defer></script>
    `;
    }
}
exports.default = new ZohoSalesIQWidgetService();
