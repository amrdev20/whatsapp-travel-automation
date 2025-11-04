import { Router } from 'express';
import { whatsappController } from '../controllers/whatsapp.controller';

const router = Router();

// Webhook verification (GET request from Meta)
router.get('/webhook', (req, res) => whatsappController.verifyWebhook(req, res));

// Webhook for receiving messages (POST request from Meta)
router.post('/webhook', (req, res) => whatsappController.handleWebhook(req, res));

// Send message endpoint (for testing)
router.post('/send', (req, res) => whatsappController.sendMessage(req, res));

// Test connection endpoint
router.get('/test', (req, res) => whatsappController.testConnection(req, res));

export default router;