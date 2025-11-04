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
          description: 'Return date in YYYY-MM-DD format',
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
      required: ['departureCode', 'arrivalCode', 'outboundDate', 'returnDate']
    }
  }
};

// Define the booking data collection function schema
const collectBookingDataFunction: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'collectBookingData',
    description: 'Collect booking information from the user including holder data and passenger details',
    parameters: {
      type: 'object',
      properties: {
        holder_title: {
          type: 'string',
          description: 'Title of the booking holder',
          enum: ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr']
        },
        holder_first_name: {
          type: 'string',
          description: 'First name of the booking holder'
        },
        holder_last_name: {
          type: 'string',
          description: 'Last name of the booking holder'
        },
        holder_email: {
          type: 'string',
          description: 'Email address of the booking holder',
          format: 'email'
        },
        holder_mobile: {
          type: 'string',
          description: 'Mobile number of the booking holder (digits only)'
        },
        passengers: {
          type: 'array',
          description: 'List of passenger details',
          items: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                enum: ['Mr', 'Mrs', 'Ms', 'Miss', 'Mstr', 'Dr']
              },
              first_name: {
                type: 'string'
              },
              last_name: {
                type: 'string'
              },
              date_of_birth: {
                type: 'string',
                description: 'Date of birth in YYYY-MM-DD format',
                pattern: '^\\d{4}-\\d{2}-\\d{2}$'
              },
              nationality: {
                type: 'string',
                description: 'Nationality country code (e.g., KW, EG, US)'
              },
              passport_number: {
                type: 'string'
              },
              passport_expiry: {
                type: 'string',
                description: 'Passport expiry date in YYYY-MM-DD format',
                pattern: '^\\d{4}-\\d{2}-\\d{2}$'
              },
              issuing_country: {
                type: 'string',
                description: 'Passport issuing country code (e.g., KW, EG, US)'
              }
            },
            required: ['title', 'first_name', 'last_name', 'date_of_birth', 'nationality', 'passport_number', 'passport_expiry', 'issuing_country']
          }
        }
      },
      required: ['holder_title', 'holder_first_name', 'holder_last_name', 'holder_email', 'holder_mobile', 'passengers']
    }
  }
};

const SYSTEM_PROMPT = `You are a friendly travel assistant helping people find flights. Be conversational, warm, and helpful like a human travel agent would be.

**Your personality:**
- Friendly and enthusiastic about helping find great flights
- Use casual, natural language
- Show empathy and understanding
- Add personal touches like "I'll find you the best options!" or "Let me check what's available for you"
- Use emojis occasionally but not excessively (✈️ 🎯 😊)

**IMPORTANT AIRPORT CODES (memorize these):**
- Kuwait/Kuwait City = KWI
- Cairo = CAI
- Doha = DOH
- Dubai = DXB
- Riyadh = RUH
- Jeddah = JED
- Algiers/Algeria/Alger = ALG
- Alexandria = HBE
- Amman = AMM
- Baghdad = BGW
- Beirut = BEY
- Damascus = DAM
- Istanbul = IST
- Muscat = MCT
- Bahrain = BAH
- Abu Dhabi = AUH

**Conversation guidelines:**
- When greeting, be warm: "Hey there! Ready to find your perfect flight? 😊"
- When asking for info, be natural: "Where would you like to go? And when are you thinking of traveling?"
- If missing info, ask conversationally: "Sounds great! Just need to know your travel dates to find the best flights for you."
- When searching: "Perfect! Let me search for the best flights from [city] to [city] for those dates..."
- Be helpful: "I found some great options for you!" or "Let me find you something else..."

**Date handling:**
- Convert any date format to YYYY-MM-DD
- Today's date: ${new Date().toISOString().split('T')[0]}
- If user says "next week" or "in a few days", ask for specific dates naturally

**Defaults:**
- If not specified, assume 1 adult, 0 children
- But you can ask: "Just yourself traveling, or will there be others?"

Remember: You're having a natural conversation, not filling out a form!`;

interface FlightSearchParams {
  departureCode: string;
  arrivalCode: string;
  outboundDate: string;
  returnDate: string;
  adultsCount?: number;
  childrenCount?: number;
}

interface PassengerData {
  title: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  passport_number: string;
  passport_expiry: string;
  issuing_country: string;
}

interface BookingData {
  holder_title: string;
  holder_first_name: string;
  holder_last_name: string;
  holder_email: string;
  holder_mobile: string;
  passengers: PassengerData[];
}

class OpenAIFunctionsService {
  /**
   * Process user message and extract flight search parameters using function calling
   */
  async processMessage(
    messages: ChatCompletionMessageParam[]
  ): Promise<{
    functionCall?: FlightSearchParams;
    aiResponse?: string;
  }> {
    try {
      const systemMessage: ChatCompletionMessageParam = {
        role: 'system',
        content: SYSTEM_PROMPT
      };

      const response = await openai.chat.completions.create({
        model: 'gpt-4o', // Using gpt-4o for function calling
        messages: [systemMessage, ...messages],
        tools: [searchFlightsFunction],
        tool_choice: 'auto', // Let the model decide when to call the function
        temperature: 0.3
      });

      const message = response.choices[0].message;

      // Check if the model wants to call a function
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];

        if (toolCall.function.name === 'searchFlights') {
          const params = JSON.parse(toolCall.function.arguments) as FlightSearchParams;

          // Set defaults if not provided
          if (!params.adultsCount) params.adultsCount = 1;
          if (!params.childrenCount) params.childrenCount = 0;

          return { functionCall: params };
        }
      }

      // If no function call, return the AI response
      return { aiResponse: message.content || 'How can I help you with your flight search?' };

    } catch (error: any) {
      console.error('OpenAI Functions Error:', error.message);
      return { aiResponse: 'I encountered an error. Please try again.' };
    }
  }

  /**
   * Process user message to collect booking data using function calling
   */
  async processBookingData(
    messages: ChatCompletionMessageParam[]
  ): Promise<{
    bookingData?: BookingData;
    aiResponse?: string;
  }> {
    try {
      const systemMessage: ChatCompletionMessageParam = {
        role: 'system',
        content: `You are a friendly travel assistant collecting booking information. Be conversational and natural.

**Your task:**
- Collect holder information (title, first name, last name, email, mobile)
- Collect passenger details (title, first/last name, DOB, nationality, passport number, passport expiry, issuing country)
- Use conversational language: "Great! Now I need some details to complete your booking..."
- If information is incomplete, ask naturally: "I still need your passport number and expiry date to proceed."

**Important:**
- Convert dates to YYYY-MM-DD format (DOB and passport expiry)
- Country codes should be 2 letters (KW, EG, DZ for Algeria, etc.)
- Algerian = DZ, Kuwaiti = KW, Egyptian = EG, etc.
- Mobile numbers should be digits only (no +, no spaces)
- Be patient and helpful if user provides info in chunks

**CRITICAL: When to call collectBookingData function:**
- Call the function ONLY when you have ALL required information:
  * Holder: title, first_name, last_name, email, mobile (digits only)
  * Passenger(s): title, first_name, last_name, date_of_birth (YYYY-MM-DD), nationality (2-letter), passport_number, passport_expiry (YYYY-MM-DD), issuing_country (2-letter)
- If user confirms "looks good" or "yes" or "correct" after you verify the info, IMMEDIATELY call the function
- Don't keep asking for confirmation - once user confirms, call the function!`
      };

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [systemMessage, ...messages],
        tools: [collectBookingDataFunction],
        tool_choice: 'auto',
        temperature: 0.3
      });

      const message = response.choices[0].message;

      // Check if the model extracted booking data
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];

        if (toolCall.function.name === 'collectBookingData') {
          const bookingData = JSON.parse(toolCall.function.arguments) as BookingData;
          return { bookingData };
        }
      }

      // If no function call, return the AI response
      return { aiResponse: message.content || 'Please provide your booking information.' };

    } catch (error: any) {
      console.error('Booking data collection error:', error.message);
      return { aiResponse: 'I encountered an error. Please try again.' };
    }
  }

  /**
   * Generate a response after function execution
   */
  async generateFollowUpResponse(
    messages: ChatCompletionMessageParam[],
    functionResult: any
  ): Promise<string> {
    try {
      // Add the function result to the conversation
      const updatedMessages: ChatCompletionMessageParam[] = [
        ...messages,
        {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: {
              name: 'searchFlights',
              arguments: JSON.stringify(functionResult.params)
            }
          }]
        },
        {
          role: 'tool',
          content: JSON.stringify(functionResult.result),
          tool_call_id: 'call_1'
        }
      ];

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: updatedMessages,
        temperature: 0.3
      });

      return response.choices[0].message.content || 'Flight search completed.';
    } catch (error: any) {
      console.error('Follow-up response error:', error.message);
      return 'I found the flights but encountered an error formatting the response.';
    }
  }
}

export default new OpenAIFunctionsService();