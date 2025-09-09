const express = require('express');
const app = express();

// Simple middleware test
app.use(express.json());

// Test calendar route
app.get('/api/calendar/events', (req, res) => {
    console.log('CALENDAR ROUTE HIT!');
    res.json({ message: 'Calendar route working!', timestamp: new Date().toISOString() });
});

// Test fallback
app.use('*', (req, res) => {
    console.log('FALLBACK HIT:', req.method, req.originalUrl);
    res.status(404).json({ message: 'Not Found', path: req.originalUrl });
});

const PORT = process.env.PORT || 8999;
app.listen(PORT, () => {
    console.log(`Simple test server running on port ${PORT}`);
});