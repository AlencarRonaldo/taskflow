const express = require('express');
const router = express.Router();
const { all, run } = require('./database');
const ActivityLogger = require('./activityLogger');
const verifyToken = require('./auth');

// GET /api/grid/data - Get grid data with pagination
router.get('/data', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 100;
        const offset = (page - 1) * pageSize;

        // Try to get cards first
        const cardsCount = await all(`
            SELECT COUNT(*) as total
            FROM cards c
            JOIN columns col ON c.column_id = col.id
            JOIN boards b ON col.board_id = b.id
            WHERE b.user_id_creator = ?
        `, [userId]);

        const hasCards = cardsCount[0]?.total > 0;

        if (hasCards) {
            // Get cards data
            const cards = await all(`
                SELECT 
                    c.id,
                    c.title,
                    c.description,
                    c.due_date,
                    c.status,
                    c.priority,
                    c.assignee_id,
                    c.progress,
                    c.created_at,
                    c.updated_at,
                    c.labels,
                    b.id as board_id,
                    b.title as board_title,
                    b.responsible,
                    col.title as column_title
                FROM cards c
                JOIN columns col ON c.column_id = col.id
                JOIN boards b ON col.board_id = b.id
                WHERE b.user_id_creator = ?
                ORDER BY c.updated_at DESC
                LIMIT ? OFFSET ?
            `, [userId, pageSize, offset]);
            
            // Transform data for grid format
            const gridData = cards.map(card => ({
                id: card.id,
                title: card.title,
                description: card.description,
                due_date: card.due_date,
                status: card.status || 'A Fazer',
                priority: card.priority || 'Média',
                responsible: card.responsible || 'Não atribuído',
                board_title: card.board_title,
                board_id: card.board_id,
                column_title: card.column_title,
                created_at: card.created_at,
                updated_at: card.updated_at
            }));

            return res.json({
                success: true,
                data: gridData,
                total: cardsCount[0]?.total || 0,
                page,
                pageSize
            });
        }

        // If no cards, return boards as fallback
        const boards = await all(`
            SELECT 
                b.id,
                b.title,
                b.due_date,
                b.responsible,
                b.created_at,
                b.last_updated_at as updated_at,
                u.email as creator_email,
                CASE 
                    WHEN b.due_date IS NULL THEN 'Sem prazo'
                    WHEN date(b.due_date) < date('now') THEN 'Atrasado'
                    WHEN date(b.due_date) = date('now') THEN 'Hoje'
                    WHEN date(b.due_date) <= date('now', '+7 days') THEN 'Esta semana'
                    ELSE 'Futuro'
                END as status,
                CASE 
                    WHEN b.due_date IS NULL THEN 'Baixa'
                    WHEN date(b.due_date) < date('now') THEN 'Crítica'
                    WHEN date(b.due_date) = date('now') THEN 'Alta'
                    WHEN date(b.due_date) <= date('now', '+7 days') THEN 'Média'
                    ELSE 'Baixa'
                END as priority
            FROM boards b
            LEFT JOIN users u ON b.user_id_creator = u.id
            WHERE b.user_id_creator = ?
            ORDER BY 
                CASE WHEN b.due_date IS NULL THEN 1 ELSE 0 END,
                b.due_date ASC
            LIMIT ? OFFSET ?
        `, [userId, pageSize, offset]);

        // Transform boards data for grid format
        const gridData = boards.map(board => ({
            id: board.id,
            title: board.title,
            description: `Responsável: ${board.responsible || 'Não definido'}`,
            board_id: board.id,
            board_title: board.title,
            column_title: '',
            status: board.status,
            priority: board.priority,
            responsible: board.responsible || 'Não atribuído',
            due_date: board.due_date,
            progress: 0,
            created_at: board.created_at,
            updated_at: board.updated_at,
            labels: ''
        }));

        // Get total count for boards
        const boardsCount = await all(`
            SELECT COUNT(*) as total
            FROM boards
            WHERE user_id_creator = ?
        `, [userId]);

        res.json({
            success: true,
            data: gridData,
            total: boardsCount[0]?.total || 0,
            page,
            pageSize
        });

    } catch (error) {
        console.error('Grid data fetch error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch grid data',
            details: error.message 
        });
    }
});

// PUT /api/grid/bulk-update - Bulk update cards
router.put('/bulk-update', async (req, res) => {
    try {
        const { ids, updates } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Card IDs are required' });
        }

        if (!updates || Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'Updates are required' });
        }

        // Build dynamic update query
        const setClause = [];
        const values = [];
        
        if (updates.status) {
            setClause.push('status = ?');
            values.push(updates.status);
        }
        
        if (updates.priority) {
            setClause.push('priority = ?');
            values.push(updates.priority);
        }
        
        if (updates.due_date) {
            setClause.push('due_date = ?');
            values.push(updates.due_date);
        }

        if (setClause.length === 0) {
            return res.status(400).json({ error: 'No valid updates provided' });
        }

        // Add updated_at
        setClause.push('updated_at = datetime("now")');
        
        // Add WHERE clause for IDs
        const placeholders = ids.map(() => '?').join(',');
        values.push(...ids);

        const query = `
            UPDATE cards 
            SET ${setClause.join(', ')}
            WHERE id IN (${placeholders})
        `;

        const result = await run(query, values);

        // Log activity for each updated card
        for (const cardId of ids) {
            const changes = Object.entries(updates)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
            
            await ActivityLogger.logActivity(
                req.user?.id || null,
                'card_updated',
                `Bulk update: ${changes}`,
                'card',
                cardId
            );
        }

        res.json({
            message: `Successfully updated ${result.changes} cards`,
            updatedCount: result.changes
        });

    } catch (error) {
        console.error('Bulk update error:', error);
        res.status(500).json({ 
            error: 'Failed to update cards',
            details: error.message 
        });
    }
});

// GET /api/grid/export - Export grid data as Excel/CSV
router.get('/export', async (req, res) => {
    try {
        const format = req.query.format || 'csv';
        
        // Get all cards data
        const cards = await all(`
            SELECT 
                c.id,
                c.title,
                c.description,
                c.due_date,
                c.status,
                c.priority,
                c.assignee_id,
                c.progress,
                c.created_at,
                c.updated_at,
                c.labels,
                b.title as board_title,
                b.responsible,
                col.title as column_title
            FROM cards c
            JOIN columns col ON c.column_id = col.id
            JOIN boards b ON col.board_id = b.id
            ORDER BY c.updated_at DESC
        `);

        if (format.toLowerCase() === 'csv') {
            // CSV Export
            const csvHeaders = [
                'ID',
                'Título',
                'Board',
                'Coluna',
                'Status',
                'Prioridade',
                'Responsável',
                'Prazo',
                'Progresso (%)',
                'Criado em',
                'Atualizado em',
                'Descrição'
            ].join(',');

            const csvRows = cards.map(card => [
                card.id,
                `"${card.title || ''}"`,
                `"${card.board_title || ''}"`,
                `"${card.column_title || ''}"`,
                `"${card.column_title || card.status || ''}"`,
                `"${card.priority || 'Média'}"`,
                `"${card.responsible || ''}"`,
                card.due_date ? new Date(card.due_date).toLocaleDateString('pt-BR') : '',
                card.progress || 0,
                new Date(card.created_at).toLocaleDateString('pt-BR'),
                new Date(card.updated_at).toLocaleDateString('pt-BR'),
                `"${(card.description || '').replace(/"/g, '""')}"`
            ].join(','));

            const csvContent = [csvHeaders, ...csvRows].join('\n');

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="cards_export.csv"');
            res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf-8'));
            
            // Add BOM for proper UTF-8 encoding in Excel
            res.write('\uFEFF');
            res.end(csvContent);

        } else if (format.toLowerCase() === 'excel') {
            // For Excel export, we'll create a simple XML format that Excel can read
            const excelRows = cards.map(card => `
                <Row>
                    <Cell><Data ss:Type="Number">${card.id}</Data></Cell>
                    <Cell><Data ss:Type="String">${escapeXml(card.title || '')}</Data></Cell>
                    <Cell><Data ss:Type="String">${escapeXml(card.board_title || '')}</Data></Cell>
                    <Cell><Data ss:Type="String">${escapeXml(card.column_title || '')}</Data></Cell>
                    <Cell><Data ss:Type="String">${escapeXml(card.column_title || card.status || '')}</Data></Cell>
                    <Cell><Data ss:Type="String">${escapeXml(card.priority || 'Média')}</Data></Cell>
                    <Cell><Data ss:Type="String">${escapeXml(card.responsible || '')}</Data></Cell>
                    <Cell><Data ss:Type="String">${card.due_date ? new Date(card.due_date).toLocaleDateString('pt-BR') : ''}</Data></Cell>
                    <Cell><Data ss:Type="Number">${card.progress || 0}</Data></Cell>
                    <Cell><Data ss:Type="String">${new Date(card.created_at).toLocaleDateString('pt-BR')}</Data></Cell>
                    <Cell><Data ss:Type="String">${new Date(card.updated_at).toLocaleDateString('pt-BR')}</Data></Cell>
                    <Cell><Data ss:Type="String">${escapeXml((card.description || '').substring(0, 200))}</Data></Cell>
                </Row>
            `).join('');

            const excelContent = `<?xml version="1.0"?>
                <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
                    xmlns:o="urn:schemas-microsoft-com:office:office"
                    xmlns:x="urn:schemas-microsoft-com:office:excel"
                    xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
                    <Worksheet ss:Name="Cards">
                        <Table>
                            <Row>
                                <Cell><Data ss:Type="String">ID</Data></Cell>
                                <Cell><Data ss:Type="String">Título</Data></Cell>
                                <Cell><Data ss:Type="String">Board</Data></Cell>
                                <Cell><Data ss:Type="String">Coluna</Data></Cell>
                                <Cell><Data ss:Type="String">Status</Data></Cell>
                                <Cell><Data ss:Type="String">Prioridade</Data></Cell>
                                <Cell><Data ss:Type="String">Responsável</Data></Cell>
                                <Cell><Data ss:Type="String">Prazo</Data></Cell>
                                <Cell><Data ss:Type="String">Progresso (%)</Data></Cell>
                                <Cell><Data ss:Type="String">Criado em</Data></Cell>
                                <Cell><Data ss:Type="String">Atualizado em</Data></Cell>
                                <Cell><Data ss:Type="String">Descrição</Data></Cell>
                            </Row>
                            ${excelRows}
                        </Table>
                    </Worksheet>
                </Workbook>`;

            res.setHeader('Content-Type', 'application/vnd.ms-excel');
            res.setHeader('Content-Disposition', 'attachment; filename="cards_export.xlsx"');
            res.end(excelContent);

        } else {
            return res.status(400).json({ error: 'Invalid export format. Use "csv" or "excel"' });
        }

    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ 
            error: 'Failed to export data',
            details: error.message 
        });
    }
});

// Helper function to escape XML content
function escapeXml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

module.exports = router;