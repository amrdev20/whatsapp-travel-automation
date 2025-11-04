import { Request, Response } from 'express';
import openAIFunctionsService from '../services/openai-functions.service';
import offtoService from '../services/offto.service';
import sessionService from '../services/session.service';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export class ChatFunctionsController {
  /**
   * Send a chat message using OpenAI Function Calling
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

      console.log(`\n📞 Message from ${phone}: ${message}`);

      // Add user message to session
      sessionService.addMessage(phone, 'user', message);

      // Check if user is in booking flow
      const context = sessionService.getContext(phone);

      // Handle basket selection
      if (context.bookingStage === 'awaiting_basket_selection') {
        const basketId = message.trim();
        const selectedBasket = context.searchResults?.find((b: any) => b.basket_id.toString() === basketId);

        if (selectedBasket) {
          sessionService.updateContext(phone, {
            selectedBasketId: basketId,
            bookingStage: 'collecting_booking_data'
          } as any);

          const aiResponse = `Great! You've selected Flight with Basket ID: ${basketId}\n\nNow I need to collect your booking information for all passengers. Please provide:\n\n**For booking holder:**\n- Title (Mr/Mrs/Ms)\n- First & Last name\n- Email\n- Mobile number\n\n**For each passenger:**\n- Title, First & Last name\n- Date of birth (YYYY-MM-DD)\n- Nationality (2-letter code like KW, EG, US)\n- Passport number\n- Passport expiry date (YYYY-MM-DD)\n- Issuing country (2-letter code)\n\nPlease provide all the information in your message.`;

          sessionService.addMessage(phone, 'assistant', aiResponse);
          return res.json({ success: true, message: aiResponse });
        } else {
          const aiResponse = `❌ Invalid Basket ID. Please enter a valid Basket ID from the flight options shown above.`;
          sessionService.addMessage(phone, 'assistant', aiResponse);
          return res.json({ success: true, message: aiResponse });
        }
      }

      // Handle booking data collection
      if (context.bookingStage === 'collecting_booking_data') {
        const messages: ChatCompletionMessageParam[] = sessionService.getMessages(phone).map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }));

        const result = await openAIFunctionsService.processBookingData(messages);
        console.log('📋 Booking data extraction result:', JSON.stringify(result, null, 2));

        if (result.bookingData) {
          // All booking data collected, make booking API call
          const bookingData = result.bookingData;
          console.log('✅ Booking data collected:', JSON.stringify(bookingData, null, 2));

          try {
            // Transform booking data to match API format
            const holderData = {
              title: bookingData.holder_title,
              first_name: bookingData.holder_first_name,
              last_name: bookingData.holder_last_name,
              email: bookingData.holder_email,
              mobile_number: bookingData.holder_mobile,
              code_phone_id: '77' // Kuwait phone code
            };

            const paxes = bookingData.passengers.map(passenger => {
              const dob = new Date(passenger.date_of_birth);
              return {
                day: dob.getDate().toString().padStart(2, '0'),
                month: (dob.getMonth() + 1).toString().padStart(2, '0'),
                year: dob.getFullYear().toString(),
                first_name: passenger.first_name,
                last_name: passenger.last_name,
                title: passenger.title,
                nationality: passenger.nationality.toUpperCase(),
                passport_number: passenger.passport_number,
                passport_expiry: passenger.passport_expiry,
                issuing_country: passenger.issuing_country.toUpperCase()
              };
            });

            console.log('📤 Booking flight with Basket ID:', context.selectedBasketId);
            console.log('📤 Holder data:', JSON.stringify(holderData, null, 2));
            console.log('📤 Paxes data:', JSON.stringify(paxes, null, 2));

            const bookingResult = await offtoService.bookFlightPackage(
              context.selectedBasketId,
              holderData,
              paxes,
              'ar',
              '1',
              '85'
            );

            console.log('📦 Booking API result:', JSON.stringify(bookingResult, null, 2));

            if (bookingResult.success && bookingResult.data?.InvoiceURL) {
              const aiResponse = `🎉 Booking successful!\n\n**Invoice ID:** ${bookingResult.data.InvoiceId}\n**Reference:** ${bookingResult.data.CustomerReference}\n\n💳 **Payment Link:**\n${bookingResult.data.InvoiceURL}\n\nPlease click the link above to complete your payment.`;

              sessionService.addMessage(phone, 'assistant', aiResponse);
              sessionService.updateContext(phone, { bookingStage: 'payment_pending' } as any);

              return res.json({ success: true, message: aiResponse });
            } else {
              const errorMessage = `❌ Booking failed: ${bookingResult.message || 'Unknown error'}\n\nPlease try again or contact support.`;
              sessionService.addMessage(phone, 'assistant', errorMessage);
              return res.json({ success: false, message: errorMessage });
            }

          } catch (error: any) {
            console.error('🔴 Booking error:', error.message);
            console.error('🔴 Full error:', error);
            const errorMessage = `❌ Error processing booking: ${error.message}`;
            sessionService.addMessage(phone, 'assistant', errorMessage);
            return res.json({ success: false, message: errorMessage });
          }

        } else {
          // AI is asking for more information
          console.log('ℹ️ AI requesting more info:', result.aiResponse);
          const aiResponse = result.aiResponse || 'Please provide your booking information.';
          sessionService.addMessage(phone, 'assistant', aiResponse);
          return res.json({ success: true, message: aiResponse });
        }
      }

      // Get conversation history
      const messages: ChatCompletionMessageParam[] = sessionService.getMessages(phone).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

      // Process message with OpenAI Function Calling
      console.log('🤖 Processing with OpenAI Function Calling...');
      const result = await openAIFunctionsService.processMessage(messages);

      if (result.functionCall) {
        // AI wants to search for flights
        const params = result.functionCall;
        console.log('✈️ Function Call Detected:', params);

        // Make API call to search flights
        try {
          const searchResult = await offtoService.getBasketFlights(
            params.arrivalCode,
            params.outboundDate,
            params.returnDate,
            params.departureCode,
            params.adultsCount || 1,
            params.childrenCount || 0,
            1, // page
            'ar', // language
            '1', // currency ID (KWD)
            '85' // location ID (Kuwait)
          );

          console.log('📦 API Response:', searchResult.success ? 'Success' : 'Failed');

          let aiResponse: string;

          if (searchResult.success && searchResult.baskets && searchResult.baskets.length > 0) {
            // Show the raw flight data from API with basket IDs
            const flightsDisplay = searchResult.baskets.map((basket: any, i: number) =>
              `**Flight ${i + 1}** (Basket ID: ${basket.basket_id})\n\n${basket.template || 'Flight details not available'}`
            ).join('\n\n' + '='.repeat(50) + '\n\n');

            aiResponse = flightsDisplay + '\n\n' + '='.repeat(50) + '\n\n' +
              '✅ To confirm and book a flight, please type the **Basket ID** of your chosen flight.';

            // Store results in session for later booking
            sessionService.updateContext(phone, {
              searchResults: searchResult.baskets,
              searchParams: params,
              bookingStage: 'awaiting_basket_selection'
            } as any);

          } else {
            aiResponse = `❌ No flights found for:
- From: ${params.departureCode}
- To: ${params.arrivalCode}
- Departure: ${params.outboundDate}
- Return: ${params.returnDate}
- Adults: ${params.adultsCount}
- Children: ${params.childrenCount}

Please try different dates or destinations.`;
          }

          // Save AI response
          sessionService.addMessage(phone, 'assistant', aiResponse);

          res.json({
            success: true,
            message: aiResponse,
            functionCall: params
          });

        } catch (error: any) {
          console.error('🔴 Flight search error:', error.message);
          const errorMessage = `❌ Error searching flights: ${error.message}`;
          sessionService.addMessage(phone, 'assistant', errorMessage);

          res.json({
            success: false,
            message: errorMessage
          });
        }

      } else {
        // AI is asking for more information
        const aiResponse = result.aiResponse || 'How can I help you with your flight search?';
        sessionService.addMessage(phone, 'assistant', aiResponse);

        res.json({
          success: true,
          message: aiResponse
        });
      }

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

      sessionService.resetSession(phone);

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

      const messages = sessionService.getMessages(phone);

      res.json({
        success: true,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
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
}

export default new ChatFunctionsController();