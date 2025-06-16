// models/contactModel.js
const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    default: ''
  },
  company: {
    type: String,
    default: ''
  },
  projectType: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  source: {
    type: String,
    enum: ['chat_widget', 'contact_form'],
    default: 'chat_widget',
    index: true
  },
  type: {
    type: String,
    enum: ['chat_client_data', 'contact_form', 'chat_call_request'],
    default: 'chat_client_data'
  },
  status: {
    type: String,
    enum: ['active', 'closed', 'pending', 'call_requested'],
    default: 'active'
  },
  callRequested: {
    type: Boolean,
    default: false
  },
  preferredCallTime: {
    type: String
  },
  callNotes: {
    type: String
  },
  closedAt: {
    type: Date
  },
  closeReason: {
    type: String
  }
}, {
  timestamps: true
});

// Create indexes
contactSchema.index({ sessionId: 1, source: 1 });
contactSchema.index({ source: 1, status: 1 });
contactSchema.index({ email: 1 });
contactSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Contact', contactSchema);