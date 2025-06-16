// models/chatModel.js
const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    index: true
  },
  message: {
    type: String,
    required: true
  },
  sender: {
    type: String,
    default: 'User'
  },
  messageType: {
    type: String,
    enum: ['user', 'agent', 'system'],
    default: 'user'
  },
  source: {
    type: String,
    enum: ['chat_widget', 'contact_form'],
    default: 'chat_widget',
    index: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'closed', 'deleted'],
    default: 'active'
  },
  assignedAgent: {
    type: String
  }
}, {
  timestamps: true
});

// Create indexes
chatMessageSchema.index({ sessionId: 1, source: 1 });
chatMessageSchema.index({ source: 1, isRead: 1 });
chatMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);