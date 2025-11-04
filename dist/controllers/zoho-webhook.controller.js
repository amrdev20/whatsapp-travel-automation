"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZohoWebhookController = void 0;
const zoho_salesiq_widget_service_1 = __importDefault(require("../services/zoho-salesiq-widget.service"));
const session_service_1 = __importDefault(require("../services/session.service"));
class ZohoWebhookController {
    /**
     * Handle webhook events from Zoho SalesIQ
     */
    async handleWebhook(req, res) {
        try {
            const { event_type, data } = req.body;
            console.log(`📨 Zoho Webhook Event: ${event_type}`);
            switch (event_type) {
                case 'agent_takeover':
                    await this.handleAgentTakeover(data);
                    break;
                case 'agent_release':
                    await this.handleAgentRelease(data);
                    break;
                case 'agent_message':
                    await this.handleAgentMessage(data);
                    break;
                case 'conversation_closed':
                    await this.handleConversationClosed(data);
                    break;
                default:
                    console.log(`Unknown event type: ${event_type}`);
            }
            return res.json({ success: true });
        }
        catch (error) {
            console.error('Webhook error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }
    /**
     * Agent takes control from AI
     */
    async handleAgentTakeover(data) {
        const { conversation_id, agent_id, visitor_phone } = data;
        console.log(`🎯 Agent ${agent_id} taking control of conversation ${conversation_id}`);
        // Update Zoho service state
        if (visitor_phone) {
            zoho_salesiq_widget_service_1.default.handleAgentTakeover(visitor_phone);
        }
        // Send notification to user that agent is now helping
        if (visitor_phone) {
            const context = session_service_1.default.getContext(visitor_phone);
            const message = context?.language === 'ar'
                ? '🧑‍💼 تم تحويلك إلى أحد موظفي الدعم. سيساعدك الآن مباشرة.'
                : '🧑‍💼 You have been transferred to a support agent who will assist you directly.';
            session_service_1.default.addMessage(visitor_phone, 'assistant', message);
        }
    }
    /**
     * Agent releases control back to AI
     */
    async handleAgentRelease(data) {
        const { conversation_id, visitor_phone } = data;
        console.log(`🤖 Agent releasing control of conversation ${conversation_id}`);
        if (visitor_phone) {
            zoho_salesiq_widget_service_1.default.handleAgentRelease(visitor_phone);
        }
        // Notify user that AI is back
        if (visitor_phone) {
            const context = session_service_1.default.getContext(visitor_phone);
            const message = context?.language === 'ar'
                ? '🤖 تم إرجاعك إلى المساعد الآلي. كيف يمكنني مساعدتك؟'
                : '🤖 You have been transferred back to the automated assistant. How can I help you?';
            session_service_1.default.addMessage(visitor_phone, 'assistant', message);
        }
    }
    /**
     * Agent sends a message to user
     */
    async handleAgentMessage(data) {
        const { conversation_id, message_text, visitor_phone } = data;
        console.log(`💬 Agent message for ${visitor_phone}: ${message_text}`);
        if (visitor_phone && message_text) {
            // Store agent message in session
            session_service_1.default.addMessage(visitor_phone, 'assistant', message_text);
            // The message will be picked up by the next polling request from the user
            // Or you can implement WebSocket/SSE to push it immediately
        }
    }
    /**
     * Conversation closed by agent
     */
    async handleConversationClosed(data) {
        const { conversation_id, visitor_phone } = data;
        console.log(`📭 Conversation closed: ${conversation_id}`);
        if (visitor_phone) {
            // Reset session if needed
            // sessionService.resetSession(visitor_phone);
        }
    }
    /**
     * Verify webhook authenticity (called on setup)
     */
    async verifyWebhook(req, res) {
        const { verify_token } = req.query;
        if (verify_token === process.env.ZOHO_WEBHOOK_VERIFY_TOKEN) {
            return res.json({ verified: true });
        }
        return res.status(401).json({ verified: false });
    }
}
exports.ZohoWebhookController = ZohoWebhookController;
exports.default = new ZohoWebhookController();
