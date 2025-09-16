const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('db.sqlite');

console.log('Creating default project...');

// Get first user
db.get(`SELECT id FROM users LIMIT 1`, (err, user) => {
    if (err || !user) {
        console.log('❌ No users found');
        return;
    }

    console.log('✅ Found user:', user.id);

    // Check if project already exists
    db.get(`SELECT id FROM projects WHERE owner_id = ?`, [user.id], (err, project) => {
        if (err) {
            console.error('❌ Error checking projects:', err);
            return;
        }

        if (project) {
            console.log('✅ Project already exists:', project.id);
            return;
        }

        console.log('🆕 Creating default project...');

        // Create default project
        db.run(`INSERT INTO projects (name, description, owner_id, slug, color)
                VALUES (?, ?, ?, ?, ?)`,
            ['Meu Primeiro Projeto', 'Projeto criado automaticamente com seus dados existentes', 
             user.id, 'meu-primeiro-projeto', '#007bff'],
            function(err) {
                if (err) {
                    console.error('❌ Error creating project:', err);
                    return;
                }
                
                const projectId = this.lastID;
                console.log(`✅ Created project with ID ${projectId}`);

                // Add owner as admin member
                db.run(`INSERT INTO project_members (project_id, user_id, role)
                        VALUES (?, ?, ?)`,
                    [projectId, user.id, 'owner'],
                    (err) => {
                        if (err) console.error('❌ Error adding owner:', err);
                        else console.log('✅ Added owner as project member');

                        // Update existing boards to belong to default project
                        db.run(`UPDATE boards SET project_id = ? WHERE project_id IS NULL`, 
                            [projectId],
                            function(err) {
                                if (err) console.error('❌ Error updating boards:', err);
                                else console.log(`✅ Updated ${this.changes} boards to project ${projectId}`);

                                console.log('🎉 Default project setup complete!');
                                db.close();
                            }
                        );
                    }
                );
            }
        );
    });
});