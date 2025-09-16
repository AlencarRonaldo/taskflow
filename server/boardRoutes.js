const express = require('express');
const router = express.Router();
const { run, get, all } = require('./database');
const verifyToken = require('./auth'); // Assuming auth.js exports verifyToken
const { updateBoardLastModified, getBoardIdFromCard, getBoardIdFromColumn } = require('./updateTracking');
const automationWorker = require('./automationWorker');

// Get all boards for the authenticated user
router.get('/boards', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const projectId = req.query.project_id;

        let query = `
            SELECT b.id, b.title, b.user_id_creator, b.due_date, b.created_at, b.responsible,
                   b.last_updated_by, b.last_updated_at, b.project_id,
                   u.name as last_updated_user_name,
                   u.email as last_updated_user_email
            FROM boards b
            LEFT JOIN users u ON b.last_updated_by = u.id
            WHERE b.user_id_creator = ?`;
        
        const params = [userId];
        if (projectId) {
            query += ` AND b.project_id = ?`;
            params.push(projectId);
        }
        // Removido ORDER BY para permitir ordenação no frontend

        let boards = await all(query, params);

        // Recalculate completion status for each board on the fly
        for (let board of boards) {
            const cards = await all('SELECT status FROM cards WHERE column_id IN (SELECT id FROM columns WHERE board_id = ?)', [board.id]);
            const allCompleted = cards.length > 0 && cards.every(card => card.status === 'completed');
            
            // Update the board object for the response
            board.allTasksCompleted = allCompleted;

            // Update the database to correct any stale data
            await run('UPDATE boards SET allTasksCompleted = ? WHERE id = ?', [allCompleted ? 1 : 0, board.id]);
        }

        res.json({ message: 'success', data: boards });

    } catch (err) {
        console.error('Critical error in /boards endpoint:', err);
        res.status(500).json({ message: 'error', error: err.message });
    }
});

// Get a specific board with its columns and cards
router.get('/boards/:id', verifyToken, async (req, res) => {
    try {
        const boardId = req.params.id;
        const userId = req.user.id;

        let board = null;
        
        try {
            // Try the full query first
            board = await get('SELECT id, title, user_id_creator, due_date, created_at FROM boards WHERE id = ? AND user_id_creator = ?', [boardId, userId]);
            console.log('Full single board query succeeded');
        } catch (fullQueryError) {
            console.log('Full single board query failed:', fullQueryError.message);
            
            try {
                // Try without due_date and created_at
                board = await get('SELECT id, title, user_id_creator FROM boards WHERE id = ? AND user_id_creator = ?', [boardId, userId]);
                console.log('Basic single board query succeeded');
                
                // Add null values for missing fields
                if (board) {
                    board.due_date = null;
                    board.created_at = null;
                }
            } catch (basicQueryError) {
                console.log('Basic single board query failed:', basicQueryError.message);
                
                // Last resort - minimal query
                board = await get('SELECT id, title FROM boards WHERE id = ? AND user_id_creator = ?', [boardId, userId]);
                console.log('Minimal single board query succeeded');
                
                if (board) {
                    board.user_id_creator = userId;
                    board.due_date = null;
                    board.created_at = null;
                }
            }
        }

        if (board) {
            board.background_image = null;
            board.background_color = null;
        }
        if (!board) {
            return res.status(404).json({ error: 'Board not found or not authorized' });
        }

        const columns = await all('SELECT id, title, order_index FROM columns WHERE board_id = ? ORDER BY order_index ASC', [boardId]);

        for (let column of columns) {
            try {
                // Try to get cards with due_date and priority columns
                column.cards = await all('SELECT id, title, description, order_index, status, priority, due_date FROM cards WHERE column_id = ? ORDER BY order_index ASC', [column.id]);
            } catch (cardQueryError) {
                console.log('Cards query with due_date/priority failed, trying without:', cardQueryError.message);
                try {
                    // Fallback: get cards without due_date and priority columns
                    column.cards = await all('SELECT id, title, description, order_index, status FROM cards WHERE column_id = ? ORDER BY order_index ASC', [column.id]);
                    // Add null due_date and default priority to each card
                    column.cards.forEach(card => {
                        card.due_date = null;
                        card.priority = 'medium';
                    });
                } catch (fallbackError) {
                    console.error('Both card queries failed:', fallbackError.message);
                    column.cards = [];
                }
            }
            
            for (let card of column.cards) {
                card.comments = await all('SELECT id, content, user_id_author, timestamp FROM comments WHERE card_id = ? ORDER BY timestamp ASC', [card.id]);
                // Get card labels
                card.labels = await all(`
                    SELECT l.id, l.name, l.color 
                    FROM labels l 
                    JOIN card_labels cl ON l.id = cl.label_id 
                    WHERE cl.card_id = ? 
                    ORDER BY l.name
                `, [card.id]);
            }
        }

        // Calculate if all tasks are completed
        let allTasksCompleted = false;
        try {
            let allCards = [];
            for (let column of columns) {
                if (column.cards) {
                    allCards = allCards.concat(column.cards);
                }
            }
            allTasksCompleted = allCards.length > 0 && allCards.every(card => card.status === 'completed');
            
            // Update the board with the correct status to prevent stale data
            await run('UPDATE boards SET allTasksCompleted = ? WHERE id = ?', [allTasksCompleted ? 1 : 0, boardId]);

        } catch (statusError) {
            console.log('Could not calculate completion status:', statusError.message);
        }

        res.json({ message: 'success', data: { ...board, columns, allTasksCompleted } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new board
router.post('/boards', verifyToken, async (req, res) => {
    try {
        const { title, due_date, responsible, project_id, description, background_color } = req.body;
        const userId = req.user.id;
        
        if (!title) {
            return res.status(400).json({ error: 'Board title is required' });
        }
        if (!responsible) {
            return res.status(400).json({ error: 'Board responsible is required' });
        }
        
        // Se project_id fornecido, verificar se existe e se o usuário tem acesso
        if (project_id) {
            const project = await get('SELECT id FROM projects WHERE id = ? AND (owner_id = ? OR id IN (SELECT project_id FROM project_members WHERE user_id = ?))', 
                [project_id, userId, userId]);
            if (!project) {
                return res.status(404).json({ error: 'Project not found or access denied' });
            }
        }
        
        const result = await run(
            'INSERT INTO boards (title, user_id_creator, due_date, responsible, project_id, description, background_color, last_updated_by, last_updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime("now"))', 
            [title, userId, due_date || null, responsible, project_id || null, description || null, background_color || '#f8f9fa', userId]
        );
        
        const boardId = result.id;
        console.log(`📋 Board "${title}" criado com ID ${boardId}, criando estrutura padrão...`);
        
        // Criar estrutura padrão do board (colunas e cards de exemplo)
        const createBoardStructure = require('./createBoardStructure');
        try {
            await createBoardStructure(boardId, userId);
            console.log(`✅ Estrutura padrão criada para board ${boardId}`);
        } catch (structureError) {
            console.error(`❌ Erro ao criar estrutura do board ${boardId}:`, structureError);
            // Não falhar a criação do board se houver erro na estrutura
        }
        
        res.status(201).json({ 
            message: 'success', 
            data: { 
                id: boardId, 
                title, 
                user_id_creator: userId, 
                due_date: due_date || null, 
                responsible,
                project_id: project_id || null,
                description: description || null,
                background_color: background_color || '#f8f9fa'
            } 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update board title
router.put('/boards/:id', verifyToken, async (req, res) => {
    try {
        const boardId = req.params.id;
        const userId = req.user.id;
        const { title, due_date, responsible } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Board title is required' });
        }

        if (!responsible) {
            return res.status(400).json({ error: 'Board responsible is required' });
        }

        const board = await get('SELECT id FROM boards WHERE id = ? AND user_id_creator = ?', [boardId, userId]);
        if (!board) {
            return res.status(404).json({ error: 'Board not found or not authorized' });
        }

        await run('UPDATE boards SET title = ?, due_date = ?, responsible = ?, last_updated_by = ?, last_updated_at = datetime("now") WHERE id = ?', 
            [title, due_date || null, responsible, userId, boardId]);
        res.json({ message: 'success', data: { id: boardId, title, due_date, responsible } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a board
router.delete('/boards/:id', verifyToken, async (req, res) => {
    try {
        const boardId = req.params.id;
        const userId = req.user.id;

        const board = await get('SELECT id FROM boards WHERE id = ? AND user_id_creator = ?', [boardId, userId]);
        if (!board) {
            return res.status(404).json({ error: 'Board not found or not authorized' });
        }

        // Delete associated cards and columns first
        const columns = await all('SELECT id FROM columns WHERE board_id = ?', [boardId]);
        for (const column of columns) {
            await run('DELETE FROM cards WHERE column_id = ?', [column.id]);
        }
        await run('DELETE FROM columns WHERE board_id = ?', [boardId]);
        await run('DELETE FROM boards WHERE id = ?', [boardId]);

        res.json({ message: 'success', data: { id: boardId } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new column
router.post('/columns', verifyToken, async (req, res) => {
    try {
        const { board_id, title } = req.body;
        const userId = req.user.id;

        if (!board_id || !title) {
            return res.status(400).json({ error: 'Board ID and title are required' });
        }

        const board = await get('SELECT id FROM boards WHERE id = ? AND user_id_creator = ?', [board_id, userId]);
        if (!board) {
            return res.status(404).json({ error: 'Board not found or not authorized' });
        }

        const maxOrder = await get('SELECT MAX(order_index) as maxOrder FROM columns WHERE board_id = ?', [board_id]);
        const newOrder = (maxOrder.maxOrder || 0) + 1;

        const result = await run('INSERT INTO columns (board_id, title, order_index) VALUES (?, ?, ?)', [board_id, title, newOrder]);
        res.status(201).json({ message: 'success', data: { id: result.id, board_id, title, order_index: newOrder } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update column order
router.put('/columns/order', verifyToken, async (req, res) => {
    try {
        const { boardId, order } = req.body; // order is an array of column IDs in the new order
        const userId = req.user.id;

        if (!boardId || !order || !Array.isArray(order)) {
            return res.status(400).json({ error: 'Board ID and order array are required' });
        }

        const board = await get('SELECT id FROM boards WHERE id = ? AND user_id_creator = ?', [boardId, userId]);
        if (!board) {
            return res.status(404).json({ error: 'Board not found or not authorized' });
        }

        for (let i = 0; i < order.length; i++) {
            await run('UPDATE columns SET order_index = ? WHERE id = ? AND board_id = ?', [i + 1, order[i], boardId]);
        }
        res.json({ message: 'success' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update column title
router.put('/columns/:id', verifyToken, async (req, res) => {
    try {
        const columnId = req.params.id;
        const { title } = req.body;
        const userId = req.user.id;

        if (!title) {
            return res.status(400).json({ error: 'Column title is required' });
        }

        const column = await get('SELECT c.id FROM columns c JOIN boards b ON c.board_id = b.id WHERE c.id = ? AND b.user_id_creator = ?', [columnId, userId]);
        if (!column) {
            return res.status(404).json({ error: 'Column not found or not authorized' });
        }

        await run('UPDATE columns SET title = ? WHERE id = ?', [title, columnId]);
        res.json({ message: 'success', data: { id: columnId, title } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a column
router.delete('/columns/:id', verifyToken, async (req, res) => {
    try {
        const columnId = req.params.id;
        const userId = req.user.id;

        const column = await get('SELECT c.id FROM columns c JOIN boards b ON c.board_id = b.id WHERE c.id = ? AND b.user_id_creator = ?', [columnId, userId]);
        if (!column) {
            return res.status(404).json({ error: 'Column not found or not authorized' });
        }

        await run('DELETE FROM cards WHERE column_id = ?', [columnId]);
        await run('DELETE FROM columns WHERE id = ?', [columnId]);

        res.json({ message: 'success', data: { id: columnId } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper function to check for scheduling conflicts
const checkSchedulingConflict = async (due_date, assignee_id, excludeCardId = null) => {
    if (!due_date || !assignee_id) return null;
    
    // Extract date and time from the due_date
    const targetDate = new Date(due_date);
    if (isNaN(targetDate.getTime())) return null;
    
    // Create a 30-minute window around the target time for conflict checking
    const bufferMinutes = 30;
    const conflictStart = new Date(targetDate);
    conflictStart.setMinutes(targetDate.getMinutes() - bufferMinutes);
    
    const conflictEnd = new Date(targetDate);
    conflictEnd.setMinutes(targetDate.getMinutes() + bufferMinutes);
    
    let query = `
        SELECT c.id, c.title, c.due_date 
        FROM cards c 
        WHERE c.assignee_id = ? 
        AND c.due_date IS NOT NULL
        AND c.due_date >= ? 
        AND c.due_date <= ?
    `;
    let params = [assignee_id, conflictStart.toISOString(), conflictEnd.toISOString()];
    
    if (excludeCardId) {
        query += ' AND c.id != ?';
        params.push(excludeCardId);
    }
    
    const conflicts = await all(query, params);
    return conflicts.length > 0 ? conflicts : null;
};

// Update board completion status
const updateBoardCompletionStatus = async (boardId) => {
    try {
        // Get all cards from all columns of the board
        let allCards = [];
        const columns = await all('SELECT id FROM columns WHERE board_id = ?', [boardId]);
        
        for (let column of columns) {
            const cards = await all('SELECT status FROM cards WHERE column_id = ?', [column.id]);
            allCards = allCards.concat(cards);
        }

        // Check if all cards are completed
        // A card is considered completed if:
        // 1. It has status 'completed', OR
        // 2. It's in a column with title containing 'concluído' or 'completed'
        let allTasksCompleted = false;
        if (allCards.length > 0) {
            allTasksCompleted = true;
            for (let card of allCards) {
                if (card.status === 'completed') continue;
                
                // Check if card is in a "completed" column
                const column = await get('SELECT title FROM columns WHERE id = ?', [card.column_id]);
                if (column && column.title) {
                    const columnTitle = column.title.toLowerCase();
                    if (columnTitle.includes('concluído') || columnTitle.includes('completed')) {
                        continue;
                    }
                }
                
                allTasksCompleted = false;
                break;
            }
        }
        
        // Update the board with completion status
        await run('UPDATE boards SET allTasksCompleted = ? WHERE id = ?', [allTasksCompleted ? 1 : 0, boardId]);
        
        console.log(`📋 Board ${boardId} completion status updated: ${allTasksCompleted}`);
        return allTasksCompleted;
    } catch (error) {
        console.error('Error updating board completion status:', error);
        throw error;
    }
};

// Create a new card
router.post('/cards', verifyToken, async (req, res) => {
    try {
        const { column_id, title, description, status, priority, due_date, assignee_id } = req.body;
        const userId = req.user.id;

        if (!column_id || !title) {
            return res.status(400).json({ error: 'Column ID and title are required' });
        }

        const column = await get('SELECT c.id FROM columns c JOIN boards b ON c.board_id = b.id WHERE c.id = ? AND b.user_id_creator = ?', [column_id, userId]);
        if (!column) {
            return res.status(404).json({ error: 'Column not found or not authorized' });
        }

        // Validate assignee_id if provided
        if (assignee_id) {
            const assignee = await get('SELECT id FROM users WHERE id = ?', [assignee_id]);
            if (!assignee) {
                return res.status(400).json({ error: 'Assignee user not found' });
            }
            
            // Check for scheduling conflicts
            const conflicts = await checkSchedulingConflict(due_date, assignee_id);
            if (conflicts) {
                const conflictDetails = conflicts.map(c => 
                    `"${c.title}" em ${new Date(c.due_date).toLocaleString('pt-BR')}`
                ).join(', ');
                return res.status(409).json({ 
                    error: 'Conflito de horário detectado',
                    details: `O responsável já tem compromisso(s) neste horário: ${conflictDetails}`,
                    conflicts: conflicts
                });
            }
        }

        const maxOrder = await get('SELECT MAX(order_index) as maxOrder FROM cards WHERE column_id = ?', [column_id]);
        const newOrder = (maxOrder.maxOrder || 0) + 1;

        const cardStatus = status || 'todo'; // Default to 'todo' if not provided
        const cardPriority = priority || 'medium'; // Default to 'medium' if not provided

        const result = await run('INSERT INTO cards (column_id, title, description, order_index, status, priority, due_date, assignee_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [column_id, title, description || null, newOrder, cardStatus, cardPriority, due_date || null, assignee_id || null]);
        
        // Update board's last_updated information
        const boardId = await getBoardIdFromColumn(column_id);
        if (boardId) {
            await updateBoardLastModified(boardId, userId);
        }
        
        // Create card object for automation trigger
        const newCard = { 
            id: result.id, 
            column_id, 
            title, 
            description: description || null, 
            order_index: newOrder, 
            status: cardStatus, 
            priority: cardPriority, 
            due_date: due_date || null, 
            assignee_id: assignee_id || null 
        };
        
        // Trigger automation for card created
        if (boardId) {
            automationWorker.onCardCreated(newCard, boardId).catch(err => {
                console.error('Error triggering card created automation:', err);
            });
        }

        res.status(201).json({ message: 'success', data: newCard });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update card (title, description, column_id, order_index)
router.put('/cards/:id', verifyToken, async (req, res) => {
    try {
        const cardId = req.params.id;
        const { title, description, column_id, order_index, status, priority, due_date, assignee_id } = req.body;
        const userId = req.user.id;

        if (!title && !description && !column_id && order_index === undefined && status === undefined && priority === undefined && due_date === undefined && assignee_id === undefined) {
            return res.status(400).json({ error: 'No fields to update provided' });
        }

        const card = await get('SELECT ca.id, ca.column_id, ca.assignee_id, ca.due_date FROM cards ca JOIN columns co ON ca.column_id = co.id JOIN boards b ON co.board_id = b.id WHERE ca.id = ? AND b.user_id_creator = ?', [cardId, userId]);
        if (!card) {
            return res.status(404).json({ error: 'Card not found or not authorized' });
        }

        let updateFields = [];
        let updateParams = [];

        if (title !== undefined) {
            updateFields.push('title = ?');
            updateParams.push(title);
        }
        if (description !== undefined) {
            updateFields.push('description = ?');
            updateParams.push(description);
        }
        if (column_id !== undefined) {
            // Verify new column belongs to the same board and user
            const newColumn = await get('SELECT co.id FROM columns co JOIN boards b ON co.board_id = b.id WHERE co.id = ? AND b.user_id_creator = ?', [column_id, userId]);
            if (!newColumn) {
                return res.status(400).json({ error: 'New column not found or not authorized' });
            }
            updateFields.push('column_id = ?');
            updateParams.push(column_id);
        }
        if (order_index !== undefined) {
            updateFields.push('order_index = ?');
            updateParams.push(order_index);
        }
        if (status !== undefined) {
            updateFields.push('status = ?');
            updateParams.push(status);
        }
        if (priority !== undefined) {
            updateFields.push('priority = ?');
            updateParams.push(priority);
        }
        if (due_date !== undefined) {
            updateFields.push('due_date = ?');
            updateParams.push(due_date);
        }
        if (assignee_id !== undefined) {
            // Validate assignee_id if provided
            if (assignee_id) {
                const assignee = await get('SELECT id FROM users WHERE id = ?', [assignee_id]);
                if (!assignee) {
                    return res.status(400).json({ error: 'Assignee user not found' });
                }
            }
            updateFields.push('assignee_id = ?');
            updateParams.push(assignee_id);
        }

        // Check for scheduling conflicts
        const newAssigneeId = assignee_id !== undefined ? assignee_id : card.assignee_id;
        const newDueDate = due_date !== undefined ? due_date : card.due_date;
        
        if (newDueDate && newAssigneeId) {
            const conflicts = await checkSchedulingConflict(newDueDate, newAssigneeId, cardId);
            if (conflicts) {
                const conflictDetails = conflicts.map(c => 
                    `"${c.title}" em ${new Date(c.due_date).toLocaleString('pt-BR')}`
                ).join(', ');
                return res.status(409).json({ 
                    error: 'Conflito de horário detectado',
                    details: `O responsável já tem compromisso(s) neste horário: ${conflictDetails}`,
                    conflicts: conflicts
                });
            }
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update provided' });
        }

        const query = `UPDATE cards SET ${updateFields.join(', ')} WHERE id = ?`;
        updateParams.push(cardId);

        await run(query, updateParams);
        
        // Get old and new card data for automation triggers
        const oldCard = card;
        const newCard = { id: cardId, ...req.body };
        
        // Update board's last_updated information
        const boardId = await getBoardIdFromCard(cardId);
        if (boardId) {
            await updateBoardLastModified(boardId, userId);
            
            // Trigger automations based on changes
            if (column_id !== undefined && column_id !== oldCard.column_id) {
                // Card moved to different column
                const fromColumn = await get('SELECT * FROM columns WHERE id = ?', [oldCard.column_id]);
                const toColumn = await get('SELECT * FROM columns WHERE id = ?', [column_id]);
                
                automationWorker.onCardMoved(newCard, fromColumn, toColumn, boardId).catch(err => {
                    console.error('Error triggering card moved automation:', err);
                });
            } else {
                // Card updated but not moved
                automationWorker.onCardUpdated(oldCard, newCard, boardId).catch(err => {
                    console.error('Error triggering card updated automation:', err);
                });
            }
            
            // Check if card was completed
            if (status === 'completed' && oldCard.status !== 'completed') {
                automationWorker.onCardCompleted(newCard, boardId).catch(err => {
                    console.error('Error triggering card completed automation:', err);
                });
            }
        }
        
        // Update board completion status if status or column_id was changed
        if ((status !== undefined || column_id !== undefined) && boardId) {
            try {
                await updateBoardCompletionStatus(boardId);
            } catch (completionError) {
                console.log('Error updating board completion status:', completionError.message);
            }
        }
        
        res.json({ message: 'success', data: { id: cardId, ...req.body } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a card
router.delete('/cards/:id', verifyToken, async (req, res) => {
    try {
        const cardId = req.params.id;
        const userId = req.user.id;

        const card = await get('SELECT ca.id FROM cards ca JOIN columns co ON ca.column_id = co.id JOIN boards b ON co.board_id = b.id WHERE ca.id = ? AND b.user_id_creator = ?', [cardId, userId]);
        if (!card) {
            return res.status(404).json({ error: 'Card not found or not authorized' });
        }

        await run('DELETE FROM cards WHERE id = ?', [cardId]);
        res.json({ message: 'success', data: { id: cardId } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new comment
router.post('/cards/:id/comments', verifyToken, async (req, res) => {
    try {
        const cardId = req.params.id;
        const { content } = req.body;
        const userId = req.user.id;

        if (!content) {
            return res.status(400).json({ error: 'Comment content is required' });
        }

        const card = await get('SELECT ca.id FROM cards ca JOIN columns co ON ca.column_id = co.id JOIN boards b ON co.board_id = b.id WHERE ca.id = ? AND b.user_id_creator = ?', [cardId, userId]);
        if (!card) {
            return res.status(404).json({ error: 'Card not found or not authorized' });
        }

        const result = await run('INSERT INTO comments (content, card_id, user_id_author) VALUES (?, ?, ?)', [content, cardId, userId]);
        res.status(201).json({ message: 'success', data: { id: result.id, content, card_id: cardId, user_id_author: userId } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update comment content
router.put('/comments/:id', verifyToken, async (req, res) => {
    try {
        const commentId = req.params.id;
        const { content } = req.body;
        const userId = req.user.id;

        if (!content) {
            return res.status(400).json({ error: 'Comment content is required' });
        }

        const comment = await get('SELECT co.id FROM comments co JOIN cards ca ON co.card_id = ca.id JOIN columns col ON ca.column_id = col.id JOIN boards b ON col.board_id = b.id WHERE co.id = ? AND co.user_id_author = ?', [commentId, userId]);
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found or not authorized' });
        }

        await run('UPDATE comments SET content = ? WHERE id = ?', [content, commentId]);
        res.json({ message: 'success', data: { id: commentId, content } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a comment
router.delete('/comments/:id', verifyToken, async (req, res) => {
    try {
        const commentId = req.params.id;
        const userId = req.user.id;

        const comment = await get('SELECT co.id FROM comments co JOIN cards ca ON co.card_id = ca.id JOIN columns col ON ca.column_id = col.id JOIN boards b ON col.board_id = b.id WHERE co.id = ? AND co.user_id_author = ?', [commentId, userId]);
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found or not authorized' });
        }

        await run('DELETE FROM comments WHERE id = ?', [commentId]);
        res.json({ message: 'success', data: { id: commentId } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== LABELS ROUTES ==========

// Get all labels for a board
router.get('/boards/:id/labels', verifyToken, async (req, res) => {
    try {
        const boardId = req.params.id;
        const userId = req.user.id;

        // Verify board ownership
        const board = await get('SELECT id FROM boards WHERE id = ? AND user_id_creator = ?', [boardId, userId]);
        if (!board) {
            return res.status(404).json({ error: 'Board not found or not authorized' });
        }

        const labels = await all('SELECT * FROM labels WHERE board_id = ? ORDER BY name', [boardId]);
        res.json({ message: 'success', data: labels });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new label
router.post('/labels', verifyToken, async (req, res) => {
    try {
        const { name, color, board_id } = req.body;
        const userId = req.user.id;

        if (!name || !color || !board_id) {
            return res.status(400).json({ error: 'Name, color, and board_id are required' });
        }

        // Verify board ownership
        const board = await get('SELECT id FROM boards WHERE id = ? AND user_id_creator = ?', [board_id, userId]);
        if (!board) {
            return res.status(404).json({ error: 'Board not found or not authorized' });
        }

        const result = await run('INSERT INTO labels (name, color, board_id) VALUES (?, ?, ?)', [name, color, board_id]);
        res.status(201).json({ 
            message: 'success', 
            data: { id: result.id, name, color, board_id } 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update a label
router.put('/labels/:id', verifyToken, async (req, res) => {
    try {
        const labelId = req.params.id;
        const { name, color } = req.body;
        const userId = req.user.id;

        if (!name && !color) {
            return res.status(400).json({ error: 'Name or color is required' });
        }

        // Verify label ownership through board
        const label = await get('SELECT l.id FROM labels l JOIN boards b ON l.board_id = b.id WHERE l.id = ? AND b.user_id_creator = ?', [labelId, userId]);
        if (!label) {
            return res.status(404).json({ error: 'Label not found or not authorized' });
        }

        let updateFields = [];
        let updateParams = [];

        if (name) {
            updateFields.push('name = ?');
            updateParams.push(name);
        }
        if (color) {
            updateFields.push('color = ?');
            updateParams.push(color);
        }

        const query = `UPDATE labels SET ${updateFields.join(', ')} WHERE id = ?`;
        updateParams.push(labelId);

        await run(query, updateParams);
        res.json({ message: 'success', data: { id: labelId, name, color } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a label
router.delete('/labels/:id', verifyToken, async (req, res) => {
    try {
        const labelId = req.params.id;
        const userId = req.user.id;

        // Verify label ownership through board
        const label = await get('SELECT l.id FROM labels l JOIN boards b ON l.board_id = b.id WHERE l.id = ? AND b.user_id_creator = ?', [labelId, userId]);
        if (!label) {
            return res.status(404).json({ error: 'Label not found or not authorized' });
        }

        // Delete label assignments first (cascade should handle this, but being explicit)
        await run('DELETE FROM card_labels WHERE label_id = ?', [labelId]);
        await run('DELETE FROM labels WHERE id = ?', [labelId]);

        res.json({ message: 'success', data: { id: labelId } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========== CARD LABELS ROUTES ==========

// Assign label to card
router.post('/cards/:id/labels', verifyToken, async (req, res) => {
    try {
        const cardId = req.params.id;
        const { label_id } = req.body;
        const userId = req.user.id;

        if (!label_id) {
            return res.status(400).json({ error: 'Label ID is required' });
        }

        // Verify card ownership
        const card = await get('SELECT ca.id FROM cards ca JOIN columns co ON ca.column_id = co.id JOIN boards b ON co.board_id = b.id WHERE ca.id = ? AND b.user_id_creator = ?', [cardId, userId]);
        if (!card) {
            return res.status(404).json({ error: 'Card not found or not authorized' });
        }

        // Verify label belongs to same board
        const label = await get('SELECT l.id FROM labels l JOIN boards b ON l.board_id = b.id JOIN columns co ON b.id = co.board_id JOIN cards ca ON co.id = ca.column_id WHERE l.id = ? AND ca.id = ?', [label_id, cardId]);
        if (!label) {
            return res.status(404).json({ error: 'Label not found or not from the same board' });
        }

        // Check if already assigned
        const existing = await get('SELECT * FROM card_labels WHERE card_id = ? AND label_id = ?', [cardId, label_id]);
        if (existing) {
            return res.status(409).json({ error: 'Label already assigned to this card' });
        }

        await run('INSERT INTO card_labels (card_id, label_id) VALUES (?, ?)', [cardId, label_id]);
        res.status(201).json({ message: 'success', data: { card_id: cardId, label_id } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Remove label from card
router.delete('/cards/:cardId/labels/:labelId', verifyToken, async (req, res) => {
    try {
        const { cardId, labelId } = req.params;
        const userId = req.user.id;

        // Verify card ownership
        const card = await get('SELECT ca.id FROM cards ca JOIN columns co ON ca.column_id = co.id JOIN boards b ON co.board_id = b.id WHERE ca.id = ? AND b.user_id_creator = ?', [cardId, userId]);
        if (!card) {
            return res.status(404).json({ error: 'Card not found or not authorized' });
        }

        const result = await run('DELETE FROM card_labels WHERE card_id = ? AND label_id = ?', [cardId, labelId]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Label assignment not found' });
        }

        res.json({ message: 'success', data: { card_id: cardId, label_id: labelId } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get analytics data for workload dashboard
router.get('/analytics/workload', async (req, res) => {
    console.log('Analytics endpoint called!');
    try {
        const userId = req.user.id;
        console.log('User ID:', userId);
        
        // Get all boards for the user
        const boards = await all('SELECT id, title FROM boards WHERE user_id_creator = ?', [userId]);
        
        let analyticsData = {
            totalCards: 0,
            userWorkload: [],
            boardStats: [],
            overallProgress: {
                todo: 0,
                inProgress: 0,
                completed: 0
            }
        };

        for (let board of boards) {
            // Get cards grouped by assignee for this board
            const cardsByUser = await all(`
                SELECT 
                    u.id as user_id,
                    u.name as user_name,
                    u.email as user_email,
                    c.status,
                    c.priority,
                    COUNT(*) as card_count
                FROM cards c
                JOIN columns col ON c.column_id = col.id
                JOIN boards b ON col.board_id = b.id
                LEFT JOIN users u ON c.assignee_id = u.id
                WHERE b.id = ? AND b.user_id_creator = ? AND c.assignee_id IS NOT NULL
                GROUP BY u.id, u.name, u.email, c.status, c.priority
                ORDER BY u.name
            `, [board.id, userId]);

            // Get board totals
            const boardTotals = await get(`
                SELECT 
                    COUNT(*) as total_cards,
                    COUNT(CASE WHEN c.status = 'todo' THEN 1 END) as todo_count,
                    COUNT(CASE WHEN c.status = 'in-progress' THEN 1 END) as in_progress_count,
                    COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as completed_count
                FROM cards c
                JOIN columns col ON c.column_id = col.id
                WHERE col.board_id = ?
            `, [board.id]);

            if (boardTotals) {
                analyticsData.totalCards += boardTotals.total_cards || 0;
                analyticsData.overallProgress.todo += boardTotals.todo_count || 0;
                analyticsData.overallProgress.inProgress += boardTotals.in_progress_count || 0;
                analyticsData.overallProgress.completed += boardTotals.completed_count || 0;

                analyticsData.boardStats.push({
                    boardId: board.id,
                    boardTitle: board.title,
                    totalCards: boardTotals.total_cards || 0,
                    todoCards: boardTotals.todo_count || 0,
                    inProgressCards: boardTotals.in_progress_count || 0,
                    completedCards: boardTotals.completed_count || 0,
                    completionRate: boardTotals.total_cards > 0 
                        ? Math.round((boardTotals.completed_count / boardTotals.total_cards) * 100) 
                        : 0
                });
            }
        }

        // Process user workload data
        const userWorkloadMap = new Map();
        
        for (let board of boards) {
            const cardsByUser = await all(`
                SELECT 
                    u.id as user_id,
                    u.name as user_name,
                    u.email as user_email,
                    COUNT(*) as total_cards,
                    COUNT(CASE WHEN c.status = 'todo' THEN 1 END) as todo_cards,
                    COUNT(CASE WHEN c.status = 'in-progress' THEN 1 END) as in_progress_cards,
                    COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as completed_cards,
                    COUNT(CASE WHEN c.priority = 'critical' THEN 1 END) as critical_cards,
                    COUNT(CASE WHEN c.priority = 'high' THEN 1 END) as high_cards
                FROM cards c
                JOIN columns col ON c.column_id = col.id
                JOIN boards b ON col.board_id = b.id
                LEFT JOIN users u ON c.assignee_id = u.id
                WHERE b.id = ? AND b.user_id_creator = ? AND c.assignee_id IS NOT NULL
                GROUP BY u.id, u.name, u.email
            `, [board.id, userId]);

            for (let userCard of cardsByUser) {
                if (!userWorkloadMap.has(userCard.user_id)) {
                    userWorkloadMap.set(userCard.user_id, {
                        userId: userCard.user_id,
                        userName: userCard.user_name || userCard.user_email?.split('@')[0] || 'Usuário',
                        userEmail: userCard.user_email,
                        totalCards: 0,
                        todoCards: 0,
                        inProgressCards: 0,
                        completedCards: 0,
                        criticalCards: 0,
                        highCards: 0,
                        workloadLevel: 'normal'
                    });
                }

                const userData = userWorkloadMap.get(userCard.user_id);
                userData.totalCards += userCard.total_cards || 0;
                userData.todoCards += userCard.todo_cards || 0;
                userData.inProgressCards += userCard.in_progress_cards || 0;
                userData.completedCards += userCard.completed_cards || 0;
                userData.criticalCards += userCard.critical_cards || 0;
                userData.highCards += userCard.high_cards || 0;
            }
        }

        // Determine workload levels
        analyticsData.userWorkload = Array.from(userWorkloadMap.values()).map(user => {
            const activeCards = user.todoCards + user.inProgressCards;
            const urgentCards = user.criticalCards + user.highCards;
            
            // Workload calculation logic
            let workloadLevel = 'low';
            if (activeCards > 15 || urgentCards > 5) {
                workloadLevel = 'high';
            } else if (activeCards > 8 || urgentCards > 2) {
                workloadLevel = 'medium';
            }

            return {
                ...user,
                activeCards,
                urgentCards,
                workloadLevel,
                completionRate: user.totalCards > 0 
                    ? Math.round((user.completedCards / user.totalCards) * 100) 
                    : 0
            };
        });

        res.json({ message: 'success', data: analyticsData });
    } catch (err) {
        console.error('Error fetching workload analytics:', err);
        res.status(500).json({ error: 'Failed to fetch analytics data' });
    }
});

// TESTE: Endpoint adicional no final
router.get('/test-analytics', async (req, res) => {
    console.log('TEST Analytics endpoint called!');
    try {
        // For testing, use the default user ID (1)
        const userId = 1; // req.user ? req.user.id : 1;
        console.log('User ID:', userId);
        
        // Get all boards for the user
        const boards = await all('SELECT id, title FROM boards WHERE user_id_creator = ?', [userId]);
        
        let analyticsData = {
            totalCards: 0,
            userWorkload: [],
            boardStats: [],
            overallProgress: {
                todo: 0,
                inProgress: 0,
                completed: 0
            }
        };

        for (let board of boards) {
            // Get board totals
            const boardTotals = await get(`
                SELECT 
                    COUNT(*) as total_cards,
                    COUNT(CASE WHEN c.status = 'todo' THEN 1 END) as todo_count,
                    COUNT(CASE WHEN c.status = 'in-progress' THEN 1 END) as in_progress_count,
                    COUNT(CASE WHEN c.status = 'completed' THEN 1 END) as completed_count
                FROM cards c
                JOIN columns col ON c.column_id = col.id
                WHERE col.board_id = ?
            `, [board.id]);

            if (boardTotals) {
                analyticsData.totalCards += boardTotals.total_cards || 0;
                analyticsData.overallProgress.todo += boardTotals.todo_count || 0;
                analyticsData.overallProgress.inProgress += boardTotals.in_progress_count || 0;
                analyticsData.overallProgress.completed += boardTotals.completed_count || 0;

                analyticsData.boardStats.push({
                    boardId: board.id,
                    boardTitle: board.title,
                    totalCards: boardTotals.total_cards || 0,
                    todoCards: boardTotals.todo_count || 0,
                    inProgressCards: boardTotals.in_progress_count || 0,
                    completedCards: boardTotals.completed_count || 0,
                    completionRate: boardTotals.total_cards > 0 
                        ? Math.round((boardTotals.completed_count / boardTotals.total_cards) * 100) 
                        : 0
                });
            }
        }

        // Add fake user workload data for now
        analyticsData.userWorkload = [{
            userId: userId,
            userName: 'Você',
            userEmail: req.user.email,
            totalCards: analyticsData.totalCards,
            todoCards: analyticsData.overallProgress.todo,
            inProgressCards: analyticsData.overallProgress.inProgress,
            completedCards: analyticsData.overallProgress.completed,
            criticalCards: 0,
            highCards: 0,
            activeCards: analyticsData.overallProgress.todo + analyticsData.overallProgress.inProgress,
            urgentCards: 0,
            workloadLevel: analyticsData.overallProgress.todo + analyticsData.overallProgress.inProgress > 10 ? 'high' : 'medium',
            completionRate: analyticsData.totalCards > 0 
                ? Math.round((analyticsData.overallProgress.completed / analyticsData.totalCards) * 100) 
                : 0
        }];

        res.json({ message: 'success', data: analyticsData });
    } catch (err) {
        console.error('Error fetching test analytics:', err);
        res.status(500).json({ error: 'Failed to fetch analytics data' });
    }
});

// Get all users (for assignee selection)
router.get('/users', verifyToken, async (req, res) => {
    try {
        const users = await all('SELECT id, name, email FROM users ORDER BY name');
        res.json({ message: 'success', data: users });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SHARING SYSTEM APIS

// Generate public sharing token for board
router.post('/boards/:id/share', verifyToken, async (req, res) => {
    try {
        const boardId = parseInt(req.params.id);
        const userId = req.user.id;

        // Verify user owns the board
        const board = await get('SELECT * FROM boards WHERE id = ? AND user_id_creator = ?', [boardId, userId]);
        if (!board) {
            return res.status(404).json({ error: 'Board not found or access denied' });
        }

        // Generate unique token
        const crypto = require('crypto');
        const token = crypto.randomBytes(32).toString('hex');

        // Set expiration to 30 days from now
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        // Check if there's already an active token
        const existingToken = await get('SELECT * FROM public_access_tokens WHERE board_id = ? AND is_active = 1', [boardId]);
        
        if (existingToken) {
            // Deactivate existing token
            await run('UPDATE public_access_tokens SET is_active = 0 WHERE id = ?', [existingToken.id]);
        }

        // Insert new token
        const result = await run(`
            INSERT INTO public_access_tokens (token, board_id, created_by, expires_at) 
            VALUES (?, ?, ?, ?)
        `, [token, boardId, userId, expiresAt.toISOString()]);

        // Generate sharing URL
        const baseUrl = process.env.BASE_URL || 'http://localhost:5173';
        const shareUrl = `${baseUrl}/public/${token}`;

        res.json({
            message: 'Share link created successfully',
            data: {
                token,
                shareUrl,
                expiresAt: expiresAt.toISOString(),
                boardTitle: board.title
            }
        });

    } catch (err) {
        console.error('Share board error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Note: Public endpoints moved to index.js to avoid middleware conflicts

module.exports = router;
