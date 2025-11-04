import { Router } from 'express';
import chatFunctionsController from '../controllers/chat-functions.controller';

const router = Router();

// Routes using OpenAI Function Calling
router.post('/message', chatFunctionsController.sendMessage.bind(chatFunctionsController));
router.get('/history/:phone', chatFunctionsController.getHistory.bind(chatFunctionsController));
router.post('/reset', chatFunctionsController.resetConversation.bind(chatFunctionsController));

export default router;