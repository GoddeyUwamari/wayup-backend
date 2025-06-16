// routes/questionRoute.js
const express = require('express');
const router = express.Router();
const Question = require('../models/questionModel');

// GET /api/questions - Get all questions with filtering
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      category,
      answered,
      search
    } = req.query;

    let filter = {};
    
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (answered !== undefined) filter.answered = answered === 'true';
    
    if (search) {
      filter.$or = [
        { question: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { answer: { $regex: search, $options: 'i' } }
      ];
    }

    const questions = await Question.find(filter)
      .populate('answeredBy', 'name email')
      .sort({ askedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Question.countDocuments(filter);

    res.json({
      success: true,
      questions,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalQuestions: total
      }
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch questions'
    });
  }
});

// GET /api/questions/unanswered - Get unanswered questions
router.get('/unanswered', async (req, res) => {
  try {
    const questions = await Question.getUnanswered()
      .populate('answeredBy', 'name email');
    
    res.json({
      success: true,
      questions
    });
  } catch (error) {
    console.error('Error fetching unanswered questions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch unanswered questions'
    });
  }
});

// GET /api/questions/:id - Get specific question
router.get('/:id', async (req, res) => {
  try {
    const question = await Question.findById(req.params.id)
      .populate('answeredBy', 'name email');

    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'Question not found'
      });
    }

    res.json({
      success: true,
      question
    });
  } catch (error) {
    console.error('Error fetching question:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch question'
    });
  }
});

// POST /api/questions - Create new question
router.post('/', async (req, res) => {
  try {
    const {
      name,
      email,
      question,
      company,
      phone,
      category = 'general',
      priority = 'normal',
      sessionId
    } = req.body;

    if (!name || !email || !question) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and question are required'
      });
    }

    const questionData = {
      name,
      email,
      question,
      company,
      phone,
      category,
      priority,
      sessionId: sessionId || `manual_${Date.now()}`,
      source: 'manual',
      status: 'pending'
    };

    const newQuestion = await Question.create(questionData);

    res.status(201).json({
      success: true,
      question: newQuestion,
      message: 'Question submitted successfully'
    });
  } catch (error) {
    console.error('Error creating question:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create question'
    });
  }
});

// PUT /api/questions/:id/answer - Answer a question
router.put('/:id/answer', async (req, res) => {
  try {
    const { answer, answeredBy } = req.body;

    if (!answer) {
      return res.status(400).json({
        success: false,
        error: 'Answer is required'
      });
    }

    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'Question not found'
      });
    }

    await question.markAsAnswered(answer, answeredBy);

    res.json({
      success: true,
      question,
      message: 'Question answered successfully'
    });
  } catch (error) {
    console.error('Error answering question:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to answer question'
    });
  }
});

// PUT /api/questions/:id - Update question
router.put('/:id', async (req, res) => {
  try {
    const updates = req.body;
    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;

    const question = await Question.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('answeredBy', 'name email');

    if (!question) {
      return res.status(404).json({
        success: false,
        error: 'Question not found'
      });
    }

    res.json({
      success: true,
      question,
      message: 'Question updated successfully'
    });
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update question'
    });
  }
});

// GET /api/questions/stats/overview - Get question statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const total = await Question.countDocuments();
    const answered = await Question.countDocuments({ answered: true });
    const pending = await Question.countDocuments({ status: 'pending' });
    
    const byCategory = await Question.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    const recent = await Question.countDocuments({
      askedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    res.json({
      success: true,
      stats: {
        total,
        answered,
        pending,
        unanswered: total - answered,
        byCategory,
        recentWeek: recent
      }
    });
  } catch (error) {
    console.error('Error fetching question stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch question statistics'
    });
  }
});

module.exports = router;