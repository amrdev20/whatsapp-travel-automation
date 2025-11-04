import { Request, Response } from 'express';
import { ocrService } from '../services/ocr.service';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/passports');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `passport-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept images only
  if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF)$/)) {
    return cb(new Error('Only image files are allowed!'));
  }
  cb(null, true);
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

export class OCRController {
  /**
   * Scan passport image and extract data
   * POST /api/ocr/scan-passport
   */
  async scanPassport(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded. Please upload a passport image.',
        });
        return;
      }

      const language = req.body.language || req.headers['accept-language'] || 'en';
      const timezone = req.body.timezone || req.headers['time-zone'] || 'Asia/Hebron';

      console.log(`📄 Scanning passport: ${req.file.filename}`);

      // Scan the passport
      const ocrResult = await ocrService.scanPassport(req.file.path, language as string, timezone as string);

      // Map to passenger data
      const passengerData = ocrService.mapToPassengerData(ocrResult.data);

      // Validate passport
      const isValid = ocrService.isPassportValid(passengerData.passportExpiry);

      // Format info for display
      const formattedInfo = ocrService.formatPassengerInfo(passengerData);

      // Clean up uploaded file (optional)
      // fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        message: 'Passport scanned successfully',
        data: {
          raw: ocrResult.data,
          passenger: passengerData,
          isValid,
          formattedInfo,
        },
      });
    } catch (error: any) {
      console.error('Error scanning passport:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to scan passport',
        error: error.message,
      });
    }
  }

  /**
   * Scan multiple passports for all passengers
   * POST /api/ocr/scan-passengers
   */
  async scanMultiplePassports(req: Request, res: Response): Promise<void> {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No files uploaded. Please upload passport images.',
        });
        return;
      }

      const language = req.body.language || req.headers['accept-language'] || 'en';
      const timezone = req.body.timezone || req.headers['time-zone'] || 'Asia/Hebron';

      console.log(`📄 Scanning ${files.length} passports`);

      const passengers = [];
      const errors = [];

      for (const file of files) {
        try {
          const ocrResult = await ocrService.scanPassport(file.path, language as string, timezone as string);
          const passengerData = ocrService.mapToPassengerData(ocrResult.data);
          const isValid = ocrService.isPassportValid(passengerData.passportExpiry);

          passengers.push({
            passenger: passengerData,
            isValid,
            fileName: file.originalname,
          });

          // Clean up file
          // fs.unlinkSync(file.path);
        } catch (error: any) {
          errors.push({
            fileName: file.originalname,
            error: error.message,
          });
        }
      }

      res.json({
        success: true,
        message: `Scanned ${passengers.length} passports successfully`,
        data: {
          passengers,
          errors: errors.length > 0 ? errors : undefined,
          totalScanned: passengers.length,
          totalErrors: errors.length,
        },
      });
    } catch (error: any) {
      console.error('Error scanning passports:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to scan passports',
        error: error.message,
      });
    }
  }

  /**
   * Test OCR endpoint
   * GET /api/ocr/test
   */
  async test(req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      message: 'OCR Service is running',
      endpoints: {
        scanPassport: 'POST /api/ocr/scan-passport (single file upload)',
        scanMultiple: 'POST /api/ocr/scan-passengers (multiple file upload)',
      },
    });
  }
}

export const ocrController = new OCRController();
