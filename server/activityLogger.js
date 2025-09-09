const db = require('./database.js');

// Função para registrar atividade
const logActivity = async (options) => {
    const {
        userId,
        boardId = null,
        cardId = null,
        actionType, // 'create', 'update', 'delete', 'move'
        entityType, // 'board', 'card', 'comment', 'attachment', 'label'
        entityId,
        oldValues = null,
        newValues = null,
        description
    } = options;

    try {
        await db.run(
            `INSERT INTO activity_log (
                user_id, board_id, card_id, action_type, entity_type, 
                entity_id, old_values, new_values, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                boardId,
                cardId,
                actionType,
                entityType,
                entityId,
                oldValues ? JSON.stringify(oldValues) : null,
                newValues ? JSON.stringify(newValues) : null,
                description
            ]
        );
    } catch (error) {
        console.error('Error logging activity:', error);
        // Não vamos falhar a operação principal por causa de log
    }
};

// Funções específicas para cada tipo de atividade
const ActivityLogger = {
    // Board activities
    boardCreated: (userId, board) => 
        logActivity({
            userId,
            boardId: board.id,
            actionType: 'create',
            entityType: 'board',
            entityId: board.id,
            newValues: { title: board.title },
            description: `Criou o board "${board.title}"`
        }),

    boardUpdated: (userId, boardId, oldBoard, newBoard) => 
        logActivity({
            userId,
            boardId,
            actionType: 'update',
            entityType: 'board',
            entityId: boardId,
            oldValues: oldBoard,
            newValues: newBoard,
            description: `Atualizou o board "${newBoard.title || oldBoard.title}"`
        }),

    boardDeleted: (userId, boardId, boardTitle) => 
        logActivity({
            userId,
            boardId,
            actionType: 'delete',
            entityType: 'board',
            entityId: boardId,
            oldValues: { title: boardTitle },
            description: `Excluiu o board "${boardTitle}"`
        }),

    // Column activities
    columnCreated: (userId, boardId, column) => 
        logActivity({
            userId,
            boardId,
            actionType: 'create',
            entityType: 'column',
            entityId: column.id,
            newValues: { title: column.title, order_index: column.order_index },
            description: `Criou a coluna "${column.title}"`
        }),

    columnUpdated: (userId, boardId, columnId, oldColumn, newColumn) => 
        logActivity({
            userId,
            boardId,
            actionType: 'update',
            entityType: 'column',
            entityId: columnId,
            oldValues: oldColumn,
            newValues: newColumn,
            description: `Atualizou a coluna "${newColumn.title || oldColumn.title}"`
        }),

    columnDeleted: (userId, boardId, columnId, columnTitle) => 
        logActivity({
            userId,
            boardId,
            actionType: 'delete',
            entityType: 'column',
            entityId: columnId,
            oldValues: { title: columnTitle },
            description: `Excluiu a coluna "${columnTitle}"`
        }),

    // Card activities
    cardCreated: (userId, boardId, card) => 
        logActivity({
            userId,
            boardId,
            cardId: card.id,
            actionType: 'create',
            entityType: 'card',
            entityId: card.id,
            newValues: { 
                title: card.title, 
                description: card.description, 
                status: card.status 
            },
            description: `Criou o card "${card.title}"`
        }),

    cardUpdated: (userId, boardId, cardId, oldCard, newCard) => 
        logActivity({
            userId,
            boardId,
            cardId,
            actionType: 'update',
            entityType: 'card',
            entityId: cardId,
            oldValues: oldCard,
            newValues: newCard,
            description: `Atualizou o card "${newCard.title || oldCard.title}"`
        }),

    cardMoved: (userId, boardId, cardId, cardTitle, oldColumn, newColumn) => 
        logActivity({
            userId,
            boardId,
            cardId,
            actionType: 'move',
            entityType: 'card',
            entityId: cardId,
            oldValues: { column: oldColumn },
            newValues: { column: newColumn },
            description: `Moveu o card "${cardTitle}" de "${oldColumn}" para "${newColumn}"`
        }),

    cardDeleted: (userId, boardId, cardId, cardTitle) => 
        logActivity({
            userId,
            boardId,
            cardId,
            actionType: 'delete',
            entityType: 'card',
            entityId: cardId,
            oldValues: { title: cardTitle },
            description: `Excluiu o card "${cardTitle}"`
        }),

    // Comment activities
    commentCreated: (userId, boardId, cardId, comment) => 
        logActivity({
            userId,
            boardId,
            cardId,
            actionType: 'create',
            entityType: 'comment',
            entityId: comment.id,
            newValues: { content: comment.content },
            description: `Adicionou um comentário`
        }),

    commentUpdated: (userId, boardId, cardId, commentId, oldContent, newContent) => 
        logActivity({
            userId,
            boardId,
            cardId,
            actionType: 'update',
            entityType: 'comment',
            entityId: commentId,
            oldValues: { content: oldContent },
            newValues: { content: newContent },
            description: `Editou um comentário`
        }),

    commentDeleted: (userId, boardId, cardId, commentId) => 
        logActivity({
            userId,
            boardId,
            cardId,
            actionType: 'delete',
            entityType: 'comment',
            entityId: commentId,
            description: `Excluiu um comentário`
        }),

    // Attachment activities
    attachmentUploaded: (userId, boardId, cardId, attachment) => 
        logActivity({
            userId,
            boardId,
            cardId,
            actionType: 'create',
            entityType: 'attachment',
            entityId: attachment.id,
            newValues: { filename: attachment.original_name, size: attachment.file_size },
            description: `Anexou o arquivo "${attachment.original_name}"`
        }),

    attachmentDeleted: (userId, boardId, cardId, attachmentId, filename) => 
        logActivity({
            userId,
            boardId,
            cardId,
            actionType: 'delete',
            entityType: 'attachment',
            entityId: attachmentId,
            oldValues: { filename },
            description: `Removeu o anexo "${filename}"`
        }),

    // Label activities
    labelCreated: (userId, boardId, label) => 
        logActivity({
            userId,
            boardId,
            actionType: 'create',
            entityType: 'label',
            entityId: label.id,
            newValues: { name: label.name, color: label.color },
            description: `Criou a label "${label.name}"`
        }),

    labelUpdated: (userId, boardId, labelId, oldLabel, newLabel) => 
        logActivity({
            userId,
            boardId,
            actionType: 'update',
            entityType: 'label',
            entityId: labelId,
            oldValues: oldLabel,
            newValues: newLabel,
            description: `Atualizou a label "${newLabel.name || oldLabel.name}"`
        }),

    labelDeleted: (userId, boardId, labelId, labelName) => 
        logActivity({
            userId,
            boardId,
            actionType: 'delete',
            entityType: 'label',
            entityId: labelId,
            oldValues: { name: labelName },
            description: `Excluiu a label "${labelName}"`
        }),

    labelAssigned: (userId, boardId, cardId, labelName, cardTitle) => 
        logActivity({
            userId,
            boardId,
            cardId,
            actionType: 'assign',
            entityType: 'label',
            entityId: cardId,
            newValues: { label: labelName },
            description: `Adicionou a label "${labelName}" ao card "${cardTitle}"`
        }),

    labelRemoved: (userId, boardId, cardId, labelName, cardTitle) => 
        logActivity({
            userId,
            boardId,
            cardId,
            actionType: 'remove',
            entityType: 'label',
            entityId: cardId,
            oldValues: { label: labelName },
            description: `Removeu a label "${labelName}" do card "${cardTitle}"`
        })
};

module.exports = ActivityLogger;