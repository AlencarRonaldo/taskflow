const { run } = require('./database');

// Function to update board's last_updated information
const updateBoardLastModified = async (boardId, userId) => {
    try {
        await run(`
            UPDATE boards 
            SET last_updated_by = ?, last_updated_at = datetime('now') 
            WHERE id = ?
        `, [userId, boardId]);
        console.log(`Updated last_updated info for board ${boardId} by user ${userId}`);
    } catch (error) {
        console.error('Error updating board last_updated info:', error);
    }
};

// Function to get board ID from card ID
const getBoardIdFromCard = async (cardId) => {
    try {
        const { get } = require('./database');
        const result = await get(`
            SELECT b.id as board_id 
            FROM boards b
            JOIN columns c ON b.id = c.board_id
            JOIN cards card ON c.id = card.column_id
            WHERE card.id = ?
        `, [cardId]);
        return result ? result.board_id : null;
    } catch (error) {
        console.error('Error getting board ID from card:', error);
        return null;
    }
};

// Function to get board ID from column ID
const getBoardIdFromColumn = async (columnId) => {
    try {
        const { get } = require('./database');
        const result = await get(`
            SELECT board_id FROM columns WHERE id = ?
        `, [columnId]);
        return result ? result.board_id : null;
    } catch (error) {
        console.error('Error getting board ID from column:', error);
        return null;
    }
};

module.exports = {
    updateBoardLastModified,
    getBoardIdFromCard,
    getBoardIdFromColumn
};