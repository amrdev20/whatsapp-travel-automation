"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ocrController = exports.OCRController = exports.upload = void 0;
const ocr_service_1 = require("../services/ocr.service");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Configure multer for file uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path_1.default.join(__dirname, '../../uploads/passports');
        if (!fs_1.default.existsSync(uploadDir)) {
            fs_1.default.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `passport-${uniqueSuffix}${path_1.default.extname(file.originalname)}`);
    },
});
const fileFilter = (req, file, cb) => {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF)$/)) {
        return cb(new Error('Only image files are allowed!'));
    }
    cb(null, true);
};
exports.upload = (0, multer_1.default)({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
});
class OCRController {
    /**
     * Scan passport image and extract data
     * POST /api/ocr/scan-passport
     */
    async scanPassport(req, res) {
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
            const ocrResult = await ocr_service_1.ocrService.scanPassport(req.file.path, language, timezone);
            // Map to passenger data
            const passengerData = ocr_service_1.ocrService.mapToPassengerData(ocrResult.data);
            // Validate passport
            const isValid = ocr_service_1.ocrService.isPassportValid(passengerData.passportExpiry);
            // Format info for display
            const formattedInfo = ocr_service_1.ocrService.formatPassengerInfo(passengerData);
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
        }
        catch (error) {
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
    async scanMultiplePassports(req, res) {
        try {
            const files = req.files;
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
                    const ocrResult = await ocr_service_1.ocrService.scanPassport(file.path, language, timezone);
                    const passengerData = ocr_service_1.ocrService.mapToPassengerData(ocrResult.data);
                    const isValid = ocr_service_1.ocrService.isPassportValid(passengerData.passportExpiry);
                    passengers.push({
                        passenger: passengerData,
                        isValid,
                        fileName: file.originalname,
                    });
                    // Clean up file
                    // fs.unlinkSync(file.path);
                }
                catch (error) {
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
        }
        catch (error) {
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
    async test(req, res) {
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
exports.OCRController = OCRController;
exports.ocrController = new OCRController();
