const db = require('./database');

console.log('Testing projects query with database.js...');

const userId = 2;

console.log('Using database.db.all method...');

db.db.all(
    `SELECT p.id, p.name, p.description, p.color, p.logo, p.created_at, p.updated_at, pm.role,
            0 as members_count, 0 as boards_count
     FROM projects p
     JOIN project_members pm ON p.id = pm.project_id
     WHERE pm.user_id = ? AND p.is_active = 1
     ORDER BY p.created_at DESC`,
    [userId],
    (err, projects) => {
        console.log('Callback executed with database.js!');
        
        if (err) {
            console.error('❌ Error fetching projects:', err);
            return;
        }
        
        console.log('✅ Found projects:', projects?.length || 0);
        console.log('🔍 Projects data:', projects);
        
        process.exit(0);
    }
);