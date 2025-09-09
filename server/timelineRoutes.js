const express = require('express');
const router = express.Router();
const { all } = require('./database');
const verifyToken = require('./auth');

// GET /api/timeline/events - Get timeline events data
router.get('/events', verifyToken, async (req, res) => {
    try {
        const events = await all(`
            SELECT 
                c.id,
                c.title,
                c.description,
                c.due_date as start,
                c.due_date as end,
                c.status,
                c.priority,
                c.assignee_id,
                b.id as board_id,
                b.title as board_title,
                b.responsible,
                col.title as column_title
            FROM cards c
            JOIN columns col ON c.column_id = col.id
            JOIN boards b ON col.board_id = b.id
            WHERE c.due_date IS NOT NULL
            ORDER BY c.due_date ASC
        `);

        // Transform data for timeline format
        const timelineEvents = events.map(event => ({
            id: event.id,
            title: event.title,
            description: event.description,
            start: new Date(event.start),
            end: event.end ? new Date(event.end) : new Date(event.start),
            board_id: event.board_id,
            board_title: event.board_title,
            status: event.column_title || event.status,
            priority: event.priority || 'Média',
            responsible: event.responsible,
            color: getPriorityColor(event.priority || 'Média')
        }));

        res.json({
            message: 'Timeline events retrieved successfully',
            data: timelineEvents
        });

    } catch (error) {
        console.error('Timeline events fetch error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch timeline events',
            details: error.message 
        });
    }
});

// Helper function to get priority color
function getPriorityColor(priority) {
    switch (priority.toLowerCase()) {
        case 'baixa':
            return '#28a745';
        case 'média':
            return '#ffc107';
        case 'alta':
            return '#fd7e14';
        case 'crítica':
            return '#dc3545';
        default:
            return '#6c757d';
    }
}

module.exports = router;