"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ocr_controller_1 = require("../controllers/ocr.controller");
const router = (0, express_1.Router)();
// Test endpoint
router.get('/test', ocr_controller_1.ocrController.test.bind(ocr_controller_1.ocrController));
// Scan single passport
router.post('/scan-passport', ocr_controller_1.upload.single('file'), ocr_controller_1.ocrController.scanPassport.bind(ocr_controller_1.ocrController));
// Scan multiple passports
router.post('/scan-passengers', ocr_controller_1.upload.array('files', 10), // Max 10 files
ocr_controller_1.ocrController.scanMultiplePassports.bind(ocr_controller_1.ocrController));
exports.default = router;
