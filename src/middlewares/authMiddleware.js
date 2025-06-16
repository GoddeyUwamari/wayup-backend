const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const asyncHandler = require('express-async-handler');

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select('-password');

      next();
    } catch (error) {
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
});

module.exports = { protect };





// const jwt = require('jsonwebtoken');
// const asyncHandler = require('express-async-handler');
// const User = require('../models/userModel');

// const protect = asyncHandler(async (req, res, next) => {
//   let token;

//   // Check if the authorization header is present and starts with "Bearer"
//   if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
//     try {
//       // Extract the token from the authorization header
//       token = req.headers.authorization.split(' ')[1];

//       // Verify the token
//       const decoded = jwt.verify(token, process.env.JWT_SECRET); // Corrected the jwt.verify function

//       // Find the user associated with the token and attach it to the req object (optional)
//       req.user = await User.findById(decoded.id).select('-password'); // Optional: Attaching user to req object

//       next(); // Call the next middleware or route handler
//     } catch (error) {
//       console.log(error);
//       res.status(401); // Changed status to 401 for unauthorized
//       throw new Error('Not authorized');
//     }
//   } else {
//     // If no token is found in the authorization header
//     res.status(401);
//     throw new Error('Not authorized, no token');
//   }
// });

// module.exports = { protect };