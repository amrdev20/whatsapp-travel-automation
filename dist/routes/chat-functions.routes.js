"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chat_functions_controller_1 = __importDefault(require("../controllers/chat-functions.controller"));
const router = (0, express_1.Router)();
// Routes using OpenAI Function Calling
router.post('/message', chat_functions_controller_1.default.sendMessage.bind(chat_functions_controller_1.default));
router.get('/history/:phone', chat_functions_controller_1.default.getHistory.bind(chat_functions_controller_1.default));
router.post('/reset', chat_functions_controller_1.default.resetConversation.bind(chat_functions_controller_1.default));
exports.default = router;
