const { run, db } = require('./database');

async function addBackgroundColumns() {
    try {
        console.log('Adding background_image column...');
        await run('ALTER TABLE boards ADD COLUMN background_image TEXT');
        console.log('Added background_image column successfully');
    } catch (err) {
        if (err.message.includes('duplicate column')) {
            console.log('background_image column already exists');
        } else {
            console.error('Error adding background_image:', err.message);
        }
    }
    
    try {
        console.log('Adding background_color column...');
        await run("ALTER TABLE boards ADD COLUMN background_color TEXT DEFAULT '#ffffff'");
        console.log('Added background_color column successfully');
    } catch (err) {
        if (err.message.includes('duplicate column')) {
            console.log('background_color column already exists');
        } else {
            console.error('Error adding background_color:', err.message);
        }
    }
    
    console.log('Database schema update complete');
    process.exit(0);
}

addBackgroundColumns();