const { app, server } = require('./app');
const { Server } = require('socket.io');

// Import models
const ChatMessage = require('./models/chatModel');
const Contact = require('./models/contactModel');
const User = require('./models/userModel');

// 🚀 NEW: Import separated chat controller handlers
const {
  handleSocketMessage,
  handleSocketClientData,
  handleSocketScheduleCall
} = require('./controllers/chatController');

// 🔧 PRODUCTION READY: Remove forced development mode
// DELETED: process.env.NODE_ENV = 'development';

console.log('Environment:', process.env.NODE_ENV);
console.log('Port:', process.env.PORT || 8000);

// Create activeConnections Map to track sessions
const activeConnections = new Map(); // Changed from Set to Map
const chatSessions = new Map(); // Track chat sessions by sessionId
const processedSubmissions = new Set(); // Track processed submissions

// 🔧 UPDATED: CORS configuration for VPS production
const socketCorsConfig = {
  origin: process.env.NODE_ENV === 'production'
    ? [
        "https://wayuptechn.com",
        "https://www.wayuptechn.com",
        "http://162.0.233.208:3000",           // Your VPS IP frontend
        "http://server1.wayuptechn.com:3000"   // Your hostname frontend
      ]
    : [
        "http://localhost:3000",
        "http://localhost:3001", 
        "http://127.0.0.1:3000",
        "http://localhost:8000"
      ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "my-custom-header"]
};

console.log('Socket.IO CORS origins:', socketCorsConfig.origin);

const io = new Server(server, {
  cors: socketCorsConfig,
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  cookie: {
    name: 'io',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
  },
  connectTimeout: 45000,
  maxHttpBufferSize: 1e6 // 1MB
});

// Make io globally available for real-time notifications
global.io = io;

// ======================
// SOCKET.IO CONNECTION HANDLER
// ======================
io.on('connection', (socket) => {
  console.log('🔌 New chat widget client connected:', socket.id);
  activeConnections.set(socket.id, {
    socketId: socket.id,
    connectedAt: new Date(),
    sessionId: null // Will be set when session is registered
  });

  // Send welcome message
  socket.emit('chat message', {
    id: `welcome_${Date.now()}`,
    message: 'Hello! Welcome to WayUP Technology. How can we help you today?',
    sender: 'Support Team',
    timestamp: new Date(),
    messageType: 'system'
  });

  // ======================
  // 🔧 FIXED: SESSION REGISTRATION
  // ======================
  
  socket.on('register chat session', (data) => {
    const { sessionId, type } = data;
    console.log(`📝 Registering chat session: ${sessionId} (Socket: ${socket.id})`);
    
    // Update connection tracking
    const connection = activeConnections.get(socket.id);
    if (connection) {
      connection.sessionId = sessionId;
      connection.type = type;
    }
    
    // Track chat session
    chatSessions.set(sessionId, {
      sessionId,
      socketId: socket.id,
      type: type || 'chat_widget',
      registeredAt: new Date(),
      lastActivity: new Date()
    });
    
    // Join room for this session
    socket.join(`session_${sessionId}`);
    
    // Confirm registration
    socket.emit('chat session registered', {
      success: true,
      sessionId,
      socketId: socket.id
    });
    
    console.log(`✅ Chat session registered: ${sessionId}`);
  });

  // ======================
  // 🔧 FIXED: CHAT WIDGET EVENTS (preserve original session IDs)
  // ======================

  // Handle chat messages from widget
  socket.on('chat message', async (data) => {
    console.log('💬 Chat message received:', data);
    
    // 🔧 CRITICAL FIX: Don't override sessionId from frontend
    const sessionId = data.sessionId || socket.id;
    const session = chatSessions.get(sessionId);
    
    if (!session) {
      console.error(`❌ No session found for: ${sessionId}`);
      socket.emit('message error', {
        success: false,
        error: 'Session not found. Please refresh and try again.'
      });
      return;
    }
    
    // Update last activity
    session.lastActivity = new Date();
    
    try {
      // Pass original data without modifying sessionId
      await handleSocketMessage(socket, {
        ...data,
        socketId: socket.id, // Add socket ID separately
        // Don't override sessionId - keep the original from frontend
      });
    } catch (error) {
      console.error('❌ Error handling chat message:', error);
      socket.emit('message error', {
        success: false,
        error: 'Failed to process message'
      });
    }
  });

  // Handle client data from chat widget form (creates contact)
  socket.on('client data', async (data) => {
    console.log('📝 Client data received:', data);
    
    const { id, sessionId } = data;
    
    // 🔧 CRITICAL FIX: Prevent duplicate submissions
    if (processedSubmissions.has(id)) {
      console.log(`❌ Duplicate submission prevented: ${id}`);
      socket.emit('client data received', {
        success: false,
        error: 'Duplicate submission',
        sessionId
      });
      return;
    }
    
    // Validate session
    const session = chatSessions.get(sessionId);
    if (!session) {
      console.error(`❌ No session found for client data: ${sessionId}`);
      socket.emit('client data received', {
        success: false,
        error: 'Invalid session',
        sessionId
      });
      return;
    }
    
    try {
      // Mark as being processed
      processedSubmissions.add(id);
      
      // Pass original data without modifying sessionId
      const result = await handleSocketClientData(socket, {
        ...data,
        socketId: socket.id,
        // Keep original sessionId from frontend
      });
      
      if (result?.success) {
        // Update session with client data
        session.clientData = data.clientData;
        session.lastActivity = new Date();
        
        console.log(`✅ Client data saved for session: ${sessionId}`);
      }
      
    } catch (error) {
      console.error('❌ Error handling client data:', error);
      // Remove from processed set on error so it can be retried
      processedSubmissions.delete(id);
      
      socket.emit('client data received', {
        success: false,
        error: 'Failed to save contact information',
        sessionId
      });
    }
  });

  // Handle call scheduling from chat widget
  socket.on('schedule call', async (data) => {
    console.log('📞 Call scheduling request:', data);
    
    const { id, sessionId } = data;
    
    // Prevent duplicate call requests
    if (processedSubmissions.has(id)) {
      console.log(`❌ Duplicate call request prevented: ${id}`);
      socket.emit('call scheduled', {
        success: false,
        error: 'Duplicate request',
        sessionId
      });
      return;
    }
    
    const session = chatSessions.get(sessionId);
    if (!session) {
      console.error(`❌ No session found for call scheduling: ${sessionId}`);
      socket.emit('call scheduled', {
        success: false,
        error: 'Invalid session',
        sessionId
      });
      return;
    }
    
    try {
      processedSubmissions.add(id);
      
      await handleSocketScheduleCall(socket, {
        ...data,
        socketId: socket.id,
        // Keep original sessionId
      });
      
      session.lastActivity = new Date();
      
    } catch (error) {
      console.error('❌ Error handling call scheduling:', error);
      processedSubmissions.delete(id);
      
      socket.emit('call scheduled', {
        success: false,
        error: 'Failed to schedule call',
        sessionId: data.sessionId
      });
    }
  });

  // ======================
  // AGENT/ADMIN EVENTS
  // ======================

  // Agent joins a chat session
  socket.on('agent join', async (data) => {
    console.log('👤 Agent joining chat session:', data.sessionId);
    try {
      const { sessionId, agentId, agentName } = data;
      
      // Validate session exists
      const session = chatSessions.get(sessionId);
      if (!session) {
        socket.emit('agent join error', {
          error: 'Session not found',
          sessionId
        });
        return;
      }
      
      // Join the session room
      socket.join(`session_${sessionId}`);
      
      // Notify client that agent joined
      socket.to(`session_${sessionId}`).emit('agent joined', {
        agentName: agentName || 'Support Agent',
        message: `${agentName || 'Support Agent'} has joined the chat`
      });

      // Update agent status if User model supports it
      if (agentId) {
        try {
          const agent = await User.findById(agentId);
          if (agent && agent.assignChat) {
            await agent.assignChat();
          }
        } catch (agentError) {
          console.error('Error updating agent status:', agentError);
        }
      }

    } catch (error) {
      console.error('Error handling agent join:', error);
    }
  });

  // Agent sends message to client
  socket.on('agent message', async (data) => {
    console.log('💼 Agent message:', data);
    try {
      const { sessionId, message, agentName, agentId } = data;
      
      // Validate session
      const session = chatSessions.get(sessionId);
      if (!session) {
        socket.emit('message error', {
          success: false,
          error: 'Session not found'
        });
        return;
      }

      // Save agent message to database
      const agentMessage = await ChatMessage.create({
        message: message,
        sender: agentName || 'Support Agent',
        sessionId: sessionId,
        messageType: 'agent',
        source: 'chat_widget',
        assignedAgent: agentId || null,
        isRead: true
      });

      // Send to client in that session
      socket.to(`session_${sessionId}`).emit('chat message', {
        id: agentMessage._id,
        message: message,
        sender: agentName || 'Support Agent',
        timestamp: agentMessage.createdAt,
        messageType: 'agent',
        sessionId: sessionId
      });

      // Confirm to agent
      socket.emit('message sent', {
        success: true,
        messageId: agentMessage._id
      });

    } catch (error) {
      console.error('Error handling agent message:', error);
      socket.emit('message error', {
        success: false,
        error: 'Failed to send message'
      });
    }
  });

  // Agent typing indicators with session validation
  socket.on('agent typing', (data) => {
    const { sessionId } = data;
    if (chatSessions.has(sessionId)) {
      socket.to(`session_${sessionId}`).emit('agent typing', { sessionId });
    }
  });

  socket.on('agent stop typing', (data) => {
    const { sessionId } = data;
    if (chatSessions.has(sessionId)) {
      socket.to(`session_${sessionId}`).emit('agent stop typing', { sessionId });
    }
  });

  // ======================
  // CLIENT EVENTS
  // ======================

  // Client typing indicator
  socket.on('client typing', async (data) => {
    try {
      const connection = activeConnections.get(socket.id);
      const sessionId = connection?.sessionId || socket.id;
      
      // Find if there's an assigned agent for this session
      const contact = await Contact.findOne({ sessionId })
        .populate('assignedTo', 'name email');

      if (contact?.assignedTo) {
        // Notify the assigned agent
        socket.broadcast.emit('client typing', {
          sessionId: sessionId,
          clientName: contact.name,
          agentId: contact.assignedTo._id
        });
      }
    } catch (error) {
      console.error('Error handling client typing:', error);
    }
  });

  socket.on('client stop typing', async (data) => {
    try {
      const connection = activeConnections.get(socket.id);
      const sessionId = connection?.sessionId || socket.id;
      
      const contact = await Contact.findOne({ sessionId })
        .populate('assignedTo', 'name email');

      if (contact?.assignedTo) {
        socket.broadcast.emit('client stop typing', {
          sessionId: sessionId,
          agentId: contact.assignedTo._id
        });
      }
    } catch (error) {
      console.error('Error handling client stop typing:', error);
    }
  });

  // ======================
  // GENERAL EVENTS
  // ======================

  // Error handling
  socket.on('error', (error) => {
    console.error('❌ Socket error for client', socket.id, ':', error);
    socket.emit('error', { message: 'An error occurred' });
  });

  // Disconnect handling
  socket.on('disconnect', (reason) => {
    console.log('🔌 Client disconnected:', socket.id, 'Reason:', reason);
    
    const connection = activeConnections.get(socket.id);
    const sessionId = connection?.sessionId;
    
    // Clean up connections
    activeConnections.delete(socket.id);
    
    if (sessionId) {
      chatSessions.delete(sessionId);
      console.log(`🗑️ Cleaned up session: ${sessionId}`);
    }

    // Release agent if assigned
    if (sessionId) {
      Contact.findOne({ sessionId })
        .populate('assignedTo')
        .then(contact => {
          if (contact?.assignedTo && contact.assignedTo.releaseChat) {
            contact.assignedTo.releaseChat().catch(console.error);
          }
        })
        .catch(console.error);
    }

    // Notify agents that client left
    socket.broadcast.emit('client disconnected', {
      sessionId: sessionId || socket.id,
      reason: reason
    });
  });
});

// ======================
// CLEANUP FUNCTIONS
// ======================

// Clean up old processed submissions periodically
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  // Note: You might want to implement timestamp tracking for better cleanup
  if (processedSubmissions.size > 10000) {
    processedSubmissions.clear();
    console.log('🗑️ Cleared processed submissions cache');
  }
}, 60 * 60 * 1000); // Every hour

// Clean up inactive sessions
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  for (const [sessionId, session] of chatSessions.entries()) {
    if (session.lastActivity.getTime() < oneHourAgo) {
      chatSessions.delete(sessionId);
      console.log(`🗑️ Cleaned up inactive session: ${sessionId}`);
    }
  }
}, 15 * 60 * 1000); // Every 15 minutes

// ======================
// REAL-TIME NOTIFICATIONS
// ======================

// Function to notify all connected admin/agents
const notifyAdmins = (event, data) => {
  io.emit('admin_notification', {
    type: event,
    data: data,
    timestamp: new Date()
  });
};

// Function to notify specific agent
const notifyAgent = (agentId, event, data) => {
  io.emit('agent_notification', {
    agentId: agentId,
    type: event,
    data: data,
    timestamp: new Date()
  });
};

// Export notification functions for use in controllers
global.notifyAdmins = notifyAdmins;
global.notifyAgent = notifyAgent;

// ======================
// SERVER CONFIGURATION
// ======================

// Server error handling
server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

// Port configuration
const PORT = process.env.PORT || 8000;

// 🔧 UPDATED: Production-ready server startup
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  
  if (process.env.NODE_ENV === 'production') {
    console.log(`📍 Production API: http://162.0.233.208:${PORT}/api/health`);
    console.log(`💬 Production Chat: Socket.IO enabled on port ${PORT}`);
    console.log(`🌐 Frontend URL: http://162.0.233.208:3000`);
    console.log(`🌐 Hostname URL: http://server1.wayuptechn.com:3000`);
  } else {
    console.log(`📍 API Health check: http://localhost:${PORT}/api/health`);
    console.log(`💬 Chat Widget: Socket.IO enabled on port ${PORT}`);
  }
  
  console.log(`📊 Active connections: ${activeConnections.size}`);
  console.log('');
  console.log('🎯 SYSTEM SEPARATION:');
  console.log('   📝 Contact Forms → /api/contact/* (HTTP only)');
  console.log('   💬 Chat Widget → Socket.IO + /api/chat/* (real-time)');
  console.log('   🔐 Session Management: Unique IDs prevent conflicts');
  console.log('');
});

// ======================
// ERROR HANDLING
// ======================

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  if (process.env.NODE_ENV === 'production') {
    console.error('Critical error - initiating graceful shutdown');
    gracefulShutdown();
  } else {
    console.error('Development mode - continuing execution');
  }
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  if (process.env.NODE_ENV === 'production') {
    console.error('Critical error - initiating graceful shutdown');
    gracefulShutdown();
  } else {
    console.error('Development mode - continuing execution');
  }
});

// Graceful shutdown function
const gracefulShutdown = () => {
  console.log('⚡ Initiating graceful shutdown...');
  
  const shutdownTimeout = setTimeout(() => {
    console.error('❌ Forceful shutdown initiated after timeout');
    process.exit(1);
  }, 10000);

  io.close(() => {
    console.log('🔌 Socket.IO server closed.');
    server.close(() => {
      console.log('🚪 HTTP server closed.');
      clearTimeout(shutdownTimeout);
      process.exit(0);
    });
  });
};

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Export for testing
module.exports = { 
  io, 
  server, 
  activeConnections, 
  chatSessions,
  processedSubmissions,
  notifyAdmins, 
  notifyAgent 
};