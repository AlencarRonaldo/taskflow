const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

console.log('=== VERIFICANDO ARQUIVOS DE BANCO ===\n');

// Verificar tamanhos
const dbSize = fs.statSync('db.sqlite').size;
const organizerSize = fs.statSync('organizer.db').size;

console.log(`db.sqlite: ${dbSize} bytes`);
console.log(`organizer.db: ${organizerSize} bytes\n`);

// Verificar db.sqlite (o que o código usa)
const db1 = new sqlite3.Database('db.sqlite');
console.log('=== VERIFICANDO db.sqlite ===');

db1.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) {
        console.error('Erro:', err);
    } else {
        console.log('Tabelas em db.sqlite:');
        if (rows.length === 0) {
            console.log('   Nenhuma tabela encontrada');
        } else {
            rows.forEach(table => {
                console.log(`   - ${table.name}`);
            });
        }
        
        // Verificar usuários
        db1.all("SELECT id, name, email FROM users LIMIT 5", (err, users) => {
            if (err) {
                console.error('Erro ao buscar usuários:', err.message);
            } else {
                console.log('\nUsuários em db.sqlite:');
                users.forEach(user => {
                    console.log(`   ID: ${user.id} | Nome: ${user.name} | Email: ${user.email}`);
                });
                
                // Verificar cards do user ID 2
                db1.all("SELECT COUNT(*) as total FROM cards WHERE assignee_id = 2", (err, cardCount) => {
                    if (err) {
                        console.error('Erro ao contar cards:', err.message);
                    } else {
                        console.log(`\nCards do usuário ID 2: ${cardCount[0].total}`);
                    }
                    
                    // Verificar cards com due_date do user ID 2
                    db1.all("SELECT COUNT(*) as total FROM cards WHERE assignee_id = 2 AND due_date IS NOT NULL", (err, dueDateCount) => {
                        if (err) {
                            console.error('Erro ao contar cards com due_date:', err.message);
                        } else {
                            console.log(`Cards com due_date do usuário ID 2: ${dueDateCount[0].total}`);
                        }
                        
                        // Mostrar alguns cards com due_date
                        db1.all("SELECT id, title, due_date FROM cards WHERE assignee_id = 2 AND due_date IS NOT NULL LIMIT 5", (err, cards) => {
                            if (err) {
                                console.error('Erro ao buscar cards:', err.message);
                            } else {
                                console.log('\nCards com due_date:');
                                cards.forEach(card => {
                                    console.log(`   ${card.id}: ${card.title} - ${card.due_date}`);
                                });
                            }
                            
                            db1.close();
                            console.log('\n=== FIM DA VERIFICAÇÃO ===');
                        });
                    });
                });
            }
        });
    }
});