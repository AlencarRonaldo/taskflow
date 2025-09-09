const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('db.sqlite');

console.log('=== CRIANDO DADOS DE TESTE PARA O CALENDÁRIO ===\n');

// Primeiro, vamos criar um board para o usuário 2
db.run(`INSERT INTO boards (title, user_id_creator, background_color, created_at) 
        VALUES (?, ?, ?, datetime('now'))`, 
        ['Board de Teste Calendário', 2, '#e3f2fd'], 
        function(err) {
    if (err) {
        console.error('Erro ao criar board:', err.message);
        return;
    }
    
    const boardId = this.lastID;
    console.log(`✅ Board criado com ID: ${boardId}`);
    
    // Criar colunas para o board
    db.run(`INSERT INTO columns (title, board_id, order_index) VALUES (?, ?, ?)`,
           ['To Do', boardId, 0], function(err) {
        if (err) {
            console.error('Erro ao criar coluna:', err.message);
            return;
        }
        
        const columnId = this.lastID;
        console.log(`✅ Coluna criada com ID: ${columnId}`);
        
        // Criar cards com due_dates variadas para o calendário
        const cards = [
            {
                title: 'Reunião de Planejamento',
                description: 'Reunião mensal para planejamento de atividades',
                due_date: '2025-01-15 10:00:00',
                assignee_id: 2,
                priority: 'high'
            },
            {
                title: 'Revisar Documentação',
                description: 'Revisar e atualizar documentação do projeto',
                due_date: '2025-01-18 14:30:00',
                assignee_id: 2,
                priority: 'medium'
            },
            {
                title: 'Entrega do Relatório',
                description: 'Finalizar e entregar relatório mensal',
                due_date: '2025-01-22 09:00:00',
                assignee_id: 2,
                priority: 'high'
            },
            {
                title: 'Treinamento da Equipe',
                description: 'Sessão de treinamento sobre novas ferramentas',
                due_date: '2025-01-25 15:00:00',
                assignee_id: 2,
                priority: 'medium'
            },
            {
                title: 'Backup de Dados',
                description: 'Realizar backup completo dos dados do sistema',
                due_date: '2025-01-30 18:00:00',
                assignee_id: 2,
                priority: 'low'
            }
        ];
        
        let cardsCreated = 0;
        cards.forEach((card, index) => {
            db.run(`INSERT INTO cards (title, description, column_id, order_index, due_date, assignee_id, priority, status) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                   [card.title, card.description, columnId, index, card.due_date, card.assignee_id, card.priority, 'todo'],
                   function(err) {
                if (err) {
                    console.error(`Erro ao criar card "${card.title}":`, err.message);
                    return;
                }
                
                cardsCreated++;
                console.log(`✅ Card criado: ${card.title} - Due: ${card.due_date}`);
                
                if (cardsCreated === cards.length) {
                    console.log(`\n🎉 Criados ${cardsCreated} cards com sucesso!`);
                    
                    // Verificar os dados criados
                    db.all(`SELECT c.id, c.title, c.due_date, c.assignee_id, c.priority 
                           FROM cards c 
                           WHERE c.assignee_id = 2 AND c.due_date IS NOT NULL 
                           ORDER BY c.due_date`, (err, cards) => {
                        if (err) {
                            console.error('Erro ao verificar cards:', err.message);
                            return;
                        }
                        
                        console.log('\n=== CARDS CRIADOS PARA O CALENDÁRIO ===');
                        cards.forEach(card => {
                            console.log(`ID: ${card.id} | ${card.title} | ${card.due_date} | Prioridade: ${card.priority}`);
                        });
                        
                        db.close();
                        console.log('\n✅ Dados de teste criados com sucesso!');
                        console.log('🚀 Agora o calendário deve mostrar os eventos!');
                    });
                }
            });
        });
    });
});