"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatController = void 0;
const openai_service_1 = __importDefault(require("../services/openai.service"));
const offto_service_1 = __importDefault(require("../services/offto.service"));
const session_service_1 = __importDefault(require("../services/session.service"));
class ChatController {
    /**
     * Send a chat message - SIMPLE FLIGHT SEARCH ONLY
     */
    async sendMessage(req, res) {
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
            session_service_1.default.addMessage(phone, 'user', message);
            // Get current context from memory
            let context = session_service_1.default.getContext(phone);
            console.log('💾 Current context in memory:', context);
            let aiResponse = '';
            // Skip booking flow - focus only on flight search
            if (false && context.bookingStage) {
                console.log('📋 Booking stage:', context.bookingStage);
                // Handle flight selection
                if (context.bookingStage === 'flight_selection') {
                    const flightNum = parseInt(message.trim());
                    if (!isNaN(flightNum) && flightNum >= 1 && flightNum <= (context.baskets?.length || 0)) {
                        const selectedBasket = context.baskets[flightNum - 1];
                        session_service_1.default.updateContext(phone, {
                            selectedBasketId: selectedBasket.basket_id,
                            bookingStage: 'collect_holder_title'
                        });
                        aiResponse = `✅ Flight ${flightNum} selected (ID: ${selectedBasket.basket_id})\n\n👤 **Main Passenger Details**\nAre you Mr or Ms?`;
                    }
                    else {
                        aiResponse = `Please enter a valid flight number (1-${context.baskets?.length || 0})`;
                    }
                }
                // Collect holder title
                else if (context.bookingStage === 'collect_holder_title') {
                    const title = message.toLowerCase().includes('mr') ? 'Mr' : message.toLowerCase().includes('ms') ? 'Ms' : null;
                    if (title) {
                        session_service_1.default.updateContext(phone, { holderTitle: title, bookingStage: 'collect_holder_name' });
                        aiResponse = 'What is your full name? (First and Last name)';
                    }
                    else {
                        aiResponse = 'Please specify: Are you Mr or Ms?';
                    }
                }
                // Collect holder name
                else if (context.bookingStage === 'collect_holder_name') {
                    const nameParts = message.trim().split(' ');
                    if (nameParts.length >= 2) {
                        session_service_1.default.updateContext(phone, {
                            holderFirstName: nameParts[0],
                            holderLastName: nameParts.slice(1).join(' '),
                            bookingStage: 'collect_holder_email'
                        });
                        aiResponse = 'What is your email address?';
                    }
                    else {
                        aiResponse = 'Please provide your full name (First and Last name)';
                    }
                }
                // Collect holder email
                else if (context.bookingStage === 'collect_holder_email') {
                    if (message.includes('@')) {
                        session_service_1.default.updateContext(phone, { holderEmail: message.trim(), bookingStage: 'collect_holder_phone' });
                        aiResponse = 'What is your phone number?';
                    }
                    else {
                        aiResponse = 'Please provide a valid email address';
                    }
                }
                // Collect holder phone
                else if (context.bookingStage === 'collect_holder_phone') {
                    session_service_1.default.updateContext(phone, { holderPhone: message.trim(), bookingStage: 'collect_passenger_dob' });
                    aiResponse = '📅 **Passenger Details**\nWhat is your date of birth? (format: DD/MM/YYYY)';
                }
                // Collect passenger DOB
                else if (context.bookingStage === 'collect_passenger_dob') {
                    const dobParts = message.split('/');
                    if (dobParts.length === 3) {
                        session_service_1.default.updateContext(phone, {
                            passengerDay: dobParts[0],
                            passengerMonth: dobParts[1],
                            passengerYear: dobParts[2],
                            bookingStage: 'collect_passenger_nationality'
                        });
                        aiResponse = 'What is your nationality? (e.g., Kuwait, Egypt, UAE)';
                    }
                    else {
                        aiResponse = 'Please provide date of birth in format: DD/MM/YYYY';
                    }
                }
                // Collect passenger nationality
                else if (context.bookingStage === 'collect_passenger_nationality') {
                    // Extract country code using AI
                    const countryInfo = await openai_service_1.default.extractCountryCode(message);
                    if (countryInfo.code) {
                        session_service_1.default.updateContext(phone, {
                            passengerNationality: countryInfo.code,
                            bookingStage: 'collect_passport_number'
                        });
                        aiResponse = 'What is your passport number?';
                    }
                    else {
                        aiResponse = 'Please specify your nationality (country name)';
                    }
                }
                // Collect passport number
                else if (context.bookingStage === 'collect_passport_number') {
                    session_service_1.default.updateContext(phone, {
                        passportNumber: message.trim().toUpperCase(),
                        bookingStage: 'collect_passport_expiry'
                    });
                    aiResponse = 'When does your passport expire? (format: DD/MM/YYYY)';
                }
                // Collect passport expiry
                else if (context.bookingStage === 'collect_passport_expiry') {
                    const expiryParts = message.split('/');
                    if (expiryParts.length === 3) {
                        const expiryDate = `${expiryParts[2]}-${expiryParts[1].padStart(2, '0')}-${expiryParts[0].padStart(2, '0')}`;
                        session_service_1.default.updateContext(phone, {
                            passportExpiry: expiryDate,
                            bookingStage: 'collect_issuing_country'
                        });
                        aiResponse = 'Which country issued your passport?';
                    }
                    else {
                        aiResponse = 'Please provide passport expiry date in format: DD/MM/YYYY';
                    }
                }
                // Collect issuing country
                else if (context.bookingStage === 'collect_issuing_country') {
                    const countryInfo = await openai_service_1.default.extractCountryCode(message);
                    if (countryInfo.code) {
                        session_service_1.default.updateContext(phone, {
                            issuingCountry: countryInfo.code,
                            bookingStage: 'ready_to_book'
                        });
                        // Show summary and confirm booking
                        aiResponse = `✅ **Booking Summary**\n
🎫 Flight ID: ${context.selectedBasketId}
👤 Holder: ${context.holderTitle} ${context.holderFirstName} ${context.holderLastName}
📧 Email: ${context.holderEmail}
📱 Phone: ${context.holderPhone}
🎂 DOB: ${context.passengerDay}/${context.passengerMonth}/${context.passengerYear}
🌍 Nationality: ${context.passengerNationality}
📔 Passport: ${context.passportNumber}
📅 Expiry: ${context.passportExpiry}
🏛️ Issued by: ${context.issuingCountry}

Type 'confirm' to book or 'cancel' to start over.`;
                    }
                    else {
                        aiResponse = 'Please specify the country that issued your passport';
                    }
                }
                // Ready to book - confirm or cancel
                else if (context.bookingStage === 'ready_to_book') {
                    if (message.toLowerCase() === 'confirm') {
                        // Make booking API call
                        const bookingData = {
                            basket_id: context.selectedBasketId,
                            holder_data: {
                                title: context.holderTitle,
                                first_name: context.holderFirstName,
                                last_name: context.holderLastName,
                                email: context.holderEmail,
                                mobile_number: context.holderPhone,
                                code_phone_id: "77",
                                currency: "USD"
                            },
                            paxes: [{
                                    day: context.passengerDay,
                                    month: context.passengerMonth,
                                    year: context.passengerYear,
                                    first_name: context.holderFirstName,
                                    last_name: context.holderLastName,
                                    title: context.holderTitle === 'Mr' ? 'Mr' : 'Ms',
                                    nationality: context.passengerNationality,
                                    passport_number: context.passportNumber,
                                    passport_expiry: context.passportExpiry,
                                    issuing_country: context.issuingCountry,
                                    currency: "USD"
                                }]
                        };
                        console.log('📤 Sending booking request:', bookingData);
                        // TODO: Call booking API
                        aiResponse = `🎉 **Booking Confirmed!**\n\nYour flight has been booked successfully.\nBooking details have been sent to ${context.holderEmail}`;
                        // Reset session after booking
                        session_service_1.default.resetSession(phone);
                    }
                    else if (message.toLowerCase() === 'cancel') {
                        session_service_1.default.resetSession(phone);
                        aiResponse = 'Booking cancelled. How can I help you today?';
                    }
                    else {
                        aiResponse = `Please type 'confirm' to complete the booking or 'cancel' to start over.`;
                    }
                }
            }
            // If no booking stage response, continue with normal flow
            if (!aiResponse) {
                // Extract flight info from user message
                const extractedInfo = await openai_service_1.default.extractFlightInfo(message, context);
                console.log('🔍 Extracted from message:', extractedInfo);
                // Update context in memory
                session_service_1.default.updateContext(phone, extractedInfo);
                context = session_service_1.default.getContext(phone);
                // Set defaults if we have flight info but missing passenger counts
                if ((context.departureCode || context.arrivalCode || context.outboundDate || context.returnDate) &&
                    context.adultsCount === undefined) {
                    session_service_1.default.updateContext(phone, { adultsCount: 1 });
                    context = session_service_1.default.getContext(phone);
                }
                if (context.adultsCount !== undefined && context.childrenCount === undefined) {
                    session_service_1.default.updateContext(phone, { childrenCount: 0 });
                    context = session_service_1.default.getContext(phone);
                }
                console.log('📊 Final context:', context);
                console.log('✅ Ready to search?', openai_service_1.default.isReadyToSearch(context));
            }
            // Check if we have all info to search (skip if we're already in booking flow)
            if (!aiResponse && openai_service_1.default.isReadyToSearch(context)) {
                // We have everything! Search for flights
                console.log('✅ All info collected! Searching flights...');
                console.log('🔍 Sending API request with body:', {
                    departureCode: context.departureCode,
                    arrivalCode: context.arrivalCode,
                    outboundDate: context.outboundDate,
                    returnDate: context.returnDate,
                    adultsCount: context.adultsCount,
                    childrenCount: context.childrenCount
                });
                // Search for flights DIRECTLY without AI message first
                try {
                    const searchResult = await offto_service_1.default.getBasketFlights(context.arrivalCode, context.outboundDate, context.returnDate, context.departureCode, context.adultsCount || 1, context.childrenCount || 0, 1, // page
                    'ar', // language AR as requested
                    '1', // currency ID (KWD)
                    '85' // location ID (Kuwait)
                    );
                    console.log('📦 API Response received:', searchResult.success ? 'Success' : 'Failed');
                    if (searchResult.success && searchResult.baskets && searchResult.baskets.length > 0) {
                        // Format flights for display - show raw data
                        const flightsList = searchResult.baskets.slice(0, 10).map((basket, index) => {
                            return {
                                flight: index + 1,
                                hotel: basket.hotel_name || basket.hotel?.name || 'Hotel Package',
                                price: `${basket.currency || 'KWD'} ${basket.grand_total || basket.total_price || basket.price || 'N/A'}`,
                                basketId: basket.basket_id,
                                departure: basket.departure_date,
                                return: basket.return_date
                            };
                        });
                        // Auto-inject results into chat
                        aiResponse = `✅ **Flight Search Results**\n\nFound ${searchResult.baskets.length} available flights from ${context.departureCode} to ${context.arrivalCode}:\n\n${JSON.stringify(flightsList, null, 2)}\n\n📌 Type the flight number (1-${Math.min(10, searchResult.baskets.length)}) to select a flight for booking.`;
                        // Store basket data and mark as in selection mode
                        session_service_1.default.updateContext(phone, {
                            baskets: searchResult.baskets,
                            bookingStage: 'flight_selection'
                        });
                    }
                    else {
                        aiResponse = `❌ No flights found for:\n- From: ${context.departureCode}\n- To: ${context.arrivalCode}\n- Departure: ${context.outboundDate}\n- Return: ${context.returnDate}\n\nPlease try different dates or destinations.`;
                    }
                }
                catch (error) {
                    console.error('🔴 API Search error:', error.message);
                    aiResponse = `❌ API Error: ${error.message}\n\nPlease check your input and try again.`;
                }
            }
            else if (!aiResponse) {
                // Still collecting info - ask AI what to ask next
                const messages = session_service_1.default.getMessages(phone).map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));
                aiResponse = await openai_service_1.default.generateResponse(messages, context);
            }
            // Save AI response to session
            session_service_1.default.addMessage(phone, 'assistant', aiResponse);
            res.json({
                success: true,
                message: aiResponse,
                debug: {
                    context,
                    readyToSearch: openai_service_1.default.isReadyToSearch(context),
                    missing: openai_service_1.default.getMissingInfo(context)
                }
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
            // Reset in-memory session
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
            // Get messages from in-memory session
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
exports.ChatController = ChatController;
