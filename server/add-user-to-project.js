const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('db.sqlite');

console.log('Adding user to project...');

// Get user with ID 2
db.get(`SELECT id, email FROM users WHERE id = 2`, (err, user) => {
    if (err || !user) {
        console.log('❌ User not found');
        return;
    }
    
    console.log('✅ Found user:', user.email);
    
    // Get the default project
    db.get(`SELECT id, name FROM projects WHERE id = 1`, (err, project) => {
        if (err || !project) {
            console.log('❌ Project not found');
            return;
        }
        
        console.log('✅ Found project:', project.name);
        
        // Check if user is already a member
        db.get(`SELECT * FROM project_members WHERE project_id = ? AND user_id = ?`, 
            [project.id, user.id], (err, member) => {
                
            if (member) {
                console.log('✅ User is already a member of this project');
                db.close();
                return;
            }
            
            // Add user as owner of the project
            db.run(`INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)`,
                [project.id, user.id, 'owner'],
                function(err) {
                    if (err) {
                        console.error('❌ Error adding user to project:', err);
                        return;
                    }
                    
                    console.log(`✅ Added user ${user.email} as owner of project "${project.name}"`);
                    
                    // Now verify the join works
                    db.all(`SELECT p.id, p.name, p.description, p.color, pm.role
                            FROM projects p
                            JOIN project_members pm ON p.id = pm.project_id
                            WHERE pm.user_id = ?`, [user.id], (err, projects) => {
                        
                        if (err) {
                            console.error('❌ Error fetching projects:', err);
                        } else {
                            console.log('✅ User can now see projects:', projects);
                        }
                        
                        db.close();
                    });
                }
            );
        });
    });
});