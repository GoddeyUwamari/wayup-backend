// routes/scheduleRoute.js
const express = require('express');
const router = express.Router();
const ScheduledCall = require('../models/scheduleModel');

// GET /api/schedule - Get all scheduled calls with filtering
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      assignedTo,
      startDate,
      endDate,
      priority
    } = req.query;

    let filter = {};
    
    if (status) filter.status = status;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (priority) filter.priority = priority;
    
    if (startDate || endDate) {
      filter.actualCallTime = {};
      if (startDate) filter.actualCallTime.$gte = new Date(startDate);
      if (endDate) filter.actualCallTime.$lte = new Date(endDate);
    }

    const calls = await ScheduledCall.find(filter)
      .populate('assignedTo', 'name email')
      .sort({ actualCallTime: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await ScheduledCall.countDocuments(filter);

    res.json({
      success: true,
      calls,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalCalls: total
      }
    });
  } catch (error) {
    console.error('Error fetching scheduled calls:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scheduled calls'
    });
  }
});

// GET /api/schedule/upcoming - Get upcoming calls
router.get('/upcoming', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const calls = await ScheduledCall.getUpcoming(parseInt(days))
      .populate('assignedTo', 'name email');
    
    res.json({
      success: true,
      calls
    });
  } catch (error) {
    console.error('Error fetching upcoming calls:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch upcoming calls'
    });
  }
});

// GET /api/schedule/pending - Get pending calls
router.get('/pending', async (req, res) => {
  try {
    const calls = await ScheduledCall.getPending()
      .populate('assignedTo', 'name email');
    
    res.json({
      success: true,
      calls
    });
  } catch (error) {
    console.error('Error fetching pending calls:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pending calls'
    });
  }
});

// GET /api/schedule/overdue - Get overdue calls
router.get('/overdue', async (req, res) => {
  try {
    const calls = await ScheduledCall.getOverdue()
      .populate('assignedTo', 'name email');
    
    res.json({
      success: true,
      calls
    });
  } catch (error) {
    console.error('Error fetching overdue calls:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch overdue calls'
    });
  }
});

// POST /api/schedule - Create new scheduled call
router.post('/', async (req, res) => {
  try {
    const callData = {
      ...req.body,
      status: 'pending',
      scheduledAt: new Date()
    };

    if (!callData.name || !callData.email) {
      return res.status(400).json({
        success: false,
        error: 'Name and email are required'
      });
    }

    const newCall = await ScheduledCall.create(callData);

    res.status(201).json({
      success: true,
      call: newCall,
      message: 'Call scheduled successfully'
    });
  } catch (error) {
    console.error('Error creating scheduled call:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to schedule call'
    });
  }
});

// PUT /api/schedule/:id - Update scheduled call
router.put('/:id', async (req, res) => {
  try {
    const updates = req.body;
    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;

    const call = await ScheduledCall.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('assignedTo', 'name email');

    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled call not found'
      });
    }

    res.json({
      success: true,
      call,
      message: 'Scheduled call updated successfully'
    });
  } catch (error) {
    console.error('Error updating scheduled call:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update scheduled call'
    });
  }
});

// PUT /api/schedule/:id/complete - Mark call as completed
router.put('/:id/complete', async (req, res) => {
  try {
    const { duration, outcome, notes } = req.body;
    
    const call = await ScheduledCall.findById(req.params.id);
    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled call not found'
      });
    }

    await call.markAsCompleted(duration, outcome, notes);

    res.json({
      success: true,
      call,
      message: 'Call marked as completed'
    });
  } catch (error) {
    console.error('Error completing call:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete call'
    });
  }
});

// PUT /api/schedule/:id/cancel - Cancel call
router.put('/:id/cancel', async (req, res) => {
  try {
    const { reason, cancelledBy = 'client' } = req.body;
    
    const call = await ScheduledCall.findById(req.params.id);
    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled call not found'
      });
    }

    await call.cancel(reason, cancelledBy);

    res.json({
      success: true,
      call,
      message: 'Call cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling call:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel call'
    });
  }
});

// PUT /api/schedule/:id/reschedule - Reschedule call
router.put('/:id/reschedule', async (req, res) => {
  try {
    const { newTime, reason } = req.body;
    
    if (!newTime) {
      return res.status(400).json({
        success: false,
        error: 'New time is required for rescheduling'
      });
    }

    const call = await ScheduledCall.findById(req.params.id);
    if (!call) {
      return res.status(404).json({
        success: false,
        error: 'Scheduled call not found'
      });
    }

    await call.reschedule(new Date(newTime), reason);

    res.json({
      success: true,
      call,
      message: 'Call rescheduled successfully'
    });
  } catch (error) {
    console.error('Error rescheduling call:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reschedule call'
    });
  }
});

// GET /api/schedule/stats - Get call statistics
router.get('/stats', async (req, res) => {
  try {
    const total = await ScheduledCall.countDocuments();
    const pending = await ScheduledCall.countDocuments({ status: 'pending' });
    const scheduled = await ScheduledCall.countDocuments({ status: 'scheduled' });
    const completed = await ScheduledCall.countDocuments({ status: 'completed' });
    const cancelled = await ScheduledCall.countDocuments({ status: 'cancelled' });

    const byStatus = await ScheduledCall.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const byRequestType = await ScheduledCall.aggregate([
      {
        $group: {
          _id: '$requestType',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      stats: {
        total,
        pending,
        scheduled,
        completed,
        cancelled,
        byStatus,
        byRequestType
      }
    });
  } catch (error) {
    console.error('Error fetching call stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch call statistics'
    });
  }
});

module.exports = router;