const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('organizer.db');

console.log('=== ANÁLISE COMPLETA DO BANCO DE DADOS ===\n');

// 1. Verificar cards totais para user ID 2
db.all("SELECT COUNT(*) as total FROM cards WHERE user_id = 2", (err, rows) => {
    if (err) {
        console.error('Erro:', err);
        return;
    }
    console.log('1. TOTAL DE CARDS PARA USER ID 2:', rows[0].total);
});

// 2. Verificar cards COM due_date para user ID 2
db.all("SELECT COUNT(*) as total FROM cards WHERE user_id = 2 AND due_date IS NOT NULL", (err, rows) => {
    if (err) {
        console.error('Erro:', err);
        return;
    }
    console.log('2. CARDS COM DUE_DATE PARA USER ID 2:', rows[0].total);
});

// 3. Mostrar todos os cards com due_date para user ID 2
db.all("SELECT id, title, due_date, board_id FROM cards WHERE user_id = 2 AND due_date IS NOT NULL", (err, rows) => {
    if (err) {
        console.error('Erro:', err);
        return;
    }
    console.log('\n3. CARDS COM DUE_DATE DETALHADOS:');
    if (rows.length === 0) {
        console.log('   Nenhum card encontrado com due_date');
    } else {
        rows.forEach(card => {
            console.log(`   ID: ${card.id} | Título: ${card.title} | Due Date: ${card.due_date} | Board: ${card.board_id}`);
        });
    }
});

// 4. Verificar se o usuário ID 2 existe
db.all("SELECT id, name, email FROM users WHERE id = 2", (err, rows) => {
    if (err) {
        console.error('Erro:', err);
        return;
    }
    console.log('\n4. USUÁRIO ID 2:');
    if (rows.length === 0) {
        console.log('   Usuário não encontrado!');
    } else {
        console.log(`   Nome: ${rows[0].name} | Email: ${rows[0].email}`);
    }
});

// 5. Verificar estrutura da tabela cards
db.all("PRAGMA table_info(cards)", (err, rows) => {
    if (err) {
        console.error('Erro:', err);
        return;
    }
    console.log('\n5. ESTRUTURA DA TABELA CARDS:');
    rows.forEach(col => {
        console.log(`   ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
    });
});

// 6. Verificar boards do usuário 2
db.all("SELECT id, name FROM boards WHERE user_id = 2", (err, rows) => {
    if (err) {
        console.error('Erro:', err);
        return;
    }
    console.log('\n6. BOARDS DO USUÁRIO 2:');
    rows.forEach(board => {
        console.log(`   ID: ${board.id} | Nome: ${board.name}`);
    });
    
    // Fechar conexão após todas as consultas
    setTimeout(() => {
        db.close();
        console.log('\n=== FIM DA ANÁLISE ===');
    }, 1000);
});