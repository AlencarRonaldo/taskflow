const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('db.sqlite');

console.log('Testing projects query...');

const userId = 2;

console.log('Query:', `SELECT p.id, p.name, p.description, p.color, p.logo, p.created_at, p.updated_at, pm.role,
        0 as members_count, 0 as boards_count
 FROM projects p
 JOIN project_members pm ON p.id = pm.project_id
 WHERE pm.user_id = ? AND p.is_active = 1
 ORDER BY p.created_at DESC`);
console.log('UserId:', userId);

db.all(
    `SELECT p.id, p.name, p.description, p.color, p.logo, p.created_at, p.updated_at, pm.role,
            0 as members_count, 0 as boards_count
     FROM projects p
     JOIN project_members pm ON p.id = pm.project_id
     WHERE pm.user_id = ? AND p.is_active = 1
     ORDER BY p.created_at DESC`,
    [userId],
    (err, projects) => {
        console.log('Callback executed!');
        
        if (err) {
            console.error('❌ Error fetching projects:', err);
            return;
        }
        
        console.log('✅ Found projects:', projects?.length || 0);
        console.log('🔍 Projects data:', projects);
        
        db.close();
    }
);