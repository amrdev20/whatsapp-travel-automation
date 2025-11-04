"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const zoho_webhook_controller_1 = __importDefault(require("../controllers/zoho-webhook.controller"));
const zoho_salesiq_widget_service_1 = __importDefault(require("../services/zoho-salesiq-widget.service"));
const router = (0, express_1.Router)();
// Zoho SalesIQ Webhook Routes
router.post('/webhook', zoho_webhook_controller_1.default.handleWebhook.bind(zoho_webhook_controller_1.default));
router.get('/webhook/verify', zoho_webhook_controller_1.default.verifyWebhook.bind(zoho_webhook_controller_1.default));
// Dashboard Route
router.get('/dashboard', (req, res) => {
    // Serve the dashboard HTML file
    res.sendFile(path_1.default.join(__dirname, '../../zoho-salesiq-dashboard.html'));
});
// Embedding Page Route
router.get('/embed', (req, res) => {
    // Serve the Zoho chat embedding page
    res.sendFile(path_1.default.join(__dirname, '../../zoho-chat-embed.html'));
});
// Get pending messages for widget
router.get('/messages/pending', (req, res) => {
    const messages = zoho_salesiq_widget_service_1.default.getPendingMessages();
    res.json(messages);
});
exports.default = router;
