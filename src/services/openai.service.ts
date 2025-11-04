import dotenv from 'dotenv';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// Load environment variables
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_PROMPT = `You are a flight search assistant. Your ONLY job is to collect flight search information from users.

You need to collect these details to search for flights:

1. **Departure City/Airport** (e.g., Kuwait, KWI, Algiers, ALG)
2. **Destination City/Airport** (e.g., Cairo, CAI, Doha, DOH)
3. **Departure Date** (outbound flight date)
4. **Return Date** (return flight date)
5. **Number of Adults** (default 1 if not specified)
6. **Number of Children** (default 0)

**IMPORTANT RULES:**
- If user doesn't provide all information, ask for ALL missing information in ONE message
- Be concise and direct
- Extract all information user provides
- Example: "Please provide: departure city, destination, departure date, return date, and number of travelers"
- When you have ALL required information, say "Searching for flights..."

**Current date:** ${new Date().toISOString().split('T')[0]}

**Airport Code Mapping:**
- Kuwait/Kuwait City = KWI
- Cairo = CAI
- Doha = DOH
- Dubai = DXB
- Riyadh = RUH
- Jeddah = JED
- Algiers/Algeria = ALG
- Alexandria = HBE
- Amman = AMM
- Baghdad = BGW
- Beirut = BEY
- Damascus = DAM
- Istanbul = IST
- Muscat = MCT
- Bahrain = BAH
- Abu Dhabi = AUH`;

interface FlightSearchContext {
  departureCode?: string;
  arrivalCode?: string;
  outboundDate?: string;
  returnDate?: string;
  adultsCount?: number;
  childrenCount?: number;
}

class OpenAIService {
  /**
   * Generate AI response for flight search conversation
   */
  async generateResponse(
    messages: ChatCompletionMessageParam[],
    context?: FlightSearchContext
  ): Promise<string> {
    try {
      const missing = this.getMissingInfo(context || {});
      const contextInfo = context ? `\n\nCurrent collected data: ${JSON.stringify(context, null, 2)}` : '';
      const missingInfo = missing.length > 0 ? `\n\nMissing information: ${missing.join(', ')}` : '';

      const systemMessage: ChatCompletionMessageParam = {
        role: 'system',
        content: SYSTEM_PROMPT + contextInfo + missingInfo + '\n\nAsk for ALL missing information in ONE message!'
      };

      const response = await openai.chat.completions.create({
        model: 'gpt-5',
        messages: [systemMessage, ...messages],
        max_completion_tokens: 16000
      });

      return response.choices[0]?.message?.content || 'I apologize, I could not generate a response.';
    } catch (error: any) {
      console.error('OpenAI Error:', error.message);

      // Fallback to gpt-4o if gpt-5 is not available
      if (error.message.includes('model') || error.message.includes('gpt-5')) {
        console.log('Falling back to gpt-4o...');
        try {
          const systemMessage: ChatCompletionMessageParam = {
            role: 'system',
            content: SYSTEM_PROMPT + (context ? `\n\nCurrent collected data: ${JSON.stringify(context, null, 2)}` : '')
          };

          const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [systemMessage, ...messages],
            temperature: 0.7,
            max_tokens: 16000
          });

          return response.choices[0]?.message?.content || 'I apologize, I could not generate a response.';
        } catch (fallbackError: any) {
          console.error('Fallback Error:', fallbackError.message);
          return 'I apologize, I encountered an error. Please try again.';
        }
      }

      return 'I apologize, I encountered an error. Please try again.';
    }
  }

  /**
   * Extract flight search information from user message
   */
  async extractFlightInfo(userMessage: string, currentContext: FlightSearchContext = {}): Promise<Partial<FlightSearchContext>> {
    try {
      const extractionPrompt = `Extract ALL flight search information from: "${userMessage}"

Current context: ${JSON.stringify(currentContext)}

Extract and return JSON with any of these fields:
- departureCode: 3-letter airport code (KWI, ALG, CAI, DOH, etc.)
- arrivalCode: 3-letter airport code
- outboundDate: departure date in YYYY-MM-DD format (must be in future, use 2025 or later)
- returnDate: return date in YYYY-MM-DD format (must be after outbound date)
- adultsCount: number (default 1 if not mentioned, if user says "me", "alone", "just me" = 1)
- childrenCount: number (default 0 if not mentioned)

**CRITICAL AIRPORT CODE MAPPING (use exact codes):**
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

ALWAYS convert city names to 3-letter airport codes!

Examples:
- "from alger to dubai from 25/10 until 30/10" → Extract ALL: departureCode=ALG, arrivalCode=DXB, dates
- "kuwait to cairo 15 march returning 20 march 2 adults 1 child" → Extract ALL data

Extract as much as possible. Return empty JSON {} only if nothing found.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-5',
        messages: [
          { role: 'system', content: 'You are a flight information extraction assistant. Return only valid JSON with airport codes.' },
          { role: 'user', content: extractionPrompt }
        ],
        max_completion_tokens: 16000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content);
    } catch (error: any) {
      console.error('Extraction Error:', error.message);

      // Fallback to gpt-4o
      if (error.message.includes('model') || error.message.includes('gpt-5')) {
        console.log('Falling back to gpt-4o for extraction...');
        try {
          const extractionPrompt = `Extract flight search information from: "${userMessage}"

Current context: ${JSON.stringify(currentContext)}

Extract and return JSON with any of these fields:
- departureCode: 3-letter airport code (KWI, ALG, CAI, DOH, etc.)
- arrivalCode: 3-letter airport code
- outboundDate: departure date in YYYY-MM-DD format (must be in future, use 2025 or later)
- returnDate: return date in YYYY-MM-DD format (must be after outbound date)
- adultsCount: number (if user says "me", "alone", "just me" = 1)
- childrenCount: number (default 0)

**CRITICAL AIRPORT CODE MAPPING:**
Kuwait=KWI, Cairo=CAI, Doha=DOH, Dubai=DXB, Riyadh=RUH, Jeddah=JED, Algiers=ALG

Only include fields clearly mentioned. Return empty JSON {} if nothing found.`;

          const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: 'You are a flight information extraction assistant. Return only valid JSON.' },
              { role: 'user', content: extractionPrompt }
            ],
            temperature: 0,
            max_tokens: 16000,
            response_format: { type: 'json_object' }
          });

          const content = response.choices[0]?.message?.content || '{}';
          return JSON.parse(content);
        } catch (fallbackError) {
          return {};
        }
      }

      return {};
    }
  }

  /**
   * Check if we have all required information to search flights
   */
  isReadyToSearch(context: FlightSearchContext): boolean {
    return !!(
      context.departureCode &&
      context.arrivalCode &&
      context.outboundDate &&
      context.returnDate &&
      context.adultsCount !== undefined
    );
  }

  /**
   * Get what information is still missing
   */
  getMissingInfo(context: FlightSearchContext): string[] {
    const missing: string[] = [];

    if (!context.departureCode) missing.push('departure city');
    if (!context.arrivalCode) missing.push('destination city');
    if (!context.outboundDate) missing.push('departure date');
    if (!context.returnDate) missing.push('return date');
    if (context.adultsCount === undefined) missing.push('number of travelers');

    return missing;
  }

  /**
   * Extract country code from country name
   */
  async extractCountryCode(countryName: string): Promise<{ code: string | null }> {
    try {
      const prompt = `Convert this country name to 2-letter ISO code: "${countryName}"

Common examples:
- Kuwait = KW
- Egypt = EG
- United Arab Emirates/UAE/Dubai = AE
- Saudi Arabia = SA
- Algeria = DZ
- Qatar = QA
- Bahrain = BH
- Jordan = JO
- Lebanon = LB
- United States/USA = US
- United Kingdom/UK = GB

Return ONLY the 2-letter code or 'UNKNOWN' if not found.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a country code converter. Return only 2-letter ISO codes.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0,
        max_tokens: 10
      });

      const code = response.choices[0]?.message?.content?.trim().toUpperCase();
      return { code: code === 'UNKNOWN' ? null : code };
    } catch (error) {
      console.error('Country code extraction error:', error);
      return { code: null };
    }
  }
}

export default new OpenAIService();
