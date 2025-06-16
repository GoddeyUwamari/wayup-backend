// controllers/chatController.js - FIXED VERSION
const Contact = require('../models/contactModel');
const ChatMessage = require('../models/chatModel');

// Chat widget session storage (use your actual chat database)
let chatSessions = new Map();
let chatMessages = new Map();

// ======================
// CHAT WIDGET PROCESSING FUNCTIONS - FIXED
// ======================

const processChatMessage = async (data) => {
  try {
    console.log('=== PROCESSING CHAT WIDGET MESSAGE ===');
    
    const { sessionId, message, sender, messageType = 'user' } = data;
    
    // Basic validation
    if (!message || !message.trim()) {
      return { success: false, error: 'Message is required' };
    }
    
    if (!sessionId || !sessionId.startsWith('chat_')) {
      return { success: false, error: 'Invalid chat widget session ID' };
    }
    
    const messageData = {
      sessionId,
      message: message.trim(),
      sender: sender || 'User',
      messageType: messageType,
      source: 'chat_widget'
    };
    
    // Store message in memory for fallback
    if (!chatMessages.has(sessionId)) {
      chatMessages.set(sessionId, []);
    }
    
    const memoryMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...messageData,
      timestamp: new Date()
    };
    
    chatMessages.get(sessionId).push(memoryMessage);
    
    // Update session activity
    if (chatSessions.has(sessionId)) {
      const session = chatSessions.get(sessionId);
      session.lastActivity = new Date();
      chatSessions.set(sessionId, session);
    }
    
    // FIXED: Actually save to ChatMessage model
    try {
      console.log('💾 Saving chat message to database...');
      const savedMessage = await ChatMessage.create(messageData);
      console.log('✅ Chat message saved to database:', savedMessage._id);
      
      // Send real-time notification via Socket.IO
      if (global.io) {
        global.io.to(`session_${sessionId}`).emit('chat message', {
          id: savedMessage._id,
          sessionId: sessionId,
          message: message,
          sender: sender || 'User',
          messageType: messageType,
          timestamp: savedMessage.createdAt,
          source: 'chat_widget'
        });
        console.log(`📡 Socket.IO notification sent for session: ${sessionId}`);
      }
      
      return {
        success: true,
        sessionId: sessionId,
        message: 'Chat message processed successfully',
        data: {
          messageId: savedMessage._id,
          sessionId: sessionId,
          timestamp: savedMessage.createdAt,
          source: 'chat_widget'
        }
      };
      
    } catch (dbError) {
      console.error('❌ Failed to save chat message to database:', dbError);
      
      // Return success for memory storage even if DB save fails
      return {
        success: true,
        sessionId: sessionId,
        message: 'Chat message processed (memory only - DB save failed)',
        warning: 'Message saved to memory but not database',
        data: memoryMessage
      };
    }
    
  } catch (error) {
    console.error('❌ PROCESS CHAT MESSAGE ERROR:', error);
    throw error;
  }
};

const processChatClientData = async (data) => {
  try {
    console.log('=== PROCESSING CHAT WIDGET CLIENT DATA ===');
    
    const { sessionId, clientData, type } = data;
    
    // Validate session ID format
    if (!sessionId || !sessionId.startsWith('chat_')) {
      return { success: false, error: 'Invalid chat widget session ID' };
    }
    
    // Validate type
    if (type !== 'chat_client_data') {
      return { success: false, error: 'Invalid data type for chat widget' };
    }
    
    const {
      name, email, phone, company, website, projectType,
      budget, timeline, description, priority = 'normal'
    } = clientData;

    // Basic validation
    if (!name || !name.trim()) {
      return { success: false, error: 'Name is required' };
    }
    if (!email || !email.trim()) {
      return { success: false, error: 'Email is required' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return { success: false, error: 'Invalid email format' };
    }

    // Store chat session data
    const chatSessionData = {
      sessionId: sessionId,
      clientData: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone || '',
        company: company || '',
        projectType: projectType || 'General Inquiry',
        budget: budget || '',
        timeline: timeline || '',
        description: description || ''
      },
      source: 'chat_widget',
      type: 'chat_client_data',
      status: 'active',
      startTime: new Date(),
      lastActivity: new Date()
    };

    // Store in chat session storage
    chatSessions.set(sessionId, chatSessionData);
    console.log('💬 Chat session created:', sessionId);

    // Save to contacts collection with chat_widget source
    try {
      console.log('💾 Saving chat client data to contacts collection...');
      
      const contactData = {
        sessionId: sessionId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone || '',
        company: company || '',
        website: website || '',
        projectType: projectType || 'General Inquiry',
        budget: budget || '',
        timeline: timeline || '',
        description: description || '',
        source: 'chat_widget', // KEY: This identifies it as chat widget data
        type: 'chat_client_data',
        priority: priority || 'normal',
        status: 'new'
      };

      // Check if contact already exists with this email AND is from chat widget
      let existingContact = await Contact.findOne({ 
        email: email.toLowerCase().trim(),
        source: 'chat_widget' // Only look for existing chat widget contacts
      });

      let savedContact;
      
      if (existingContact) {
        console.log('💬 Existing chat widget contact found, updating...');
        
        // Update existing chat widget contact
        Object.assign(existingContact, {
          ...contactData,
          lastContactDate: new Date()
        });
        
        savedContact = await existingContact.save();
        console.log('✅ Existing chat widget contact updated:', savedContact._id);
        
      } else {
        console.log('💬 Creating new chat widget contact...');
        
        const newContact = new Contact(contactData);
        savedContact = await newContact.save();
        console.log('✅ New chat widget contact created:', savedContact._id);
      }

      console.log('📝 Contact saved with source:', savedContact.source);
      console.log('📝 Contact type:', savedContact.type);

      return {
        success: true,
        sessionId: sessionId,
        message: 'Chat client data saved successfully!',
        contact: {
          _id: savedContact._id,
          source: savedContact.source,
          type: savedContact.type,
          isExisting: !!existingContact
        }
      };

    } catch (contactError) {
      console.error('❌ Failed to save chat widget contact:', contactError);
      
      // Return success for chat session even if contact save fails
      return {
        success: true,
        sessionId: sessionId,
        message: 'Chat session started but contact save failed',
        warning: 'Contact data could not be saved to database'
      };
    }

  } catch (error) {
    console.error('❌ PROCESS CHAT CLIENT DATA ERROR:', error);
    throw error;
  }
};

const processChatCallRequest = async (data) => {
  try {
    console.log('=== PROCESSING CHAT WIDGET CALL REQUEST ===');
    
    const { sessionId, clientData, preferredTime, notes } = data;
    
    // Validate session ID
    if (!sessionId || !sessionId.startsWith('chat_')) {
      return { success: false, error: 'Invalid chat widget session ID' };
    }
    
    const callData = {
      id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: sessionId,
      clientData: clientData,
      preferredTime: preferredTime,
      notes: notes || '',
      source: 'chat_widget',
      status: 'requested',
      createdAt: new Date()
    };

    console.log('💬 Chat widget call request:', callData);
    
    // Try to update the contact record with call request info
    try {
      const contact = await Contact.findOne({ 
        sessionId: sessionId,
        source: 'chat_widget'
      });
      
      if (contact) {
        contact.callRequested = true;
        contact.preferredCallTime = preferredTime;
        contact.callNotes = notes;
        contact.status = 'call_requested';
        await contact.save();
        console.log('✅ Chat widget contact updated with call request');
      }
    } catch (updateError) {
      console.error('⚠️ Could not update contact with call request:', updateError);
    }
    
    return {
      success: true,
      sessionId: sessionId,
      message: 'Call request from chat widget processed successfully',
      callData: callData
    };
    
  } catch (error) {
    console.error('❌ PROCESS CHAT CALL REQUEST ERROR:', error);
    throw error;
  }
};

// ======================
// SOCKET.IO HANDLERS (Chat Widget Only)
// ======================

const handleSocketMessage = async (socket, data) => {
  try {
    console.log('=== CHAT WIDGET MESSAGE DEBUG ===');
    console.log('💬 Raw socket message data:', JSON.stringify(data, null, 2));
    console.log('💬 Socket ID:', socket.id);
    console.log('💬 Session ID:', data.sessionId);
    
    // Validate this is a chat widget message
    if (!data.sessionId || !data.sessionId.startsWith('chat_')) {
      console.log('❌ Invalid session ID for chat widget:', data.sessionId);
      socket.emit('message error', {
        success: false,
        error: 'Invalid chat widget session ID',
        sessionId: data.sessionId
      });
      return;
    }
    
    const result = await processChatMessage({
      ...data,
      socketId: socket.id
    });
    
    console.log('✅ Chat message processed:', result);
    socket.emit('message received', result);
    
  } catch (error) {
    console.error('❌ SOCKET CHAT MESSAGE ERROR:', error);
    socket.emit('message error', { 
      success: false, 
      error: 'Failed to process message',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const handleSocketClientData = async (socket, data) => {
  try {
    console.log('=== CHAT WIDGET CLIENT DATA DEBUG ===');
    console.log('💬 Raw socket client data:', JSON.stringify(data, null, 2));
    console.log('💬 Socket ID:', socket.id);
    console.log('💬 Session ID:', data.sessionId);
    
    // Validate this is chat widget data
    if (!data.sessionId || !data.sessionId.startsWith('chat_')) {
      console.log('❌ Invalid session ID for chat widget:', data.sessionId);
      socket.emit('client data received', {
        success: false,
        error: 'Invalid chat widget session ID',
        sessionId: data.sessionId
      });
      return;
    }
    
    const result = await processChatClientData({
      ...data,
      socketId: socket.id
    });
    
    console.log('✅ Chat client data processed:', result);
    socket.emit('client data received', result);
    
  } catch (error) {
    console.error('❌ SOCKET CLIENT DATA ERROR:', error);
    socket.emit('client data received', { 
      success: false, 
      error: 'Failed to save chat client data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const handleSocketScheduleCall = async (socket, data) => {
  try {
    console.log('=== CHAT WIDGET CALL SCHEDULING DEBUG ===');
    console.log('💬 Call request data:', JSON.stringify(data, null, 2));
    console.log('💬 Session ID:', data.sessionId);
    
    // Validate this is a chat widget call request
    if (!data.sessionId || !data.sessionId.startsWith('chat_')) {
      console.log('❌ Invalid session ID for chat widget call:', data.sessionId);
      socket.emit('call scheduled', {
        success: false,
        error: 'Invalid chat widget session ID',
        sessionId: data.sessionId
      });
      return;
    }
    
    const result = await processChatCallRequest({
      ...data,
      socketId: socket.id
    });
    
    console.log('✅ Chat call request processed:', result);
    socket.emit('call scheduled', result);
    
  } catch (error) {
    console.error('❌ SOCKET CALL SCHEDULING ERROR:', error);
    socket.emit('call scheduled', { 
      success: false, 
      error: 'Failed to schedule call from chat',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ======================
// HTTP ROUTE HANDLERS (Chat Widget Only)
// ======================

const sendChatMessage = async (req, res) => {
  try {
    console.log('💬 HTTP Chat message request:', req.body);
    
    // Validate this is a chat widget request
    const { sessionId } = req.body;
    if (!sessionId || !sessionId.startsWith('chat_')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid chat widget session ID',
        expected: 'Session ID must start with "chat_"',
        received: sessionId
      });
    }
    
    const result = await processChatMessage(req.body);
    res.json(result);
    
  } catch (error) {
    console.error('❌ Send chat message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send chat message',
      source: 'chat_widget'
    });
  }
};

const handleClientData = async (req, res) => {
  try {
    console.log('💬 HTTP Chat client data request:', req.body);
    
    // Validate this is a chat widget request
    const { sessionId, type } = req.body;
    if (!sessionId || !sessionId.startsWith('chat_')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid chat widget session ID',
        expected: 'Session ID must start with "chat_"',
        received: sessionId
      });
    }
    
    if (type !== 'chat_client_data') {
      return res.status(400).json({
        success: false,
        error: 'Invalid data type for chat widget',
        expected: 'chat_client_data',
        received: type
      });
    }
    
    const result = await processChatClientData(req.body);
    res.json(result);
    
  } catch (error) {
    console.error('❌ Handle chat client data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat client data',
      source: 'chat_widget'
    });
  }
};

const getChatHistory = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 50 } = req.query;
    
    // Validate chat widget session
    if (!sessionId || !sessionId.startsWith('chat_')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid chat widget session ID'
      });
    }
    
    // Try to get from database first
    let messages = [];
    let session = null;
    
    try {
      if (ChatMessage && typeof ChatMessage.getChatHistory === 'function') {
        messages = await ChatMessage.getChatHistory(sessionId, parseInt(limit));
        console.log(`💬 Retrieved ${messages.length} messages from database for session: ${sessionId}`);
      }
    } catch (dbError) {
      console.error('⚠️ Failed to get messages from database:', dbError);
    }
    
    // Fallback to memory storage
    if (messages.length === 0) {
      messages = chatMessages.get(sessionId) || [];
      console.log(`💬 Retrieved ${messages.length} messages from memory for session: ${sessionId}`);
    }
    
    session = chatSessions.get(sessionId) || null;
    
    res.json({
      success: true,
      sessionId,
      session,
      messages,
      count: messages.length,
      source: 'chat_widget'
    });
    
  } catch (error) {
    console.error('❌ Get chat history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chat history',
      source: 'chat_widget'
    });
  }
};

const getAllChatSessions = async (req, res) => {
  try {
    // Try to get from database first
    let sessions = [];
    
    try {
      if (ChatMessage && typeof ChatMessage.getAllChatWidgetSessions === 'function') {
        const dbSessions = await ChatMessage.getAllChatWidgetSessions();
        sessions = dbSessions;
        console.log(`💬 Retrieved ${sessions.length} sessions from database`);
      }
    } catch (dbError) {
      console.error('⚠️ Failed to get sessions from database:', dbError);
    }
    
    // Fallback to memory storage
    if (sessions.length === 0) {
      sessions = Array.from(chatSessions.values())
        .filter(session => session.source === 'chat_widget');
      console.log(`💬 Retrieved ${sessions.length} sessions from memory`);
    }
    
    res.json({
      success: true,
      sessions,
      count: sessions.length,
      source: 'chat_widget',
      message: 'Chat widget sessions only (no contact form data)'
    });
    
  } catch (error) {
    console.error('❌ Get chat sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chat sessions',
      source: 'chat_widget'
    });
  }
};

const getChatStats = async (req, res) => {
  try {
    let stats = {
      totalSessions: 0,
      activeSessions: 0,
      totalMessages: 0,
      avgMessagesPerSession: 0
    };
    
    // Try to get from database first
    try {
      if (ChatMessage && Contact) {
        const totalSessions = await Contact.countDocuments({ source: 'chat_widget' });
        const activeSessions = await Contact.countDocuments({ 
          source: 'chat_widget', 
          status: 'active' 
        });
        const totalMessages = await ChatMessage.countDocuments({ source: 'chat_widget' });
        
        stats = {
          totalSessions,
          activeSessions,
          totalMessages,
          avgMessagesPerSession: totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0
        };
        
        console.log('💬 Generated chat widget statistics from database');
      }
    } catch (dbError) {
      console.error('⚠️ Failed to get stats from database:', dbError);
      
      // Fallback to memory storage
      const chatWidgetSessions = Array.from(chatSessions.values())
        .filter(session => session.source === 'chat_widget');
      
      const totalSessions = chatWidgetSessions.length;
      const activeSessions = chatWidgetSessions
        .filter(session => session.status === 'active').length;
      
      const allMessages = Array.from(chatMessages.values()).flat();
      const totalMessages = allMessages.length;
      
      stats = {
        totalSessions,
        activeSessions,
        totalMessages,
        avgMessagesPerSession: totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0
      };
      
      console.log('💬 Generated chat widget statistics from memory');
    }
    
    res.json({
      success: true,
      stats,
      source: 'chat_widget',
      message: 'Chat widget statistics only',
      timestamp: new Date()
    });
    
  } catch (error) {
    console.error('❌ Get chat stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get chat statistics',
      source: 'chat_widget'
    });
  }
};

// Export all functions for routes and Socket.IO
module.exports = {
  // Socket.IO handlers (for real-time chat)
  handleSocketMessage,
  handleSocketClientData,
  handleSocketScheduleCall,
  
  // Processing functions
  processChatMessage,
  processChatClientData,
  processChatCallRequest,
  
  // HTTP route handlers (for API fallbacks)
  sendChatMessage,
  handleClientData,
  getChatHistory,
  getAllChatSessions,
  getChatStats
};