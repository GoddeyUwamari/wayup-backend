// models/chatModel.js - CHAT WIDGET MESSAGES ONLY (CLEAN SEPARATION)
const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  // Core message content
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  
  // Sender information
  sender: {
    type: String,
    required: true,
    trim: true,
    default: 'User'
  },
  
  senderEmail: {
    type: String,
    trim: true,
    lowercase: true,
    default: null
  },
  
  // Message classification (chat widget only)
  messageType: {
    type: String,
    enum: ['user', 'agent', 'system'],
    default: 'user',
    required: true
  },
  
  // Session management (chat widget only - must start with 'chat_')
  sessionId: {
    type: String,
    required: true,
    index: true,
    validate: {
      validator: function(v) {
        return v && v.startsWith('chat_');
      },
      message: 'Session ID must start with "chat_" for chat widget messages'
    }
  },
  
  // Source tracking (ONLY chat_widget for this model)
  source: {
    type: String,
    enum: ['chat_widget'],
    default: 'chat_widget',
    required: true,
    immutable: true
  },
  
  // Message status
  status: {
    type: String,
    enum: ['active', 'deleted', 'edited'],
    default: 'active'
  },
  
  // Read status
  isRead: {
    type: Boolean,
    default: false
  },
  
  readAt: {
    type: Date,
    default: null
  },
  
  // Priority level
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  // Agent assignment (for agent responses)
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Response time tracking (for agents)
  responseTime: {
    type: Number, // in seconds
    default: null
  },
  
  // Message metadata
  messageId: {
    type: String,
    unique: true,
    default: function() {
      return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  },
  
  // Threading support (for replies)
  parentMessageId: {
    type: String,
    default: null
  },
  
  // Internal notes (not visible to client)
  internalNote: {
    type: String,
    maxlength: 1000,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'chatmessages'
});

// Indexes for chat widget performance
chatMessageSchema.index({ sessionId: 1, createdAt: 1 }); // Chat history
chatMessageSchema.index({ messageType: 1, createdAt: -1 }); // Filter by type
chatMessageSchema.index({ source: 1, status: 1 }); // Active messages
chatMessageSchema.index({ isRead: 1, messageType: 1 }); // Unread messages
chatMessageSchema.index({ assignedAgent: 1, createdAt: -1 }); // Agent messages
chatMessageSchema.index({ messageId: 1 }); // Unique lookup
chatMessageSchema.index({ createdAt: -1 }); // Recent messages

// Compound indexes for chat widget queries
chatMessageSchema.index({ sessionId: 1, messageType: 1, createdAt: 1 });
chatMessageSchema.index({ source: 1, status: 1, isRead: 1 });

// Virtual fields
chatMessageSchema.virtual('formattedCreatedAt').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

chatMessageSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
});

// Instance methods for chat widget
chatMessageSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

chatMessageSchema.methods.isFromUser = function() {
  return this.messageType === 'user';
};

chatMessageSchema.methods.isFromAgent = function() {
  return this.messageType === 'agent';
};

chatMessageSchema.methods.isSystemMessage = function() {
  return this.messageType === 'system';
};

chatMessageSchema.methods.isChatWidget = function() {
  return this.source === 'chat_widget';
};

// Static methods for chat widget queries
chatMessageSchema.statics.getChatHistory = function(sessionId, limit = 50) {
  // Validate chat widget session
  if (!sessionId.startsWith('chat_')) {
    throw new Error('Invalid chat widget session ID');
  }
  
  return this.find({ 
    sessionId, 
    source: 'chat_widget',
    status: { $ne: 'deleted' }
  })
  .populate('assignedAgent', 'name email')
  .sort({ createdAt: 1 })
  .limit(limit);
};

chatMessageSchema.statics.getUnreadChatMessages = function() {
  return this.find({
    source: 'chat_widget',
    messageType: 'user',
    isRead: false,
    status: 'active'
  }).sort({ createdAt: -1 });
};

chatMessageSchema.statics.getActiveChatSessions = function(hoursBack = 24) {
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
  return this.distinct('sessionId', {
    source: 'chat_widget',
    createdAt: { $gte: since },
    status: 'active'
  });
};

chatMessageSchema.statics.getChatMessagesByAgent = function(agentId, limit = 100) {
  return this.find({
    source: 'chat_widget',
    assignedAgent: agentId,
    messageType: 'agent'
  })
  .sort({ createdAt: -1 })
  .limit(limit);
};

chatMessageSchema.statics.getChatSessionStats = function(sessionId) {
  // Validate chat widget session
  if (!sessionId.startsWith('chat_')) {
    throw new Error('Invalid chat widget session ID');
  }
  
  return this.aggregate([
    { $match: { sessionId, source: 'chat_widget' } },
    {
      $group: {
        _id: '$sessionId',
        totalMessages: { $sum: 1 },
        userMessages: {
          $sum: { $cond: [{ $eq: ['$messageType', 'user'] }, 1, 0] }
        },
        agentMessages: {
          $sum: { $cond: [{ $eq: ['$messageType', 'agent'] }, 1, 0] }
        },
        systemMessages: {
          $sum: { $cond: [{ $eq: ['$messageType', 'system'] }, 1, 0] }
        },
        unreadMessages: {
          $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
        },
        firstMessage: { $min: '$createdAt' },
        lastMessage: { $max: '$createdAt' }
      }
    }
  ]);
};

chatMessageSchema.statics.getAllChatWidgetSessions = function() {
  return this.aggregate([
    { $match: { source: 'chat_widget' } },
    {
      $group: {
        _id: '$sessionId',
        messageCount: { $sum: 1 },
        lastActivity: { $max: '$createdAt' },
        firstMessage: { $min: '$createdAt' },
        hasUnread: {
          $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] }
        }
      }
    },
    { $sort: { lastActivity: -1 } }
  ]);
};

// Pre-save middleware for chat widget
chatMessageSchema.pre('save', function(next) {
  // Ensure this is always a chat widget message
  this.source = 'chat_widget';
  
  // Validate session ID format
  if (!this.sessionId || !this.sessionId.startsWith('chat_')) {
    return next(new Error('Invalid session ID format for chat widget message'));
  }
  
  // Auto-generate sessionId if not provided (fallback)
  if (this.isNew && !this.sessionId) {
    this.sessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Auto-mark agent messages as read
  if (this.messageType === 'agent' && this.isNew) {
    this.isRead = true;
    this.readAt = new Date();
  }
  
  next();
});

// Pre-update middleware to prevent changing source
chatMessageSchema.pre(['updateOne', 'findOneAndUpdate'], function(next) {
  this.set('source', 'chat_widget');
  next();
});

// Post-save middleware for real-time notifications
chatMessageSchema.post('save', function(doc) {
  // Emit socket event for chat widget real-time updates
  if (global.io) {
    global.io.to(`session_${doc.sessionId}`).emit('new_chat_message', {
      sessionId: doc.sessionId,
      messageType: doc.messageType,
      message: doc.message,
      sender: doc.sender,
      timestamp: doc.createdAt,
      source: 'chat_widget'
    });
  }
});

module.exports = mongoose.model('ChatMessage', chatMessageSchema);