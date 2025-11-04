"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chat_controller_1 = require("../controllers/chat.controller");
const router = (0, express_1.Router)();
const chatController = new chat_controller_1.ChatController();
// Simple routes - ONLY flight search
router.post('/message', chatController.sendMessage.bind(chatController));
router.get('/history/:phone', chatController.getHistory.bind(chatController));
router.post('/reset', chatController.resetConversation.bind(chatController));
exports.default = router;
