const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { get, all } = require('./database');

const app = express();
const port = 8002; // Different port to avoid conflicts
const JWT_SECRET = "super-secret-key-for-jwt";

console.log('🗓️ Starting Calendar Server...');

// Middleware
app.use(cors());
app.use(express.json());

// Auth middleware
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log('🔐 AUTH:', { authHeader: authHeader ? 'EXISTS' : 'MISSING', token: token ? 'EXISTS' : 'MISSING' });

    if (!token) {
        console.log('❌ No token provided');
        return res.status(403).send({ message: 'No token provided!' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.log('❌ JWT verification failed:', err.message);
            return res.status(401).send({ message: 'Unauthorized!' });
        }
        console.log('✅ JWT verified, user:', decoded);
        req.user = decoded;
        next();
    });
};

// Debug middleware for all API routes
app.use('/api', (req, res, next) => {
    console.log(`🎯 API HIT: ${req.method} ${req.originalUrl}`);
    next();
});

// Calendar routes
const calendarRouter = express.Router();

// Test endpoint
calendarRouter.get('/test', (req, res) => {
    console.log('🧪 CALENDAR TEST HIT!');
    res.json({ 
        message: 'Calendar API is working!',
        timestamp: new Date().toISOString()
    });
});

// Calendar events endpoint
calendarRouter.get('/events', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log('🗓️ Fetching calendar events for user:', userId);
        
        // Get all cards with due dates for the user's boards
        const events = await all(`
            SELECT c.id, c.title, c.description, c.due_date, c.priority, c.status,
                   b.title as board_title, b.responsible, b.id as board_id,
                   col.title as column_title
            FROM cards c 
            JOIN columns col ON c.column_id = col.id 
            JOIN boards b ON col.board_id = b.id 
            WHERE b.user_id_creator = ? 
            AND c.due_date IS NOT NULL
            ORDER BY c.due_date ASC
        `, [userId]);

        console.log(`📊 Found ${events.length} events for user ${userId}`);
        
        // Format events for FullCalendar
        const calendarEvents = events.map(event => {
            // Priority color mapping
            let backgroundColor;
            let borderColor;
            switch(event.priority) {
                case 'critical':
                    backgroundColor = '#dc3545'; // red
                    borderColor = '#b02a37';
                    break;
                case 'high':
                    backgroundColor = '#fd7e14'; // orange
                    borderColor = '#e8681a';
                    break;
                case 'medium':
                    backgroundColor = '#0d6efd'; // blue
                    borderColor = '#0a58ca';
                    break;
                case 'low':
                    backgroundColor = '#198754'; // green
                    borderColor = '#146c43';
                    break;
                default:
                    backgroundColor = '#6c757d'; // gray
                    borderColor = '#5c636a';
            }

            // Add transparency for completed tasks
            if (event.status === 'completed') {
                backgroundColor += '80'; // 50% opacity
                borderColor += '80';
            }

            return {
                id: event.id,
                title: event.title,
                start: event.due_date,
                backgroundColor: backgroundColor,
                borderColor: borderColor,
                textColor: '#ffffff',
                extendedProps: {
                    description: event.description || '',
                    priority: event.priority || 'medium',
                    status: event.status || 'todo',
                    boardTitle: event.board_title,
                    responsible: event.responsible,
                    boardId: event.board_id,
                    columnTitle: event.column_title
                }
            };
        });

        console.log(`✅ Returning ${calendarEvents.length} formatted events`);
        
        res.json({
            message: 'Calendar events retrieved successfully',
            data: calendarEvents
        });
    } catch (error) {
        console.error('❌ Calendar events error:', error);
        res.status(500).json({ 
            message: 'Error fetching calendar events', 
            error: error.message 
        });
    }
});

// Mount calendar routes
app.use('/api/calendar', calendarRouter);

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'Calendar Server is running',
        endpoints: {
            test: '/api/calendar/test',
            events: '/api/calendar/events (requires auth)'
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        server: 'Calendar Server'
    });
});

app.listen(port, () => {
    console.log(`🎯 Calendar Server running on port ${port}`);
    console.log(`📋 Test: http://localhost:${port}/api/calendar/test`);
    console.log(`🗓️ Events: http://localhost:${port}/api/calendar/events`);
    console.log(`💚 Health: http://localhost:${port}/health`);
});