const db = require('./database');

/**
 * Cria a estrutura completa de um projeto com boards, colunas e cards de exemplo
 * @param {number} projectId - ID do projeto recém criado
 * @param {number} userId - ID do usuário dono do projeto
 * @returns {Promise} - Promise que resolve quando toda estrutura foi criada
 */
async function createProjectStructure(projectId, userId) {
    console.log(`📦 Criando estrutura completa para projeto ${projectId}...`);
    
    // Estrutura de boards padrão
    const defaultBoards = [
        {
            title: 'Tarefas Gerais',
            description: 'Board para tarefas do dia a dia',
            backgroundColor: '#f8f9fa',
            order: 0,
            columns: [
                { name: 'A Fazer', order: 0 },
                { name: 'Em Andamento', order: 1 },
                { name: 'Concluído', order: 2 }
            ],
            cards: [
                {
                    title: '🎉 Bem-vindo ao TaskFlow!',
                    description: 'Este é seu primeiro card. Você pode arrastar e soltar entre colunas, editar, adicionar comentários e muito mais!',
                    column: 0,
                    order: 0,
                    priority: 'low'
                },
                {
                    title: '📝 Crie suas primeiras tarefas',
                    description: 'Clique no botão + em qualquer coluna para adicionar novos cards',
                    column: 0,
                    order: 1,
                    priority: 'medium'
                }
            ]
        },
        {
            title: 'Sprint Atual',
            description: 'Board para gerenciar sprints ágeis',
            backgroundColor: '#e3f2fd',
            order: 1,
            columns: [
                { name: 'Backlog Sprint', order: 0 },
                { name: 'Em Desenvolvimento', order: 1 },
                { name: 'Em Teste', order: 2 },
                { name: 'Pronto para Deploy', order: 3 },
                { name: 'Finalizado', order: 4 }
            ],
            cards: [
                {
                    title: '🚀 Configure seu primeiro sprint',
                    description: 'Use este board para organizar tarefas em sprints semanais ou quinzenais',
                    column: 0,
                    order: 0,
                    priority: 'high'
                }
            ]
        },
        {
            title: 'Backlog',
            description: 'Board para ideias e tarefas futuras',
            backgroundColor: '#fff3e0',
            order: 2,
            columns: [
                { name: 'Ideias', order: 0 },
                { name: 'Para Análise', order: 1 },
                { name: 'Aprovado', order: 2 },
                { name: 'Próximo Sprint', order: 3 }
            ],
            cards: [
                {
                    title: '💡 Guarde suas ideias aqui',
                    description: 'Este board é perfeito para armazenar ideias e tarefas que serão analisadas no futuro',
                    column: 0,
                    order: 0,
                    priority: 'low'
                }
            ]
        }
    ];

    try {
        // Criar cada board
        for (const boardData of defaultBoards) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO boards (title, description, user_id_creator, project_id, background_color, order_index) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [boardData.title, boardData.description, userId, projectId, boardData.backgroundColor, boardData.order],
                    function(err) {
                        if (err) {
                            console.error(`❌ Erro ao criar board ${boardData.title}:`, err);
                            reject(err);
                            return;
                        }
                        
                        const boardId = this.lastID;
                        console.log(`✅ Board "${boardData.title}" criado com ID ${boardId}`);
                        
                        // Criar colunas para este board
                        const columnPromises = boardData.columns.map((column, index) => {
                            return new Promise((resolveCol, rejectCol) => {
                                db.run(
                                    `INSERT INTO columns (name, board_id, order_index) VALUES (?, ?, ?)`,
                                    [column.name, boardId, column.order],
                                    function(err) {
                                        if (err) {
                                            console.error(`❌ Erro ao criar coluna ${column.name}:`, err);
                                            rejectCol(err);
                                            return;
                                        }
                                        
                                        const columnId = this.lastID;
                                        console.log(`  ✅ Coluna "${column.name}" criada`);
                                        
                                        // Se for a coluna de índice especificado nos cards, guardar o ID
                                        column.id = columnId;
                                        resolveCol(columnId);
                                    }
                                );
                            });
                        });
                        
                        // Esperar todas as colunas serem criadas
                        Promise.all(columnPromises).then(columnIds => {
                            // Criar cards de exemplo
                            const cardPromises = boardData.cards.map(card => {
                                return new Promise((resolveCard, rejectCard) => {
                                    const columnId = columnIds[card.column];
                                    const dueDate = new Date();
                                    dueDate.setDate(dueDate.getDate() + 7); // Due date em 7 dias
                                    
                                    db.run(
                                        `INSERT INTO cards (title, description, column_id, order_index, assigned_user_id, priority, due_date, status) 
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
                                                rejectCard(err);
                                                return;
                                            }
                                            console.log(`    ✅ Card "${card.title}" criado`);
                                            resolveCard();
                                        }
                                    );
                                });
                            });
                            
                            Promise.all(cardPromises).then(() => {
                                resolve();
                            }).catch(reject);
                        }).catch(reject);
                    }
                );
            });
        }
        
        // Criar alguns eventos de calendário de exemplo
        const calendarEvents = [
            {
                title: 'Reunião de Kick-off do Projeto',
                description: 'Primeira reunião para alinhar objetivos do projeto',
                start: new Date().toISOString(),
                end: new Date(Date.now() + 3600000).toISOString(), // 1 hora depois
                color: '#28a745'
            },
            {
                title: 'Review Semanal',
                description: 'Revisão do progresso da semana',
                start: new Date(Date.now() + 7 * 24 * 3600000).toISOString(), // 1 semana depois
                end: new Date(Date.now() + 7 * 24 * 3600000 + 3600000).toISOString(),
                color: '#007bff'
            }
        ];
        
        for (const event of calendarEvents) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO calendar_events (title, description, start_date, end_date, user_id, project_id, color) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [event.title, event.description, event.start, event.end, userId, projectId, event.color],
                    (err) => {
                        if (err) {
                            console.error('❌ Erro ao criar evento de calendário:', err);
                            // Não falhar se calendário não existir
                            resolve();
                        } else {
                            console.log(`📅 Evento "${event.title}" criado no calendário`);
                            resolve();
                        }
                    }
                );
            });
        }
        
        console.log(`🎉 Estrutura completa criada para o projeto ${projectId}!`);
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao criar estrutura do projeto:', error);
        throw error;
    }
}

module.exports = createProjectStructure;