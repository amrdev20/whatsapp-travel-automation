"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chatV2_controller_1 = require("../controllers/chatV2.controller");
const router = (0, express_1.Router)();
const controller = new chatV2_controller_1.ChatControllerV2();
// Chat endpoints with state machine
router.post('/message', controller.sendMessage.bind(controller));
router.post('/reset', controller.resetConversation.bind(controller));
router.get('/history/:phone', controller.getHistory.bind(controller));
router.post('/book', controller.bookDirectly.bind(controller));
exports.default = router;
