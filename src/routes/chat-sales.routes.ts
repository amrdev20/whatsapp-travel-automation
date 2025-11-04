import { Router } from 'express';
import chatSalesController from '../controllers/chat-sales.controller';

const router = Router();

// V4 Sales Agent Routes
router.post('/message', chatSalesController.sendMessage.bind(chatSalesController));
router.get('/history/:phone', chatSalesController.getHistory.bind(chatSalesController));
router.post('/reset', chatSalesController.resetConversation.bind(chatSalesController));

export default router;
