import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';

const router = Router();
const chatController = new ChatController();

// Simple routes - ONLY flight search
router.post('/message', chatController.sendMessage.bind(chatController));
router.get('/history/:phone', chatController.getHistory.bind(chatController));
router.post('/reset', chatController.resetConversation.bind(chatController));

export default router;
