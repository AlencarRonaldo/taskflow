const express = require('express');
const app = express();
const port = 8001; // Using different port to avoid conflicts

console.log('🚀 Starting simple test server...');

// Basic middleware
app.use(express.json());

// Test middleware
app.use('/api', (req, res, next) => {
    console.log(`✅ API MIDDLEWARE: ${req.method} ${req.originalUrl}`);
    next();
});

// Simple calendar routes
const calendarRouter = express.Router();

calendarRouter.get('/test', (req, res) => {
    console.log('🧪 CALENDAR TEST HIT!');
    res.json({ message: 'Calendar test working!' });
});

calendarRouter.get('/events', (req, res) => {
    console.log('🗓️ CALENDAR EVENTS HIT!');
    res.json({ message: 'Calendar events', data: ['test event'] });
});

app.use('/api/calendar', calendarRouter);

// Root route
app.get('/', (req, res) => {
    res.json({ message: 'Simple test server working' });
});

app.listen(port, () => {
    console.log(`🎯 Simple test server running on port ${port}`);
    console.log(`Test: http://localhost:${port}/api/calendar/test`);
});