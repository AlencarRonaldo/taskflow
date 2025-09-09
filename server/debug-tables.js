const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('organizer.db');

console.log('=== VERIFICANDO TABELAS EXISTENTES ===\n');

// Listar todas as tabelas
db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
    if (err) {
        console.error('Erro:', err);
        return;
    }
    
    console.log('TABELAS EXISTENTES:');
    if (rows.length === 0) {
        console.log('   Nenhuma tabela encontrada!');
    } else {
        rows.forEach(table => {
            console.log(`   - ${table.name}`);
        });
    }
    
    // Verificar se o arquivo existe e tem tamanho
    const fs = require('fs');
    const stats = fs.statSync('organizer.db');
    console.log(`\nTamanho do arquivo: ${stats.size} bytes`);
    
    db.close();
});