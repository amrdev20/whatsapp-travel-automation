"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatSalesController = void 0;
const openai_sales_service_1 = __importDefault(require("../services/openai-sales.service"));
const offto_service_1 = __importDefault(require("../services/offto.service"));
const session_service_1 = __importDefault(require("../services/session.service"));
class ChatSalesController {
    /**
     * Send a chat message using Sales Agent AI
     */
    async sendMessage(req, res) {
        try {
            const { phone, message, passportData } = req.body;
            if (!phone || !message) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone and message are required'
                });
            }
            console.log(`\n📞 [V4 Sales] Message from ${phone}: ${message}`);
            // Handle passport data if provided
            // Note: Passport data is now saved in whatsapp.controller.ts before being sent here
            // to avoid duplicate saving. We just log it here for tracking.
            if (passportData) {
                console.log(`📄 Passport data received for ${phone}:`, passportData);
                console.log(`✅ Passport already saved to session by WhatsApp controller`);
            }
            // Get session context
            const context = session_service_1.default.getContext(phone);
            // PRIORITY 2: Check if user is selecting an option by number or position
            // Match patterns like: "1", "option 1", "first one", "the first", "book option 1", etc.
            const optionNumberMatch = message.trim().match(/(?:option\s+)?(\d+)/i);
            const optionWordMatch = message.trim().toLowerCase();
            const basketIdMatch = message.trim().match(/^(?:basket\s+)?(\d+)$/i);
            let selectedBasketId = null;
            let selectionMethod = '';
            // Try to determine selection
            if (basketIdMatch && (context.flightResults || context.hotelResults)) {
                // Old format: direct basket_id (for backward compatibility)
                const basketId = basketIdMatch[1];
                // Check if this basket_id exists in current results
                const flightMatch = context.flightResults?.find((f) => f.basket_id?.toString() === basketId);
                const hotelMatch = context.hotelResults?.find((h) => h.basket_id?.toString() === basketId);
                if (flightMatch || hotelMatch) {
                    selectedBasketId = basketId;
                    selectionMethod = 'direct_basket_id';
                    console.log(`🎫 User selecting by direct basket_id: ${basketId}`);
                }
            }
            else if (optionNumberMatch && (context.flightResults || context.hotelResults)) {
                // New format: "option 1", "1", etc.
                const optionNumber = parseInt(optionNumberMatch[1]);
                const optionIndex = optionNumber - 1;
                // Check flight results first
                if (context.flightResults && optionIndex >= 0 && optionIndex < context.flightResults.length) {
                    selectedBasketId = context.flightResults[optionIndex].basket_id?.toString();
                    selectionMethod = 'option_number';
                    console.log(`🎫 User selecting flight option ${optionNumber}, basket_id: ${selectedBasketId}`);
                }
                // Then check hotel results
                else if (context.hotelResults && optionIndex >= 0 && optionIndex < context.hotelResults.length) {
                    selectedBasketId = context.hotelResults[optionIndex].basket_id?.toString();
                    selectionMethod = 'option_number';
                    console.log(`🎫 User selecting hotel option ${optionNumber}, basket_id: ${selectedBasketId}`);
                }
            }
            else if ((optionWordMatch.includes('first') || optionWordMatch.includes('1st')) && (context.flightResults || context.hotelResults)) {
                // Words like "first", "first one", "the first"
                if (context.flightResults && context.flightResults.length > 0) {
                    selectedBasketId = context.flightResults[0].basket_id?.toString();
                    selectionMethod = 'word_first';
                    console.log(`🎫 User selecting first flight option, basket_id: ${selectedBasketId}`);
                }
                else if (context.hotelResults && context.hotelResults.length > 0) {
                    selectedBasketId = context.hotelResults[0].basket_id?.toString();
                    selectionMethod = 'word_first';
                    console.log(`🎫 User selecting first hotel option, basket_id: ${selectedBasketId}`);
                }
            }
            if (selectedBasketId) {
                // Check if this is a FLIGHT basket
                if (context.flightResults) {
                    const flight = context.flightResults?.find((f) => f.basket_id?.toString() === selectedBasketId);
                    if (flight) {
                        console.log('✅ Found matching flight:', flight.basket_id);
                        // Get number of passengers from search params
                        const adultsCount = context.flightSearchParams?.adultsCount || 1;
                        const childrenCount = context.flightSearchParams?.childrenCount || 0;
                        const totalPassengers = adultsCount + childrenCount;
                        // Store the selected basket_id and booking type in context
                        session_service_1.default.updateContext(phone, {
                            selectedBasketId: selectedBasketId,
                            selectedFlight: flight,
                            bookingType: 'flight',
                            adultsCount,
                            childrenCount
                        });
                        // Add user selection to history
                        session_service_1.default.addMessage(phone, 'user', message);
                        // Continue to AI to start collecting booking details (don't return early!)
                    }
                }
                // Check if this is a HOTEL basket
                if (context.hotelResults) {
                    const hotel = context.hotelResults?.find((h) => h.basket_id?.toString() === selectedBasketId);
                    if (hotel) {
                        console.log('✅ Found matching hotel:', hotel.basket_id);
                        // Store the selected basket_id and booking type in context
                        session_service_1.default.updateContext(phone, {
                            selectedHotelBasketId: selectedBasketId,
                            selectedHotel: hotel,
                            bookingType: 'hotel'
                        });
                        // Add user selection to history
                        session_service_1.default.addMessage(phone, 'user', message);
                        // Continue to AI to start collecting booking details (don't return early!)
                    }
                    else {
                        console.log('❌ No matching basket found for basket_id:', selectedBasketId);
                    }
                }
            }
            // Add user message to session
            session_service_1.default.addMessage(phone, 'user', message);
            // Get conversation history
            const messages = session_service_1.default.getMessages(phone).map(msg => ({
                role: msg.role,
                content: msg.content
            }));
            // Process message with Sales AI (pass context so AI knows about basket selection)
            console.log('🤖 Processing with Sales Agent AI...');
            const result = await openai_sales_service_1.default.processMessage(messages, context);
            console.log('📊 Sales AI Result:', JSON.stringify(result, null, 2));
            let aiResponse = result.aiResponse || '';
            const searches = [];
            // Handle flight booking (PRIORITY 1 - check this first!)
            if (result.flightBooking) {
                const params = result.flightBooking;
                console.log('✈️ Flight Booking Detected:', params);
                // Fix basketId if AI used placeholder
                if (params.basketId === 'selected_flight_basket_id' || !params.basketId || isNaN(Number(params.basketId))) {
                    if (context.selectedBasketId) {
                        params.basketId = context.selectedBasketId;
                        console.log('🔧 Fixed basketId from context:', params.basketId);
                    }
                }
                try {
                    const bookingResult = await offto_service_1.default.bookFlight(params.basketId, {
                        title: params.holderData.title,
                        first_name: params.holderData.firstName,
                        last_name: params.holderData.lastName,
                        email: params.holderData.email,
                        mobile_number: params.holderData.mobileNumber,
                        code_phone_id: params.holderData.codePhoneId
                    }, params.paxes.map(pax => ({
                        day: pax.day,
                        month: pax.month,
                        year: pax.year,
                        first_name: pax.firstName,
                        last_name: pax.lastName,
                        title: pax.title,
                        nationality: pax.nationality,
                        passport_number: pax.passportNumber,
                        passport_expiry: pax.passportExpiry,
                        issuing_country: pax.issuingCountry
                    })));
                    console.log('✅ Flight booking API result:', bookingResult);
                    if (bookingResult.success && bookingResult.data?.InvoiceURL) {
                        const successMessage = `🎉 **Flight Booking Confirmed!**

📧 **Invoice ID**: ${bookingResult.data.InvoiceId}
🔗 **Payment Link**: ${bookingResult.data.InvoiceURL}
📝 **Customer Reference**: ${bookingResult.data.CustomerReference}

Please click the payment link above to complete your booking. Thank you for choosing us! 🙏`;
                        session_service_1.default.addMessage(phone, 'user', message);
                        session_service_1.default.addMessage(phone, 'assistant', successMessage);
                        // Clear ALL booking context after successful booking
                        session_service_1.default.updateContext(phone, {
                            selectedHotelBasketId: null,
                            selectedHotel: null,
                            hotelResults: null,
                            flightResults: null,
                            hotelSearchParams: null,
                            flightSearchParams: null
                        });
                        return res.json({
                            success: true,
                            message: successMessage
                        });
                    }
                    else {
                        // Booking failed - DON'T clear context, let AI handle it intelligently
                        console.log('❌ Flight booking failed:', bookingResult.message);
                        // Check if it's truly a basket expiration (basket not found on Offto's API)
                        const isBasketExpired = bookingResult.message?.toLowerCase().includes('basket not found') ||
                            bookingResult.message?.toLowerCase().includes('basket has expired');
                        if (isBasketExpired) {
                            // Only in this case, clear the basket and ask to search again
                            const expiredMessage = `❌ **Booking Session Expired**

The selection you made is no longer available. Availability changes quickly!

🔄 **Please search again** to get fresh availability and prices.

Just tell me what you're looking for (flights or hotels) with your travel details.`;
                            session_service_1.default.updateContext(phone, {
                                selectedHotelBasketId: null,
                                selectedHotel: null,
                                hotelResults: null,
                                flightResults: null
                            });
                            session_service_1.default.addMessage(phone, 'user', message);
                            session_service_1.default.addMessage(phone, 'assistant', expiredMessage);
                            return res.json({
                                success: true,
                                message: expiredMessage
                            });
                        }
                        else {
                            // For other errors (like API errors), keep basket context and let AI ask for clarification
                            session_service_1.default.addMessage(phone, 'user', message);
                            // Get conversation history
                            const messagesWithError = session_service_1.default.getMessages(phone).map(msg => ({
                                role: msg.role,
                                content: msg.content
                            }));
                            // Add error context for AI
                            messagesWithError.push({
                                role: 'user',
                                content: `[Previous booking attempt failed with: "${bookingResult.message}". Please help user resolve this and provide guidance.]`
                            });
                            // Let AI respond intelligently to the error
                            const aiErrorResponse = await openai_sales_service_1.default.processMessage(messagesWithError);
                            const errorResponseText = aiErrorResponse.aiResponse ||
                                `I encountered an issue with the booking: ${bookingResult.message}\n\nCould you please verify the information and try again? Make sure all passenger details are correct and in the proper format.`;
                            session_service_1.default.addMessage(phone, 'assistant', errorResponseText);
                            return res.json({
                                success: true,
                                message: errorResponseText
                            });
                        }
                    }
                }
                catch (error) {
                    console.error('🔴 Flight Booking exception:', error);
                    // Don't clear basket on exceptions - let user retry
                    const errorMessage = `I encountered a technical error while processing your flight booking. The booking is still available. Please try again or contact support if the issue persists.`;
                    session_service_1.default.addMessage(phone, 'user', message);
                    session_service_1.default.addMessage(phone, 'assistant', errorMessage);
                    return res.json({
                        success: true,
                        message: errorMessage
                    });
                }
            }
            // Handle hotel booking (PRIORITY 2 - check after flight booking!)
            if (result.hotelBooking) {
                const params = result.hotelBooking;
                console.log('📝 Hotel Booking Detected:', params);
                // Fix basketId if AI used placeholder
                if (params.basketId === 'selected_hotel_basket_id' || !params.basketId || isNaN(Number(params.basketId))) {
                    if (context.selectedHotelBasketId) {
                        params.basketId = context.selectedHotelBasketId;
                        console.log('🔧 Fixed hotel basketId from context:', params.basketId);
                    }
                }
                try {
                    const bookingResult = await offto_service_1.default.bookHotel(params.basketId, {
                        title: params.title,
                        first_name: params.firstName,
                        last_name: params.lastName,
                        email: params.email,
                        mobile_number: params.mobileNumber,
                        code_phone_id: params.codePhoneId
                    });
                    console.log('✅ Hotel booking API result:', bookingResult);
                    if (bookingResult.success && bookingResult.data?.InvoiceURL) {
                        const successMessage = `🎉 **Hotel Booking Confirmed!**

📧 **Invoice ID**: ${bookingResult.data.InvoiceId}
🔗 **Payment Link**: ${bookingResult.data.InvoiceURL}
📝 **Customer Reference**: ${bookingResult.data.CustomerReference}

Please click the payment link above to complete your booking. Thank you for choosing us! 🙏`;
                        session_service_1.default.addMessage(phone, 'user', message);
                        session_service_1.default.addMessage(phone, 'assistant', successMessage);
                        // Clear ALL booking context after successful booking
                        session_service_1.default.updateContext(phone, {
                            selectedHotelBasketId: null,
                            selectedHotel: null,
                            hotelResults: null,
                            flightResults: null,
                            hotelSearchParams: null,
                            flightSearchParams: null
                        });
                        return res.json({
                            success: true,
                            message: successMessage
                        });
                    }
                    else {
                        // Booking failed - DON'T clear context, let AI handle it and ask for clarification
                        console.log('❌ Hotel booking failed:', bookingResult.message);
                        // Check if it's truly a basket expiration (basket not found on Offto's API)
                        const isBasketExpired = bookingResult.message?.toLowerCase().includes('basket not found') ||
                            bookingResult.message?.toLowerCase().includes('basket has expired');
                        if (isBasketExpired) {
                            // Only in this case, clear the basket and ask to search again
                            const expiredMessage = `❌ **Booking Session Expired**

The selection you made is no longer available. Availability changes quickly!

🔄 **Please search again** to get fresh availability and prices.

Just tell me what you're looking for (flights or hotels) with your travel details.`;
                            session_service_1.default.updateContext(phone, {
                                selectedHotelBasketId: null,
                                selectedHotel: null,
                                hotelResults: null,
                                flightResults: null
                            });
                            session_service_1.default.addMessage(phone, 'user', message);
                            session_service_1.default.addMessage(phone, 'assistant', expiredMessage);
                            return res.json({
                                success: true,
                                message: expiredMessage
                            });
                        }
                        else {
                            // For other errors (like API errors), keep basket context and let AI ask for clarification
                            // Add error context for AI awareness
                            const errorNote = `[SYSTEM NOTE: Booking attempt failed with error: "${bookingResult.message}". Basket ${params.basketId} is still selected. Ask user to verify and re-enter their information in correct format, or if it's an API error, inform them politely.]`;
                            session_service_1.default.addMessage(phone, 'user', message);
                            session_service_1.default.addMessage(phone, 'system', errorNote);
                            // Get conversation history including the error note
                            const messagesWithError = session_service_1.default.getMessages(phone)
                                .filter(msg => msg.role !== 'system') // Don't send system messages to OpenAI
                                .map(msg => ({
                                role: msg.role,
                                content: msg.content
                            }));
                            // Add the error context as a user message for AI to see
                            messagesWithError.push({
                                role: 'user',
                                content: `[Previous booking attempt failed with: "${bookingResult.message}". Please help user resolve this.]`
                            });
                            // Let AI respond intelligently to the error
                            const aiErrorResponse = await openai_sales_service_1.default.processMessage(messagesWithError);
                            const errorResponseText = aiErrorResponse.aiResponse ||
                                `I encountered an issue with the booking: ${bookingResult.message}\n\nCould you please verify your information and provide it again in this format?\n\n**Title, First Name, Last Name, Email, Mobile Number, Country Code**\n\nExample: \`Mr, John, Doe, john@example.com, 12345678, 965\``;
                            session_service_1.default.addMessage(phone, 'assistant', errorResponseText);
                            return res.json({
                                success: true,
                                message: errorResponseText
                            });
                        }
                    }
                }
                catch (error) {
                    console.error('🔴 Hotel booking exception:', error);
                    // Don't clear basket on exceptions either - let user retry
                    const errorMessage = `I encountered a technical error while processing your booking. The basket is still valid. Please try providing your details again:\n\n**Title, First Name, Last Name, Email, Mobile Number, Country Code**\n\nExample: \`Mr, John, Doe, john@example.com, 12345678, 965\``;
                    session_service_1.default.addMessage(phone, 'user', message);
                    session_service_1.default.addMessage(phone, 'assistant', errorMessage);
                    return res.json({
                        success: true,
                        message: errorMessage
                    });
                }
            }
            // Handle flight search
            if (result.flightSearch) {
                const params = result.flightSearch;
                console.log('✈️ Flight Search Detected:', params);
                try {
                    const searchResult = await offto_service_1.default.getBasketFlights(params.arrivalCode, params.outboundDate, params.returnDate || null, // Pass null for one-way flights
                    params.departureCode, params.adultsCount || 1, params.childrenCount || 0, 1, 'ar', '1', '85');
                    if (searchResult.success && searchResult.baskets && searchResult.baskets.length > 0) {
                        const flightsDisplay = searchResult.baskets.slice(0, 5).map((basket, i) => `**Flight Option ${i + 1}**\n\n${basket.template || 'Flight details not available'}`).join('\n\n' + '='.repeat(50) + '\n\n');
                        searches.push({
                            type: 'flights',
                            data: flightsDisplay,
                            baskets: searchResult.baskets
                        });
                        // Store flight results in session
                        session_service_1.default.updateContext(phone, {
                            flightResults: searchResult.baskets,
                            flightSearchParams: params
                        });
                    }
                    else {
                        searches.push({
                            type: 'flights',
                            data: `❌ No flights found for ${params.departureCode} → ${params.arrivalCode}`
                        });
                    }
                }
                catch (error) {
                    console.error('🔴 Flight search error:', error.message);
                    searches.push({
                        type: 'flights',
                        data: `❌ Error searching flights: ${error.message}`
                    });
                }
            }
            // Handle hotel search
            if (result.hotelSearch) {
                const params = result.hotelSearch;
                console.log('🏨 Hotel Search Detected:', params);
                try {
                    const searchResult = await offto_service_1.default.searchHotels(params.destinationCity, params.checkInDate, params.checkOutDate, 'KW', 'KW', params.rooms, '7', 'KWD', 'en');
                    if (searchResult.success && searchResult.hotels && searchResult.hotels.length > 0) {
                        const hotelsDisplay = searchResult.hotels.slice(0, 5).map((hotel, i) => {
                            // Use template if available, otherwise format manually
                            if (hotel.template) {
                                return `**Hotel Option ${i + 1}**\n\n${hotel.template}` +
                                    (hotel.image ? `\n\n🖼️ Image: ${hotel.image}` : '');
                            }
                            else {
                                const details = hotel.HotelDetails || {};
                                const price = hotel.NetShowingPrice || hotel.Price || 'N/A';
                                return `**Hotel Option ${i + 1}**\n\n` +
                                    `🏨 **${details.HotelName || hotel.HotelName || 'Hotel'}**\n` +
                                    `⭐ Rating: ${details.HotelRating || hotel.HotelRating || 'N/A'} stars\n` +
                                    `📍 Location: ${details.Address || hotel.Address || 'N/A'}\n` +
                                    `💰 Price: ${price} KWD\n` +
                                    (hotel.image ? `🖼️ Image: ${hotel.image}\n` : '') +
                                    `${details.HotelDescription || hotel.HotelDescription || ''}`;
                            }
                        }).join('\n\n' + '='.repeat(50) + '\n\n');
                        searches.push({
                            type: 'hotels',
                            data: hotelsDisplay,
                            hotels: searchResult.hotels
                        });
                        // Store hotel results in session
                        session_service_1.default.updateContext(phone, {
                            hotelResults: searchResult.hotels,
                            hotelSearchParams: params
                        });
                    }
                    else {
                        searches.push({
                            type: 'hotels',
                            data: `❌ No hotels found in ${params.destinationCity}`
                        });
                    }
                }
                catch (error) {
                    console.error('🔴 Hotel search error:', error.message);
                    searches.push({
                        type: 'hotels',
                        data: `❌ Error searching hotels: ${error.message}`
                    });
                }
            }
            // Combine AI response with search results
            let finalResponse = aiResponse;
            if (searches.length > 0) {
                finalResponse += '\n\n' + '='.repeat(50) + '\n\n';
                for (const search of searches) {
                    if (search.type === 'flights') {
                        finalResponse += '✈️ **FLIGHT OPTIONS**\n\n' + search.data + '\n\n';
                    }
                    else if (search.type === 'hotels') {
                        finalResponse += '🏨 **HOTEL OPTIONS**\n\n' + search.data + '\n\n';
                    }
                }
                finalResponse += '='.repeat(50) + '\n\n';
                finalResponse += '💡 **To book:** Tell me which option you prefer (e.g., "I want option 1" or "Book the first one")';
            }
            // Save AI response
            session_service_1.default.addMessage(phone, 'assistant', finalResponse);
            res.json({
                success: true,
                message: finalResponse
            });
        }
        catch (error) {
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
    async resetConversation(req, res) {
        try {
            const { phone } = req.body;
            if (!phone) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone is required'
                });
            }
            session_service_1.default.resetSession(phone);
            res.json({
                success: true,
                message: 'Conversation reset successfully'
            });
        }
        catch (error) {
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
    async getHistory(req, res) {
        try {
            const { phone } = req.params;
            if (!phone) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone is required'
                });
            }
            const messages = session_service_1.default.getMessages(phone);
            res.json({
                success: true,
                messages: messages.map(msg => ({
                    role: msg.role,
                    content: msg.content
                }))
            });
        }
        catch (error) {
            console.error('History error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get history',
                error: error.message
            });
        }
    }
}
exports.ChatSalesController = ChatSalesController;
exports.default = new ChatSalesController();
