"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const chat_routes_1 = __importDefault(require("./routes/chat.routes"));
const chatV2_routes_1 = __importDefault(require("./routes/chatV2.routes"));
const chat_functions_routes_1 = __importDefault(require("./routes/chat-functions.routes"));
const chat_sales_routes_1 = __importDefault(require("./routes/chat-sales.routes"));
const zoho_webhook_routes_1 = __importDefault(require("./routes/zoho-webhook.routes"));
const whatsapp_routes_1 = __importDefault(require("./routes/whatsapp.routes"));
const ocr_routes_1 = __importDefault(require("./routes/ocr.routes"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Create uploads directory if it doesn't exist
const uploadsDir = path_1.default.join(__dirname, '../uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
// Configure Pug as view engine
app.set('view engine', 'pug');
app.set('views', path_1.default.join(__dirname, 'views'));
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Routes
app.use('/api/chat', chat_routes_1.default);
app.use('/api/v2/chat', chatV2_routes_1.default); // New state machine version
app.use('/api/v3/chat', chat_functions_routes_1.default); // Function calling version
app.use('/api/v4/chat', chat_sales_routes_1.default); // Sales agent version with flights + hotels
app.use('/api/zoho', zoho_webhook_routes_1.default); // Zoho SalesIQ webhook integration
app.use('/api/whatsapp', whatsapp_routes_1.default); // WhatsApp Business API integration
app.use('/api/ocr', ocr_routes_1.default); // OCR Passport scanning
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Travel Automation API is running' });
});
// Chat UI route
app.get('/chat', (req, res) => {
    res.render('chat');
});
// OCR Test UI route
app.get('/ocr-test', (req, res) => {
    res.render('ocr-test');
});
// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Travel Automation API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            chat: '/api/chat/message',
            upload: '/api/chat/upload',
            history: '/api/chat/history/:phone',
            reset: '/api/chat/reset',
            chatUI: '/chat'
        }
    });
});
// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});
// Start server
const startServer = () => {
    console.log('🚀 Starting Travel Automation API...\n');
    app.listen(PORT, () => {
        console.log(`\n✓ Server is running on port ${PORT}`);
        console.log(`✓ API URL: http://localhost:${PORT}`);
        console.log(`✓ Health Check: http://localhost:${PORT}/health`);
        console.log(`✓ Chat UI: http://localhost:${PORT}/chat`);
        console.log(`✓ Zoho Dashboard: http://localhost:${PORT}/api/zoho/dashboard`);
        console.log('\n📝 Available endpoints:');
        console.log(`   GET    /chat                 - Integrated Chat UI`);
        console.log(`   GET    /api/zoho/dashboard   - Zoho SalesIQ Monitoring Dashboard`);
        console.log(`   POST   /api/v4/chat/message  - V4 Sales Agent (Flights + Hotels)`);
        console.log(`   POST   /api/v3/chat/message  - V3 Function Calling`);
        console.log(`   POST   /api/v2/chat/message  - V2 State Machine`);
        console.log(`   POST   /api/chat/message     - V1 Chat`);
        console.log(`   GET    /api/v4/chat/history/:phone - Get chat history`);
        console.log(`   POST   /api/v4/chat/reset    - Reset conversation`);
        console.log(`   POST   /api/zoho/webhook     - Zoho webhook endpoint`);
        console.log(`   GET    /api/whatsapp/webhook - WhatsApp webhook verification`);
        console.log(`   POST   /api/whatsapp/webhook - WhatsApp message receiver`);
        console.log(`   POST   /api/whatsapp/send    - Send WhatsApp message`);
        console.log(`   GET    /api/whatsapp/test    - Test WhatsApp connection`);
        console.log('\n✨ Ready to accept requests! (Using in-memory sessions)\n');
    });
};
startServer();
