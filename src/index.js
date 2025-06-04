const express = require('express');
const dotenv = require('dotenv'); // Load environment variables
const connectDB = require('./config/db');
const v1Router = require('./routes/v1/index');
const path = require('path');
const corsMiddleware = require('./config/cors-config');

dotenv.config();

// Call MongoDB connection
connectDB();
console.log('db connected');

const app = express();
console.log('going to parse requests parsed');

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// CORS middleware
app.use(corsMiddleware);

// Middleware
app.use(express.json()); // Parse incoming JSON requests
console.log('incoming requests parsed');

app.use(express.static(path.join(__dirname, '../public'))); 

// Routes
app.use('/api/v1', v1Router);
console.log('apis called');

// Vercel serverless function health check
app.get('/_health', (req, res) => {
  res.status(200).json({ status: 'ok', environment: process.env.NODE_ENV });
});

// Error handling middleware (optional)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});
console.log('error in middleware');

// Export the app for use in the server.js file
module.exports = app;