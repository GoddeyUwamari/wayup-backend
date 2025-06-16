// routes/chatRoutes.js - FINAL FIXED VERSION (No Duplicate Errors)
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// Import models for chat widget - with error handling
let ChatMessage, Contact;

try {
  ChatMessage = require('../models/chatModel');
  Contact = require('../models/contactModel');
  console.log('✅ Chat models imported successfully');
  console.log('ChatMessage type:', typeof ChatMessage);
  console.log('ChatMessage.updateMany exists:', typeof ChatMessage.updateMany === 'function');
} catch (error) {
  console.error('❌ Failed to import chat models:', error);
  throw error;
}

// Logging middleware for chat widget
router.use((req, res, next) => {
  console.log(`💬 Chat Widget route accessed: ${req.method} ${req.path}`);
  console.log(`💬 Request from: ${req.ip}`);
  
  // Validate chat widget session for applicable routes
  if (req.params.sessionId && !req.params.sessionId.startsWith('chat_')) {
    console.log(`❌ Invalid chat widget session ID: ${req.params.sessionId}`);
    return res.status(400).json({
      success: false,
      error: 'Invalid chat widget session ID',
      details: 'Session ID must start with "chat_"',
      received: req.params.sessionId
    });
  }
  
  next();
});

// ======================
// CHAT WIDGET ENDPOINTS ONLY
// ======================

// Send chat message - IMPLEMENTED DIRECTLY
router.post('/send', async (req, res) => {
  console.log('💬 Chat message request received');
  console.log('💬 Session ID:', req.body.sessionId);
  console.log('💬 Message type:', req.body.messageType || 'user');
  
  try {
    const { sessionId, message, sender, messageType = 'user' } = req.body;
    
    // Validate required fields
    if (!sessionId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sessionId and message'
      });
    }
    
    // Validate chat widget session
    if (!sessionId.startsWith('chat_')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid chat widget session ID',
        details: 'Session ID must start with "chat_"'
      });
    }
    
    // Validate ChatMessage model
    if (!ChatMessage || typeof ChatMessage.create !== 'function') {
      return res.status(500).json({
        success: false,
        error: 'Database model not available'
      });
    }
    
    // Create chat message
    const chatMessage = await ChatMessage.create({
      sessionId: sessionId,
      message: message.trim(),
      sender: sender || 'User',
      messageType: messageType,
      source: 'chat_widget'
    });
    
    console.log(`✅ Chat message saved: ${chatMessage._id}`);
    
    // Send real-time notification via Socket.IO
    try {
      if (global.io) {
        global.io.to(`session_${sessionId}`).emit('chat message', {
          id: chatMessage._id,
          message: message,
          sender: sender || 'User',
          timestamp: chatMessage.createdAt,
          messageType: messageType,
          sessionId: sessionId,
          source: 'chat_widget'
        });
        console.log(`📡 Socket.IO notification sent for chat session: ${sessionId}`);
      }
    } catch (socketError) {
      console.error('⚠️ Socket.IO notification failed (non-critical):', socketError.message);
    }
    
    res.json({
      success: true,
      message: 'Chat message sent successfully',
      data: {
        messageId: chatMessage._id,
        sessionId: sessionId,
        timestamp: chatMessage.createdAt,
        source: 'chat_widget'
      }
    });
    
  } catch (error) {
    console.error('❌ Error sending chat message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send chat message',
      details: error.message,
      source: 'chat_widget'
    });
  }
});

// FIXED Submit client data - NO MORE DUPLICATE ERRORS
router.post('/client-data', async (req, res) => {
  console.log('💬 Processing client data submission...');
  console.log('💬 Full request body:', JSON.stringify(req.body, null, 2));
  
  try {
    // Validate Contact model first
    if (!Contact || typeof Contact.create !== 'function') {
      console.error('❌ Contact model not loaded');
      return res.status(500).json({
        success: false,
        error: 'Database model not available',
        details: 'Contact model failed to load'
      });
    }
    
    const { sessionId, type } = req.body;
    
    // Extract client data (handle both nested and flat structures)
    let { name, email, phone, company, projectType, description } = req.body;
    
    // Handle nested clientData structure
    if (req.body.clientData) {
      const clientData = req.body.clientData;
      name = name || clientData.name;
      email = email || clientData.email;
      phone = phone || clientData.phone;
      company = company || clientData.company;
      projectType = projectType || clientData.projectType;
      description = description || clientData.description;
    }
    
    console.log('💬 Extracted data:', { sessionId, type, name, email, phone, company, projectType, description });
    
    // Validate required fields
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: sessionId'
      });
    }
    
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name and email',
        received: { name: !!name, email: !!email }
      });
    }
    
    // Validate session format
    if (!sessionId.startsWith('chat_')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID format',
        details: 'Session ID must start with "chat_"'
      });
    }
    
    // Check for existing contact FIRST - PREVENT DUPLICATES GRACEFULLY
    let existingContact = await Contact.findOne({ 
      sessionId: sessionId,
      source: 'chat_widget'
    });
    
    // If contact exists, UPDATE instead of creating duplicate or throwing error
    if (existingContact) {
      console.log(`💬 Found existing contact for session ${sessionId}, updating...`);
      
      // Update existing contact with new data
      const contactData = {
        sessionId: sessionId,
        name: name,
        email: email,
        phone: phone || '',
        company: company || '',
        projectType: projectType || '',
        description: description || '',
        source: 'chat_widget',
        type: 'chat_client_data',
        status: 'active',
        updatedAt: new Date()
      };
      
      const updatedContact = await Contact.findByIdAndUpdate(
        existingContact._id,
        contactData,
        { new: true }
      );
      
      console.log(`✅ Updated existing contact: ${updatedContact._id}`);
      
      // Send success response (NOT an error) - FIXED!
      return res.json({
        success: true,
        message: 'Client data updated successfully',
        data: {
          contactId: updatedContact._id,
          sessionId: sessionId,
          source: 'chat_widget',
          action: 'updated'
        }
      });
    }
    
    // Create NEW contact if none exists
    const contactData = {
      sessionId: sessionId,
      name: name,
      email: email,
      phone: phone || '',
      company: company || '',
      projectType: projectType || '',
      description: description || '',
      source: 'chat_widget',
      type: 'chat_client_data',
      status: 'active'
    };
    
    const newContact = await Contact.create(contactData);
    console.log(`✅ Created new contact: ${newContact._id}`);
    
    // REMOVED Socket.IO notification to prevent duplicate messages
    
    res.json({
      success: true,
      message: 'Client data submitted successfully',
      data: {
        contactId: newContact._id,
        sessionId: sessionId,
        source: 'chat_widget',
        action: 'created'
      }
    });
    
  } catch (error) {
    console.error('❌ Error submitting client data:', error);
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      error: 'Failed to submit client data',
      details: error.message,
      source: 'chat_widget'
    });
  }
});

// Get chat history - IMPLEMENTED DIRECTLY
router.get('/history/:sessionId', async (req, res) => {
  console.log('💬 Fetching chat history for session:', req.params.sessionId);
  
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    // Validate ChatMessage model
    if (!ChatMessage || typeof ChatMessage.find !== 'function') {
      return res.status(500).json({
        success: false,
        error: 'Database model not available'
      });
    }
    
    // Get chat history for this session
    const messages = await ChatMessage.find({
      sessionId: sessionId,
      source: 'chat_widget',
      status: { $ne: 'deleted' }
    })
    .sort({ createdAt: 1 })
    .limit(limit);
    
    console.log(`✅ Retrieved ${messages.length} chat messages for session: ${sessionId}`);
    
    res.json({
      success: true,
      data: messages,
      count: messages.length,
      sessionId: sessionId,
      source: 'chat_widget'
    });
    
  } catch (error) {
    console.error('❌ Error fetching chat history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat history',
      details: error.message,
      source: 'chat_widget'
    });
  }
});

// Get all chat sessions - IMPLEMENTED DIRECTLY
router.get('/sessions', async (req, res) => {
  console.log('💬 Fetching all chat widget sessions');
  
  try {
    // Validate ChatMessage model
    if (!ChatMessage || typeof ChatMessage.aggregate !== 'function') {
      return res.status(500).json({
        success: false,
        error: 'Database model not available'
      });
    }
    
    // Get all chat widget sessions
    const sessions = await ChatMessage.aggregate([
      { $match: { source: 'chat_widget' } },
      {
        $group: {
          _id: '$sessionId',
          messageCount: { $sum: 1 },
          lastActivity: { $max: '$createdAt' },
          firstMessage: { $min: '$createdAt' },
          unreadCount: {
            $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
          }
        }
      },
      { $sort: { lastActivity: -1 } }
    ]);
    
    console.log(`✅ Retrieved ${sessions.length} chat widget sessions`);
    
    res.json({
      success: true,
      data: sessions,
      count: sessions.length,
      source: 'chat_widget'
    });
    
  } catch (error) {
    console.error('❌ Error fetching chat sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat sessions',
      details: error.message,
      source: 'chat_widget'
    });
  }
});

// Get chat statistics - IMPLEMENTED DIRECTLY
router.get('/stats', async (req, res) => {
  console.log('💬 Generating chat widget statistics');
  
  try {
    // Validate models
    if (!ChatMessage || !Contact) {
      return res.status(500).json({
        success: false,
        error: 'Database models not available'
      });
    }
    
    // Get chat widget statistics
    const stats = {
      messages: {
        total: await ChatMessage.countDocuments({ source: 'chat_widget' }),
        unread: await ChatMessage.countDocuments({ 
          source: 'chat_widget', 
          isRead: false,
          messageType: 'user'
        }),
        today: await ChatMessage.countDocuments({
          source: 'chat_widget',
          createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) }
        })
      },
      contacts: {
        total: await Contact.countDocuments({ source: 'chat_widget' }),
        active: await Contact.countDocuments({ 
          source: 'chat_widget', 
          status: 'active' 
        }),
        today: await Contact.countDocuments({
          source: 'chat_widget',
          createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) }
        })
      },
      sessions: {
        active: await ChatMessage.distinct('sessionId', {
          source: 'chat_widget',
          createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) }
        }).then(sessions => sessions.length)
      }
    };
    
    console.log('✅ Generated chat widget statistics');
    
    res.json({
      success: true,
      data: stats,
      source: 'chat_widget',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error generating chat statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate chat statistics',
      details: error.message,
      source: 'chat_widget'
    });
  }
});

// Mark chat messages as read - ALREADY IMPLEMENTED
router.put('/read/:sessionId', async (req, res) => {
  console.log(`💬 Mark as read request for session: ${req.params.sessionId}`);
  
  try {
    const { sessionId } = req.params;
    
    // Validate ChatMessage model
    if (!ChatMessage || typeof ChatMessage.updateMany !== 'function') {
      console.error('❌ ChatMessage model not properly loaded');
      return res.status(500).json({
        success: false,
        error: 'Database model not available',
        details: 'ChatMessage model not properly initialized'
      });
    }
    
    // Check database connection
    if (mongoose.connection.readyState !== 1) {
      console.error('❌ Database not connected');
      return res.status(500).json({
        success: false,
        error: 'Database connection error',
        details: 'MongoDB connection not active'
      });
    }
    
    console.log('✅ About to call ChatMessage.updateMany...');
    
    // Update only chat widget messages
    const result = await ChatMessage.updateMany(
      { 
        sessionId: sessionId,
        source: 'chat_widget',
        isRead: { $ne: true }
      },
      { 
        isRead: true,
        readAt: new Date()
      }
    );
    
    console.log(`✅ Marked ${result.modifiedCount} chat widget messages as read`);
    
    res.json({
      success: true,
      message: `Marked ${result.modifiedCount} chat widget messages as read`,
      sessionId: sessionId,
      updatedCount: result.modifiedCount,
      source: 'chat_widget'
    });
    
  } catch (error) {
    console.error('❌ Error marking chat messages as read:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to mark chat messages as read',
      details: error.message,
      source: 'chat_widget'
    });
  }
});

// Close chat session - ALREADY IMPLEMENTED
router.put('/close/:sessionId', async (req, res) => {
  console.log(`💬 Close session request for: ${req.params.sessionId}`);
  
  try {
    const { sessionId } = req.params;
    const { reason = 'Session ended' } = req.body;
    
    // Validate models
    if (!Contact || !ChatMessage) {
      return res.status(500).json({
        success: false,
        error: 'Database models not available'
      });
    }
    
    // Update only chat widget contact
    const contact = await Contact.findOneAndUpdate(
      { 
        sessionId: sessionId,
        source: 'chat_widget'
      },
      { 
        status: 'closed',
        closedAt: new Date(),
        closeReason: reason
      },
      { new: true }
    );
    
    // Also mark all messages in this session as closed
    const messageUpdate = await ChatMessage.updateMany(
      { 
        sessionId: sessionId,
        source: 'chat_widget'
      },
      { 
        status: 'closed'
      }
    );
    
    console.log(`✅ Chat widget session closed: ${sessionId}`);
    console.log(`✅ Updated ${messageUpdate.modifiedCount} messages`);
    
    res.json({
      success: true,
      message: 'Chat widget session closed successfully',
      sessionId: sessionId,
      contactUpdated: !!contact,
      messagesUpdated: messageUpdate.modifiedCount,
      source: 'chat_widget'
    });
    
  } catch (error) {
    console.error('❌ Error closing chat session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to close chat session',
      details: error.message,
      source: 'chat_widget'
    });
  }
});

// Send agent response - ALREADY IMPLEMENTED
router.post('/agent-response', async (req, res) => {
  console.log(`💬 Agent response request`);
  
  try {
    const { sessionId, message, agentName = 'Support Agent', agentId } = req.body;
    
    if (!sessionId || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sessionId and message'
      });
    }
    
    // Validate chat widget session
    if (!sessionId.startsWith('chat_')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid chat widget session ID',
        details: 'Session ID must start with "chat_"'
      });
    }
    
    // Validate ChatMessage model
    if (!ChatMessage || typeof ChatMessage.create !== 'function') {
      return res.status(500).json({
        success: false,
        error: 'Database model not available'
      });
    }
    
    // Save agent message to chat widget messages
    const agentMessage = await ChatMessage.create({
      sessionId: sessionId,
      message: message,
      sender: agentName,
      messageType: 'agent',
      source: 'chat_widget',
      assignedAgent: agentId || null,
      isRead: true
    });
    
    console.log(`✅ Agent response saved: ${agentMessage._id}`);
    
    // Send real-time notification via Socket.IO
    try {
      if (global.io) {
        global.io.to(`session_${sessionId}`).emit('chat message', {
          id: agentMessage._id,
          message: message,
          sender: agentName,
          timestamp: agentMessage.createdAt,
          messageType: 'agent',
          sessionId: sessionId,
          source: 'chat_widget'
        });
        console.log(`📡 Socket.IO notification sent for chat session: ${sessionId}`);
      }
    } catch (socketError) {
      console.error('⚠️ Socket.IO notification failed (non-critical):', socketError.message);
    }
    
    res.json({
      success: true,
      message: 'Agent response sent successfully',
      data: {
        messageId: agentMessage._id,
        sessionId: sessionId,
        timestamp: agentMessage.createdAt,
        source: 'chat_widget'
      }
    });
    
  } catch (error) {
    console.error('❌ Error sending agent response:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send agent response',
      details: error.message,
      source: 'chat_widget'
    });
  }
});

// Schedule call from chat widget - ALREADY IMPLEMENTED
router.post('/schedule-call', async (req, res) => {
  console.log(`💬 Schedule call request from chat widget`);
  
  try {
    const { sessionId, clientData, preferredTime, notes } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: sessionId'
      });
    }
    
    // Validate chat widget session
    if (!sessionId.startsWith('chat_')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid chat widget session ID',
        details: 'Session ID must start with "chat_"'
      });
    }
    
    // Validate Contact model
    if (!Contact) {
      return res.status(500).json({
        success: false,
        error: 'Database model not available'
      });
    }
    
    // Find or create chat widget contact
    let contact = await Contact.findOne({ 
      sessionId: sessionId,
      source: 'chat_widget'
    });
    
    if (contact) {
      // Update existing chat widget contact
      contact = await Contact.findByIdAndUpdate(
        contact._id,
        {
          callRequested: true,
          preferredCallTime: preferredTime,
          callNotes: notes,
          status: 'call_requested',
          updatedAt: new Date()
        },
        { new: true }
      );
      console.log(`✅ Updated existing chat widget contact for call: ${contact._id}`);
    } else if (clientData) {
      // Create new chat widget contact
      contact = await Contact.create({
        sessionId: sessionId,
        name: clientData.name,
        email: clientData.email,
        phone: clientData.phone,
        company: clientData.company,
        projectType: clientData.projectType,
        description: clientData.description,
        source: 'chat_widget',
        type: 'chat_call_request',
        status: 'call_requested',
        callRequested: true,
        preferredCallTime: preferredTime,
        callNotes: notes
      });
      console.log(`✅ Created new chat widget contact for call: ${contact._id}`);
    } else {
      return res.status(400).json({
        success: false,
        error: 'No existing chat widget contact found and no client data provided'
      });
    }
    
    res.json({
      success: true,
      message: 'Call scheduled successfully from chat widget',
      data: {
        contactId: contact._id,
        sessionId: sessionId,
        preferredTime: preferredTime,
        source: 'chat_widget'
      }
    });
    
  } catch (error) {
    console.error('❌ Error scheduling call from chat widget:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule call from chat widget',
      details: error.message,
      source: 'chat_widget'
    });
  }
});

// ======================
// SYSTEM INFO ENDPOINTS
// ======================

// Health check for chat widget system
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    system: 'Chat Widget',
    status: 'healthy',
    method: 'HTTP + Socket.IO',
    sessionPrefix: 'chat_',
    sourceType: 'chat_widget',
    timestamp: new Date().toISOString(),
    database: {
      connected: mongoose.connection.readyState === 1,
      state: mongoose.connection.readyState
    },
    models: {
      ChatMessage: !!ChatMessage && typeof ChatMessage.updateMany === 'function',
      Contact: !!Contact && typeof Contact.findOne === 'function'
    },
    features: {
      realTimeMessaging: true,
      clientDataCollection: true,
      agentResponses: true,
      callScheduling: true,
      sessionManagement: true,
      socketIO: !!global.io
    }
  });
});

// Main info route
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Chat Widget API Routes',
    system: 'chat_widget',
    method: 'HTTP + Socket.IO real-time',
    sessionPrefix: 'chat_',
    sourceType: 'chat_widget',
    routes: {
      messaging: [
        'POST /send - Send chat message',
        'POST /agent-response - Send agent response',
        'PUT /read/:sessionId - Mark messages as read'
      ],
      clientData: [
        'POST /client-data - Submit client data',
        'POST /schedule-call - Schedule call from chat'
      ],
      management: [
        'GET /history/:sessionId - Get chat history',
        'GET /sessions - Get all chat sessions',
        'GET /stats - Get chat statistics',
        'PUT /close/:sessionId - Close chat session'
      ],
      system: [
        'GET /health - System health check',
        'GET /debug/test - Debug functionality'
      ]
    },
    note: 'This API only handles chat widget functionality (no contact form endpoints)',
    contactFormsNote: 'For contact forms, use /api/contact/* endpoints',
    timestamp: new Date().toISOString()
  });
});

// Debug route - Enhanced
router.get('/debug/test', async (req, res) => {
  try {
    const testResults = {
      models: {
        ChatMessage: {
          loaded: !!ChatMessage,
          type: typeof ChatMessage,
          hasUpdateMany: typeof ChatMessage?.updateMany === 'function',
          hasCreate: typeof ChatMessage?.create === 'function'
        },
        Contact: {
          loaded: !!Contact,
          type: typeof Contact,
          hasFind: typeof Contact?.findOne === 'function'
        }
      },
      database: {
        connection: mongoose.connection.readyState,
        states: {
          0: 'disconnected',
          1: 'connected', 
          2: 'connecting',
          3: 'disconnecting'
        }
      },
      socketIO: !!global.io,
      timestamp: new Date().toISOString()
    };
    
    // Test database connectivity
    try {
      if (ChatMessage && typeof ChatMessage.countDocuments === 'function') {
        const chatMessageCount = await ChatMessage.countDocuments({ source: 'chat_widget' });
        const chatContactCount = await Contact.countDocuments({ source: 'chat_widget' });
        
        testResults.database.connected = true;
        testResults.database.chatMessages = chatMessageCount;
        testResults.database.chatContacts = chatContactCount;
      }
    } catch (dbError) {
      testResults.database.connected = false;
      testResults.database.error = dbError.message;
    }
    
    res.json({
      success: true,
      message: 'Chat widget debug test completed',
      results: testResults,
      system: 'chat_widget'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Chat widget debug test failed',
      details: error.message,
      system: 'chat_widget'
    });
  }
});

// ======================
// ERROR HANDLING
// ======================

// 404 handler for chat widget routes
router.use('*', (req, res) => {
  console.log(`💬 Chat widget route not found: ${req.method} ${req.originalUrl}`);
  
  res.status(404).json({
    success: false,
    error: 'Chat widget endpoint not found',
    requestedRoute: `${req.method} ${req.originalUrl}`,
    availableEndpoints: {
      messaging: [
        'POST /api/chat/send',
        'POST /api/chat/agent-response',
        'PUT /api/chat/read/:sessionId'
      ],
      clientData: [
        'POST /api/chat/client-data',
        'POST /api/chat/schedule-call'
      ],
      management: [
        'GET /api/chat/history/:sessionId',
        'GET /api/chat/sessions',
        'GET /api/chat/stats',
        'PUT /api/chat/close/:sessionId'
      ],
      system: [
        'GET /api/chat/health',
        'GET /api/chat/debug/test'
      ]
    },
    note: 'This API only handles chat widget functionality (no contact form endpoints)',
    contactFormsNote: 'For contact forms, use /api/contact/* endpoints'
  });
});

module.exports = router;