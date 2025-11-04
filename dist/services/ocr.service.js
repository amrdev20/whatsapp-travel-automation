"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ocrService = exports.OCRService = void 0;
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const fs = __importStar(require("fs"));
class OCRService {
    constructor() {
        this.apiBaseUrl = process.env.OFFTO_API_BASE_URL || 'https://front.test.offto.com.kw/api/v1';
    }
    /**
     * Scan passport image using OCR API
     * @param filePath - Path to the passport image file
     * @param language - Language for the response (default: 'en')
     * @param timezone - Timezone (default: 'Asia/Hebron')
     * @returns OCR response data
     */
    async scanPassport(filePath, language = 'en', timezone = 'Asia/Hebron') {
        try {
            const formData = new form_data_1.default();
            formData.append('file', fs.createReadStream(filePath));
            const response = await axios_1.default.post(`${this.apiBaseUrl}/ocr`, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'Accept-Language': language,
                    'time-zone': timezone,
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
            });
            if (!response.data.success) {
                throw new Error('OCR scanning failed');
            }
            return response.data;
        }
        catch (error) {
            console.error('OCR scanning error:', error.message);
            throw new Error(`Failed to scan passport: ${error.message}`);
        }
    }
    /**
     * Scan passport from buffer (for uploaded files)
     * @param fileBuffer - File buffer
     * @param fileName - Original file name
     * @param language - Language for the response (default: 'en')
     * @param timezone - Timezone (default: 'Asia/Hebron')
     * @returns OCR response data
     */
    async scanPassportFromBuffer(fileBuffer, fileName, language = 'en', timezone = 'Asia/Hebron') {
        try {
            const formData = new form_data_1.default();
            formData.append('file', fileBuffer, fileName);
            const response = await axios_1.default.post(`${this.apiBaseUrl}/ocr`, formData, {
                headers: {
                    ...formData.getHeaders(),
                    'Accept-Language': language,
                    'time-zone': timezone,
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
            });
            if (!response.data.success) {
                throw new Error('OCR scanning failed');
            }
            return response.data;
        }
        catch (error) {
            console.error('OCR scanning error:', error.message);
            throw new Error(`Failed to scan passport: ${error.message}`);
        }
    }
    /**
     * Convert OCR response to passenger data format
     * @param ocrData - OCR API response data
     * @returns Formatted passenger data
     */
    mapToPassengerData(ocrData) {
        return {
            firstName: ocrData.names.firstName,
            lastName: ocrData.names.lastName,
            passportNumber: ocrData.documentNumber,
            nationality: ocrData.nationality.full,
            dateOfBirth: this.formatDate(ocrData.dob),
            gender: this.mapGender(ocrData.sex.abbr),
            passportExpiry: this.formatDate(ocrData.expiry),
            passportIssueCountry: ocrData.issuerOrg.full,
        };
    }
    /**
     * Format date from DD/MM/YYYY to YYYY-MM-DD
     * @param date - Date in DD/MM/YYYY format
     * @returns Date in YYYY-MM-DD format
     */
    formatDate(date) {
        const parts = date.split('/');
        if (parts.length === 3) {
            const [day, month, year] = parts;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return date;
    }
    /**
     * Map gender abbreviation to full form
     * @param genderAbbr - Gender abbreviation (M/F)
     * @returns Full gender string (Male/Female)
     */
    mapGender(genderAbbr) {
        return genderAbbr.toUpperCase() === 'M' ? 'Male' : 'Female';
    }
    /**
     * Validate passport expiry date
     * @param expiryDate - Expiry date in YYYY-MM-DD format
     * @returns true if passport is valid (not expired)
     */
    isPassportValid(expiryDate) {
        const expiry = new Date(expiryDate);
        const today = new Date();
        return expiry > today;
    }
    /**
     * Get formatted passenger info for confirmation
     * @param passengerData - Passenger data
     * @returns Formatted string for display
     */
    formatPassengerInfo(passengerData) {
        return `
📄 Passport Information:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 Name: ${passengerData.firstName} ${passengerData.lastName}
📋 Passport: ${passengerData.passportNumber}
🌍 Nationality: ${passengerData.nationality}
📅 Date of Birth: ${passengerData.dateOfBirth}
⚧ Gender: ${passengerData.gender}
📆 Passport Expiry: ${passengerData.passportExpiry}
🏛 Issued by: ${passengerData.passportIssueCountry}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${this.isPassportValid(passengerData.passportExpiry) ? '✅ Passport is valid' : '⚠️ Passport is expired!'}
    `.trim();
    }
}
exports.OCRService = OCRService;
exports.ocrService = new OCRService();
