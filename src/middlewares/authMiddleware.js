const jwt = require('jsonwebtoken');
const User = require('../models/User');


const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) throw new CustomError('No token provided', 401);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded Token:', decoded); // Debug

    // Add this verification - ensure we get the full user document
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      console.error('User not found in database for ID:', decoded.userId);
      throw new CustomError('User not found', 404);
    }

    req.user = user; // Attach full user document
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);
    res.status(401).json({ success: false, error: 'Unauthorized' });
  }
};

module.exports = { authMiddleware };