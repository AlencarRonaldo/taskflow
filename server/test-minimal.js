/**
 * MINIMAL TEST SERVER - PHASE 2 DEBUGGING
 * Purpose: Validate basic Express.js functionality without middlewares
 * Test basic routing capabilities to isolate the core problem
 */

const express = require('express');
const app = express();

const PORT = process.env.PORT || 9999;

// Basic Express configuration
app.use(express.json());

// Test Routes
app.get('/', (req, res) => {
  console.log('GET / - Root endpoint accessed');
  res.json({
    status: 'minimal server works',
    message: 'Root endpoint is functioning',
    timestamp: new Date().toISOString(),
    server: 'test-minimal.js'
  });
});

app.get('/test', (req, res) => {
  console.log('GET /test - Test endpoint accessed');
  res.json({
    test: 'ok',
    message: 'Basic test endpoint working',
    timestamp: new Date().toISOString(),
    server: 'test-minimal.js'
  });
});

app.get('/api/test', (req, res) => {
  console.log('GET /api/test - API test endpoint accessed');
  res.json({
    api: 'working',
    message: 'API endpoint functioning',
    timestamp: new Date().toISOString(),
    server: 'test-minimal.js'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('GET /health - Health check accessed');
  res.json({
    status: 'healthy',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    server: 'test-minimal.js'
  });
});

// Additional API routes for testing
app.get('/api/health', (req, res) => {
  console.log('GET /api/health - API health check accessed');
  res.json({
    status: 'healthy',
    api: 'functional',
    message: 'API health check working',
    timestamp: new Date().toISOString(),
    server: 'test-minimal.js'
  });
});

// 404 handler
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    url: req.originalUrl,
    message: 'This endpoint does not exist in the minimal server',
    server: 'test-minimal.js'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error occurred:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message || 'Unknown error occurred',
    server: 'test-minimal.js'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log('MINIMAL TEST SERVER STARTED');
  console.log('='.repeat(50));
  console.log(`Server running on port: ${PORT}`);
  console.log(`Server URL: http://localhost:${PORT}`);
  console.log('');
  console.log('Available endpoints:');
  console.log(`  GET  http://localhost:${PORT}/`);
  console.log(`  GET  http://localhost:${PORT}/test`);
  console.log(`  GET  http://localhost:${PORT}/api/test`);
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log(`  GET  http://localhost:${PORT}/api/health`);
  console.log('');
  console.log('This minimal server tests basic Express routing');
  console.log('without any custom middlewares or complex configurations.');
  console.log('='.repeat(50));
});

module.exports = app;