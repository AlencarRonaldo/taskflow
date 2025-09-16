const { db } = require('./database');

/**
 * Cria estrutura básica para um board recém criado com colunas padrão
 * @param {number} boardId - ID do board recém criado
 * @param {number} userId - ID do usuário criador
 * @returns {Promise} - Promise que resolve quando toda estrutura foi criada
 */
async function createBoardStructure(boardId, userId) {
    console.log(`📦 Criando estrutura padrão para board ${boardId}...`);
    
    // Colunas padrão para novos boards
    const defaultColumns = [
        { name: 'A Fazer', order: 0 },
        { name: 'Em Andamento', order: 1 },
        { name: 'Concluído', order: 2 }
    ];

    // Cards de exemplo para demonstrar funcionalidade
    const exampleCards = [
        {
            title: '🎉 Bem-vindo ao seu novo board!',
            description: 'Este é um card de exemplo. Você pode editar, mover entre colunas, adicionar comentários e muito mais!',
            column: 0, // A Fazer
            order: 0,
            priority: 'medium'
        },
        {
            title: '📝 Crie suas tarefas aqui',
            description: 'Clique no botão + para adicionar novos cards a qualquer coluna',
            column: 0, // A Fazer
            order: 1,
            priority: 'low'
        }
    ];

    try {
        const columnIds = [];
        
        // Criar as colunas padrão usando serialize para evitar conflitos
        await new Promise((resolve, reject) => {
            db.serialize(async () => {
                try {
                    for (const column of defaultColumns) {
                        console.log(`  🔄 Criando coluna "${column.name}"...`);
                        const columnId = await new Promise((colResolve, colReject) => {
                            db.run(
                                `INSERT INTO columns (title, board_id, order_index) VALUES (?, ?, ?)`,
                                [column.name, boardId, column.order],
                                function(err) {
                                    if (err) {
                                        console.error(`❌ Erro ao criar coluna ${column.name}:`, err);
                                        console.error(`❌ SQL Error details:`, err.message);
                                        colReject(err);
                                        return;
                                    }
                                    
                                    const columnId = this.lastID;
                                    console.log(`  ✅ Coluna "${column.name}" criada com ID ${columnId}`);
                                    colResolve(columnId);
                                }
                            );
                        });
                        columnIds.push(columnId);
                    }
                    resolve();
                } catch (error) {
                    console.error(`❌ Erro no loop de criação de colunas:`, error);
                    reject(error);
                }
            });
        });
        
        // Criar cards de exemplo
        for (const card of exampleCards) {
            await new Promise((resolve, reject) => {
                const columnId = columnIds[card.column];
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 7); // Due date em 7 dias
                
                db.run(
                    `INSERT INTO cards (title, description, column_id, order_index, assignee_id, priority, due_date, status) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        card.title, 
                        card.description, 
                        columnId, 
                        card.order, 
                        userId,
                        card.priority || 'medium',
                        dueDate.toISOString(),
                        'todo'
                    ],
                    function(err) {
                        if (err) {
                            console.error(`❌ Erro ao criar card ${card.title}:`, err);
                            reject(err);
                            return;
                        }
                        console.log(`    ✅ Card "${card.title}" criado`);
                        resolve();
                    }
                );
            });
        }
        
        console.log(`🎉 Estrutura padrão criada para o board ${boardId}! Total de colunas: ${columnIds.length}`);
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao criar estrutura do board:', error);
        throw error;
    }
}

module.exports = createBoardStructure;