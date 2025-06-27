const cors = require('cors');

// Configure CORS options for public access
const corsOptions = {
  origin: ['https://www.leasy.com.pl'], // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

module.exports = cors(corsOptions); 