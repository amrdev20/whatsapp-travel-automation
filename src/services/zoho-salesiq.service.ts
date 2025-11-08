import axios, { AxiosInstance } from 'axios';

interface ZohoConversationResponse {
  id: string;
  visitor: any;
  department_id: string;
  question: string;
  unread_chats?: number;
}

interface ZohoMessageResponse {
  success: boolean;
  message?: string;
}

class ZohoSalesIQService {
  private axiosInstance: AxiosInstance;
  private screenName: string;
  private appId: string;
  private departmentId: string;
  private conversationMap: Map<string, string>; // phoneNumber -> conversationId

  constructor() {
    this.screenName = process.env.ZOHO_SALESIQ_SCREEN_NAME || 'offtokw';
    this.appId = process.env.ZOHO_SALESIQ_APP_ID || '982569000000449619';
    this.departmentId = process.env.ZOHO_SALESIQ_DEPARTMENT_ID || '982569000002388075';
    this.conversationMap = new Map();

    this.axiosInstance = axios.create({
      baseURL: 'https://salesiq.zoho.com',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Zoho-oauthtoken ${process.env.ZOHO_SALESIQ_ACCESS_TOKEN}`
      }
    });
  }

  /**
   * Create a new conversation in Zoho SalesIQ
   */
  async createConversation(
    phoneNumber: string,
    customerName: string,
    firstMessage: string
  ): Promise<string | null> {
    try {
      console.log(`📞 Creating Zoho SalesIQ conversation for ${phoneNumber}`);

      const whatsappWebLink = `https://wa.me/${phoneNumber.replace(/\+/g, '')}`;

      const payload = {
        visitor: {
          user_id: phoneNumber,
          name: customerName || `WhatsApp User ${phoneNumber}`,
          phone: phoneNumber
        },
        customer_info: {
          'WhatsApp Link': whatsappWebLink,
          'Source': 'WhatsApp Business',
          'Phone': phoneNumber
        },
        app_id: this.appId,
        department_id: this.departmentId,
        question: firstMessage
      };

      console.log('📤 Zoho SalesIQ payload:', JSON.stringify(payload, null, 2));

      const response = await this.axiosInstance.post<ZohoConversationResponse>(
        `/visitor/v2/${this.screenName}/conversations`,
        payload
      );

      const conversationId = response.data.id;
      this.conversationMap.set(phoneNumber, conversationId);

      console.log(`✅ Zoho conversation created: ${conversationId}`);
      console.log(`📊 Response:`, JSON.stringify(response.data, null, 2));

      return conversationId;
    } catch (error: any) {
      console.error('❌ Error creating Zoho SalesIQ conversation:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      return null;
    }
  }

  /**
   * Send a message to an existing conversation
   */
  async sendMessage(
    phoneNumber: string,
    message: string,
    isFromCustomer: boolean = false
  ): Promise<boolean> {
    try {
      let conversationId = this.conversationMap.get(phoneNumber);

      // If no conversation exists, create one
      if (!conversationId) {
        console.log(`🔍 No conversation found for ${phoneNumber}, creating new one`);
        const newConversationId = await this.createConversation(
          phoneNumber,
          `WhatsApp User ${phoneNumber}`,
          message
        );

        if (!newConversationId) {
          console.error('❌ Failed to create conversation');
          return false;
        }

        conversationId = newConversationId;

        // First message was already sent during conversation creation
        if (isFromCustomer) {
          return true;
        }
      }

      console.log(`💬 Sending message to Zoho conversation ${conversationId}`);

      const payload = {
        text: message
      };

      await this.axiosInstance.post(
        `/api/visitor/v1/${this.screenName}/conversations/${conversationId}/messages`,
        payload
      );

      console.log(`✅ Message sent to Zoho SalesIQ`);
      return true;
    } catch (error: any) {
      console.error('❌ Error sending message to Zoho SalesIQ:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      return false;
    }
  }

  /**
   * Track a new WhatsApp message in Zoho SalesIQ
   */
  async trackWhatsAppMessage(
    phoneNumber: string,
    customerName: string,
    message: string
  ): Promise<void> {
    try {
      const existingConversation = this.conversationMap.get(phoneNumber);

      if (existingConversation) {
        // Send message to existing conversation
        await this.sendMessage(phoneNumber, `Customer: ${message}`, false);
      } else {
        // Create new conversation with the message
        await this.createConversation(phoneNumber, customerName, message);
      }
    } catch (error) {
      console.error('Error tracking WhatsApp message in Zoho:', error);
    }
  }

  /**
   * Track bot response in Zoho SalesIQ
   */
  async trackBotResponse(
    phoneNumber: string,
    response: string
  ): Promise<void> {
    try {
      await this.sendMessage(phoneNumber, `Bot: ${response}`, false);
    } catch (error) {
      console.error('Error tracking bot response in Zoho:', error);
    }
  }

  /**
   * Get conversation ID for a phone number
   */
  getConversationId(phoneNumber: string): string | undefined {
    return this.conversationMap.get(phoneNumber);
  }

  /**
   * Clear conversation mapping (useful for testing)
   */
  clearConversation(phoneNumber: string): void {
    this.conversationMap.delete(phoneNumber);
  }
}

export const zohoSalesIQService = new ZohoSalesIQService();
