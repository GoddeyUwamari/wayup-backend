// controllers/contactController.js - CONTACT FORMS ONLY (NO CHAT WIDGET)
const Contact = require('../models/contactModel');
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

// Handle ONLY contact form submissions (NO chat widget data)
const handleContactForm = async (req, res) => {
  try {
    console.log('=== CONTACT FORM SUBMISSION RECEIVED ===');
    console.log('📝 Raw request body:', req.body);
    
    // Validate that this is actually a contact form submission
    const { source, type } = req.body;
    if (source !== 'contact_form' || type !== 'contact_form') {
      console.log('❌ Invalid submission type - not a contact form');
      return res.status(400).json({
        success: false,
        error: 'Invalid submission type',
        details: 'This endpoint only accepts contact form submissions',
        expected: { source: 'contact_form', type: 'contact_form' },
        received: { source, type }
      });
    }

    // Handle contact form field variations
    const {
      sessionId,
      fullName,
      name,
      firstName,
      lastName,
      email,
      phone,
      phoneNumber,
      company,
      website,
      projectType,
      budget,
      timeline,
      howCanWeHelp,
      description,
      message,
      seenAtTradeshow,
      priority = 'normal'
    } = req.body;

    // Validate session ID is present
    if (!sessionId) {
      console.log('❌ Missing session ID for contact form');
      return res.status(400).json({
        success: false,
        error: 'Invalid session ID',
        details: 'Contact form submission requires a session ID',
        received: sessionId
      });
    }

    // Normalize contact form field names
    const finalName = fullName || name || (firstName && lastName ? `${firstName} ${lastName}`.trim() : firstName) || '';
    const finalEmail = email || '';
    const finalPhone = phone || phoneNumber || '';
    const finalCompany = company || '';
    const finalWebsite = website || '';
    const finalProjectType = projectType || 'General Inquiry';
    const finalBudget = budget || '';
    const finalTimeline = timeline || '';
    const finalDescription = howCanWeHelp || description || message || '';

    console.log('=== NORMALIZED CONTACT FORM FIELDS ===');
    console.log('📝 Session ID:', sessionId);
    console.log('📝 Name:', finalName);
    console.log('📝 Email:', finalEmail);
    console.log('📝 Phone:', finalPhone);
    console.log('📝 Project Type:', finalProjectType);
    console.log('📝 Source: contact_form');

    // Validate required fields
    if (!finalName.trim()) {
      console.log('❌ Validation failed: Missing name');
      return res.status(400).json({
        success: false,
        error: 'Name is required',
        details: 'Please provide your full name',
        field: 'name'
      });
    }

    if (!finalEmail.trim()) {
      console.log('❌ Validation failed: Missing email');
      return res.status(400).json({
        success: false,
        error: 'Email is required',
        details: 'Please provide a valid email address',
        field: 'email'
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(finalEmail)) {
      console.log('❌ Validation failed: Invalid email format');
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
        details: 'Please provide a valid email address',
        field: 'email'
      });
    }

    if (!finalDescription.trim()) {
      console.log('❌ Validation failed: Missing description');
      return res.status(400).json({
        success: false,
        error: 'Project description is required',
        details: 'Please tell us how we can help you',
        field: 'description'
      });
    }

    // Check for existing contact by email (contact forms only)
    const existingContact = await Contact.findOne({ 
      email: finalEmail,
      source: 'contact_form'
    });
    
    if (existingContact) {
      console.log('📝 Updating existing contact form submission:', existingContact._id);
      
      const updateData = {
        name: finalName,
        phone: finalPhone,
        company: finalCompany,
        website: finalWebsite,
        projectType: finalProjectType,
        budget: finalBudget,
        timeline: finalTimeline,
        description: finalDescription,
        source: 'contact_form',
        type: 'contact_form',
        priority,
        lastContactDate: new Date(),
        sessionId: sessionId
      };

      if (seenAtTradeshow !== undefined) {
        updateData.tradeshowResponse = seenAtTradeshow;
      }

      try {
        const updatedContact = await Contact.findByIdAndUpdate(
          existingContact._id,
          updateData,
          { new: true, runValidators: true }
        );

        // Send email notification for returning contact
        try {
          await resend.emails.send({
            from: 'noreply@wayuptechn.com',
            to: 'projectmanager@wayuptechn.com',
            subject: `🔄 Returning Contact: ${finalName} — ${finalProjectType}`,
            html: `
              <h2>Returning Contact Form Submission</h2>
              <p><strong>Name:</strong> ${finalName}</p>
              <p><strong>Email:</strong> ${finalEmail}</p>
              <p><strong>Phone:</strong> ${finalPhone || 'Not provided'}</p>
              <p><strong>Company:</strong> ${finalCompany || 'Not provided'}</p>
              <p><strong>Project Type:</strong> ${finalProjectType}</p>
              <p><strong>Message:</strong> ${finalDescription}</p>
              <p><strong>Session ID:</strong> ${sessionId}</p>
              <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
              <p style="color: orange;"><em>Note: This contact already exists in the system and was updated.</em></p>
              <hr/>
              <p><a href="https://cloud.mongodb.com">View in MongoDB Atlas</a></p>
            `
          });
          console.log('📧 Email notification sent for returning contact');
        } catch (emailError) {
          console.error('⚠️ Email notification failed (non-critical):', emailError.message);
        }

        console.log('✅ Contact form updated successfully');
        return res.status(200).json({
          success: true,
          contact: updatedContact,
          message: 'Your contact information has been updated. We will get back to you soon!',
          isExisting: true,
          source: 'contact_form'
        });
      } catch (updateError) {
        console.error('❌ Error updating contact form submission:', updateError);
        throw updateError;
      }
    }

    // Create new contact from contact form
    const contactData = {
      sessionId: sessionId,
      name: finalName,
      email: finalEmail,
      phone: finalPhone,
      company: finalCompany,
      website: finalWebsite,
      projectType: finalProjectType,
      budget: finalBudget,
      timeline: finalTimeline,
      description: finalDescription,
      source: 'contact_form',
      type: 'contact_form',
      priority,
      status: 'pending'
    };

    if (seenAtTradeshow !== undefined) {
      contactData.tradeshowResponse = seenAtTradeshow;
    }

    console.log('=== CREATING NEW CONTACT FROM FORM ===');
    console.log('📝 Contact data:', contactData);

    try {
      const newContact = await Contact.create(contactData);
      console.log('✅ New contact form submission created successfully:', newContact._id);

      // Send email notification for new contact
      try {
        await resend.emails.send({
          from: 'noreply@wayuptechn.com',
          to: 'projectmanager@wayuptechn.com',
          subject: `🔔 New Lead: ${finalName} — ${finalProjectType}`,
          html: `
            <h2 style="color: #ef5a16;">New Contact Form Submission</h2>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px; font-weight: bold;">Name</td><td style="padding: 8px;">${finalName}</td></tr>
              <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Email</td><td style="padding: 8px;"><a href="mailto:${finalEmail}">${finalEmail}</a></td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Phone</td><td style="padding: 8px;">${finalPhone || 'Not provided'}</td></tr>
              <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Company</td><td style="padding: 8px;">${finalCompany || 'Not provided'}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Project Type</td><td style="padding: 8px;">${finalProjectType}</td></tr>
              <tr style="background: #f9f9f9;"><td style="padding: 8px; font-weight: bold;">Message</td><td style="padding: 8px;">${finalDescription}</td></tr>
              <tr><td style="padding: 8px; font-weight: bold;">Submitted</td><td style="padding: 8px;">${new Date().toLocaleString()}</td></tr>
            </table>
            <br/>
            <p><a href="mailto:${finalEmail}" style="background: #ef5a16; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reply to ${finalName}</a></p>
            <hr/>
            <p style="color: #888; font-size: 12px;"><a href="https://cloud.mongodb.com">View in MongoDB Atlas</a> | WayUP Technology</p>
          `
        });
        console.log('📧 Email notification sent for new contact form submission');
      } catch (emailError) {
        console.error('⚠️ Email notification failed (non-critical):', emailError.message);
      }

      res.status(201).json({
        success: true,
        contact: newContact,
        message: 'Thank you for contacting us! We will get back to you within 24 hours.',
        isExisting: false,
        source: 'contact_form'
      });
    } catch (createError) {
      console.error('❌ Error creating contact form submission:', createError);
      
      if (createError.code === 11000 && createError.keyPattern?.sessionId) {
        console.log('🔄 SessionId conflict, using fallback ID...');
        contactData.sessionId = `${sessionId}_fallback_${Date.now()}`;
        
        try {
          const retryNewContact = await Contact.create(contactData);
          console.log('✅ Contact form created successfully with fallback session ID:', retryNewContact._id);

          return res.status(201).json({
            success: true,
            contact: retryNewContact,
            message: 'Thank you for contacting us! We will get back to you within 24 hours.',
            isExisting: false,
            source: 'contact_form'
          });
        } catch (retryError) {
          console.error('❌ Retry creation failed:', retryError);
          throw retryError;
        }
      } else {
        throw createError;
      }
    }

  } catch (error) {
    console.error('❌ Error handling contact form submission:', error);
    console.error('📝 Request body was:', req.body);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      console.log('❌ Validation errors:', validationErrors);
      
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validationErrors,
        source: 'contact_form'
      });
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      console.log(`❌ Duplicate key error on field: ${field}`, error.keyValue);
      
      return res.status(400).json({
        success: false,
        error: `Contact form with this ${field} already exists`,
        details: `A contact form with ${field} "${error.keyValue[field]}" already exists in our system`,
        source: 'contact_form'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to submit contact form. Please try again later.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      source: 'contact_form'
    });
  }
};

// Get all contact form submissions ONLY (NO chat widget data)
const getAllContacts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      projectType,
      priority,
      search
    } = req.query;

    let filter = { source: 'contact_form' };
    
    if (status) filter.status = status;
    if (projectType) filter.projectType = projectType;
    if (priority) filter.priority = priority;
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const contacts = await Contact.find(filter)
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Contact.countDocuments(filter);

    console.log(`📝 Retrieved ${contacts.length} contact form submissions`);

    res.json({
      success: true,
      contacts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalContacts: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      },
      source: 'contact_form',
      message: 'Contact form submissions only (no chat widget data)'
    });
  } catch (error) {
    console.error('❌ Error fetching contact form submissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contact form submissions',
      source: 'contact_form'
    });
  }
};

// Get single contact by ID (contact forms only)
const getContactById = async (req, res) => {
  try {
    const contact = await Contact.findOne({
      _id: req.params.id,
      source: 'contact_form'
    }).populate('assignedTo', 'name email');

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact form submission not found',
        source: 'contact_form'
      });
    }

    res.json({
      success: true,
      contact,
      source: 'contact_form'
    });
  } catch (error) {
    console.error('❌ Error fetching contact form submission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contact form submission',
      source: 'contact_form'
    });
  }
};

// Update contact form submission
const updateContact = async (req, res) => {
  try {
    const updates = req.body;
    
    updates.source = 'contact_form';
    
    delete updates._id;
    delete updates.createdAt;
    delete updates.updatedAt;

    const contact = await Contact.findOneAndUpdate(
      { 
        _id: req.params.id,
        source: 'contact_form'
      },
      { ...updates, lastContactDate: new Date() },
      { new: true, runValidators: true }
    ).populate('assignedTo', 'name email');

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact form submission not found',
        source: 'contact_form'
      });
    }

    console.log('✅ Contact form submission updated:', contact._id);

    res.json({
      success: true,
      contact,
      message: 'Contact form submission updated successfully',
      source: 'contact_form'
    });
  } catch (error) {
    console.error('❌ Error updating contact form submission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update contact form submission',
      source: 'contact_form'
    });
  }
};

// Get contact form statistics ONLY
const getContactStats = async (req, res) => {
  try {
    const contactFormFilter = { source: 'contact_form' };
    const totalContacts = await Contact.countDocuments(contactFormFilter);
    
    const statusStats = await Contact.aggregate([
      { $match: contactFormFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const projectTypeStats = await Contact.aggregate([
      { $match: { ...contactFormFilter, projectType: { $ne: null } } },
      { $group: { _id: '$projectType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentContacts = await Contact.countDocuments({
      ...contactFormFilter,
      createdAt: { $gte: thirtyDaysAgo }
    });

    const tradeshowStats = await Contact.aggregate([
      { $match: { ...contactFormFilter, tradeshowResponse: { $ne: null } } },
      { $group: { _id: '$tradeshowResponse', count: { $sum: 1 } } }
    ]);

    console.log('📝 Generated contact form statistics');

    res.json({
      success: true,
      stats: {
        totalContacts,
        statusStats,
        projectTypeStats,
        tradeshowStats,
        recentContacts,
        source: 'contact_form'
      },
      message: 'Contact form statistics only (no chat widget data)',
      timestamp: new Date()
    });
  } catch (error) {
    console.error('❌ Error fetching contact form statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch contact form statistics',
      source: 'contact_form'
    });
  }
};

// Delete contact form submission
const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findOneAndDelete({
      _id: req.params.id,
      source: 'contact_form'
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact form submission not found',
        source: 'contact_form'
      });
    }

    console.log('🗑️ Contact form submission deleted:', contact._id);

    res.json({
      success: true,
      message: 'Contact form submission deleted successfully',
      deletedContact: {
        id: contact._id,
        name: contact.name,
        email: contact.email
      },
      source: 'contact_form'
    });
  } catch (error) {
    console.error('❌ Error deleting contact form submission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete contact form submission',
      source: 'contact_form'
    });
  }
};

module.exports = {
  handleContactForm,
  getAllContacts,
  getContactById,
  updateContact,
  getContactStats,
  deleteContact
};