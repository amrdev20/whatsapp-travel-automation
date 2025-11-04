import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const OFFTO_BASE_URL = process.env.OFFTO_API_BASE_URL || 'https://front.test.offto.com.kw/api/v1';

export interface OCRResult {
  success: boolean;
  data?: {
    documentType: string;
    documentNumber: string;
    names: {
      firstName: string;
      lastName: string;
    };
    nationality: {
      abbr: string;
      full: string;
    };
    nationalityID: number;
    dob: string;
    sex: {
      abbr: string;
      full: string;
    };
    expiry: string;
    issuerOrg: {
      abbr: string;
      full: string;
    };
  };
  message: string;
}

export interface CitySearchResult {
  success: boolean;
  data?: {
    items: Array<{
      country: {
        id: number;
        name: string;
        code: string;
      };
      items: Array<{
        city: {
          id: number;
          name: string;
          code: string;
        };
        items?: Array<{
          HotelCode: number;
          city_id: number;
          HotelName: string;
        }>;
      }>;
    }>;
  };
  message: string;
}

export interface PackageSearchParams {
  CheckInDate: string; // YYYY-MM-DD
  CheckOutDate: string; // YYYY-MM-DD
  CountryofResidence: string;
  CountryOfNationality: string;
  Room: Array<{
    NumberOfAdult: number;
    NumberOfChild: number;
    AgeOfChild: number[];
  }>;
  From: string; // Airport code
  To: string; // City code
}

export interface PackageSearchResult {
  success: boolean;
  data?: Array<{
    template: string;
    basket_id: number;
  }>;
  message: string;
}

class OfftoService {
  /**
   * OCR Passport - Extract passport information from image
   */
  async ocrPassport(filePath: string, language: string = 'ar'): Promise<OCRResult> {
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));

      const response = await axios.post(`${OFFTO_BASE_URL}/ocr`, formData, {
        headers: {
          ...formData.getHeaders(),
          'Accept-Language': language,
          'time-zone': 'Asia/Kuwait'
        }
      });

      return response.data;
    } catch (error: any) {
      console.error('OCR Error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'OCR processing failed'
      };
    }
  }

  /**
   * Search Cities - Get cities and hotels
   */
  async searchCities(search?: string, city?: string, language: string = 'ar'): Promise<CitySearchResult> {
    try {
      const formData = new FormData();
      if (search) formData.append('search', search);
      if (city) formData.append('city', city);

      const response = await axios.post(`${OFFTO_BASE_URL}/get_all_cities_elastic`, formData, {
        headers: {
          ...formData.getHeaders(),
          'Accept-Language': language,
          'Accept-PageSize': '10'
        }
      });

      return response.data;
    } catch (error: any) {
      console.error('City Search Error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'City search failed'
      };
    }
  }

  /**
   * Search Packages - Get flight + hotel packages
   */
  async searchPackages(params: PackageSearchParams, language: string = 'ar'): Promise<PackageSearchResult> {
    try {
      const response = await axios.post(`${OFFTO_BASE_URL}/get_basket_package_html`, params, {
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': language,
          'Accept-PageSize': '10'
        }
      });

      return response.data;
    } catch (error: any) {
      console.error('Package Search Error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Package search failed'
      };
    }
  }

  /**
   * Book Flight Package - Complete booking and get payment link
   */
  async bookFlightPackage(
    basketId: string | number,
    holderData: {
      title: string;
      first_name: string;
      last_name: string;
      email: string;
      mobile_number: string;
      code_phone_id: string;
    },
    paxes: Array<{
      day: string;
      month: string;
      year: string;
      first_name: string;
      last_name: string;
      title: string;
      nationality: string;
      passport_number: string;
      passport_expiry: string;
      issuing_country: string;
    }>,
    language: string = 'ar',
    currencyId: string = '1', // 1 = KWD (Kuwaiti Dinar)
    locationId: string = '85' // Kuwait location
  ): Promise<any> {
    try {
      // Add currency to holder_data and paxes as required by API
      const requestBody = {
        basket_id: Number(basketId), // Convert to number as API requires
        holder_data: {
          ...holderData,
          currency: 'USD'
        },
        paxes: paxes.map(pax => ({
          ...pax,
          currency: 'USD'
        }))
      };

      const headers = {
        'Content-Type': 'application/json',
        'Accept-Language': language,
        'Accept-Location': locationId,
        'Accept-Currency': currencyId,
        'Accept-TimeZone': 'Asia/Kuwait',
        'Accept-NotificationEnabled': 'no',
        'Accept-PageSize': '10'
      };

      console.log('📤 Booking request:', JSON.stringify(requestBody, null, 2));
      console.log('📋 Request headers:', JSON.stringify(headers, null, 2));
      console.log('🔗 Request URL:', `${OFFTO_BASE_URL}/booking_basket_flight`);

      const response = await axios.post(`${OFFTO_BASE_URL}/booking_basket_flight`, requestBody, {
        headers
      });

      console.log('✅ Booking Response:', JSON.stringify(response.data, null, 2));

      return response.data;
    } catch (error: any) {
      console.error('❌ Booking Error - Full Details:',  JSON.stringify({
        message: error.message,
        responseData: error.response?.data,
        responseStatus: error.response?.status,
        responseHeaders: error.response?.headers
      }, null, 2));
      return {
        success: false,
        message: error.response?.data?.message || 'Booking failed',
        error: error.response?.data
      };
    }
  }

  /**
   * Get fresh basket flights with search criteria
   */
  async getBasketFlights(
    destination: string,
    checkInDate: string,
    checkOutDate: string | null,  // Make return date optional
    departureCity: string,
    adults: number = 1,
    children: number = 0,
    page: number = 1,
    language: string = 'ar',
    currencyId: string = '1',
    locationId: string = '85'
  ): Promise<any> {
    try {
      // Validate airport codes (must be 3 letters)
      if (destination.length !== 3 || departureCity.length !== 3) {
        console.error('❌ Invalid airport codes:', { destination, departureCity });
        throw new Error('Airport codes must be 3 letters (e.g., KWI, ALG, DOH)');
      }

      // Ensure codes are uppercase
      const arrivalCode = destination.toUpperCase();
      const departureCode = departureCity.toUpperCase();

      // Build legs array - add return leg only if checkOutDate is provided
      const legs = [
        {
          departureCode: departureCode,
          arrivalCode: arrivalCode,
          outboundDate: checkInDate
        }
      ];

      // Add return leg only if return date is provided
      if (checkOutDate) {
        legs.push({
          departureCode: arrivalCode,
          arrivalCode: departureCode,
          outboundDate: checkOutDate
        });
      }

      // Build the search request body matching Postman format
      const searchData = {
        legs: legs,
        adultsCount: adults,
        childrenCount: children,
        infantsCount: 0,
        cabin: "Economy",
        currencyCode: "KWD",
        isDirect: true,
        locale: language === 'ar' ? 'AR' : 'EN'
      };

      const headers = {
        'Content-Type': 'application/json',
        'Accept-Language': language,
        'Accept-Location': locationId,
        'Accept-Currency': currencyId,
        'Accept-TimeZone': 'Asia/Kuwait',
        'Accept-NotificationEnabled': 'no',
        'Accept-PageSize': '10'
      };

      console.log('🔍 Fetching fresh basket flights with search data:');
      if (checkOutDate) {
        console.log('  Type: Round-trip');
        console.log('  Route:', departureCode, '→', arrivalCode, '→', departureCode);
        console.log('  Dates:', checkInDate, 'to', checkOutDate);
      } else {
        console.log('  Type: One-way');
        console.log('  Route:', departureCode, '→', arrivalCode);
        console.log('  Date:', checkInDate);
      }
      console.log('  Travelers:', adults, 'adults,', children, 'children');
      console.log('  Full request:', JSON.stringify(searchData, null, 2));

      // POST request with search data
      const response = await axios.post(`${OFFTO_BASE_URL}/get_basket_flights_html?page=${page}`, searchData, {
        headers
      });

      console.log('✅ Fresh baskets response:', {
        status: response.data.status,
        message: response.data.message,
        dataLength: response.data.data?.length || 0
      });

      // Log first basket to see structure
      if (response.data.data && response.data.data.length > 0) {
        console.log('📦 First basket structure:', {
          basket_id: response.data.data[0].basket_id,
          hotel_name: response.data.data[0].hotel_name,
          price: response.data.data[0].grand_total || response.data.data[0].price,
          currency: response.data.data[0].currency
        });
      }

      // Extract baskets from response
      if (response.data.data && Array.isArray(response.data.data)) {
        return {
          success: true,
          baskets: response.data.data,
          message: 'Baskets fetched successfully'
        };
      }

      return {
        success: true,
        baskets: [],
        message: 'No baskets found'
      };
    } catch (error: any) {
      console.error('❌ Get Baskets Error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to fetch baskets'
      };
    }
  }

  /**
   * Search for hotels using HTML template endpoint
   */
  async searchHotels(
    destinationCity: string,
    checkInDate: string,
    checkOutDate: string,
    countryOfResidence: string = 'KW',
    countryOfNationality: string = 'KW',
    rooms: Array<{
      NumberOfAdult: number;
      NumberOfChild: number;
      AgeOfChild: number[];
    }>,
    tag: string = '7',
    currencyCode: string = 'KWD',
    locale: string = 'en'
  ): Promise<any> {
    try {
      const searchData = {
        DestinationCity: destinationCity,
        CheckInDate: checkInDate,
        CheckOutDate: checkOutDate,
        CountryofResidence: countryOfResidence,
        CountryOfNationality: countryOfNationality,
        Room: rooms,
        Tag: tag,
        currencyCode: currencyCode,
        locale: locale
      };

      console.log('🏨 Searching hotels with data:');
      console.log('  Destination:', destinationCity);
      console.log('  Dates:', checkInDate, 'to', checkOutDate);
      console.log('  Rooms:', rooms.length);
      console.log('  Full request:', JSON.stringify(searchData, null, 2));

      const response = await axios.post(`${OFFTO_BASE_URL}/get_basket_hotel_html`, searchData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': locale,
          'Accept-Location': '85', // Kuwait
          'Accept-Currency': currencyCode === 'KWD' ? '1' : '2',
          'Accept-TimeZone': 'Asia/Kuwait'
        }
      });

      console.log('✅ Hotels response:', { status: response.data.status, message: response.data.message, hotelsCount: response.data.data?.length || 0 });

      if (response.data.success && response.data.data) {
        return {
          success: true,
          hotels: Array.isArray(response.data.data) ? response.data.data : [response.data.data],
          message: 'Hotels fetched successfully'
        };
      }

      return {
        success: true,
        hotels: [],
        message: 'No hotels found'
      };
    } catch (error: any) {
      console.error('❌ Hotel Search Error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to search hotels'
      };
    }
  }

  /**
   * Book Hotel - Complete booking and get payment link
   */
  async bookHotel(
    basketId: string | number,
    holderData: {
      title: string;
      first_name: string;
      last_name: string;
      email: string;
      mobile_number: string;
      code_phone_id: string;
    }
  ): Promise<any> {
    try {
      const requestBody = {
        basket_id: Number(basketId), // Convert to number as API requires
        holder_data: holderData
      };

      console.log('📤 Hotel booking request:', JSON.stringify(requestBody, null, 2));

      const response = await axios.post(`${OFFTO_BASE_URL}/booking_basket_hotels`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': 'en',
          'Accept-Location': '85',
          'Accept-Currency': '1',
          'Accept-TimeZone': 'Asia/Kuwait'
        }
      });

      console.log('✅ Hotel Booking Response:', JSON.stringify(response.data, null, 2));

      return response.data;
    } catch (error: any) {
      console.error('❌ Hotel Booking Error:', JSON.stringify({
        message: error.message,
        responseData: error.response?.data,
        responseStatus: error.response?.status
      }, null, 2));
      return {
        success: false,
        message: error.response?.data?.message || 'Hotel booking failed',
        error: error.response?.data
      };
    }
  }

  /**
   * Book Flight - Complete flight booking with passenger details and get payment link
   */
  async bookFlight(
    basketId: string | number,
    holderData: {
      title: string;
      first_name: string;
      last_name: string;
      email: string;
      mobile_number: string;
      code_phone_id: string;
    },
    paxes: Array<{
      day: string;
      month: string;
      year: string;
      first_name: string;
      last_name: string;
      title: string;
      nationality: string;
      passport_number: string;
      passport_expiry: string;
      issuing_country: string;
    }>
  ): Promise<any> {
    try {
      // Add currency to holder_data and paxes as required by API
      const requestBody = {
        basket_id: Number(basketId), // Convert to number as API requires
        holder_data: {
          ...holderData,
          currency: 'USD'
        },
        paxes: paxes.map(pax => ({
          ...pax,
          currency: 'USD'
        }))
      };

      console.log('📤 Flight booking request:', JSON.stringify(requestBody, null, 2));

      const response = await axios.post(`${OFFTO_BASE_URL}/booking_basket_flight`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': 'en',
          'Accept-Location': '85',
          'Accept-Currency': '1',
          'Accept-TimeZone': 'Asia/Kuwait',
          'Accept-NotificationEnabled': 'no',
          'Accept-PageSize': '10'
        }
      });

      console.log('✅ Flight Booking Response:', JSON.stringify(response.data, null, 2));

      return response.data;
    } catch (error: any) {
      console.error('❌ Flight Booking Error:', JSON.stringify({
        message: error.message,
        responseData: error.response?.data,
        responseStatus: error.response?.status
      }, null, 2));
      return {
        success: false,
        message: error.response?.data?.message || 'Flight booking failed',
        error: error.response?.data
      };
    }
  }
}

export default new OfftoService();


