// app.js - Enhanced with Session Tracking for Duplicate Prevention
const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/dbConfig');
const { errorHandler } = require('./middlewares/errorHandler');

// Import separated route handlers
const userRoutes = require('./routes/userRoutes');
const contactRoute = require('./routes/contactRoute');  // Contact forms only
const chatRoutes = require('./routes/chatRoutes');      // Chat widget only
const productRoutes = require('./routes/productRoutes');
const scheduleRoute = require('./routes/scheduleRoute');
const questionRoute = require('./routes/questionRoute');

dotenv.config();

// Database connection
connectDB();

const app = express();

// 🔧 ENHANCED: Track processed requests to prevent duplicates
const processedRequests = new Map(); // Track by sessionId + timestamp
const requestCounters = new Map(); // Track request frequency per session

// Clean up old processed requests every hour
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  for (const [key, timestamp] of processedRequests.entries()) {
    if (timestamp < oneHourAgo) {
      processedRequests.delete(key);
    }
  }
  
  // Reset request counters
  requestCounters.clear();
  
  console.log('🗑️ Cleaned up processed requests cache');
}, 60 * 60 * 1000);

// Enhanced request logging middleware with separation awareness
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n=== ${req.method} ${req.path} ===`);
  console.log(`Time: ${timestamp}`);
  console.log(`IP: ${req.ip}`);
  console.log(`User-Agent: ${req.get('User-Agent')?.substring(0, 50)}...`);
  
  // Identify system based on route
  if (req.path.includes('/contact')) {
    console.log('📝 CONTACT FORM SYSTEM REQUEST');
  } else if (req.path.includes('/chat')) {
    console.log('💬 CHAT WIDGET SYSTEM REQUEST');
  }
  
  next();
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 🔧 ENHANCED: Duplicate prevention middleware
app.use((req, res, next) => {
  if (req.method === 'POST') {
    const sessionId = req.body.sessionId;
    const requestId = req.body.id;
    
    if (sessionId && requestId) {
      const requestKey = `${sessionId}_${requestId}`;
      
      // Check if this exact request was already processed
      if (processedRequests.has(requestKey)) {
        console.log(`❌ DUPLICATE REQUEST BLOCKED: ${requestKey}`);
        return res.status(409).json({
          success: false,
          error: 'Duplicate request detected',
          message: 'This request has already been processed',
          sessionId: sessionId,
          requestId: requestId
        });
      }
      
      // Check request frequency for this session
      const now = Date.now();
      const sessionKey = `freq_${sessionId}`;
      const lastRequest = requestCounters.get(sessionKey) || 0;
      
      // Prevent rapid-fire requests (less than 1 second apart)
      if (now - lastRequest < 1000) {
        console.log(`❌ RATE LIMITED: Too many requests from session ${sessionId}`);
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message: 'Please wait before sending another request',
          sessionId: sessionId
        });
      }
      
      // Update request tracking
      requestCounters.set(sessionKey, now);
      
      // Mark this request as being processed
      processedRequests.set(requestKey, now);
      
      console.log(`✅ REQUEST AUTHORIZED: ${requestKey}`);
    }
  }
  
  next();
});

// Enhanced body logging with system separation awareness
app.use((req, res, next) => {
  if (req.method === 'POST') {
    console.log('📝 Request body received:');
    console.log('Body keys:', Object.keys(req.body));
    
    // Enhanced session tracking
    if (req.body.sessionId) {
      console.log('🔗 Session ID:', req.body.sessionId);
      console.log('🔗 Request ID:', req.body.id || 'MISSING');
      console.log('🔗 Type:', req.body.type || 'UNKNOWN');
      console.log('🔗 Source:', req.body.source || 'UNKNOWN');
    }
    
    // Contact Form System
    if (req.path.includes('/contact/submit')) {
      console.log('📧 CONTACT FORM DATA (contact forms only):');
      console.log('- Session ID:', req.body.sessionId || 'MISSING');
      console.log('- Type:', req.body.type || 'MISSING');
      console.log('- Name:', req.body.fullName || req.body.name || 'MISSING');
      console.log('- Email:', req.body.email || 'MISSING');
      console.log('- Phone:', req.body.phone || req.body.phoneNumber || 'MISSING');
      console.log('- Company:', req.body.company || 'MISSING');
      console.log('- Project Type:', req.body.projectType || 'MISSING');
      console.log('- Description:', req.body.description || req.body.howCanWeHelp || 'MISSING');
      console.log('- Expected source: contact_form');
      console.log('- Expected type: contact_form');
    }
    
    // Chat Widget System
    else if (req.path.includes('/chat/')) {
      console.log('💬 CHAT WIDGET DATA:');
      if (req.path.includes('/client-data')) {
        console.log('- Session ID:', req.body.sessionId || 'MISSING');
        console.log('- Type:', req.body.type || 'MISSING');
        console.log('- Client Name:', req.body.clientData?.name || req.body.name || 'MISSING');
        console.log('- Client Email:', req.body.clientData?.email || req.body.email || 'MISSING');
        console.log('- Expected source: chat_widget');
        console.log('- Expected type: chat_client_data');
      } else if (req.path.includes('/send')) {
        console.log('- Session ID:', req.body.sessionId || 'MISSING');
        console.log('- Message:', req.body.message?.substring(0, 50) + '...' || 'MISSING');
        console.log('- Sender:', req.body.sender || 'MISSING');
        console.log('- Expected type: chat_message');
      }
    }
    
    // Other systems
    else {
      console.log('Body preview:', JSON.stringify(req.body).substring(0, 200) + '...');
    }
  }
  next();
});

// UPDATED CORS origins (✅ With HTTPS URLs)
const origins = [
  "https://wayuptechn.com",
  "https://www.wayuptechn.com", 
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "https://localhost:3000",              // ✅ HTTPS development
  // 🔧 VPS Production URLs:
  "http://162.0.233.208:3000",           // Your VPS IP frontend
  "http://server1.wayuptechn.com:3000",  // Your hostname frontend
  // ✅ NEW: Allow direct access to your backend for testing
  "https://162.0.233.208:8000",          // ✅ Your HTTPS backend
  "http://162.0.233.208:8000"            // ✅ HTTP fallback
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
        
    if (origins.indexOf(origin) !== -1) {
      console.log('✅ CORS allowed for origin:', origin);
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  optionsSuccessStatus: 200
}));

app.options('*', cors());

// Health check route with system status
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'WayUP Technology API Server',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    systemArchitecture: {
      contactForms: {
        status: 'active',
        endpoint: '/api/contact/*',
        method: 'HTTP only',
        purpose: 'Website contact form submissions',
        sessionPrefix: 'contact_'
      },
      chatWidget: {
        status: 'active',
        endpoint: '/api/chat/*',
        method: 'HTTP + Socket.IO',
        purpose: 'Real-time chat support',
        sessionPrefix: 'chat_'
      },
      separation: 'clean_architecture_v2.1',
      duplicatePrevention: 'active'
    },
    features: {
      chatSystem: true,
      agentAssignment: true,
      contactManagement: true,
      callScheduling: true,
      realTimeChat: true,
      separatedSystems: true,
      duplicatePrevention: true,
      sessionTracking: true
    },
    stats: {
      processedRequestsCount: processedRequests.size,
      activeSessionsCount: requestCounters.size
    }
  });
});

// Enhanced response logging with system awareness
app.use((req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Contact Form System responses
    if (req.path.includes('/contact/') && req.method === 'POST') {
      console.log(`\n📤 CONTACT FORM RESPONSE:`);
      console.log(`Status: ${res.statusCode}`);
      console.log(`System: Contact Forms (HTTP)`);
      console.log(`Session: ${req.body.sessionId || 'MISSING'}`);
      try {
        const responseData = JSON.parse(data);
        console.log(`Success: ${responseData.success}`);
        if (responseData.success) {
          console.log('✅ Contact form submission saved!');
          console.log(`Contact ID: ${responseData.contact?._id}`);
          console.log(`Source: ${responseData.contact?.source || 'contact_form'}`);
          console.log(`Type: ${responseData.contact?.type || 'contact_form'}`);
        } else {
          console.log('❌ Contact form failed:', responseData.error);
        }
      } catch (e) {
        console.log('Response preview:', data.substring(0, 200));
      }
      console.log('=================================\n');
    }
    
    // Chat Widget System responses
    else if (req.path.includes('/chat/') && req.method === 'POST') {
      console.log(`\n💬 CHAT WIDGET RESPONSE:`);
      console.log(`Status: ${res.statusCode}`);
      console.log(`System: Chat Widget (HTTP + Socket.IO)`);
      console.log(`Session: ${req.body.sessionId || 'MISSING'}`);
      try {
        const responseData = JSON.parse(data);
        console.log(`Success: ${responseData.success}`);
        if (responseData.success) {
          if (req.path.includes('/client-data')) {
            console.log('✅ Chat widget client data saved!');
            console.log(`Contact ID: ${responseData.contact?._id}`);
            console.log(`Source: chat_widget`);
            console.log(`Type: chat_client_data`);
          } else if (req.path.includes('/send')) {
            console.log('✅ Chat message processed!');
            console.log(`Message ID: ${responseData.message?._id}`);
            console.log(`Type: chat_message`);
          }
        } else {
          console.log('❌ Chat widget request failed:', responseData.error);
        }
      } catch (e) {
        console.log('Response preview:', data.substring(0, 200));
      }
      console.log('=================================\n');
    }
    
    originalSend.call(this, data);
  };
  
  next();
});

// ======================
// ROUTES - CLEAN SEPARATION
// ======================

// System routes
app.use('/api/users', userRoutes);

// 📝 Contact Forms System (HTTP only)
app.use('/api/contact', contactRoute);

// 💬 Chat Widget System (HTTP + Socket.IO)
app.use('/api/chat', chatRoutes);

// Other business logic routes
app.use('/api/products', productRoutes);
app.use('/api/calls', scheduleRoute);
app.use('/api/questions', questionRoute);

// Base route with system overview
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'WayUP Technology API Server',
    version: '2.1.0',
    architecture: 'Clean Separated Systems with Duplicate Prevention',
    timestamp: new Date().toISOString(),
    systems: {
      contactForms: {
        description: 'Website contact form submissions',
        method: 'HTTP only',
        sessionPrefix: 'contact_',
        expectedType: 'contact_form',
        endpoints: {
          submit: 'POST /api/contact/submit',
          list: 'GET /api/contact/all',
          stats: 'GET /api/contact/stats'
        }
      },
      chatWidget: {
        description: 'Real-time chat support system',
        method: 'HTTP + Socket.IO',
        sessionPrefix: 'chat_',
        expectedTypes: ['chat_client_data', 'chat_message'],
        endpoints: {
          sendMessage: 'POST /api/chat/send',
          clientData: 'POST /api/chat/client-data',
          history: 'GET /api/chat/history/:sessionId',
          sessions: 'GET /api/chat/sessions',
          stats: 'GET /api/chat/stats'
        },
        socketEvents: [
          'register chat session',
          'chat message',
          'client data',
          'schedule call',
          'agent message'
        ]
      }
    },
    duplicatePrevention: {
      enabled: true,
      method: 'sessionId + requestId tracking',
      rateLimiting: '1 second minimum between requests',
      cleanup: 'Every 1 hour'
    },
    otherEndpoints: {
      health: 'GET /api/health',
      users: 'POST /api/users/register, POST /api/users/login',
      products: 'GET /api/products',
      calls: 'GET /api/calls, POST /api/calls',
      questions: 'GET /api/questions, POST /api/questions'
    }
  });
});

// Enhanced 404 handler with system separation awareness
app.use('*', (req, res) => {
  console.log(`\n❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  console.log(`Origin: ${req.get('Origin')}`);
  console.log(`Referer: ${req.get('Referer')}`);
  
  // Helpful routing suggestions based on request path
  let suggestions = [];
  if (req.originalUrl.includes('contact')) {
    suggestions.push('📝 For contact forms: POST /api/contact/submit');
    suggestions.push('📋 To view contacts: GET /api/contact/all');
  }
  if (req.originalUrl.includes('chat')) {
    suggestions.push('💬 For chat messages: POST /api/chat/send');
    suggestions.push('📞 For client data: POST /api/chat/client-data');
    suggestions.push('📊 For chat stats: GET /api/chat/stats');
  }
  
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    suggestions: suggestions.length > 0 ? suggestions : ['Check the available routes below'],
    availableSystems: {
      contactForms: {
        description: 'Website contact form submissions (HTTP only)',
        sessionPrefix: 'contact_',
        routes: [
          'POST /api/contact/submit - Submit contact form',
          'GET /api/contact/all - Get all contact form submissions',
          'GET /api/contact/stats - Get contact form statistics'
        ]
      },
      chatWidget: {
        description: 'Real-time chat support (HTTP + Socket.IO)',
        sessionPrefix: 'chat_',
        routes: [
          'POST /api/chat/send - Send chat message',
          'POST /api/chat/client-data - Submit client data from chat',
          'GET /api/chat/sessions - Get all chat sessions',
          'GET /api/chat/history/:sessionId - Get chat history',
          'GET /api/chat/stats - Get chat statistics'
        ]
      },
      system: [
        'GET / - API overview',
        'GET /api/health - System health check'
      ]
    }
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Create HTTP server
const server = http.createServer(app);

// Enhanced server event handling
server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const port = process.env.PORT || 8000;
  const bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

  switch (error.code) {
    case 'EACCES':
      console.error(`❌ ${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(`❌ ${bind} is already in use`);
      process.exit(1);
      break;
    default:
      console.error('❌ Server error:', error);
      throw error;
  }
});

server.on('listening', () => {
  const addr = server.address();
  const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
  console.log('\n🚀 SERVER STARTED SUCCESSFULLY!');
  console.log(`📍 Listening on ${bind}`);
  console.log('');
  console.log('🎯 ENHANCED CLEAN SYSTEM ARCHITECTURE ACTIVE:');
  console.log('');
  console.log('📝 Contact Forms System:');
  console.log('   - Method: HTTP only');
  console.log('   - Endpoint: POST /api/contact/submit');
  console.log('   - Session Prefix: contact_');
  console.log('   - Type: contact_form');
  console.log('   - Purpose: Website contact form submissions');
  console.log('   - Storage: contacts collection (source: contact_form)');
  console.log('');
  console.log('💬 Chat Widget System:');
  console.log('   - Method: HTTP + Socket.IO real-time');
  console.log('   - Endpoints: /api/chat/* + Socket.IO events');
  console.log('   - Session Prefix: chat_');
  console.log('   - Types: chat_client_data, chat_message');
  console.log('   - Purpose: Customer support chat');
  console.log('   - Storage: chatmessages + contacts (source: chat_widget)');
  console.log('');
  console.log('🔒 Duplicate Prevention Features:');
  console.log('   ✅ Session + Request ID tracking');
  console.log('   ✅ Rate limiting (1 second minimum)');
  console.log('   ✅ Automatic cleanup every hour');
  console.log('   ✅ 409 Conflict responses for duplicates');
  console.log('   ✅ 429 Rate limit responses');
  console.log('');
  console.log('📊 System Features:');
  console.log('   ✅ Clean separation (no mixing)');
  console.log('   ✅ Agent assignment system');
  console.log('   ✅ Real-time chat notifications');
  console.log('   ✅ Comprehensive logging');
  console.log('   ✅ Error handling & validation');
  console.log('   ✅ Enhanced duplicate prevention');
  console.log('');
  console.log('🔍 Debugging enabled - detailed logs active');
  console.log('=====================================\n');
});

// Export processed requests tracking for testing
module.exports = { 
  app, 
  server, 
  processedRequests, 
  requestCounters 
};