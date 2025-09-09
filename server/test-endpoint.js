const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// Add middleware to log all requests
app.use((req, res, next) => {
    console.log(`🌍 [${req.method}] ${req.url}`);
    next();
});

// Simple test endpoint
app.post('/api/public/:token/cards/:cardId/comment', async (req, res) => {
    console.log('🎯 PUBLIC COMMENT ENDPOINT HIT!', req.url);
    console.log('Token:', req.params.token);
    console.log('CardId:', req.params.cardId);
    console.log('Body:', req.body);
    res.json({ message: 'Public comment endpoint reached successfully!' });
});

// Simulate the problematic routes that might be interfering
const verifyToken = (req, res, next) => {
    console.log('🚨 verifyToken middleware called!', req.url);
    return res.status(403).send({ message: 'No token provided!' });
};

// Simulate board routes
app.use('/api/boards', verifyToken, (req, res, next) => {
    console.log('Board route hit:', req.url);
    res.json({ message: 'Board route' });
});

const HTTP_PORT = 8001; // Use a different port to avoid conflicts

app.listen(HTTP_PORT, () => {
    console.log(`Test server running on port ${HTTP_PORT}`);
    console.log('Test the endpoint with:');
    console.log(`curl -X POST http://localhost:${HTTP_PORT}/api/public/055994a9bea9b5c4481db6acdf65ff5b5c1eb4b57b4d74a7d310a97cf71f77a4/cards/1/comment -H "Content-Type: application/json" -d '{"content": "Test comment", "technicianName": "Test User", "technicianPhone": "123456789"}'`);
});