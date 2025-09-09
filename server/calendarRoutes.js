const express = require('express');
const verifyToken = require('./auth');
const router = express.Router();

console.log('🗓️ CalendarRoutes module loaded successfully');

// Debug middleware
router.use((req, res, next) => {
    console.log(`🎯 CALENDAR ROUTER: ${req.method} ${req.originalUrl}`);
    next();
});

// Test endpoint
router.get('/test', (req, res) => {
    console.log('🧪 CALENDAR TEST HIT!');
    res.json({ 
        message: 'Calendar API is working!',
        timestamp: new Date().toISOString()
    });
});

// Calendar events endpoint
router.get('/events', verifyToken, async (req, res) => {
    try {
        const { get, all } = require('./database');
        const userId = req.user.id;
        console.log('🗓️ Fetching calendar events for user:', userId);
        
        // Get all boards with due dates
        const boardEvents = await all(`
            SELECT b.id, b.title, b.due_date, b.responsible
            FROM boards b 
            WHERE b.user_id_creator = ? 
            AND b.due_date IS NOT NULL
            ORDER BY b.due_date ASC
        `, [userId]);

        console.log(`📊 Found ${boardEvents.length} board events for user ${userId}`);

        // Format events for FullCalendar
        const calendarEvents = boardEvents.map(event => {
            // Color based on due date
            let backgroundColor;
            let borderColor;
            
            // Check if overdue
            const dueDate = new Date(event.due_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (dueDate < today) {
                backgroundColor = '#dc3545'; // red for overdue
                borderColor = '#b02a37';
            } else if (dueDate.toDateString() === today.toDateString()) {
                backgroundColor = '#fd7e14'; // orange for today
                borderColor = '#e8681a';
            } else {
                backgroundColor = '#0d6efd'; // blue for future
                borderColor = '#0a58ca';
            }

            return {
                id: `board-${event.id}`,
                title: event.title,
                start: event.due_date,
                backgroundColor: backgroundColor,
                borderColor: borderColor,
                textColor: '#ffffff',
                extendedProps: {
                    description: '',
                    priority: 'medium',
                    status: 'in_progress',
                    boardTitle: event.title,
                    responsible: event.responsible,
                    boardId: event.id,
                    columnTitle: ''
                }
            };
        });

        console.log(`✅ Returning ${calendarEvents.length} formatted events`);

        res.json({
            message: 'Calendar events retrieved successfully',
            data: calendarEvents
        });
    } catch (error) {
        console.error('Calendar events error:', error);
        res.status(500).json({ 
            message: 'Error fetching calendar events', 
            error: error.message 
        });
    }
});

// Update board due date endpoint (for calendar drag & drop)
router.put('/events/:eventId', verifyToken, async (req, res) => {
    try {
        const { get, run } = require('./database');
        const userId = req.user.id;
        const eventId = req.params.eventId;
        const { start } = req.body;
        
        // Remove "board-" prefix if present
        const boardId = eventId.replace('board-', '');
        
        console.log('📅 Updating board due date:', { boardId, start });
        
        // Verify the board belongs to the user
        const board = await get(`
            SELECT id 
            FROM boards
            WHERE id = ? AND user_id_creator = ?
        `, [boardId, userId]);
        
        if (!board) {
            return res.status(404).json({ 
                message: 'Board not found or access denied' 
            });
        }
        
        // Update the board's due date
        await run(`
            UPDATE boards 
            SET due_date = ? 
            WHERE id = ?
        `, [start, boardId]);
        
        res.json({
            message: 'Board due date updated successfully',
            data: { id: eventId, due_date: start }
        });
    } catch (error) {
        console.error('Calendar update error:', error);
        res.status(500).json({ 
            message: 'Error updating board due date', 
            error: error.message 
        });
    }
});

module.exports = router;