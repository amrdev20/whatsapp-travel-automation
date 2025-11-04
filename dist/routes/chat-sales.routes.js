"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chat_sales_controller_1 = __importDefault(require("../controllers/chat-sales.controller"));
const router = (0, express_1.Router)();
// V4 Sales Agent Routes
router.post('/message', chat_sales_controller_1.default.sendMessage.bind(chat_sales_controller_1.default));
router.get('/history/:phone', chat_sales_controller_1.default.getHistory.bind(chat_sales_controller_1.default));
router.post('/reset', chat_sales_controller_1.default.resetConversation.bind(chat_sales_controller_1.default));
exports.default = router;
