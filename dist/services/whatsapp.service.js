"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappService = exports.WhatsAppService = void 0;
const axios_1 = __importDefault(require("axios"));
const events_1 = require("events");
class WhatsAppService extends events_1.EventEmitter {
    constructor() {
        super();
        this.apiVersion = 'v18.0';
        this.baseUrl = 'https://graph.facebook.com';
        this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
        this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '530905870110617';
        this.businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '522621817609876';
        this.verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'offto_whatsapp_2024';
    }
    /**
     * Verify webhook subscription from Meta
     */
    verifyWebhook(mode, token, challenge) {
        if (mode === 'subscribe' && token === this.verifyToken) {
            console.log('WhatsApp webhook verified successfully');
            return challenge;
        }
        console.error('WhatsApp webhook verification failed');
        return null;
    }
    /**
     * Process incoming webhook from WhatsApp
     */
    async processWebhook(body) {
        try {
            if (body.entry && Array.isArray(body.entry)) {
                for (const entry of body.entry) {
                    const changes = entry.changes;
                    for (const change of changes) {
                        const value = change.value;
                        // Handle incoming messages
                        if (value.messages && value.messages.length > 0) {
                            for (const message of value.messages) {
                                console.log('Received WhatsApp message:', JSON.stringify(message, null, 2));
                                // Mark message as read
                                await this.markAsRead(message.id);
                                // Check if message is an image (potential passport)
                                if (message.type === 'image' && message.image) {
                                    console.log('📷 Received image message, processing as potential passport...');
                                    console.log('📷 Image data:', JSON.stringify(message.image, null, 2));
                                    // Emit image message event with media details
                                    this.emit('image', {
                                        from: message.from,
                                        mediaId: message.image.id,
                                        mimeType: message.image.mime_type,
                                        caption: message.image.caption || '',
                                        messageId: message.id,
                                        timestamp: message.timestamp,
                                        contactName: value.contacts?.[0]?.profile?.name || message.from
                                    });
                                }
                                else {
                                    // Emit text message event
                                    this.emit('message', {
                                        from: message.from,
                                        text: message.text?.body || '',
                                        messageId: message.id,
                                        timestamp: message.timestamp,
                                        type: message.type,
                                        contactName: value.contacts?.[0]?.profile?.name || message.from
                                    });
                                }
                            }
                        }
                        // Handle status updates
                        if (value.statuses && value.statuses.length > 0) {
                            for (const status of value.statuses) {
                                console.log('Message status update:', status);
                                this.emit('status', status);
                            }
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error('Error processing WhatsApp webhook:', error);
            throw error;
        }
    }
    /**
     * Send text message
     */
    async sendMessage(to, text) {
        try {
            const message = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: this.formatPhoneNumber(to),
                type: 'text',
                text: { body: text }
            };
            const response = await axios_1.default.post(`${this.baseUrl}/${this.apiVersion}/${this.phoneNumberId}/messages`, message, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log('WhatsApp message sent:', response.data);
            return response.data;
        }
        catch (error) {
            console.error('Error sending WhatsApp message:', error.response?.data || error.message);
            throw error;
        }
    }
    /**
     * Send template message
     */
    async sendTemplate(to, templateName, languageCode = 'ar', components) {
        try {
            const message = {
                messaging_product: 'whatsapp',
                to: this.formatPhoneNumber(to),
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: languageCode },
                    components: components || []
                }
            };
            const response = await axios_1.default.post(`${this.baseUrl}/${this.apiVersion}/${this.phoneNumberId}/messages`, message, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log('WhatsApp template sent:', response.data);
            return response.data;
        }
        catch (error) {
            console.error('Error sending WhatsApp template:', error.response?.data || error.message);
            throw error;
        }
    }
    /**
     * Mark message as read
     */
    async markAsRead(messageId) {
        try {
            await axios_1.default.post(`${this.baseUrl}/${this.apiVersion}/${this.phoneNumberId}/messages`, {
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId
            }, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`Marked message ${messageId} as read`);
        }
        catch (error) {
            console.error('Error marking message as read:', error.response?.data || error.message);
        }
    }
    /**
     * Get business phone numbers
     */
    async getPhoneNumbers() {
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/${this.apiVersion}/${this.businessAccountId}/phone_numbers`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });
            return response.data;
        }
        catch (error) {
            console.error('Error getting phone numbers:', error.response?.data || error.message);
            throw error;
        }
    }
    /**
     * Get message templates
     */
    async getTemplates() {
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/${this.apiVersion}/${this.businessAccountId}/message_templates`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });
            return response.data;
        }
        catch (error) {
            console.error('Error getting templates:', error.response?.data || error.message);
            throw error;
        }
    }
    /**
     * Download media from WhatsApp
     */
    async downloadMedia(mediaId) {
        try {
            // Step 1: Get media URL
            const mediaResponse = await axios_1.default.get(`${this.baseUrl}/${this.apiVersion}/${mediaId}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });
            const mediaUrl = mediaResponse.data.url;
            console.log('Media URL obtained:', mediaUrl);
            // Step 2: Download the actual media
            const fileResponse = await axios_1.default.get(mediaUrl, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                },
                responseType: 'arraybuffer'
            });
            console.log(`Media downloaded, size: ${fileResponse.data.length} bytes`);
            return Buffer.from(fileResponse.data);
        }
        catch (error) {
            console.error('Error downloading media:', error.response?.data || error.message);
            throw error;
        }
    }
    /**
     * Format phone number to WhatsApp format
     */
    formatPhoneNumber(phone) {
        // Remove any non-digit characters
        let formatted = phone.replace(/\D/g, '');
        // Add country code if not present (assuming Kuwait 965)
        if (!formatted.startsWith('965') && formatted.length === 8) {
            formatted = '965' + formatted;
        }
        return formatted;
    }
    /**
     * Validate access token
     */
    async validateToken() {
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/debug_token?input_token=${this.accessToken}&access_token=${this.accessToken}`);
            const isValid = response.data.data?.is_valid || false;
            if (!isValid) {
                console.error('WhatsApp access token is invalid');
            }
            return isValid;
        }
        catch (error) {
            console.error('Error validating WhatsApp token:', error);
            return false;
        }
    }
}
exports.WhatsAppService = WhatsAppService;
// Export singleton instance
exports.whatsappService = new WhatsAppService();
