const mongoose = require('mongoose');

const scheduledCallSchema = new mongoose.Schema({
  // Basic contact information
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
  phone: {
    type: String,
    trim: true
  },
  
  // Company information
  company: {
    type: String,
    trim: true
  },
  
  // Project details
  projectType: {
    type: String,
    enum: [
      'Web Design & Development',
      'Mobile App Development',
      'Digital Marketing',
      'E-commerce Solutions',
      'Website Hosting',
      'Graphics & Logo Design',
      'WordPress Development',
      'Project Management',
      'Other'
    ]
  },
  
  // Call scheduling details
  preferredTime: {
    type: Date
  },
  
  actualCallTime: {
    type: Date
  },
  
  // Keep your existing field but also add server.js expected field
  scheduledDate: { 
    type: Date 
  },
  
  scheduledAt: { 
    type: Date,
    default: Date.now
  },
  
  // Call type and purpose
  requestType: {
    type: String,
    enum: ['consultation', 'demo', 'support', 'follow_up', 'sales', 'technical'],
    default: 'consultation'
  },
  
  callPurpose: {
    type: String,
    trim: true
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['pending', 'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled'],
    default: 'pending'
  },
  
  // Duration and outcome
  duration: {
    type: Number, // in minutes
    min: 0
  },
  
  callOutcome: {
    type: String,
    enum: ['successful', 'no_answer', 'busy', 'voicemail', 'wrong_number', 'not_interested', 'follow_up_needed'],
  },
  
  // Assignment and handling
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  assignedAgentName: {
    type: String
  },
  
  // Session and source tracking
  sessionId: {
    type: String,
    index: true
  },
  
  source: {
    type: String,
    enum: ['chat_widget', 'contact_form', 'website', 'referral', 'manual'],
    default: 'chat_widget'
  },
  
  // Priority and urgency
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  isUrgent: {
    type: Boolean,
    default: false
  },
  
  // Notes and details
  notes: {
    type: String,
    trim: true
  },
  
  callNotes: {
    type: String,
    trim: true
  },
  
  internalNotes: {
    type: String,
    trim: true
  },
  
  // Client requirements
  budget: {
    type: String,
    enum: [
      'Under $5,000',
      '$5,000 - $15,000', 
      '$15,000 - $50,000',
      '$50,000 - $100,000',
      'Over $100,000',
      'Not sure yet'
    ]
  },
  
  timeline: {
    type: String,
    enum: [
      'ASAP (1-2 weeks)',
      '1 Month',
      '2-3 Months', 
      '3-6 Months',
      '6+ Months',
      'Flexible'
    ]
  },
  
  // Follow-up tracking
  followUpRequired: {
    type: Boolean,
    default: false
  },
  
  followUpDate: {
    type: Date
  },
  
  followUpNotes: {
    type: String
  },
  
  // Reminders
  reminderSent: {
    type: Boolean,
    default: false
  },
  
  reminderTime: {
    type: Date
  },
  
  // Call logistics
  callType: {
    type: String,
    enum: ['phone', 'video', 'in_person'],
    default: 'phone'
  },
  
  meetingLink: {
    type: String // For video calls
  },
  
  meetingLocation: {
    type: String // For in-person meetings
  },
  
  // Timezone handling
  timezone: {
    type: String,
    default: 'America/New_York'
  },
  
  // Contact preferences
  bestTimeToCall: {
    type: String
  },
  
  doNotCallBefore: {
    type: String // Time like "09:00"
  },
  
  doNotCallAfter: {
    type: String // Time like "18:00"
  },
  
  // Legacy compatibility
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  
  // Cancellation details
  cancellationReason: {
    type: String
  },
  
  cancelledBy: {
    type: String,
    enum: ['client', 'agent', 'system']
  },
  
  cancelledAt: {
    type: Date
  },
  
  // Rescheduling history
  rescheduledFrom: {
    type: Date
  },
  
  rescheduledReason: {
    type: String
  },
  
  rescheduledCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Indexes for better performance
scheduledCallSchema.index({ email: 1 });
scheduledCallSchema.index({ status: 1 });
scheduledCallSchema.index({ scheduledAt: -1 });
scheduledCallSchema.index({ actualCallTime: 1 });
scheduledCallSchema.index({ assignedTo: 1 });
scheduledCallSchema.index({ sessionId: 1 });
scheduledCallSchema.index({ followUpDate: 1 });

// Virtual fields
scheduledCallSchema.virtual('isOverdue').get(function() {
  return this.status === 'scheduled' && this.actualCallTime && this.actualCallTime < new Date();
});

scheduledCallSchema.virtual('timeUntilCall').get(function() {
  if (!this.actualCallTime) return null;
  return this.actualCallTime.getTime() - new Date().getTime();
});

// Instance methods
scheduledCallSchema.methods.markAsCompleted = function(duration, outcome, notes) {
  this.status = 'completed';
  this.duration = duration;
  this.callOutcome = outcome;
  if (notes) this.callNotes = notes;
  return this.save();
};

scheduledCallSchema.methods.cancel = function(reason, cancelledBy = 'client') {
  this.status = 'cancelled';
  this.cancellationReason = reason;
  this.cancelledBy = cancelledBy;
  this.cancelledAt = new Date();
  return this.save();
};

scheduledCallSchema.methods.reschedule = function(newTime, reason) {
  this.rescheduledFrom = this.actualCallTime;
  this.actualCallTime = newTime;
  this.rescheduledReason = reason;
  this.rescheduledCount += 1;
  this.status = 'rescheduled';
  return this.save();
};

scheduledCallSchema.methods.addNote = function(note, type = 'general') {
  const timestamp = new Date().toISOString();
  const noteWithTimestamp = `${timestamp}: ${note}`;
  
  switch(type) {
    case 'call':
      this.callNotes = this.callNotes ? 
        this.callNotes + '\n\n' + noteWithTimestamp : 
        noteWithTimestamp;
      break;
    case 'internal':
      this.internalNotes = this.internalNotes ? 
        this.internalNotes + '\n\n' + noteWithTimestamp : 
        noteWithTimestamp;
      break;
    default:
      this.notes = this.notes ? 
        this.notes + '\n\n' + noteWithTimestamp : 
        noteWithTimestamp;
  }
  
  return this.save();
};

// Static methods
scheduledCallSchema.statics.getUpcoming = function(days = 7) {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);
  
  return this.find({
    status: { $in: ['scheduled', 'confirmed'] },
    actualCallTime: {
      $gte: new Date(),
      $lte: endDate
    }
  }).sort({ actualCallTime: 1 });
};

scheduledCallSchema.statics.getPending = function() {
  return this.find({ status: 'pending' }).sort({ scheduledAt: -1 });
};

scheduledCallSchema.statics.getOverdue = function() {
  return this.find({
    status: 'scheduled',
    actualCallTime: { $lt: new Date() }
  }).sort({ actualCallTime: 1 });
};

scheduledCallSchema.statics.getByAgent = function(agentId) {
  return this.find({ assignedTo: agentId })
    .sort({ actualCallTime: 1 })
    .populate('assignedTo', 'name email');
};

scheduledCallSchema.statics.getNeedingFollowUp = function() {
  return this.find({
    followUpRequired: true,
    followUpDate: { $lte: new Date() },
    status: 'completed'
  }).sort({ followUpDate: 1 });
};

// Pre-save middleware
scheduledCallSchema.pre('save', function(next) {
  // Auto-set scheduledDate from actualCallTime for backward compatibility
  if (this.actualCallTime && !this.scheduledDate) {
    this.scheduledDate = this.actualCallTime;
  }
  
  // Auto-set actualCallTime from scheduledDate if not set
  if (this.scheduledDate && !this.actualCallTime) {
    this.actualCallTime = this.scheduledDate;
  }
  
  // Set urgent flag based on priority
  this.isUrgent = this.priority === 'urgent';
  
  next();
});

module.exports = mongoose.model('ScheduledCall', scheduledCallSchema);