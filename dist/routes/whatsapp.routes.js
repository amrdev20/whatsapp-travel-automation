"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const whatsapp_controller_1 = require("../controllers/whatsapp.controller");
const router = (0, express_1.Router)();
// Webhook verification (GET request from Meta)
router.get('/webhook', (req, res) => whatsapp_controller_1.whatsappController.verifyWebhook(req, res));
// Webhook for receiving messages (POST request from Meta)
router.post('/webhook', (req, res) => whatsapp_controller_1.whatsappController.handleWebhook(req, res));
// Send message endpoint (for testing)
router.post('/send', (req, res) => whatsapp_controller_1.whatsappController.sendMessage(req, res));
// Test connection endpoint
router.get('/test', (req, res) => whatsapp_controller_1.whatsappController.testConnection(req, res));
exports.default = router;
