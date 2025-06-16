// routes/contactRoute.js - CONTACT FORMS ONLY (NO UNIVERSAL VIEW)
const express = require('express');
const {
  handleContactForm,
  getAllContacts,
  getContactById,
  updateContact,
  getContactStats,
  deleteContact
} = require('../controllers/contactController');

const router = express.Router();

// Logging middleware
router.use((req, res, next) => {
  console.log(`📝 Contact Form route accessed: ${req.method} ${req.path}`);
  console.log(`📝 Request from: ${req.ip}`);
  next();
});

// Test route
router.get('/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Contact Form API is working',
    timestamp: new Date().toISOString(),
    service: 'contact_forms_only',
    system: 'Contact Forms (HTTP only)',
    sessionPrefix: 'contact_',
    sourceType: 'contact_form',
    endpoints: {
      'POST /submit': 'Submit contact form',
      'GET /all': 'Get contact form submissions only',
      'GET /stats': 'Get contact form statistics only',
      'GET /:id': 'Get specific contact form by ID',
      'PUT /:id': 'Update contact form submission',
      'DELETE /:id': 'Delete contact form submission'
    },
    note: 'This API only handles contact form submissions (no chat widget data)'
  });
});

// ======================
// CONTACT FORM ENDPOINTS ONLY
// ======================

// Submit contact form (main endpoint)
router.post('/submit', (req, res, next) => {
  console.log('📝 Contact form submission received');
  console.log('📝 Session ID:', req.body.sessionId);
  console.log('📝 Source:', req.body.source);
  console.log('📝 Type:', req.body.type);
  next();
}, handleContactForm);

// Get all contact form submissions (admin/dashboard)
router.get('/all', (req, res, next) => {
  console.log('📝 Fetching all contact form submissions');
  next();
}, getAllContacts);

// Get contact form statistics
router.get('/stats', (req, res, next) => {
  console.log('📝 Generating contact form statistics');
  next();
}, getContactStats);

// Get specific contact form submission by ID
router.get('/:id', (req, res, next) => {
  console.log('📝 Fetching contact form submission:', req.params.id);
  next();
}, getContactById);

// Update contact form submission
router.put('/:id', (req, res, next) => {
  console.log('📝 Updating contact form submission:', req.params.id);
  next();
}, updateContact);

// Delete contact form submission
router.delete('/:id', (req, res, next) => {
  console.log('📝 Deleting contact form submission:', req.params.id);
  next();
}, deleteContact);

// ======================
// SYSTEM INFO ENDPOINTS
// ======================

// Health check for contact form system
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    system: 'Contact Forms',
    status: 'healthy',
    method: 'HTTP only',
    sessionPrefix: 'contact_',
    sourceType: 'contact_form',
    timestamp: new Date().toISOString(),
    features: {
      formSubmission: true,
      emailValidation: true,
      duplicatePrevention: true,
      sessionTracking: true,
      adminManagement: true
    }
  });
});

// Get contact form schema info
router.get('/schema', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Contact Form Schema Information',
    requiredFields: ['name', 'email', 'description', 'sessionId'],
    optionalFields: ['phone', 'company', 'website', 'projectType', 'budget', 'timeline', 'tradeshowResponse'],
    sessionFormat: 'contact_TIMESTAMP_RANDOMID',
    sourceType: 'contact_form',
    validationRules: {
      name: 'Required, minimum 2 characters',
      email: 'Required, valid email format',
      description: 'Required, minimum 10 characters',
      sessionId: 'Required, must start with "contact_"'
    },
    exampleSubmission: {
      sessionId: 'contact_1748767679782_abc123',
      type: 'contact_form',
      source: 'contact_form',
      name: 'John Doe',
      email: 'john@example.com',
      phone: '123-456-7890',
      company: 'Example Corp',
      projectType: 'Web Design & Development',
      description: 'Need a new website for our business',
      tradeshowResponse: false
    }
  });
});

// ======================
// ERROR HANDLING
// ======================

// 404 handler for contact form routes
router.use('*', (req, res) => {
  console.log(`📝 Contact form route not found: ${req.method} ${req.originalUrl}`);
  
  res.status(404).json({
    success: false,
    error: 'Contact form endpoint not found',
    requestedRoute: `${req.method} ${req.originalUrl}`,
    availableEndpoints: {
      submission: 'POST /api/contact/submit',
      management: [
        'GET /api/contact/all',
        'GET /api/contact/stats', 
        'GET /api/contact/:id',
        'PUT /api/contact/:id',
        'DELETE /api/contact/:id'
      ],
      system: [
        'GET /api/contact/test',
        'GET /api/contact/health',
        'GET /api/contact/schema'
      ]
    },
    note: 'This API only handles contact form submissions (no chat widget endpoints)',
    chatWidgetNote: 'For chat widget functionality, use /api/chat/* endpoints'
  });
});

module.exports = router;