import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import chatRoutes from './routes/chat.routes';
import chatV2Routes from './routes/chatV2.routes';
import chatFunctionsRoutes from './routes/chat-functions.routes';
import chatSalesRoutes from './routes/chat-sales.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import ocrRoutes from './routes/ocr.routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure Pug as view engine
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/v2/chat', chatV2Routes); // New state machine version
app.use('/api/v3/chat', chatFunctionsRoutes); // Function calling version
app.use('/api/v4/chat', chatSalesRoutes); // Sales agent version with flights + hotels
app.use('/api/whatsapp', whatsappRoutes); // WhatsApp Business API integration
app.use('/api/ocr', ocrRoutes); // OCR Passport scanning

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
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
    console.log('\n📝 Available endpoints:');
    console.log(`   GET    /chat                 - Integrated Chat UI`);
    console.log(`   POST   /api/v4/chat/message  - V4 Sales Agent (Flights + Hotels)`);
    console.log(`   POST   /api/v3/chat/message  - V3 Function Calling`);
    console.log(`   POST   /api/v2/chat/message  - V2 State Machine`);
    console.log(`   POST   /api/chat/message     - V1 Chat`);
    console.log(`   GET    /api/v4/chat/history/:phone - Get chat history`);
    console.log(`   POST   /api/v4/chat/reset    - Reset conversation`);
    console.log(`   GET    /api/whatsapp/webhook - WhatsApp webhook verification`);
    console.log(`   POST   /api/whatsapp/webhook - WhatsApp message receiver`);
    console.log(`   POST   /api/whatsapp/send    - Send WhatsApp message`);
    console.log(`   GET    /api/whatsapp/test    - Test WhatsApp connection`);
    console.log('\n✨ Ready to accept requests! (Using in-memory sessions)\n');
  });
};

startServer();
