const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  updateUserProfile,
  deleteUserProfile,
  // Add the new functions from updated controller
  setUserOnline,
  setUserOffline,
  getAvailableAgents,
  getAllAgents,
  getOnlineAgents,
  updateUserStatus,
  getUserStats
} = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');

// Keep your existing routes exactly as they are
router.post('/register', registerUser);
router.post('/login', loginUser);
router.put('/update', protect, updateUserProfile);
router.delete('/delete', protect, deleteUserProfile);

// Add new routes for chat system functionality
// Agent status management (for when agents start/stop their shift)
router.put('/status/online', protect, setUserOnline);
router.put('/status/offline', protect, setUserOffline);

// Agent queries (used by your chat assignment system)
router.get('/agents/available', getAvailableAgents);  // Get agents who can take new chats
router.get('/agents/online', getOnlineAgents);        // Get all online agents
router.get('/agents/all', getAllAgents);              // Get all agents (for admin)

// User management (for admin functions)
router.put('/:userId/status', protect, updateUserStatus); // Activate/deactivate users
router.get('/:userId/stats', protect, getUserStats);       // Get user performance stats

// Optional: Add a route to get current user info
router.get('/profile', protect, async (req, res) => {
  try {
    const User = require('../models/userModel');
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;