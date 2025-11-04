import { Router } from 'express';
import { ocrController, upload } from '../controllers/ocr.controller';

const router = Router();

// Test endpoint
router.get('/test', ocrController.test.bind(ocrController));

// Scan single passport
router.post(
  '/scan-passport',
  upload.single('file'),
  ocrController.scanPassport.bind(ocrController)
);

// Scan multiple passports
router.post(
  '/scan-passengers',
  upload.array('files', 10), // Max 10 files
  ocrController.scanMultiplePassports.bind(ocrController)
);

export default router;
