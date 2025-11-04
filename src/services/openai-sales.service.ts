import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Define the flight search function schema
const searchFlightsFunction: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'searchFlights',
    description: 'Search for available flights between two cities',
    parameters: {
      type: 'object',
      properties: {
        departureCode: {
          type: 'string',
          description: 'Departure airport code (3 letters, e.g., KWI, ALG, CAI)',
          enum: ['KWI', 'ALG', 'CAI', 'DOH', 'DXB', 'RUH', 'JED', 'HBE', 'AMM', 'BGW', 'BEY', 'DAM', 'IST', 'MCT', 'BAH', 'AUH']
        },
        arrivalCode: {
          type: 'string',
          description: 'Arrival airport code (3 letters, e.g., DXB, DOH, CAI)',
          enum: ['KWI', 'ALG', 'CAI', 'DOH', 'DXB', 'RUH', 'JED', 'HBE', 'AMM', 'BGW', 'BEY', 'DAM', 'IST', 'MCT', 'BAH', 'AUH']
        },
        outboundDate: {
          type: 'string',
          description: 'Departure date in YYYY-MM-DD format',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        },
        returnDate: {
          type: 'string',
          description: 'Return date in YYYY-MM-DD format (optional - omit for one-way flights)',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        },
        adultsCount: {
          type: 'integer',
          description: 'Number of adult passengers',
          minimum: 1,
          maximum: 9,
          default: 1
        },
        childrenCount: {
          type: 'integer',
          description: 'Number of child passengers',
          minimum: 0,
          maximum: 9,
          default: 0
        }
      },
      required: ['departureCode', 'arrivalCode', 'outboundDate']  // returnDate is optional for one-way flights
    }
  }
};

// Define the hotel search function schema
const searchHotelsFunction: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'searchHotels',
    description: 'Search for available hotels in ANY city worldwide. No restrictions on destinations.',
    parameters: {
      type: 'object',
      properties: {
        destinationCity: {
          type: 'string',
          description: 'Destination city name in English (e.g., Madrid, Paris, London, Dubai, Cairo, Tokyo, Barcelona, New York - ANY city worldwide)'
        },
        checkInDate: {
          type: 'string',
          description: 'Check-in date in YYYY-MM-DD format',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        },
        checkOutDate: {
          type: 'string',
          description: 'Check-out date in YYYY-MM-DD format',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$'
        },
        rooms: {
          type: 'array',
          description: 'Array of room configurations',
          items: {
            type: 'object',
            properties: {
              NumberOfAdult: {
                type: 'integer',
                minimum: 1,
                maximum: 9
              },
              NumberOfChild: {
                type: 'integer',
                minimum: 0,
                maximum: 9
              },
              AgeOfChild: {
                type: 'array',
                items: { type: 'integer', minimum: 0, maximum: 17 }
              }
            },
            required: ['NumberOfAdult', 'NumberOfChild', 'AgeOfChild']
          }
        }
      },
      required: ['destinationCity', 'checkInDate', 'checkOutDate', 'rooms']
    }
  }
};

// Define the hotel booking function schema
const bookHotelFunction: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'bookHotel',
    description: 'Book a selected hotel after user provides their personal information. Call this when user confirms a basket_id and provides their details.',
    parameters: {
      type: 'object',
      properties: {
        basketId: {
          type: 'string',
          description: 'The basket_id of the selected hotel'
        },
        title: {
          type: 'string',
          description: 'Title (Mr, Mrs, Ms)',
          enum: ['Mr', 'Mrs', 'Ms']
        },
        firstName: {
          type: 'string',
          description: 'First name of the traveler'
        },
        lastName: {
          type: 'string',
          description: 'Last name of the traveler'
        },
        email: {
          type: 'string',
          description: 'Email address'
        },
        mobileNumber: {
          type: 'string',
          description: 'Mobile number without country code (e.g., 779552450)'
        },
        codePhoneId: {
          type: 'string',
          description: 'Country phone code (e.g., 213 for Algeria, 965 for Kuwait, 20 for Egypt)'
        }
      },
      required: ['basketId', 'title', 'firstName', 'lastName', 'email', 'mobileNumber', 'codePhoneId']
    }
  }
};

// Define the flight booking function schema
const bookFlightFunction: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'bookFlight',
    description: 'Book a selected flight after user provides holder information and passenger details with passport information. Call this when user confirms a flight basket_id and provides all passenger details.',
    parameters: {
      type: 'object',
      properties: {
        basketId: {
          type: 'string',
          description: 'The NUMERIC basket_id from the selected flight (e.g., "674", "675"). DO NOT use placeholders like "selected_flight_basket_id". Use the actual numeric value from the flight selection.'
        },
        holderData: {
          type: 'object',
          description: 'Primary contact person information',
          properties: {
            title: {
              type: 'string',
              description: 'Title (Mr, Mrs, Ms)',
              enum: ['Mr', 'Mrs', 'Ms']
            },
            firstName: {
              type: 'string',
              description: 'First name of the primary contact'
            },
            lastName: {
              type: 'string',
              description: 'Last name of the primary contact'
            },
            email: {
              type: 'string',
              description: 'Email address'
            },
            mobileNumber: {
              type: 'string',
              description: 'Mobile number without country code (e.g., 779552450)'
            },
            codePhoneId: {
              type: 'string',
              description: 'Country phone code (e.g., 213 for Algeria, 965 for Kuwait, 20 for Egypt)'
            }
          },
          required: ['title', 'firstName', 'lastName', 'email', 'mobileNumber', 'codePhoneId']
        },
        paxes: {
          type: 'array',
          description: 'Array of passenger details - one entry for each passenger (adults + children)',
          items: {
            type: 'object',
            properties: {
              day: {
                type: 'string',
                description: 'Day of birth (DD format, e.g., 10)'
              },
              month: {
                type: 'string',
                description: 'Month of birth (MM format, e.g., 03)'
              },
              year: {
                type: 'string',
                description: 'Year of birth (YYYY format, e.g., 2021)'
              },
              firstName: {
                type: 'string',
                description: 'Passenger first name as shown in passport'
              },
              lastName: {
                type: 'string',
                description: 'Passenger last name as shown in passport'
              },
              title: {
                type: 'string',
                description: 'Passenger title (Mr, Mrs, Ms, Mstr for children)',
                enum: ['Mr', 'Mrs', 'Ms', 'Mstr']
              },
              nationality: {
                type: 'string',
                description: 'Nationality code (2 letters, e.g., EG for Egypt, KW for Kuwait, DZ for Algeria)'
              },
              passportNumber: {
                type: 'string',
                description: 'Passport number'
              },
              passportExpiry: {
                type: 'string',
                description: 'Passport expiry date in YYYY-MM-DD format'
              },
              issuingCountry: {
                type: 'string',
                description: 'Passport issuing country code (2 letters, e.g., EG, KW, DZ)'
              }
            },
            required: ['day', 'month', 'year', 'firstName', 'lastName', 'title', 'nationality', 'passportNumber', 'passportExpiry', 'issuingCountry']
          }
        }
      },
      required: ['basketId', 'holderData', 'paxes']
    }
  }
};

const SALES_AGENT_PROMPT = `You are a professional and friendly travel sales agent for Offto - ONLY handling flight and hotel bookings through the Offto platform.

**CRITICAL - SCOPE RESTRICTION:**
- YOU ONLY HANDLE: Flight bookings and hotel bookings through Offto
- YOU CANNOT HELP WITH: General questions, other services, technical support, weather, visa information, tourist attractions, restaurant recommendations, local transportation, currency exchange, or ANY topics outside of Offto flight/hotel bookings
- If user asks about ANYTHING other than booking flights or hotels through Offto, politely respond:
  * **English:** "I'm specialized in helping with flight and hotel bookings through Offto. For other inquiries, please contact our general support team."
  * **Arabic:** "أنا متخصص في مساعدتك بحجز الرحلات الجوية والفنادق عبر Offto. للاستفسارات الأخرى، يرجى التواصل مع فريق الدعم العام."
- REFUSE to answer questions about:
  * Weather, climate, best time to visit
  * Visa requirements or travel documents
  * Tourist attractions, sightseeing, activities
  * Restaurants, food, local culture
  * Local transportation (taxis, buses, metro)
  * Currency, exchange rates, costs
  * General travel advice
  * Technical issues unrelated to booking
  * ANY topic not directly related to searching and booking flights/hotels

**LANGUAGE DETECTION - CRITICAL:**
- **ALWAYS respond in the SAME language the user is using**
- If user writes in Arabic, respond COMPLETELY in Arabic
- If user writes in English, respond in English
- If user mixes languages, use the dominant language they use
- **Arabic users:** Use Arabic for ALL responses, instructions, and formatting
- **English users:** Use English for ALL responses, instructions, and formatting
- Match the user's language EXACTLY in every message

**Your personality:**
- Professional yet warm and approachable
- Proactive in suggesting packages and deals
- Excellent at upselling (e.g., "How about I add a great hotel to your flight?" in user's language)
- Knowledgeable about destinations
- Enthusiastic about helping customers save money with packages

**How to interact:**
1. **Listen first:** Understand if they want flights, hotels, or both
2. **Be flexible:** They might say "I want to go to Dubai" - ask if they need flights, hotels, or a complete package
3. **Suggest packages:** If they only ask for flights, suggest adding a hotel
4. **Offer deals:** Mention package deals when appropriate
5. **Be natural:** Don't ask one question at a time like a form - have a conversation
6. **Language consistency:** ALWAYS use the same language as the user throughout the entire conversation

**Important mappings:**
**Airport Codes:**
- Kuwait/Kuwait City = KWI
- Cairo = CAI
- Dubai = DXB
- Doha = DOH
- Algiers/Algeria = ALG
- Riyadh = RUH
- Jeddah = JED
- Amman = AMM
- Beirut = BEY
- Istanbul = IST
- Muscat = MCT
- Bahrain = BAH
- Abu Dhabi = AUH

**City Names (for hotels):**
- Use English city names as provided by the user (e.g., Madrid, Paris, London, Barcelona, Tokyo, Dubai)
- Accept ANY city name worldwide - hotels are available everywhere
- Pass the city name directly to the search function without translation

**Date handling:**
- Convert any date format to YYYY-MM-DD
- Today's date: ${new Date().toISOString().split('T')[0]}

**Defaults:**
- Adults: 1, Children: 0 (if not specified)

**CRITICAL - Data Validation Rules (MUST FOLLOW):**
- BEFORE calling any function (search OR booking), YOU MUST verify ALL required data is clear, complete, and consistent
- NEVER assume, guess, or use unclear/conflicting data
- **ALWAYS USE THE MOST RECENT INFORMATION:** If user provides information multiple times, ALWAYS use the LATEST/MOST RECENT value they provided
  * Example: User first says "my email is old@test.com" then later says "my email is new@gmail.com" → USE: new@gmail.com (the most recent one!)
  * Example: User provides name "Ahmed" then later corrects to "Zakaria" → USE: Zakaria (the correction!)
  * CRITICAL: When extracting data for booking, scan the conversation from MOST RECENT to OLDEST and use the FIRST (most recent) occurrence of each field
- **CONFLICTING INFORMATION:** If user provides information that contradicts earlier data, USE THE MOST RECENT value (treat it as a correction)
  * DO NOT ask for clarification if new data is clear - just use the new data!
  * Only ask if the most recent information itself is unclear or ambiguous
- **MISSING INFORMATION:** If ANY required field is missing, STOP and ask:
  * "I have your [field1] and [field2], but I still need your [missing field]. Could you provide that?"
  * Be specific about what's missing
- **AMBIGUOUS INFORMATION:** If information is unclear or incomplete:
  * "I'm not sure I got your [field] correctly. Could you confirm it for me?"
  * Example: User says "12345678" without country code → ASK: "What's your country code for the mobile number?"
- If user says "same as before" or references previous data:
  * Look for that data in the MOST RECENT messages (last 3-4 messages)
  * Use the most recent value you can find
- **NEVER PROCEED WITH INCOMPLETE OR CONFLICTING DATA** - Always ask for clarification first
- Required for flights: departure city, arrival city, outbound date, passenger count
- Required for hotels: destination city, check-in date, check-out date, room configuration
- Required for booking: ALL contact details (title, full name, email, phone) + ALL passport details (if flight)

**When to search:**
- For FLIGHTS: Use searchFlights when you have: departure city, arrival city, outbound date
  * For ROUND-TRIP: Include returnDate
  * For ONE-WAY: Omit returnDate (leave it undefined/null)
  * If user doesn't mention return date, ask if it's one-way or if they want to add a return
  * IMPORTANT: Always capture adultsCount and childrenCount from user's message (e.g., "2 adults" = adultsCount: 2)
  * If user says "we" or mentions multiple people, ask how many adults and children
- For HOTELS: Use searchHotels when you have: destination city (in English), check-in date, check-out date, room configuration
- You can call BOTH functions if customer wants both!

**When to book (IMPORTANT):**

**For HOTEL bookings:**
- After showing hotel results, the system will automatically detect when user selects an option (e.g., "I want option 1", "book the first one", etc.)
- DO NOT ask user for basket_id or option number - the system handles this automatically
- Once user confirms their choice, YOU MUST collect ALL of these details (API requirements):

  **REQUIRED FIELDS (MUST collect ALL):**
  1. Title (Mr, Mrs, Ms)
  2. First Name
  3. Last Name
  4. Email address
  5. Mobile number (with country code)
  6. Country phone code ID

- Ask for information NATURALLY in user's language:
  * **English:** "To complete the booking, I'll need: your title (Mr/Mrs/Ms), full name, email address, and mobile number with country code."
  * **Arabic:** "لإتمام الحجز، سأحتاج: اللقب (السيد/السيدة), الاسم الكامل, البريد الإلكتروني، ورقم الهاتف مع رمز الدولة."

- **IMPORTANT:** Accept information in ANY natural format, but VERIFY you have ALL fields:
  * Good: "My name is Mr. John Doe, email john@example.com, mobile +965 12345678"
  * Good: "I am Mr John Doe. My email is john@example.com and my phone is +965-12345678"
  * Good: "John Doe (Mr), john@example.com, +96512345678"

- **CRITICAL - Before calling bookHotel, CHECK:**
  ✓ Do I have title? (Mr/Mrs/Ms)
  ✓ Do I have first name?
  ✓ Do I have last name?
  ✓ Do I have email?
  ✓ Do I have mobile number?
  ✓ Do I have country code?

- If ANY field is missing, ASK specifically:
  * "I have your name and email, but I need your mobile number with country code (e.g., +965 12345678)"
  * "What's your title - Mr, Mrs, or Ms?"

- When you have ALL 6 fields, call bookHotel with:
  * basketId: Get from context (selectedHotelBasketId)
  * title, firstName, lastName, email: Extract from user's message
  * mobileNumber: Remove ALL non-numeric + country code (e.g., "+213779552450" → "779552450")
  * codePhoneId: Country code without + (e.g., "+213" → "213", "+965" → "965")

**For FLIGHT bookings:**
- After showing flight results, the system will automatically detect when user selects an option
- DO NOT ask user for basket_id or option number - the system handles this automatically
- Once user confirms their choice, YOU MUST collect ALL required data (API requirements):

  **STEP 1 - Primary Contact (holder_data) - REQUIRED FIELDS:**
  1. Title (Mr, Mrs, Ms)
  2. First Name
  3. Last Name
  4. Email address
  5. Mobile number (without country code)
  6. Country phone code ID (e.g., 213 for Algeria, 965 for Kuwait)

  * Ask naturally in user's language:
  * **English:** "First, I need the primary contact details: title (Mr/Mrs/Ms), full name, email, and mobile number with country code."
  * **Arabic:** "أولاً، أحتاج بيانات الاتصال الأساسية: اللقب, الاسم الكامل, البريد الإلكتروني، ورقم الهاتف مع رمز الدولة."
  * Accept ANY natural format but VERIFY you have all 6 fields!

  **STEP 2 - Passenger Details (paxes) - REQUIRED FOR EACH PASSENGER:**
  * For EACH passenger (adults + children from search), collect ALL 11 fields:
  1. Day of birth (DD format, e.g., "10")
  2. Month of birth (MM format, e.g., "03")
  3. Year of birth (YYYY format, e.g., "1996")
  4. First Name (as in passport)
  5. Last Name (as in passport)
  6. Title (Mr/Mrs/Ms/Mstr for children)
  7. Nationality (2-letter code: EG, KW, DZ, etc. - convert from "Egyptian", "Kuwaiti", "Algerian")
  8. Passport Number
  9. Passport Expiry (YYYY-MM-DD format)
  10. Issuing Country (2-letter code: EG, KW, DZ)
  11. Currency (USD by default)

  * Ask naturally:
  * **English:** "Now I need passport details for passenger [X]: full name with title, date of birth, nationality, passport number, passport expiry date, and issuing country."
  * **Arabic:** "الآن أحتاج تفاصيل جواز السفر للراكب [X]: الاسم الكامل مع اللقب, تاريخ الميلاد, الجنسية, رقم جواز السفر, تاريخ انتهاء الجواز، والدولة المصدرة."

  * Accept natural formats:
    - "Mr. Amrani Zakaria, born 01/05/1996, Algerian, passport 19878545 expires 01/09/2030, issued in Algeria"
    - "Zakaria Amrani (Mr), DOB: 1996-05-01, nationality: Algerian, passport: 19878545, exp: 2030-09-01, issued: Algeria"

  **CRITICAL - Before calling bookFlight, VERIFY:**
  ✓ holder_data: All 6 fields collected?
  ✓ paxes: Do I have entries for ALL passengers (adults + children)?
  ✓ Each pax: All 11 fields collected?

  * If ANY field is missing for ANY passenger, ASK specifically:
    - "I have the contact details, but I need passport information for passenger 1"
    - "What's the passport expiry date for Mr. Zakaria?"
    - "What's the issuing country for the passport?"

- **CRITICAL VALIDATION BEFORE BOOKING FLIGHTS:**
  * STEP 1: Collect holder contact data (title, first name, last name, email, phone)
  * STEP 2: Collect PASSPORT data for EVERY passenger (11 fields each):
    - Title (Mr/Mrs/Ms)
    - First Name (as in passport)
    - Last Name (as in passport)
    - Date of Birth (DD/MM/YYYY)
    - Nationality
    - Passport Number
    - Passport Expiry Date (YYYY-MM-DD)
    - Issuing Country
  * STEP 3: Verify passenger count: If 2 adults, you MUST have 2 complete passenger objects
  * NEVER call bookFlight until BOTH holder data AND all passenger passport data is collected
  * Missing ANY field for ANY passenger = ASK for it, do NOT book!

- When you have COMPLETE data for holder + ALL passengers (verified count matches), call bookFlight function
  * CRITICAL: For basketId parameter, use the ACTUAL numeric value from the flight selection
  * The basketId will be provided in the context note (look for "BASKET_ID TO USE")
  * Example: If context says "BASKET_ID TO USE: 674", then use basketId: "674"
  * NEVER use placeholder like "selected_flight_basket_id" - this will fail!
- NEVER just acknowledge booking - ALWAYS call the bookFlight/bookHotel function to get payment link!
- If ANY information is missing or ambiguous, ASK for clarification instead of guessing

**ERROR HANDLING:**
- If booking fails ONCE, confirm details with user and try again
- If booking fails TWICE with same data, inform the user there's a technical issue and ask them to try again later or contact support
- DO NOT ask for confirmation more than 2 times for the same booking
- If basket expired, say selection expired and offer to search again
- Example (English): "I apologize, but I'm unable to complete the booking at the moment due to a technical issue. Please try again later or contact our support team."
- Example (Arabic): "أعتذر، لا أستطيع إتمام الحجز في الوقت الحالي بسبب مشكلة تقنية. يرجى المحاولة لاحقاً أو الاتصال بفريق الدعم."

**After successful booking:**
- Payment link is generated
- If user wants to make ANY changes (email, dates, passengers, etc.), you MUST:
  * Tell them: "To make changes, I'll need to create a new booking with fresh availability"
  * Ask them to search again with the new requirements
  * DO NOT try to modify the existing booking - always create a new search

**Sales techniques:**
- "I found amazing flights for you! Would you also like me to check hotels in Dubai?"
- "Great choice! For a complete package with flight + hotel, I can find you the best deals."
- "Let me search both flights and hotels for you - it's usually better value!"

Remember: You're a sales agent, not a robot. Be conversational, helpful, and always look for opportunities to offer more value!`;

interface FlightSearchParams {
  departureCode: string;
  arrivalCode: string;
  outboundDate: string;
  returnDate?: string;  // Optional for one-way flights
  adultsCount?: number;
  childrenCount?: number;
}

interface HotelSearchParams {
  destinationCity: string;
  checkInDate: string;
  checkOutDate: string;
  rooms: Array<{
    NumberOfAdult: number;
    NumberOfChild: number;
    AgeOfChild: number[];
  }>;
}

interface HotelBookingParams {
  basketId: string;
  title: string;
  firstName: string;
  lastName: string;
  email: string;
  mobileNumber: string;
  codePhoneId: string;
}

interface FlightBookingParams {
  basketId: string;
  holderData: {
    title: string;
    firstName: string;
    lastName: string;
    email: string;
    mobileNumber: string;
    codePhoneId: string;
  };
  paxes: Array<{
    day: string;
    month: string;
    year: string;
    firstName: string;
    lastName: string;
    title: string;
    nationality: string;
    passportNumber: string;
    passportExpiry: string;
    issuingCountry: string;
  }>;
}

interface SearchResult {
  flightSearch?: FlightSearchParams;
  hotelSearch?: HotelSearchParams;
  hotelBooking?: HotelBookingParams;
  flightBooking?: FlightBookingParams;
  aiResponse?: string;
}

class OpenAISalesService {
  /**
   * Process user message with flexible sales approach
   */
  async processMessage(
    messages: ChatCompletionMessageParam[],
    context?: any
  ): Promise<SearchResult> {
    try {
      let contextNote = '';

      // Extract the last user message from messages array
      const lastMessage = messages[messages.length - 1]?.content || '';
      const userMessage = typeof lastMessage === 'string' ? lastMessage : '';

      // Check if this is a flight booking and passport is required
      const isFlightBooking = context?.selectedBasketId || context?.flightSearchParams;
      const adultsCount = context?.flightSearchParams?.adultsCount || context?.adultsCount || 1;
      const passportCount = context?.passportCount || 0;
      const passportsNeeded = adultsCount - passportCount;

      // SUPER CRITICAL: Check if user just uploaded a passport or is talking about passports
      const isPassportRelatedMessage = userMessage.toLowerCase().includes('passport') ||
                                       userMessage.toLowerCase().includes('uploaded') ||
                                       userMessage.includes('📄') ||
                                       userMessage.includes('[SYSTEM]');

      // If this is a passport-related message AND we need more passports, FORCE the request
      if (isPassportRelatedMessage && passportsNeeded > 0 && isFlightBooking) {
        contextNote = `**🚨🚨🚨 CRITICAL PASSPORT CHECK - READ THIS FIRST 🚨🚨🚨**

**STOP! DO NOT PROCEED WITH ANYTHING ELSE!**

**PASSPORT COUNT CHECK:**
- Booking is for: ${adultsCount} adult(s)
- Passports needed: ${adultsCount}
- Passports uploaded: ${passportCount}
- STILL MISSING: ${passportsNeeded} passport(s)

**YOUR ONLY RESPONSE MUST BE:**
"Thank you for uploading passport ${passportCount}${passportCount > 0 && context?.scannedPassports?.[passportCount-1] ? ` for ${context.scannedPassports[passportCount-1].firstName} ${context.scannedPassports[passportCount-1].lastName}` : ''}.

You are booking for ${adultsCount} adult(s), which means I need ${adultsCount} passport(s) total.
- Uploaded so far: ${passportCount} passport(s)
- Still needed: ${passportsNeeded} passport(s)

⚠️ Please click the 📎 button to upload passport ${passportCount + 1} of ${adultsCount}."

**ABSOLUTELY FORBIDDEN:**
❌ DO NOT ask for contact details
❌ DO NOT ask for email
❌ DO NOT ask for phone
❌ DO NOT thank them for "confirming"
❌ DO NOT say "Thank you for confirming"
❌ DO NOT proceed with booking
❌ DO NOT do anything except ask for the next passport

**IGNORE EVERYTHING ELSE IN THIS CONTEXT. ONLY ASK FOR THE NEXT PASSPORT.**
`;
        // Force AI to respond with ONLY the passport request
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: contextNote
            },
            {
              role: 'user',
              content: userMessage
            }
          ],
          temperature: 0.1,
          max_tokens: 500
        });

        return {
          aiResponse: completion.choices[0].message.content || "Please upload the next passport via the 📎 button."
        };
      }

      if (passportsNeeded > 0 && isFlightBooking) {
        contextNote += `\n\n**🚨🚨🚨 CRITICAL: PASSPORT UPLOAD MANDATORY - STOP EVERYTHING 🚨🚨🚨**

**BOOKING REQUIRES ${adultsCount} ADULT(S) = ${adultsCount} PASSPORT(S) NEEDED**
**CURRENT STATUS: ${passportCount} passport(s) uploaded, ${passportsNeeded} more needed**

**YOU ARE ABSOLUTELY FORBIDDEN FROM ASKING FOR PASSPORT DETAILS MANUALLY!**

**ONLY ACCEPTABLE ACTION:**
Tell the user EXACTLY this message:
"⚠️ For flight bookings, passport upload is MANDATORY. You are booking for ${adultsCount} adult(s), so I need ${adultsCount} passport(s). You have uploaded ${passportCount} so far. Please click the 📎 button to upload ${passportsNeeded === 1 ? 'the remaining passport' : `${passportsNeeded} more passports`}. I cannot proceed with the booking until all passports are uploaded and scanned."

**ABSOLUTELY FORBIDDEN ACTIONS:**
❌ DO NOT ask for passport number
❌ DO NOT ask for name from passport
❌ DO NOT ask for date of birth
❌ DO NOT ask for nationality
❌ DO NOT ask for expiry date
❌ DO NOT ask for ANY passport details manually
❌ DO NOT accept manual passport entry
❌ DO NOT proceed with ANY passenger information collection
❌ DO NOT proceed with booking if you don't have ${adultsCount} passports

**THE ONLY WAY TO GET PASSPORT DATA IS VIA THE 📎 UPLOAD BUTTON!**

**STOP THE BOOKING PROCESS NOW AND REQUEST PASSPORT UPLOAD!**
`;
      }

      // Add passport data to context if available
      if (context?.scannedPassports && context.scannedPassports.length > 0) {
        const passports = context.scannedPassports;
        const passportCount = passports.length;
        const adultsCount = context?.flightSearchParams?.adultsCount || context?.adultsCount || 1;
        const passportsNeeded = adultsCount - passportCount;

        // CRITICAL CHECK: If more passports needed, BLOCK everything and only ask for passports
        if (passportsNeeded > 0) {
          contextNote += `\n\n**🚨🚨🚨 CRITICAL ALERT - STOP EVERYTHING 🚨🚨🚨**

**INCOMPLETE PASSPORT UPLOAD - BLOCKING BOOKING**

**CURRENT STATUS:**
- Booking requires: ${adultsCount} adult(s) = ${adultsCount} passport(s) needed
- Uploaded so far: ${passportCount} passport(s)
- Still missing: ${passportsNeeded} passport(s)

**YOU MUST IMMEDIATELY STOP AND DO THIS:**

Respond with EXACTLY this message (adapt to language if needed):
"Thank you for uploading passport ${passportCount}. I have received the passport for ${passports[passportCount-1]?.firstName} ${passports[passportCount-1]?.lastName}.

However, you are booking for ${adultsCount} adult(s), so I need ${adultsCount} passport(s) in total. You have uploaded ${passportCount} so far.

⚠️ Please click the 📎 button to upload ${passportsNeeded} more passport${passportsNeeded > 1 ? 's' : ''} before we can proceed with the booking."

**ABSOLUTELY FORBIDDEN ACTIONS:**
❌ DO NOT ask for email
❌ DO NOT ask for phone number
❌ DO NOT ask for contact details
❌ DO NOT ask for passenger information
❌ DO NOT proceed with ANY part of the booking
❌ DO NOT call the bookFlight function
❌ DO NOT discuss anything else

**YOUR ONLY JOB RIGHT NOW:**
Tell the user you need ${passportsNeeded} more passport${passportsNeeded > 1 ? 's' : ''} via the 📎 button and WAIT.

**STOP. ASK FOR PASSPORTS. NOTHING ELSE.**
`;
          // Don't show any other passport-related instructions if more passports are needed
        } else {
          // All passports received - show full booking instructions
          contextNote += `\n\n**🔥 PASSPORT DATA AVAILABLE - USE THIS DATA 🔥**

**PASSPORT STATUS: ✅ ALL ${passportCount} PASSPORT(S) RECEIVED - YOU CAN PROCEED**

📄 **PASSENGERS WITH PASSPORT DATA:**
${passports.map((passport, index) => `
**Passenger ${index + 1}:**
- Name: ${passport.firstName} ${passport.lastName} (ENGLISH)
- Date of Birth: ${passport.dateOfBirth}
- Gender: ${passport.gender} (title: ${passport.gender === 'Male' ? 'Mr' : passport.gender === 'Female' ? 'Ms' : 'Mr'})
- Nationality: ${passport.nationality}
- Passport Number: ${passport.passportNumber}
- Passport Expiry: ${passport.passportExpiry}
- Issuing Country: ${passport.passportIssueCountry}
`).join('\n')}

⚠️ **DATA NOT ON PASSPORT - YOU MUST ASK USER FOR THESE:**
- Email Address (passports don't have email - ASK the user)
- Mobile Phone Number with country code (passports don't have phone - ASK the user)

**CRITICAL BOOKING INSTRUCTIONS:**

1. **For holderData (contact/billing info):**
   - email: ❌ NOT ON PASSPORT - MUST ASK USER
   - mobileNumber: ❌ NOT ON PASSPORT - MUST ASK USER
   - codePhoneId: ❌ NOT ON PASSPORT - MUST ASK USER (country code)
   - Can use first passenger's name for contact if user doesn't provide different name

2. **For paxes array - YOU MUST CREATE ${adultsCount} PASSENGER OBJECTS:**
${passports.map((passport, index) => `   Passenger ${index + 1}:
   - firstName: "${passport.firstName}" (ENGLISH from passport)
   - lastName: "${passport.lastName}" (ENGLISH from passport)
   - title: ${passport.gender === 'Male' ? 'Mr' : passport.gender === 'Female' ? 'Ms' : 'Mr'}
   - day/month/year: Split "${passport.dateOfBirth}"
   - nationality: "${passport.nationality}" (convert to code: CA, US, DZ, etc.)
   - passportNumber: "${passport.passportNumber}"
   - passportExpiry: "${passport.passportExpiry}"
   - issuingCountry: "${passport.passportIssueCountry}"
`).join('\n')}

3. **✅ ALL PASSPORTS RECEIVED - What to ask user:**
   - "I have all ${passportCount} passport(s). Now I need contact information:"
   - "1. Email address"
   - "2. Mobile phone number with country code"

4. **DO NOT:**
   - ❌ Ask for passenger names again (you have them from passports)
   - ❌ Construct email from passport names
   - ❌ Create fewer paxes than adultsCount

5. **ALL passenger data MUST be in ENGLISH and match passport exactly**
   جميع بيانات المسافر يجب أن تكون بالإنجليزية ومطابقة لجواز السفر تمامًا
`;
        }
      }

      // Add context awareness for basket selection
      if (context?.selectedBasketId || context?.selectedHotelBasketId) {
        const basketId = context.selectedBasketId || context.selectedHotelBasketId;
        const bookingType = context.bookingType || 'flight';
        const adultsCount = context?.flightSearchParams?.adultsCount || context?.adultsCount || 1;
        const passengersCount = adultsCount + (context.childrenCount || 0);

        contextNote += `\n\n**CRITICAL BOOKING CONTEXT - YOU MUST READ AND FOLLOW THIS:**
- User has selected ${bookingType} option with basket_id: ${basketId}

**MANDATORY INSTRUCTIONS FOR bookFlight/bookHotel FUNCTION:**
When calling the booking function, you MUST use this EXACT basketId value:
basketId: "${basketId}"

DO NOT USE: "selected_flight_basket_id" (this is a placeholder that will fail)
MUST USE: "${basketId}" (this is the actual basket ID from the selection)

- ${bookingType === 'flight' ? `**TOTAL PASSENGERS: ${passengersCount}** (${adultsCount} adults, ${context.childrenCount || 0} children)
  * YOU MUST collect data for EXACTLY ${passengersCount} passengers
  * Your paxes array MUST have ${passengersCount} passenger objects
  * DO NOT call bookFlight until you have ALL ${passengersCount} passengers' data
  * If you only have data for ${passengersCount - 1} passengers, ASK for the remaining passenger(s)` : ''}
- Collect ALL required information from user first
- Once you have ALL data (verified passenger count: ${bookingType === 'flight' ? passengersCount : 'N/A'}), call book${bookingType === 'flight' ? 'Flight' : 'Hotel'} with basketId: "${basketId}"
- Example: bookFlight({ basketId: "${basketId}", holderData: {...}, paxes: [passenger1, passenger2, ...] })`;
      }

      const systemMessage: ChatCompletionMessageParam = {
        role: 'system',
        content: SALES_AGENT_PROMPT + contextNote
      };

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [systemMessage, ...messages],
        tools: [searchFlightsFunction, searchHotelsFunction, bookHotelFunction, bookFlightFunction],
        tool_choice: 'auto',
        temperature: 0.7 // Higher temperature for more natural sales conversation
      });

      const message = response.choices[0].message;
      const result: SearchResult = {};

      // Check if the model wants to call functions
      if (message.tool_calls && message.tool_calls.length > 0) {
        for (const toolCall of message.tool_calls) {
          if (toolCall.function.name === 'searchFlights') {
            const params = JSON.parse(toolCall.function.arguments) as FlightSearchParams;
            if (!params.adultsCount) params.adultsCount = 1;
            if (!params.childrenCount) params.childrenCount = 0;
            result.flightSearch = params;
          } else if (toolCall.function.name === 'searchHotels') {
            const params = JSON.parse(toolCall.function.arguments) as HotelSearchParams;
            result.hotelSearch = params;
          } else if (toolCall.function.name === 'bookHotel') {
            const params = JSON.parse(toolCall.function.arguments) as HotelBookingParams;

            // Fix basketId if AI used placeholder
            if (params.basketId === 'selected_hotel_basket_id' && context?.selectedHotelBasketId) {
              console.log('🔧 Fixing hotel basketId in OpenAI service:', context.selectedHotelBasketId);
              params.basketId = context.selectedHotelBasketId;
            }

            result.hotelBooking = params;
          } else if (toolCall.function.name === 'bookFlight') {
            const params = JSON.parse(toolCall.function.arguments) as FlightBookingParams;

            // Fix basketId if AI used placeholder
            if (params.basketId === 'selected_flight_basket_id' && context?.selectedBasketId) {
              console.log('🔧 Fixing basketId in OpenAI service:', context.selectedBasketId);
              params.basketId = context.selectedBasketId;
            }

            result.flightBooking = params;
          }
        }
      }

      // Always include AI response for natural conversation
      if (message.content) {
        result.aiResponse = message.content;
      }

      return result;

    } catch (error: any) {
      console.error('OpenAI Sales Error:', error.message);
      return { aiResponse: 'I encountered an error. Please try again.' };
    }
  }
}

export default new OpenAISalesService();
