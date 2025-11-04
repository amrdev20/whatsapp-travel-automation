/**
 * Enhanced Chat Controller with State Machine Pattern
 * This controller ensures consistent conversation flow and proper API integration
 */

import { Request, Response } from 'express';
import { User, Conversation, Message, ConversationState as ConversationStateModel } from '../models';
import openaiService from '../services/openai.service';
import offtoService from '../services/offto.service';
import stateMachineService, { ConversationState, StateContext } from '../services/stateMachine.service';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export class ChatControllerV2 {
  /**
   * Send a chat message with state machine management
   */
  async sendMessage(req: Request, res: Response) {
    try {
      const { phone, message } = req.body;

      if (!phone || !message) {
        return res.status(400).json({
          success: false,
          message: 'Phone and message are required'
        });
      }

      // Get or create user
      let user = await User.findOne({ where: { phone } });
      if (!user) {
        user = await User.create({ phone });
      }

      // Get or create active conversation
      let conversation = await Conversation.findOne({
        where: { user_id: user.id, status: 'active' },
        order: [['created_at', 'DESC']]
      });

      if (!conversation) {
        conversation = await Conversation.create({
          user_id: user.id,
          session_id: `${phone}-${Date.now()}`
        });

        // Create initial conversation state
        await ConversationStateModel.create({
          conversation_id: conversation.id,
          current_step: 'greeting',
          collected_data: stateMachineService.resetConversation()
        });
      }

      // Save user message
      await Message.create({
        conversation_id: conversation.id,
        role: 'user',
        content: message
      });

      // Get conversation state
      let stateRecord = await ConversationStateModel.findOne({
        where: { conversation_id: conversation.id }
      });

      if (!stateRecord) {
        stateRecord = await ConversationStateModel.create({
          conversation_id: conversation.id,
          current_step: 'greeting',
          collected_data: stateMachineService.resetConversation()
        });
      }

      // Get current context from state machine
      let context: StateContext = stateRecord.collected_data as StateContext || stateMachineService.resetConversation();

      // Ensure we have a valid state
      if (!context.currentState) {
        context = stateMachineService.resetConversation();
      }

      console.log(`📍 Current State: ${context.currentState}`);
      console.log(`📨 User Message: ${message}`);

      // Extract information based on current state
      const extractedTravelInfo = await openaiService.extractTravelInfo(message, context);
      const extractedPassengerInfo = await openaiService.extractPassengerDetails(message, context);

      // Smart fallback for passport expiry - if user is clearly trying to provide a date
      if (context.currentState === ConversationState.COLLECTING_PASSPORT_EXPIRY) {
        const datePatterns = [
          /\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/, // YYYY-MM-DD or YYYY/MM/DD
          /\d{1,2}[-\/]\d{1,2}[-\/]\d{4}/, // DD-MM-YYYY or MM/DD/YYYY
          /\d{4}/, // Just year
          /20\d{2}/ // Year 20XX
        ];

        const hasDateInfo = datePatterns.some(pattern => pattern.test(message));

        // If message contains date-like info but AI didn't extract it
        if (hasDateInfo && !extractedPassengerInfo.passportExpiry) {
          console.log('⚠️ AI failed to extract passport expiry, attempting fallback parsing...');

          // Try to extract year at minimum
          const yearMatch = message.match(/20\d{2}/);
          if (yearMatch) {
            // Default to end of the year
            extractedPassengerInfo.passportExpiry = `${yearMatch[0]}-12-31`;
            console.log(`✅ Fallback passport expiry set to: ${extractedPassengerInfo.passportExpiry}`);
          }
        }
      }

      // Update context with extracted information
      context = { ...context, ...extractedTravelInfo, ...extractedPassengerInfo };

      // Check if current state requirements are met and transition
      if (stateMachineService.isStateComplete(context)) {
        context = await stateMachineService.transition(context);
        console.log(`➡️  Transitioned to: ${context.currentState}`);
      }

      // Handle special states that require API calls
      let aiResponse: string = '';
      let apiActionTaken = false;

      const apiAction = stateMachineService.shouldCallAPI(context.currentState);

      if (apiAction === 'search' && !context.waitingForApiResponse) {
        // Send immediate feedback that search is starting
        aiResponse = '🔍 Searching for available packages...\n\nThis may take a moment while I check the latest flight and hotel options for you.';

        // Save this message first
        await Message.create({
          conversation_id: conversation.id,
          role: 'assistant',
          content: aiResponse
        });

        // Fetch fresh basket flights instead of searching
        console.log('🔍 Fetching fresh basket flights...');
        context.waitingForApiResponse = true;

        try {
          // Get fresh baskets from the API with search criteria
          const basketResult = await offtoService.getBasketFlights(
            context.destination!,
            context.checkInDate!,
            context.checkOutDate!,
            context.departureCity!,
            context.adults || 1,
            context.children || 0,
            1, // page 1
            await openaiService.detectLanguage(message),
            '1', // currency ID
            '85' // location ID
          );

          if (basketResult.success && basketResult.baskets && basketResult.baskets.length > 0) {
            // Store the fresh baskets
            context.packages = basketResult.baskets;
            context.waitingForApiResponse = false;

            // Transition to PACKAGES_DISPLAYED
            context.currentState = ConversationState.PACKAGES_DISPLAYED;

            // Format baskets for display
            const packageList = basketResult.baskets.slice(0, 5).map((basket: any, index: number) => {
              // Extract relevant info from basket
              const hotelName = basket.hotel_name || basket.hotel?.name || 'Hotel Package';
              const price = basket.grand_total || basket.total_price || basket.price || 'Check price';
              const currency = basket.currency || 'USD';
              const basketId = basket.basket_id || basket.id;

              return `📦 **Package ${index + 1}**
Hotel: ${hotelName}
Price: ${currency} ${price}
Basket ID: ${basketId}
━━━━━━━━━━━━━━━━━━━━━━`;
            }).join('\n\n');

            aiResponse = `I found ${basketResult.baskets.length} available packages. Here are the top 5:\n\n${packageList}\n\nWhich package would you like to book? (Please say "Package 1", "Package 2", etc.)`;
          } else {
            // No baskets found
            console.log('📍 No baskets found from get_basket_flights_html');

            context.packages = [];
            context.waitingForApiResponse = false;
            context.currentState = ConversationState.ERROR;
            context.errorMessage = 'No packages found for your search criteria';
            aiResponse = 'I couldn\'t find any packages for your search criteria. Would you like to try different dates or destination?';
          }
        } catch (error: any) {
          context.waitingForApiResponse = false;
          context.currentState = ConversationState.ERROR;
          context.errorMessage = error.message;
          aiResponse = 'I encountered an error while searching. Please try again.';
        }

        apiActionTaken = true;
      } else if (apiAction === 'book' && !context.waitingForApiResponse) {
        // Send immediate feedback that booking is starting
        aiResponse = '📝 Creating your booking...\n\n✨ Processing your travel details and generating payment link...';

        // Save this message first
        await Message.create({
          conversation_id: conversation.id,
          role: 'assistant',
          content: aiResponse
        });

        // Perform booking
        console.log('📝 Creating booking...');
        context.waitingForApiResponse = true;

        try {
          const selectedPkg = context.packages![context.selectedPackageIndex!];

          // Parse passenger name
          const nameParts = context.passengerName!.split(' ');
          const firstName = nameParts[0];
          const lastName = nameParts.slice(1).join(' ') || nameParts[0];

          // Parse DOB
          const dobParts = context.passengerDOB!.split('-');

          // Map country code to phone code
          const countryToPhoneCode: Record<string, string> = {
            'DZ': '213', 'KW': '965', 'SA': '966', 'EG': '20',
            'QA': '974', 'AE': '971', 'BH': '973', 'OM': '968'
          };

          const phoneCode = countryToPhoneCode[context.countryOfResidence || 'DZ'] || '213';

          const holderData = {
            title: 'Mr',
            first_name: firstName,
            last_name: lastName,
            email: context.passengerEmail!,
            mobile_number: context.passengerPhone!.replace(/^\+/, ''),
            code_phone_id: phoneCode
          };

          const paxes = [{
            day: dobParts[2],
            month: dobParts[1],
            year: dobParts[0],
            first_name: firstName,
            last_name: lastName,
            title: 'Mr',
            nationality: context.nationality || 'DZ',
            passport_number: context.passportNumber!,
            passport_expiry: context.passportExpiry!,
            issuing_country: context.nationality || 'DZ'
          }];

          const bookingResult = await offtoService.bookFlightPackage(
            selectedPkg.basket_id,
            holderData,
            paxes,
            await openaiService.detectLanguage(message)
          );

          context.waitingForApiResponse = false;

          if (bookingResult.success && bookingResult.data) {
            context.paymentUrl = bookingResult.data.InvoiceURL;
            context.bookingReference = bookingResult.data.InvoiceId;
            context.currentState = ConversationState.BOOKING_COMPLETED;

            aiResponse = `✅ **Booking created successfully!**

**Invoice ID:** ${bookingResult.data.InvoiceId}
**Reference:** ${bookingResult.data.CustomerReference}

💳 **Payment Link:**
${bookingResult.data.InvoiceURL}

Please complete payment to confirm your booking.`;
          } else {
            context.currentState = ConversationState.BOOKING_FAILED;
            context.errorMessage = bookingResult.message || 'Booking failed';
            aiResponse = `❌ Sorry, booking failed: ${bookingResult.message || 'Unknown error'}

Would you like to try again or start with a new search?`;
          }
        } catch (error: any) {
          context.waitingForApiResponse = false;
          context.currentState = ConversationState.BOOKING_FAILED;
          context.errorMessage = error.message;
          aiResponse = 'I encountered an error while booking. Please try again.';
        }

        apiActionTaken = true;
      }

      // If no API action was taken, generate AI response based on state
      if (!apiActionTaken) {
        // Get conversation history
        const history = await Message.findAll({
          where: { conversation_id: conversation.id },
          order: [['created_at', 'ASC']],
          limit: 10
        });

        const messages: ChatCompletionMessageParam[] = history.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }));

        // Add current state to context for AI
        const contextWithState = {
          ...context,
          currentState: context.currentState,
          statePrompt: stateMachineService.getStatePrompt(context.currentState, context)
        };

        // Generate AI response using the state-aware prompt
        aiResponse = await openaiService.generateResponse(messages, contextWithState);
      }

      // Save AI response
      await Message.create({
        conversation_id: conversation.id,
        role: 'assistant',
        content: aiResponse
      });

      // Update conversation state in database
      await stateRecord.update({
        current_step: context.currentState,
        collected_data: context
      });

      // Log state for debugging
      console.log('📊 Updated Context:', stateMachineService.getContextSummary(context));

      res.json({
        success: true,
        message: aiResponse,
        state: context.currentState,
        debug: {
          currentState: context.currentState,
          hasPackages: !!context.packages,
          packageCount: context.packages?.length || 0,
          selectedPackage: context.selectedPackageIndex,
          paymentUrl: context.paymentUrl
        }
      });

    } catch (error: any) {
      console.error('Chat error:', error);
      res.status(500).json({
        success: false,
        message: 'An error occurred processing your message',
        error: error.message
      });
    }
  }

  /**
   * Reset conversation
   */
  async resetConversation(req: Request, res: Response) {
    try {
      const { phone } = req.body;

      if (!phone) {
        return res.status(400).json({
          success: false,
          message: 'Phone is required'
        });
      }

      const user = await User.findOne({ where: { phone } });

      if (!user) {
        return res.json({
          success: true,
          message: 'No conversation to reset'
        });
      }

      // Deactivate all conversations
      await Conversation.update(
        { status: 'completed' },
        { where: { user_id: user.id, status: 'active' } }
      );

      res.json({
        success: true,
        message: 'Conversation reset successfully'
      });

    } catch (error: any) {
      console.error('Reset error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to reset conversation',
        error: error.message
      });
    }
  }

  /**
   * Get conversation history
   */
  async getHistory(req: Request, res: Response) {
    try {
      const { phone } = req.params;

      if (!phone) {
        return res.status(400).json({
          success: false,
          message: 'Phone is required'
        });
      }

      const user = await User.findOne({ where: { phone } });

      if (!user) {
        return res.json({
          success: true,
          messages: []
        });
      }

      const conversation = await Conversation.findOne({
        where: { user_id: user.id, status: 'active' },
        order: [['created_at', 'DESC']]
      });

      if (!conversation) {
        return res.json({
          success: true,
          messages: []
        });
      }

      const messages = await Message.findAll({
        where: { conversation_id: conversation.id },
        order: [['created_at', 'ASC']]
      });

      res.json({
        success: true,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          createdAt: msg.created_at
        }))
      });

    } catch (error: any) {
      console.error('History error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get history',
        error: error.message
      });
    }
  }

  /**
   * Direct booking endpoint (for testing)
   */
  async bookDirectly(req: Request, res: Response) {
    try {
      const { phone, basketId, holderData, paxes } = req.body;

      if (!phone || !basketId || !holderData || !paxes) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      const result = await offtoService.bookFlightPackage(
        basketId,
        holderData,
        paxes,
        'en'
      );

      res.json(result);

    } catch (error: any) {
      console.error('Direct booking error:', error);
      res.status(500).json({
        success: false,
        message: 'Booking failed',
        error: error.message
      });
    }
  }
}