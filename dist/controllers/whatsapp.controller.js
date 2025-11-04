"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.whatsappController = exports.WhatsAppController = void 0;
const whatsapp_service_1 = require("../services/whatsapp.service");
const chat_sales_controller_1 = require("./chat-sales.controller");
const session_service_1 = __importDefault(require("../services/session.service"));
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class WhatsAppController {
    constructor() {
        this.chatSalesController = new chat_sales_controller_1.ChatSalesController();
        this.setupEventListeners();
    }
    /**
     * Webhook verification endpoint for Meta
     * GET /api/whatsapp/webhook
     */
    async verifyWebhook(req, res) {
        try {
            const mode = req.query['hub.mode'];
            const token = req.query['hub.verify_token'];
            const challenge = req.query['hub.challenge'];
            console.log('WhatsApp webhook verification request:', { mode, token, challenge });
            const result = whatsapp_service_1.whatsappService.verifyWebhook(mode, token, challenge);
            if (result) {
                res.status(200).send(result);
            }
            else {
                res.status(403).send('Verification failed');
            }
        }
        catch (error) {
            console.error('Error in webhook verification:', error);
            res.status(500).send('Verification error');
        }
    }
    /**
     * Webhook endpoint to receive messages
     * POST /api/whatsapp/webhook
     */
    async handleWebhook(req, res) {
        try {
            console.log('WhatsApp webhook received:', JSON.stringify(req.body, null, 2));
            // Process the webhook
            await whatsapp_service_1.whatsappService.processWebhook(req.body);
            // Always respond with 200 OK to acknowledge receipt
            res.status(200).send('EVENT_RECEIVED');
        }
        catch (error) {
            console.error('Error processing WhatsApp webhook:', error);
            // Still respond with 200 to prevent retries
            res.status(200).send('EVENT_RECEIVED');
        }
    }
    /**
     * Send a WhatsApp message
     * POST /api/whatsapp/send
     */
    async sendMessage(req, res) {
        try {
            const { to, message, type = 'text' } = req.body;
            if (!to || !message) {
                res.status(400).json({
                    success: false,
                    error: 'Missing required fields: to, message'
                });
                return;
            }
            let result;
            if (type === 'template') {
                const { templateName, languageCode, components } = req.body;
                result = await whatsapp_service_1.whatsappService.sendTemplate(to, templateName, languageCode, components);
            }
            else {
                result = await whatsapp_service_1.whatsappService.sendMessage(to, message);
            }
            res.json({
                success: true,
                messageId: result.messages?.[0]?.id,
                data: result
            });
        }
        catch (error) {
            console.error('Error sending WhatsApp message:', error);
            res.status(500).json({
                success: false,
                error: error.response?.data || error.message
            });
        }
    }
    /**
     * Test endpoint to validate setup
     * GET /api/whatsapp/test
     */
    async testConnection(req, res) {
        try {
            // Validate token
            const tokenValid = await whatsapp_service_1.whatsappService.validateToken();
            // Get phone numbers
            const phoneNumbers = await whatsapp_service_1.whatsappService.getPhoneNumbers();
            // Get templates
            const templates = await whatsapp_service_1.whatsappService.getTemplates();
            res.json({
                success: true,
                tokenValid,
                phoneNumbers: phoneNumbers.data || [],
                templates: templates.data || [],
                config: {
                    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
                    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
                }
            });
        }
        catch (error) {
            console.error('WhatsApp test failed:', error);
            res.status(500).json({
                success: false,
                error: error.response?.data || error.message,
                details: error.response?.data?.error || {}
            });
        }
    }
    /**
     * Set up event listeners for WhatsApp messages
     */
    setupEventListeners() {
        // Handle incoming messages
        whatsapp_service_1.whatsappService.on('message', async (data) => {
            console.log('Processing WhatsApp message:', data);
            try {
                // Format the message for our chat system
                const chatRequest = {
                    phone: data.from,
                    message: data.text,
                    platform: 'whatsapp',
                    messageId: data.messageId,
                    contactName: data.contactName
                };
                // Process through our existing chat system
                const mockReq = {
                    body: chatRequest
                };
                const mockRes = {
                    json: async (response) => {
                        // Send the AI response back to WhatsApp
                        if (response.success && response.message) {
                            await whatsapp_service_1.whatsappService.sendMessage(data.from, response.message);
                            // If there's a payment link, send it as a follow-up
                            if (response.paymentLink) {
                                const paymentMessage = `رابط الدفع / Payment Link:\n${response.paymentLink}`;
                                await whatsapp_service_1.whatsappService.sendMessage(data.from, paymentMessage);
                            }
                        }
                    },
                    status: () => mockRes
                };
                // Process through chat sales controller
                await this.chatSalesController.sendMessage(mockReq, mockRes);
            }
            catch (error) {
                console.error('Error processing WhatsApp message:', error);
                // Send error message to user
                try {
                    await whatsapp_service_1.whatsappService.sendMessage(data.from, 'عذراً، حدث خطأ في معالجة رسالتك. يرجى المحاولة مرة أخرى.\nSorry, an error occurred processing your message. Please try again.');
                }
                catch (sendError) {
                    console.error('Failed to send error message:', sendError);
                }
            }
        });
        // Handle image messages (potential passports)
        whatsapp_service_1.whatsappService.on('image', async (data) => {
            console.log('📷 Processing WhatsApp image:', data);
            try {
                // Download the image from WhatsApp
                const imageBuffer = await whatsapp_service_1.whatsappService.downloadMedia(data.mediaId);
                // Save temporarily for OCR processing
                const tempDir = path.join(process.cwd(), 'temp');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }
                const tempFilePath = path.join(tempDir, `passport_${data.from}_${Date.now()}.jpg`);
                fs.writeFileSync(tempFilePath, imageBuffer);
                console.log(`📄 Image saved temporarily at: ${tempFilePath}`);
                // Send to OCR API
                const formData = new form_data_1.default();
                formData.append('file', fs.createReadStream(tempFilePath));
                const ocrResponse = await axios_1.default.post('https://front.test.offto.com.kw/api/v1/ocr', formData, {
                    headers: {
                        ...formData.getHeaders(),
                        'Authorization': 'Bearer 28|QCdKzvO5YWptqvC3QxQVcVWJ9EDGyKJBajQB7jP1cf4df21a'
                    }
                });
                // Clean up temp file
                fs.unlinkSync(tempFilePath);
                console.log('📊 Full OCR Response:', JSON.stringify(ocrResponse.data, null, 2));
                if (ocrResponse.data && ocrResponse.data.success) {
                    const ocrData = ocrResponse.data.data;
                    console.log(`✅ Passport OCR successful:`, JSON.stringify(ocrData, null, 2));
                    // Map the OCR response to our expected format
                    const passportData = {
                        firstName: ocrData.names?.firstName || '',
                        lastName: ocrData.names?.lastName || '',
                        passportNumber: ocrData.documentNumber || '',
                        nationality: ocrData.nationality?.abbr || ocrData.nationality?.full || '',
                        dateOfBirth: ocrData.dob || '',
                        gender: ocrData.sex?.abbr || ocrData.sex?.full || '',
                        expiryDate: ocrData.expiry || '',
                        issuerCountry: ocrData.issuerOrg?.abbr || ocrData.issuerOrg?.full || ''
                    };
                    console.log(`📋 Mapped passport data:`, JSON.stringify(passportData, null, 2));
                    // Get or create session context
                    const context = session_service_1.default.getContext(data.from);
                    // Store passport data in array to support multiple passengers
                    const existingPassports = context.scannedPassports || [];
                    const updatedPassports = [...existingPassports, passportData];
                    session_service_1.default.updateContext(data.from, {
                        ...context,
                        scannedPassports: updatedPassports,
                        hasPassportData: true,
                        passportCount: updatedPassports.length
                    });
                    console.log(`✅ Passport ${updatedPassports.length} saved to session for ${data.from}`);
                    // Format the message with passport confirmation
                    const chatRequest = {
                        phone: data.from,
                        message: `I uploaded my passport (${passportData.firstName} ${passportData.lastName})`,
                        platform: 'whatsapp',
                        messageId: data.messageId,
                        contactName: data.contactName,
                        passportData: passportData
                    };
                    // Process through chat system with passport data
                    const mockReq = {
                        body: chatRequest
                    };
                    const mockRes = {
                        json: async (response) => {
                            // Send the AI response back to WhatsApp
                            if (response.success && response.message) {
                                await whatsapp_service_1.whatsappService.sendMessage(data.from, response.message);
                                // If there's a payment link, send it as a follow-up
                                if (response.paymentLink) {
                                    const paymentMessage = `رابط الدفع / Payment Link:\n${response.paymentLink}`;
                                    await whatsapp_service_1.whatsappService.sendMessage(data.from, paymentMessage);
                                }
                            }
                        },
                        status: () => mockRes
                    };
                    // Process through chat sales controller
                    await this.chatSalesController.sendMessage(mockReq, mockRes);
                }
                else {
                    // OCR failed
                    console.error('❌ Passport OCR failed:', ocrResponse.data);
                    await whatsapp_service_1.whatsappService.sendMessage(data.from, '⚠️ لم أتمكن من قراءة جواز السفر بوضوح. الرجاء التأكد من:\n' +
                        '• وضوح الصورة\n' +
                        '• إظهار صفحة البيانات الشخصية كاملة\n' +
                        '• الإضاءة الجيدة\n\n' +
                        'Could not read the passport clearly. Please ensure:\n' +
                        '• Clear image quality\n' +
                        '• Full personal data page is visible\n' +
                        '• Good lighting\n\n' +
                        'الرجاء إرسال الصورة مرة أخرى / Please send the image again');
                }
            }
            catch (error) {
                console.error('Error processing WhatsApp image:', error);
                // Send error message to user
                try {
                    await whatsapp_service_1.whatsappService.sendMessage(data.from, '❌ حدث خطأ في معالجة الصورة. الرجاء المحاولة مرة أخرى.\n' +
                        'Error processing the image. Please try again.');
                }
                catch (sendError) {
                    console.error('Failed to send error message:', sendError);
                }
            }
        });
        // Handle status updates
        whatsapp_service_1.whatsappService.on('status', (status) => {
            console.log('WhatsApp message status:', status);
            // You can store status updates in database if needed
        });
    }
}
exports.WhatsAppController = WhatsAppController;
// Export singleton instance
exports.whatsappController = new WhatsAppController();
