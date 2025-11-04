import axios from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';

interface OCRResponse {
  success: boolean;
  data: {
    documentCode: string;
    documentType: string;
    issuerOrg: {
      abbr: string;
      full: string;
    };
    issuerOrgID: number;
    names: {
      firstName: string;
      lastName: string;
    };
    documentNumber: string;
    nationality: {
      abbr: string;
      full: string;
    };
    nationalityID: number;
    dob: string; // format: DD/MM/YYYY
    sex: {
      abbr: string;
      full: string;
    };
    expiry: string; // format: DD/MM/YYYY
    personalNumber: string;
    checkDigit?: any;
  };
}

interface PassengerData {
  firstName: string;
  lastName: string;
  passportNumber: string;
  nationality: string;
  dateOfBirth: string;
  gender: string;
  passportExpiry: string;
  passportIssueCountry: string;
}

export class OCRService {
  private apiBaseUrl: string;

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
  async scanPassport(
    filePath: string,
    language: string = 'en',
    timezone: string = 'Asia/Hebron'
  ): Promise<OCRResponse> {
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath));

      const response = await axios.post<OCRResponse>(
        `${this.apiBaseUrl}/ocr`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Accept-Language': language,
            'time-zone': timezone,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      if (!response.data.success) {
        throw new Error('OCR scanning failed');
      }

      return response.data;
    } catch (error: any) {
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
  async scanPassportFromBuffer(
    fileBuffer: Buffer,
    fileName: string,
    language: string = 'en',
    timezone: string = 'Asia/Hebron'
  ): Promise<OCRResponse> {
    try {
      const formData = new FormData();
      formData.append('file', fileBuffer, fileName);

      const response = await axios.post<OCRResponse>(
        `${this.apiBaseUrl}/ocr`,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'Accept-Language': language,
            'time-zone': timezone,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      if (!response.data.success) {
        throw new Error('OCR scanning failed');
      }

      return response.data;
    } catch (error: any) {
      console.error('OCR scanning error:', error.message);
      throw new Error(`Failed to scan passport: ${error.message}`);
    }
  }

  /**
   * Convert OCR response to passenger data format
   * @param ocrData - OCR API response data
   * @returns Formatted passenger data
   */
  mapToPassengerData(ocrData: OCRResponse['data']): PassengerData {
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
  private formatDate(date: string): string {
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
  private mapGender(genderAbbr: string): string {
    return genderAbbr.toUpperCase() === 'M' ? 'Male' : 'Female';
  }

  /**
   * Validate passport expiry date
   * @param expiryDate - Expiry date in YYYY-MM-DD format
   * @returns true if passport is valid (not expired)
   */
  isPassportValid(expiryDate: string): boolean {
    const expiry = new Date(expiryDate);
    const today = new Date();
    return expiry > today;
  }

  /**
   * Get formatted passenger info for confirmation
   * @param passengerData - Passenger data
   * @returns Formatted string for display
   */
  formatPassengerInfo(passengerData: PassengerData): string {
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

export const ocrService = new OCRService();
