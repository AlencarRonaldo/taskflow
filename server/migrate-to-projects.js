const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('db.sqlite');

console.log('Starting database migration for multi-project support...');

db.serialize(() => {
    // 1. Create projects table
    db.run(`CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        owner_id INTEGER NOT NULL,
        slug TEXT UNIQUE,
        logo TEXT,
        color TEXT DEFAULT '#007bff',
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users (id)
    )`, (err) => {
        if (err) console.error('Error creating projects table:', err);
        else console.log('✓ Projects table created');
    });

    // 2. Create project_members table
    db.run(`CREATE TABLE IF NOT EXISTS project_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role TEXT DEFAULT 'member',
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(project_id, user_id)
    )`, (err) => {
        if (err) console.error('Error creating project_members table:', err);
        else console.log('✓ Project members table created');
    });

    // 3. Add project_id to boards table
    db.run(`ALTER TABLE boards ADD COLUMN project_id INTEGER`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding project_id to boards:', err);
        } else if (!err) {
            console.log('✓ Added project_id to boards table');
        }
    });

    // 4. Add project_id to calendar_events table
    db.run(`ALTER TABLE calendar_events ADD COLUMN project_id INTEGER`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding project_id to calendar_events:', err);
        } else if (!err) {
            console.log('✓ Added project_id to calendar_events table');
        }
    });

    // 5. Add project_id to automations table
    db.run(`ALTER TABLE automations ADD COLUMN project_id INTEGER`, (err) => {
        if (err && !err.message.includes('duplicate column') && !err.message.includes('no such table')) {
            console.error('Error adding project_id to automations:', err);
        } else if (!err) {
            console.log('✓ Added project_id to automations table');
        }
    });

    // 6. Add project_id to webhooks table
    db.run(`ALTER TABLE webhooks ADD COLUMN project_id INTEGER`, (err) => {
        if (err && !err.message.includes('duplicate column') && !err.message.includes('no such table')) {
            console.error('Error adding project_id to webhooks:', err);
        } else if (!err) {
            console.log('✓ Added project_id to webhooks table');
        }
    });

    // 7. Add project_id to activity_log table
    db.run(`ALTER TABLE activity_log ADD COLUMN project_id INTEGER`, (err) => {
        if (err && !err.message.includes('duplicate column') && !err.message.includes('no such table')) {
            console.error('Error adding project_id to activity_log:', err);
        } else if (!err) {
            console.log('✓ Added project_id to activity_log table');
        }
    });

    // 8. Create default project for existing data
    setTimeout(() => {
        db.get(`SELECT id FROM users LIMIT 1`, (err, user) => {
            if (err || !user) {
                console.log('No users found, skipping default project creation');
                return;
            }

            const defaultProjectName = 'Meu Primeiro Projeto';
            const defaultProjectSlug = 'meu-primeiro-projeto';
            
            db.run(`INSERT OR IGNORE INTO projects (name, description, owner_id, slug, color)
                    VALUES (?, ?, ?, ?, ?)`,
                [defaultProjectName, 'Projeto criado automaticamente com seus dados existentes', 
                 user.id, defaultProjectSlug, '#007bff'],
                function(err) {
                    if (err) {
                        console.error('Error creating default project:', err);
                        return;
                    }
                    
                    const projectId = this.lastID;
                    console.log(`✓ Created default project with ID ${projectId}`);

                    // Add owner as admin member
                    db.run(`INSERT OR IGNORE INTO project_members (project_id, user_id, role)
                            VALUES (?, ?, ?)`,
                        [projectId, user.id, 'owner'],
                        (err) => {
                            if (err) console.error('Error adding owner to project:', err);
                            else console.log('✓ Added owner as project member');
                        }
                    );

                    // Update existing boards to belong to default project
                    db.run(`UPDATE boards SET project_id = ? WHERE project_id IS NULL`, 
                        [projectId],
                        function(err) {
                            if (err) console.error('Error updating boards:', err);
                            else console.log(`✓ Updated ${this.changes} boards to default project`);
                        }
                    );

                    // Update existing calendar events
                    db.run(`UPDATE calendar_events SET project_id = ? WHERE project_id IS NULL`, 
                        [projectId],
                        function(err) {
                            if (err && !err.message.includes('no such table')) {
                                console.error('Error updating calendar events:', err);
                            } else if (!err) {
                                console.log(`✓ Updated ${this.changes} calendar events to default project`);
                            }
                        }
                    );
                }
            );
        });
    }, 1000);

    // 9. Create indexes for better performance
    setTimeout(() => {
        db.run(`CREATE INDEX IF NOT EXISTS idx_boards_project_id ON boards(project_id)`, (err) => {
            if (err) console.error('Error creating index on boards:', err);
            else console.log('✓ Created index on boards.project_id');
        });

        db.run(`CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id)`, (err) => {
            if (err) console.error('Error creating index on project_members:', err);
            else console.log('✓ Created index on project_members.project_id');
        });

        db.run(`CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id)`, (err) => {
            if (err) console.error('Error creating index on project_members:', err);
            else console.log('✓ Created index on project_members.user_id');
        });

        console.log('\n✅ Migration completed successfully!');
        console.log('Your existing data has been moved to a default project.');
        
        setTimeout(() => {
            db.close();
            process.exit(0);
        }, 500);
    }, 2000);
});