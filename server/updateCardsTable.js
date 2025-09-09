const sqlite3 = require('sqlite3').verbose();
const DBSOURCE = "db.sqlite";

const db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        console.error(err.message);
        throw err;
    } else {
        console.log('Connected to the SQLite database.');
        
        // Add assignee_id column if it doesn't exist
        db.run(`ALTER TABLE cards ADD COLUMN assignee_id INTEGER REFERENCES users(id)`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log('Column assignee_id already exists');
                } else {
                    console.log('Error adding assignee_id column:', err.message);
                }
            } else {
                console.log('Successfully added assignee_id column');
            }
        });

        // Add priority column if it doesn't exist
        db.run(`ALTER TABLE cards ADD COLUMN priority TEXT DEFAULT 'medium'`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log('Column priority already exists');
                } else {
                    console.log('Error adding priority column:', err.message);
                }
            } else {
                console.log('Successfully added priority column');
            }
            
            // Close connection after all operations
            db.close((err) => {
                if (err) {
                    console.error(err.message);
                }
                console.log('Database connection closed.');
            });
        });
    }
});