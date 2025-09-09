const { all, run, get } = require('./database');

async function addColumnsToExistingBoards() {
    try {
        // Get all boards
        const boards = await all('SELECT id FROM boards');

        for (const board of boards) {
            // Check if columns already exist for this board
            const existingColumns = await all('SELECT title FROM columns WHERE board_id = ?', [board.id]);
            const existingColumnTitles = existingColumns.map(c => c.title);

            // Columns to add
            const columnsToAdd = ['A Fazer', 'Em Andamento', 'Concluído'];

            for (const columnTitle of columnsToAdd) {
                if (!existingColumnTitles.includes(columnTitle)) {
                    const maxOrder = await get('SELECT MAX(order_index) as maxOrder FROM columns WHERE board_id = ?', [board.id]);
                    const newOrder = (maxOrder.maxOrder || 0) + 1;
                    await run('INSERT INTO columns (board_id, title, order_index) VALUES (?, ?, ?)', [board.id, columnTitle, newOrder]);
                    console.log(`Added column '${columnTitle}' to board ${board.id}`);
                }
            }
        }

        console.log('Finished adding columns to existing boards.');
    } catch (err) {
        console.error('Failed to add columns to existing boards:', err.message);
    }
}

addColumnsToExistingBoards();
