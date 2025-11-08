import { Request, Response } from 'express';
import { whatsappService } from '../services/whatsapp.service';
import { ChatController } from './chat.controller';
import { ChatSalesController } from './chat-sales.controller';
import sessionService from '../services/session.service';
import { zohoSalesIQService } from '../services/zoho-salesiq.service';
import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';

export class WhatsAppController {
  private chatSalesController: ChatSalesController;

  constructor() {
    this.chatSalesController = new ChatSalesController();
    this.setupEventListeners();
  }

  /**
   * Webhook verification endpoint for Meta
   * GET /api/whatsapp/webhook
   */
  async verifyWebhook(req: Request, res: Response): Promise<void> {
    try {
      const mode = req.query['hub.mode'] as string;
      const token = req.query['hub.verify_token'] as string;
      const challenge = req.query['hub.challenge'] as string;

      console.log('WhatsApp webhook verification request:', { mode, token, challenge });

      const result = whatsappService.verifyWebhook(mode, token, challenge);

      if (result) {
        res.status(200).send(result);
      } else {
        res.status(403).send('Verification failed');
      }
    } catch (error) {
      console.error('Error in webhook verification:', error);
      res.status(500).send('Verification error');
    }
  }

  /**
   * Webhook endpoint to receive messages
   * POST /api/whatsapp/webhook
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      console.log('WhatsApp webhook received:', JSON.stringify(req.body, null, 2));

      // Process the webhook
      await whatsappService.processWebhook(req.body);

      // Always respond with 200 OK to acknowledge receipt
      res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      console.error('Error processing WhatsApp webhook:', error);
      // Still respond with 200 to prevent retries
      res.status(200).send('EVENT_RECEIVED');
    }
  }

  /**
   * Send a WhatsApp message
   * POST /api/whatsapp/send
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
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
        result = await whatsappService.sendTemplate(to, templateName, languageCode, components);
      } else {
        result = await whatsappService.sendMessage(to, message);
      }

      res.json({
        success: true,
        messageId: result.messages?.[0]?.id,
        data: result
      });
    } catch (error: any) {
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
  async testConnection(req: Request, res: Response): Promise<void> {
    try {
      // Validate token
      const tokenValid = await whatsappService.validateToken();

      // Get phone numbers
      const phoneNumbers = await whatsappService.getPhoneNumbers();

      // Get templates
      const templates = await whatsappService.getTemplates();

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
    } catch (error: any) {
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
  private setupEventListeners(): void {
    // Handle incoming messages
    whatsappService.on('message', async (data) => {
      console.log('Processing WhatsApp message:', data);

      try {
        // Track customer message in Zoho SalesIQ
        await zohoSalesIQService.trackWhatsAppMessage(
          data.from,
          data.contactName || `WhatsApp User ${data.from}`,
          data.text
        );

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
        } as Request;

        const mockRes = {
          json: async (response: any) => {
            // Send the AI response back to WhatsApp
            if (response.success && response.message) {
              await whatsappService.sendMessage(data.from, response.message);

              // Track bot response in Zoho SalesIQ
              await zohoSalesIQService.trackBotResponse(data.from, response.message);

              // If there's a payment link, send it as a follow-up
              if (response.paymentLink) {
                const paymentMessage = `رابط الدفع / Payment Link:\n${response.paymentLink}`;
                await whatsappService.sendMessage(data.from, paymentMessage);
                // Track payment link in Zoho
                await zohoSalesIQService.trackBotResponse(data.from, paymentMessage);
              }
            }
          },
          status: () => mockRes
        } as any as Response;

        // Process through chat sales controller
        await this.chatSalesController.sendMessage(mockReq, mockRes);
      } catch (error) {
        console.error('Error processing WhatsApp message:', error);
        // Send error message to user
        try {
          await whatsappService.sendMessage(
            data.from,
            'عذراً، حدث خطأ في معالجة رسالتك. يرجى المحاولة مرة أخرى.\nSorry, an error occurred processing your message. Please try again.'
          );
        } catch (sendError) {
          console.error('Failed to send error message:', sendError);
        }
      }
    });

    // Handle image messages (potential passports)
    whatsappService.on('image', async (data) => {
      console.log('📷 Processing WhatsApp image:', data);

      try {
        // Download the image from WhatsApp
        const imageBuffer = await whatsappService.downloadMedia(data.mediaId);

        // Save temporarily for OCR processing
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFilePath = path.join(tempDir, `passport_${data.from}_${Date.now()}.jpg`);
        fs.writeFileSync(tempFilePath, imageBuffer);

        console.log(`📄 Image saved temporarily at: ${tempFilePath}`);

        // Send to OCR API
        const formData = new FormData();
        formData.append('file', fs.createReadStream(tempFilePath));

        const ocrResponse = await axios.post(
          'https://front.test.offto.com.kw/api/v1/ocr',
          formData,
          {
            headers: {
              ...formData.getHeaders(),
              'Authorization': 'Bearer 28|QCdKzvO5YWptqvC3QxQVcVWJ9EDGyKJBajQB7jP1cf4df21a'
            }
          }
        );

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
          const context = sessionService.getContext(data.from) as any;

          // Store passport data in array to support multiple passengers
          const existingPassports = context.scannedPassports || [];
          const updatedPassports = [...existingPassports, passportData];

          sessionService.updateContext(data.from, {
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
          } as Request;

          const mockRes = {
            json: async (response: any) => {
              // Send the AI response back to WhatsApp
              if (response.success && response.message) {
                await whatsappService.sendMessage(data.from, response.message);

                // If there's a payment link, send it as a follow-up
                if (response.paymentLink) {
                  const paymentMessage = `رابط الدفع / Payment Link:\n${response.paymentLink}`;
                  await whatsappService.sendMessage(data.from, paymentMessage);
                }
              }
            },
            status: () => mockRes
          } as any as Response;

          // Process through chat sales controller
          await this.chatSalesController.sendMessage(mockReq, mockRes);
        } else {
          // OCR failed
          console.error('❌ Passport OCR failed:', ocrResponse.data);
          await whatsappService.sendMessage(
            data.from,
            '⚠️ لم أتمكن من قراءة جواز السفر بوضوح. الرجاء التأكد من:\n' +
            '• وضوح الصورة\n' +
            '• إظهار صفحة البيانات الشخصية كاملة\n' +
            '• الإضاءة الجيدة\n\n' +
            'Could not read the passport clearly. Please ensure:\n' +
            '• Clear image quality\n' +
            '• Full personal data page is visible\n' +
            '• Good lighting\n\n' +
            'الرجاء إرسال الصورة مرة أخرى / Please send the image again'
          );
        }
      } catch (error) {
        console.error('Error processing WhatsApp image:', error);

        // Send error message to user
        try {
          await whatsappService.sendMessage(
            data.from,
            '❌ حدث خطأ في معالجة الصورة. الرجاء المحاولة مرة أخرى.\n' +
            'Error processing the image. Please try again.'
          );
        } catch (sendError) {
          console.error('Failed to send error message:', sendError);
        }
      }
    });

    // Handle status updates
    whatsappService.on('status', (status) => {
      console.log('WhatsApp message status:', status);
      // You can store status updates in database if needed
    });
  }
}

// Export singleton instance
export const whatsappController = new WhatsAppController();