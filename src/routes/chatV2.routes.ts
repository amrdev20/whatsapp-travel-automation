import { Router } from 'express';
import { ChatControllerV2 } from '../controllers/chatV2.controller';

const router = Router();
const controller = new ChatControllerV2();

// Chat endpoints with state machine
router.post('/message', controller.sendMessage.bind(controller));
router.post('/reset', controller.resetConversation.bind(controller));
router.get('/history/:phone', controller.getHistory.bind(controller));
router.post('/book', controller.bookDirectly.bind(controller));

export default router;