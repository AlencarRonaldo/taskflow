const { run, get, all } = require('./database');

async function addCalendarTestData() {
    try {
        console.log('🔧 Adding calendar test data for user ID 2...');
        
        // Check if user exists
        const user = await get('SELECT id, email FROM users WHERE id = ?', [2]);
        if (!user) {
            console.log('❌ User ID 2 not found');
            return;
        }
        
        console.log('✅ Found user:', user.email);
        
        // Create a test board
        const boardResult = await run(
            'INSERT INTO boards (title, user_id_creator, responsible) VALUES (?, ?, ?)',
            ['Board Calendário - Teste', 2, user.email]
        );
        const boardId = boardResult.id;
        console.log('✅ Created board ID:', boardId);
        
        // Create columns
        const todoResult = await run(
            'INSERT INTO columns (board_id, title, order_index) VALUES (?, ?, ?)',
            [boardId, 'To Do', 1]
        );
        const progressResult = await run(
            'INSERT INTO columns (board_id, title, order_index) VALUES (?, ?, ?)',
            [boardId, 'In Progress', 2]
        );
        const doneResult = await run(
            'INSERT INTO columns (board_id, title, order_index) VALUES (?, ?, ?)',
            [boardId, 'Done', 3]
        );
        
        console.log('✅ Created columns:', {
            todo: todoResult.id,
            progress: progressResult.id,
            done: doneResult.id
        });
        
        // Create cards with due dates
        const cards = [
            {
                title: 'Reunião importante',
                description: 'Reunião de planejamento mensal',
                due_date: '2025-09-08 14:00:00',
                priority: 'critical',
                column_id: todoResult.id
            },
            {
                title: 'Revisar relatório',
                description: 'Análise dos resultados do último trimestre',
                due_date: '2025-09-09 10:30:00',
                priority: 'high',
                column_id: todoResult.id
            },
            {
                title: 'Entrega do projeto',
                description: 'Finalizar e entregar projeto para cliente',
                due_date: '2025-09-12 16:00:00',
                priority: 'high',
                column_id: progressResult.id
            },
            {
                title: 'Apresentação para equipe',
                description: 'Apresentar novos processos para a equipe',
                due_date: '2025-09-15 09:00:00',
                priority: 'medium',
                column_id: todoResult.id
            },
            {
                title: 'Follow-up cliente',
                description: 'Verificar satisfação do cliente com entrega',
                due_date: '2025-09-20 11:00:00',
                priority: 'low',
                column_id: todoResult.id
            },
            {
                title: 'Tarefa concluída',
                description: 'Esta já foi concluída para testar transparência',
                due_date: '2025-09-05 08:00:00',
                priority: 'medium',
                status: 'completed',
                column_id: doneResult.id
            }
        ];
        
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            const cardResult = await run(
                'INSERT INTO cards (column_id, title, description, order_index, status, priority, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    card.column_id, 
                    card.title, 
                    card.description, 
                    i + 1,
                    card.status || 'todo',
                    card.priority,
                    card.due_date
                ]
            );
            console.log(`✅ Created card "${card.title}" with due date ${card.due_date}`);
        }
        
        console.log('🎉 Calendar test data added successfully!');
        console.log('📅 User should now see', cards.length, 'events in calendar');
        
    } catch (error) {
        console.error('❌ Error adding calendar test data:', error);
    }
}

// Run if called directly
if (require.main === module) {
    addCalendarTestData().then(() => {
        process.exit(0);
    });
}

module.exports = addCalendarTestData;