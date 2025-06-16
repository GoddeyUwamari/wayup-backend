const User = require('../models/userModel');
const asyncHandler = require('express-async-handler');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// Keep your existing functions but enhanced
const registerUser = asyncHandler(async (req, res) => {
  const { 
    name, 
    email, 
    password, 
    role = 'agent',
    skills = [],
    department = 'support',
    maxConcurrentChats = 5
  } = req.body;

  console.log('Received registration payload:', req.body);

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      skills,
      department,
      maxConcurrentChats,
      isActive: true
    });

    res.status(201).json({
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      skills: user.skills,
      department: user.department,
      token: generateToken(user._id),
      message: 'User registered successfully'
    });
  } catch (error) {
    console.error('Error in registerUser:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({ message: 'Account is locked due to too many failed login attempts' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated' });
    }

    if (await bcrypt.compare(password, user.password)) {
      // Reset login attempts on successful login
      await user.resetLoginAttempts();
      
      // Set user as online
      await user.setOnline();

      res.status(200).json({
        _id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        skills: user.skills,
        department: user.department,
        isOnline: user.isOnline,
        maxConcurrentChats: user.maxConcurrentChats,
        currentChatCount: user.currentChatCount,
        token: generateToken(user._id),
        message: 'Login successful'
      });
    } else {
      // Increment login attempts on failed login
      await user.incrementLoginAttempts();
      res.status(400).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('Error in loginUser:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const updateUserProfile = async (req, res) => {
  const { 
    name, 
    email, 
    password, 
    skills,
    maxConcurrentChats,
    workingHours,
    workingDays,
    phone,
    bio,
    notifications
  } = req.body;

  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = name || user.name;
      user.email = email || user.email;
      user.skills = skills || user.skills;
      user.maxConcurrentChats = maxConcurrentChats || user.maxConcurrentChats;
      user.workingHours = workingHours || user.workingHours;
      user.workingDays = workingDays || user.workingDays;
      user.phone = phone || user.phone;
      user.bio = bio || user.bio;
      user.notifications = notifications || user.notifications;

      if (password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
      }

      const updatedUserProfile = await user.save();

      res.status(200).json({
        _id: updatedUserProfile.id,
        name: updatedUserProfile.name,
        email: updatedUserProfile.email,
        role: updatedUserProfile.role,
        skills: updatedUserProfile.skills,
        maxConcurrentChats: updatedUserProfile.maxConcurrentChats,
        workingHours: updatedUserProfile.workingHours,
        workingDays: updatedUserProfile.workingDays,
        phone: updatedUserProfile.phone,
        bio: updatedUserProfile.bio,
        notifications: updatedUserProfile.notifications,
        token: generateToken(updatedUserProfile._id),
        message: 'Profile updated successfully'
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error in updateUserProfile:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const deleteUserProfile = asyncHandler(async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error in deleteUserProfile:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// New functions for chat system
const setUserOnline = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.setOnline();
    
    res.status(200).json({
      message: 'User set to online',
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
    });
  } catch (error) {
    console.error('Error setting user online:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

const setUserOffline = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await user.setOffline();
    
    res.status(200).json({
      message: 'User set to offline',
      isOnline: user.isOnline,
      lastSeen: user.lastSeen
    });
  } catch (error) {
    console.error('Error setting user offline:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

const getAvailableAgents = asyncHandler(async (req, res) => {
  try {
    const { skills } = req.query;
    const skillsArray = skills ? skills.split(',') : [];
    
    const agents = await User.getAvailableAgents(skillsArray);
    
    res.status(200).json({
      success: true,
      agents,
      count: agents.length
    });
  } catch (error) {
    console.error('Error getting available agents:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

const getAllAgents = asyncHandler(async (req, res) => {
  try {
    const { role = 'agent', active = 'true' } = req.query;
    
    let filter = { role };
    if (active === 'true') {
      filter.isActive = true;
    }
    
    const agents = await User.find(filter)
      .select('-password')
      .sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      agents,
      count: agents.length
    });
  } catch (error) {
    console.error('Error getting all agents:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

const getOnlineAgents = asyncHandler(async (req, res) => {
  try {
    const agents = await User.getOnlineAgents();
    
    res.status(200).json({
      success: true,
      agents,
      count: agents.length
    });
  } catch (error) {
    console.error('Error getting online agents:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

const updateUserStatus = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;
    
    const user = await User.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({
      success: true,
      user,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

const getUserStats = asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('name email stats');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        stats: user.stats
      }
    });
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = {
  registerUser,
  loginUser,
  updateUserProfile,
  deleteUserProfile,
  setUserOnline,
  setUserOffline,
  getAvailableAgents,
  getAllAgents,
  getOnlineAgents,
  updateUserStatus,
  getUserStats
};