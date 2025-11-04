"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const fs_1 = __importDefault(require("fs"));
const OFFTO_BASE_URL = process.env.OFFTO_API_BASE_URL || 'https://front.test.offto.com.kw/api/v1';
class OfftoService {
    /**
     * OCR Passport - Extract passport information from image
     */
    async ocrPassport(filePath, language = 'ar') {
        try {
            const formData = new form_data_1.default();
            formData.append('file', fs_1.default.createReadStream(filePath));
            const response = await axios_1.default.post(`${OFFTO_BASE_URL}/ocr`, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'Accept-Language': language,
                    'time-zone': 'Asia/Kuwait'
                }
            });
            return response.data;
        }
        catch (error) {
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
    async searchCities(search, city, language = 'ar') {
        try {
            const formData = new form_data_1.default();
            if (search)
                formData.append('search', search);
            if (city)
                formData.append('city', city);
            const response = await axios_1.default.post(`${OFFTO_BASE_URL}/get_all_cities_elastic`, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'Accept-Language': language,
                    'Accept-PageSize': '10'
                }
            });
            return response.data;
        }
        catch (error) {
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
    async searchPackages(params, language = 'ar') {
        try {
            const response = await axios_1.default.post(`${OFFTO_BASE_URL}/get_basket_package_html`, params, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept-Language': language,
                    'Accept-PageSize': '10'
                }
            });
            return response.data;
        }
        catch (error) {
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
    async bookFlightPackage(basketId, holderData, paxes, language = 'ar', currencyId = '1', // 1 = KWD (Kuwaiti Dinar)
    locationId = '85' // Kuwait location
    ) {
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
            const response = await axios_1.default.post(`${OFFTO_BASE_URL}/booking_basket_flight`, requestBody, {
                headers
            });
            console.log('✅ Booking Response:', JSON.stringify(response.data, null, 2));
            return response.data;
        }
        catch (error) {
            console.error('❌ Booking Error - Full Details:', JSON.stringify({
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
    async getBasketFlights(destination, checkInDate, checkOutDate, // Make return date optional
    departureCity, adults = 1, children = 0, page = 1, language = 'ar', currencyId = '1', locationId = '85') {
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
            }
            else {
                console.log('  Type: One-way');
                console.log('  Route:', departureCode, '→', arrivalCode);
                console.log('  Date:', checkInDate);
            }
            console.log('  Travelers:', adults, 'adults,', children, 'children');
            console.log('  Full request:', JSON.stringify(searchData, null, 2));
            // POST request with search data
            const response = await axios_1.default.post(`${OFFTO_BASE_URL}/get_basket_flights_html?page=${page}`, searchData, {
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
        }
        catch (error) {
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
    async searchHotels(destinationCity, checkInDate, checkOutDate, countryOfResidence = 'KW', countryOfNationality = 'KW', rooms, tag = '7', currencyCode = 'KWD', locale = 'en') {
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
            const response = await axios_1.default.post(`${OFFTO_BASE_URL}/get_basket_hotel_html`, searchData, {
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
        }
        catch (error) {
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
    async bookHotel(basketId, holderData) {
        try {
            const requestBody = {
                basket_id: Number(basketId), // Convert to number as API requires
                holder_data: holderData
            };
            console.log('📤 Hotel booking request:', JSON.stringify(requestBody, null, 2));
            const response = await axios_1.default.post(`${OFFTO_BASE_URL}/booking_basket_hotels`, requestBody, {
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
        }
        catch (error) {
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
    async bookFlight(basketId, holderData, paxes) {
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
            const response = await axios_1.default.post(`${OFFTO_BASE_URL}/booking_basket_flight`, requestBody, {
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
        }
        catch (error) {
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
exports.default = new OfftoService();
