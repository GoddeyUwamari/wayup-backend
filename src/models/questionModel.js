const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  // Basic user information
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true,
    trim: true,
    lowercase: true
  },
  
  // Question details
  question: { 
    type: String, 
    required: true,
    trim: true
  },
  
  // Additional context fields
  company: {
    type: String,
    trim: true
  },
  
  phone: {
    type: String,
    trim: true
  },
  
  // Question categorization
  category: {
    type: String,
    enum: [
      'general',
      'pricing',
      'technical',
      'support',
      'sales',
      'web_design',
      'mobile_apps',
      'digital_marketing',
      'hosting',
      'other'
    ],
    default: 'general'
  },
  
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'answered', 'closed'],
    default: 'pending'
  },
  
  // Keep backwards compatibility
  answered: { 
    type: Boolean, 
    default: false 
  },
  
  // Answer details
  answer: {
    type: String,
    trim: true
  },
  
  answeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  answeredAt: {
    type: Date
  },
  
  // Session and source tracking
  sessionId: {
    type: String,
    index: true
  },
  
  source: {
    type: String,
    enum: ['chat_widget', 'contact_form', 'email', 'phone', 'other'],
    default: 'chat_widget'
  },
  
  // Keep your existing timestamp but rename for clarity
  askedAt: { 
    type: Date, 
    default: Date.now 
  },
  
  // Legacy support - map to askedAt
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  
  // Additional metadata
  userAgent: {
    type: String
  },
  
  ipAddress: {
    type: String
  },
  
  // Tags for organization
  tags: [{
    type: String,
    trim: true
  }],
  
  // Internal notes
  internalNotes: {
    type: String
  },
  
  // Follow-up tracking
  followUpRequired: {
    type: Boolean,
    default: false
  },
  
  followUpDate: {
    type: Date
  },
  
  // Rating/feedback after answer
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  
  feedback: {
    type: String
  }
}, {
  timestamps: true // This adds createdAt and updatedAt
});

// Indexes for better performance
questionSchema.index({ email: 1 });
questionSchema.index({ status: 1 });
questionSchema.index({ category: 1 });
questionSchema.index({ sessionId: 1 });
questionSchema.index({ askedAt: -1 });

// Virtual to maintain compatibility with your existing "answered" field
questionSchema.virtual('isAnswered').get(function() {
  return this.status === 'answered' || this.answered;
});

// Pre-save middleware to keep answered field in sync
questionSchema.pre('save', function(next) {
  if (this.status === 'answered' && !this.answered) {
    this.answered = true;
    this.answeredAt = this.answeredAt || new Date();
  } else if (this.answered && this.status === 'pending') {
    this.status = 'answered';
    this.answeredAt = this.answeredAt || new Date();
  }
  next();
});

// Instance method to mark as answered
questionSchema.methods.markAsAnswered = function(answer, answeredBy) {
  this.answered = true;
  this.status = 'answered';
  this.answer = answer;
  this.answeredBy = answeredBy;
  this.answeredAt = new Date();
  return this.save();
};

// Instance method to add internal note
questionSchema.methods.addInternalNote = function(note) {
  this.internalNotes = this.internalNotes ? 
    this.internalNotes + '\n\n' + new Date().toISOString() + ': ' + note :
    new Date().toISOString() + ': ' + note;
  return this.save();
};

// Static method to get unanswered questions
questionSchema.statics.getUnanswered = function() {
  return this.find({ 
    $or: [
      { answered: false },
      { status: { $in: ['pending', 'in_progress'] } }
    ]
  }).sort({ askedAt: -1 });
};

// Static method to get questions by category
questionSchema.statics.getByCategory = function(category) {
  return this.find({ category }).sort({ askedAt: -1 });
};

// Static method to get questions that need follow-up
questionSchema.statics.getNeedingFollowUp = function() {
  return this.find({ 
    followUpRequired: true,
    followUpDate: { $lte: new Date() }
  }).sort({ followUpDate: 1 });
};

module.exports = mongoose.model('Question', questionSchema);