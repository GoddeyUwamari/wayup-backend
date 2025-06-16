// models/userModel.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Basic info
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  
  // Role and permissions
  role: {
    type: String,
    enum: ['admin', 'manager', 'agent', 'viewer'],
    default: 'agent'
  },
  
  // Agent-specific fields
  isActive: {
    type: Boolean,
    default: true
  },
  
  isOnline: {
    type: Boolean,
    default: false
  },
  
  lastSeen: {
    type: Date,
    default: Date.now
  },
  
  // Chat management
  maxConcurrentChats: {
    type: Number,
    default: 5,
    min: 1,
    max: 20
  },
  
  currentChatCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Skills and specializations
  skills: [{
    type: String,
    enum: [
      'web_design',
      'mobile_apps', 
      'digital_marketing',
      'ecommerce',
      'hosting',
      'graphics',
      'wordpress',
      'project_management',
      'technical_support',
      'sales'
    ]
  }],
  
  // Availability
  workingHours: {
    start: {
      type: String,
      default: '09:00'
    },
    end: {
      type: String, 
      default: '17:00'
    },
    timezone: {
      type: String,
      default: 'America/New_York'
    }
  },
  
  workingDays: [{
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    default: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  }],
  
  // Contact info
  phone: {
    type: String,
    trim: true
  },
  
  department: {
    type: String,
    enum: ['sales', 'support', 'technical', 'management'],
    default: 'support'
  },
  
  // Profile
  avatar: {
    type: String // URL to profile picture
  },
  
  bio: {
    type: String,
    maxlength: 500
  },
  
  // Performance metrics
  stats: {
    totalChats: {
      type: Number,
      default: 0
    },
    totalCalls: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number, // in seconds
      default: 0
    },
    customerSatisfaction: {
      type: Number, // 1-5 rating
      default: 0
    },
    totalSales: {
      type: Number,
      default: 0
    }
  },
  
  // Notification preferences
  notifications: {
    email: {
      type: Boolean,
      default: true
    },
    sms: {
      type: Boolean,
      default: false
    },
    desktop: {
      type: Boolean,
      default: true
    },
    newChats: {
      type: Boolean,
      default: true
    },
    mentions: {
      type: Boolean,
      default: true
    }
  },
  
  // Security
  lastLogin: {
    type: Date
  },
  
  loginAttempts: {
    type: Number,
    default: 0
  },
  
  lockUntil: {
    type: Date
  },
  
  passwordResetToken: {
    type: String
  },
  
  passwordResetExpires: {
    type: Date
  },
  
  // Two-factor authentication
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  
  twoFactorSecret: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ isOnline: 1 });
userSchema.index({ skills: 1 });

// Virtual for account locked
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Instance methods
userSchema.methods.incrementLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
  }
  
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

userSchema.methods.setOnline = function() {
  this.isOnline = true;
  this.lastSeen = new Date();
  return this.save();
};

userSchema.methods.setOffline = function() {
  this.isOnline = false;
  this.lastSeen = new Date();
  this.currentChatCount = 0; // Reset active chats when going offline
  return this.save();
};

userSchema.methods.canTakeNewChat = function() {
  return this.isActive && this.isOnline && this.currentChatCount < this.maxConcurrentChats;
};

userSchema.methods.assignChat = function() {
  if (this.canTakeNewChat()) {
    this.currentChatCount += 1;
    return this.save();
  }
  throw new Error('Agent cannot take new chat');
};

userSchema.methods.releaseChat = function() {
  if (this.currentChatCount > 0) {
    this.currentChatCount -= 1;
    return this.save();
  }
};

// Static methods
userSchema.statics.getAvailableAgents = function(skills = []) {
  const query = {
    isActive: true,
    isOnline: true,
    $expr: { $lt: ['$currentChatCount', '$maxConcurrentChats'] }
  };
  
  if (skills.length > 0) {
    query.skills = { $in: skills };
  }
  
  return this.find(query).sort({ currentChatCount: 1 });
};

userSchema.statics.getAgentsByRole = function(role) {
  return this.find({ role, isActive: true }).sort({ name: 1 });
};

userSchema.statics.getOnlineAgents = function() {
  return this.find({ isOnline: true, isActive: true }).sort({ currentChatCount: 1 });
};

// Pre-save middleware
userSchema.pre('save', function(next) {
  if (this.isModified('isOnline') && this.isOnline) {
    this.lastSeen = new Date();
  }
  next();
});

module.exports = mongoose.model('User', userSchema);