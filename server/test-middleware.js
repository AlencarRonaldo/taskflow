/**
 * INCREMENTAL MIDDLEWARE TEST SERVER - PHASE 2 DEBUGGING
 * Purpose: Add middlewares one by one to identify which one causes routing failures
 * Based on the middleware order in the main index.js file
 */

const express = require('express');
const cors = require("cors");

// Import the middleware functions to test
const { 
  securityMiddleware, 
  loggingMiddleware, 
  apiVersioning, 
  errorHandler, 
  healthCheck 
} = require('./apiMiddleware');

const app = express();
const PORT = process.env.PORT || 8888;

// Phase tracking for incremental testing
let currentPhase = 0;
const phases = [
  'PHASE 0: Basic Express only',
  'PHASE 1: Added CORS',
  'PHASE 2: Added Security Middleware',
  'PHASE 3: Added Logging Middleware',
  'PHASE 4: Added API Versioning', // This is the suspected culprit!
  'PHASE 5: Added JSON Parser',
  'PHASE 6: Added URL Encoded Parser'
];

// Test Routes (same as minimal server)
app.get('/', (req, res) => {
  console.log(`✅ GET / - ${phases[currentPhase]} - ROOT WORKING`);
  res.json({
    status: 'middleware test works',
    phase: currentPhase,
    phaseDescription: phases[currentPhase],
    message: 'Root endpoint is functioning',
    timestamp: new Date().toISOString(),
    server: 'test-middleware.js'
  });
});

app.get('/test', (req, res) => {
  console.log(`✅ GET /test - ${phases[currentPhase]} - TEST WORKING`);
  res.json({
    test: 'ok',
    phase: currentPhase,
    phaseDescription: phases[currentPhase],
    message: 'Test endpoint working',
    timestamp: new Date().toISOString(),
    server: 'test-middleware.js'
  });
});

app.get('/api/test', (req, res) => {
  console.log(`✅ GET /api/test - ${phases[currentPhase]} - API TEST WORKING`);
  res.json({
    api: 'working',
    phase: currentPhase,
    phaseDescription: phases[currentPhase],
    message: 'API test endpoint functioning',
    timestamp: new Date().toISOString(),
    server: 'test-middleware.js'
  });
});

app.get('/health', (req, res) => {
  console.log(`✅ GET /health - ${phases[currentPhase]} - HEALTH WORKING`);
  res.json({
    status: 'healthy',
    phase: currentPhase,
    phaseDescription: phases[currentPhase],
    message: 'Health check working',
    timestamp: new Date().toISOString(),
    server: 'test-middleware.js'
  });
});

app.get('/api/health', (req, res) => {
  console.log(`✅ GET /api/health - ${phases[currentPhase]} - API HEALTH WORKING`);
  res.json({
    status: 'healthy',
    api: 'functional',
    phase: currentPhase,
    phaseDescription: phases[currentPhase],
    message: 'API health check working',
    timestamp: new Date().toISOString(),
    server: 'test-middleware.js'
  });
});

// Special endpoint to show current phase
app.get('/phase', (req, res) => {
  res.json({
    currentPhase,
    phaseDescription: phases[currentPhase],
    allPhases: phases,
    message: 'Current middleware phase information',
    server: 'test-middleware.js'
  });
});

// INCREMENTAL MIDDLEWARE ADDITION
// Uncomment the lines below ONE AT A TIME to test each middleware

// PHASE 1: Add CORS
console.log('🧪 ACTIVATING PHASE 1: Adding CORS middleware');
currentPhase = 1;
app.use(cors());

// PHASE 2: Add Security Middleware  
console.log('🧪 ACTIVATING PHASE 2: Adding Security middleware');
currentPhase = 2;
app.use(securityMiddleware);

// PHASE 3: Add Logging Middleware
console.log('🧪 ACTIVATING PHASE 3: Adding Logging middleware');  
currentPhase = 3;
app.use(loggingMiddleware);

// PHASE 4: Add API Versioning (CRITICAL TEST!)
console.log('🧪 ACTIVATING PHASE 4: Adding API Versioning middleware (SUSPECT!)');
currentPhase = 4;
app.use(apiVersioning); // <-- This is likely the problem!

// PHASE 5: Add JSON Parser
console.log('🧪 ACTIVATING PHASE 5: Adding JSON parser');
currentPhase = 5;
app.use(express.json());

// PHASE 6: Add URL Encoded Parser
console.log('🧪 ACTIVATING PHASE 6: Adding URL Encoded parser');
currentPhase = 6;
app.use(express.urlencoded({ extended: true }));

// 404 handler (safe version without wildcard)
app.use((req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl} (Phase ${currentPhase})`);
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    url: req.originalUrl,
    phase: currentPhase,
    phaseDescription: phases[currentPhase],
    message: 'This endpoint does not exist in the middleware test server',
    server: 'test-middleware.js'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(`💥 Error occurred (Phase ${currentPhase}):`, err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message || 'Unknown error occurred',
    phase: currentPhase,
    phaseDescription: phases[currentPhase],
    server: 'test-middleware.js'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🧪 INCREMENTAL MIDDLEWARE TEST SERVER STARTED');
  console.log('='.repeat(60));
  console.log(`🚀 Server running on port: ${PORT}`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
  console.log(`📊 Current Phase: ${currentPhase} - ${phases[currentPhase]}`);
  console.log('');
  console.log('🎯 Available test endpoints:');
  console.log(`  GET  http://localhost:${PORT}/`);
  console.log(`  GET  http://localhost:${PORT}/test`);
  console.log(`  GET  http://localhost:${PORT}/api/test`);
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log(`  GET  http://localhost:${PORT}/api/health`);
  console.log(`  GET  http://localhost:${PORT}/phase`);
  console.log('');
  console.log('🔍 This server will test middlewares incrementally.');
  console.log('⚠️  If any endpoint stops working, the last added middleware is the culprit!');
  console.log('='.repeat(60));
});

module.exports = app;