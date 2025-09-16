const { run, all } = require('../server/database');

async function cleanupRevisaoColumns() {
    console.log('Iniciando limpeza de colunas "Revisão" e "Em Revisão"...');

    try {
        // Find columns to be deleted (for logging purposes)
        const columnsToDelete = await all("SELECT id, name, board_id FROM columns WHERE name = 'Em Revisão' OR name = 'Revisão'");

        if (columnsToDelete.length === 0) {
            console.log('Nenhuma coluna "Revisão" ou "Em Revisão" encontrada para deletar.');
            return;
        }

        console.log('Colunas a serem deletadas:');
        console.table(columnsToDelete);

        // Delete the columns
        const result = await run("DELETE FROM columns WHERE name = 'Em Revisão' OR name = 'Revisão'");

        console.log(`Sucesso! ${result.changes} colunas foram deletadas.`);
        console.log('Por favor, verifique seus boards no aplicativo.');

    } catch (err) {
        console.error('Ocorreu um erro durante a limpeza das colunas:', err);
    }
}

cleanupRevisaoColumns();
