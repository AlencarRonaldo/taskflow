const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const DBSOURCE = "db.sqlite";

const db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        // Cannot open database
        console.error(err.message);
        throw err;
    } else {
        console.log('Connected to the SQLite database.');
        db.serialize(() => {
            // Create tables
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                email TEXT UNIQUE,
                password_hash TEXT,
                CONSTRAINT email_unique UNIQUE (email)
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS boards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                user_id_creator INTEGER,
                background_image TEXT,
                background_color TEXT DEFAULT '#ffffff',
                due_date DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id_creator) REFERENCES users (id)
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS columns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                board_id INTEGER,
                order_index INTEGER,
                wip_limit INTEGER DEFAULT NULL,
                is_collapsed BOOLEAN DEFAULT 0,
                FOREIGN KEY (board_id) REFERENCES boards (id)
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS cards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                description TEXT,
                column_id INTEGER,
                order_index INTEGER,
                status TEXT DEFAULT 'todo',
                due_date DATETIME,
                assignee_id INTEGER,
                priority TEXT DEFAULT 'medium',
                FOREIGN KEY (column_id) REFERENCES columns (id),
                FOREIGN KEY (assignee_id) REFERENCES users (id)
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT,
                card_id INTEGER,
                user_id_author INTEGER,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (card_id) REFERENCES cards (id),
                FOREIGN KEY (user_id_author) REFERENCES users (id)
            )`);
            
            // Create labels table
            db.run(`CREATE TABLE IF NOT EXISTS labels (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                color TEXT NOT NULL,
                board_id INTEGER,
                FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE
            )`);
            
            // Create card_labels junction table
            db.run(`CREATE TABLE IF NOT EXISTS card_labels (
                card_id INTEGER,
                label_id INTEGER,
                PRIMARY KEY (card_id, label_id),
                FOREIGN KEY (card_id) REFERENCES cards (id) ON DELETE CASCADE,
                FOREIGN KEY (label_id) REFERENCES labels (id) ON DELETE CASCADE
            )`);

            // Create attachments table
            db.run(`CREATE TABLE IF NOT EXISTS attachments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                original_name TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                mime_type TEXT NOT NULL,
                uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (card_id) REFERENCES cards (id) ON DELETE CASCADE
            )`);

            // Create activity_log table
            db.run(`CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                board_id INTEGER,
                card_id INTEGER,
                action_type TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id INTEGER NOT NULL,
                old_values TEXT,
                new_values TEXT,
                description TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE,
                FOREIGN KEY (card_id) REFERENCES cards (id) ON DELETE CASCADE
            )`);

            // Create checklists table
            db.run(`CREATE TABLE IF NOT EXISTS checklists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                card_id INTEGER NOT NULL,
                title TEXT NOT NULL DEFAULT 'Checklist',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (card_id) REFERENCES cards (id) ON DELETE CASCADE
            )`);

            // Create checklist_items table
            db.run(`CREATE TABLE IF NOT EXISTS checklist_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                checklist_id INTEGER NOT NULL,
                text TEXT NOT NULL,
                completed BOOLEAN DEFAULT 0,
                order_index INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                FOREIGN KEY (checklist_id) REFERENCES checklists (id) ON DELETE CASCADE
            )`);

            // Add missing columns to existing boards table (migration)
            db.run(`ALTER TABLE boards ADD COLUMN due_date DATETIME`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding due_date column:', err.message);
                } else if (!err) {
                    console.log('Added due_date column to boards table');
                }
            });
            db.run(`ALTER TABLE boards ADD COLUMN created_at DATETIME`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding created_at column:', err.message);
                } else if (!err) {
                    console.log('Added created_at column to boards table');
                    // Update existing boards to have created_at timestamp
                    db.run(`UPDATE boards SET created_at = datetime('now') WHERE created_at IS NULL`, (updateErr) => {
                        if (updateErr) {
                            console.error('Error updating created_at timestamps:', updateErr.message);
                        } else {
                            console.log('Updated existing boards with created_at timestamps');
                        }
                    });
                }
            });

            // Add missing columns to existing cards table (migration)
            db.run(`ALTER TABLE cards ADD COLUMN due_date DATETIME`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding due_date column to cards:', err.message);
                } else if (!err) {
                    console.log('Added due_date column to cards table');
                }
            });

            // Add priority column to cards table
            db.run(`ALTER TABLE cards ADD COLUMN priority TEXT DEFAULT 'medium'`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding priority column to cards:', err.message);
                } else if (!err) {
                    console.log('Added priority column to cards table');
                }
            });

            // Add name column to users table
            db.run(`ALTER TABLE users ADD COLUMN name TEXT`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding name column to users:', err.message);
                } else if (!err) {
                    console.log('Added name column to users table');
                }
            });

            // Create analytics table for workload tracking
            db.run(`CREATE TABLE IF NOT EXISTS analytics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                board_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                metric_type TEXT NOT NULL,
                metric_value REAL NOT NULL,
                calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`);

            // Add last_updated_by and last_updated_at columns to boards table
            db.run(`ALTER TABLE boards ADD COLUMN last_updated_by INTEGER`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding last_updated_by column to boards:', err.message);
                } else if (!err) {
                    console.log('Added last_updated_by column to boards table');
                }
            });
            db.run(`ALTER TABLE boards ADD COLUMN last_updated_at DATETIME`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding last_updated_at column to boards:', err.message);
                } else if (!err) {
                    console.log('Added last_updated_at column to boards table');
                    // Update existing boards to have last_updated_at timestamp
                    db.run(`UPDATE boards SET last_updated_at = datetime('now'), last_updated_by = user_id_creator WHERE last_updated_at IS NULL`, (updateErr) => {
                        if (updateErr) {
                            console.error('Error updating last_updated timestamps:', updateErr.message);
                        } else {
                            console.log('Updated existing boards with last_updated timestamps');
                        }
                    });
                }
            });

            // Add allTasksCompleted column to boards table
            db.run(`ALTER TABLE boards ADD COLUMN allTasksCompleted INTEGER DEFAULT 0`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding allTasksCompleted column to boards:', err.message);
                } else if (!err) {
                    console.log('Added allTasksCompleted column to boards table');
                }
            });

            // Add created_at and updated_at columns to cards table
            db.run(`ALTER TABLE cards ADD COLUMN created_at DATETIME`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding created_at column to cards:', err.message);
                } else if (!err) {
                    console.log('Added created_at column to cards table');
                }
            });
            db.run(`ALTER TABLE cards ADD COLUMN updated_at DATETIME`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding updated_at column to cards:', err.message);
                } else if (!err) {
                    console.log('Added updated_at column to cards table');
                    // Update existing cards to have timestamps
                    db.run(`UPDATE cards SET created_at = datetime('now'), updated_at = datetime('now') WHERE created_at IS NULL`, (updateErr) => {
                        if (updateErr) {
                            console.error('Error updating cards timestamps:', updateErr.message);
                        } else {
                            console.log('Updated existing cards with timestamps');
                        }
                    });
                }
            });

            // Add labels column to cards table for storing comma-separated labels
            db.run(`ALTER TABLE cards ADD COLUMN labels TEXT`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding labels column to cards:', err.message);
                } else if (!err) {
                    console.log('Added labels column to cards table');
                }
            });

            // Add progress column to cards table
            db.run(`ALTER TABLE cards ADD COLUMN progress INTEGER DEFAULT 0`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding progress column to cards:', err.message);
                } else if (!err) {
                    console.log('Added progress column to cards table');
                }
            });

            // Create public_access_tokens table
            db.run(`CREATE TABLE IF NOT EXISTS public_access_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token VARCHAR(255) UNIQUE NOT NULL,
                board_id INTEGER NOT NULL,
                created_by INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME,
                is_active BOOLEAN DEFAULT 1,
                FOREIGN KEY (board_id) REFERENCES boards(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            )`, (err) => {
                if (err) {
                    console.error('Error creating public_access_tokens table:', err.message);
                } else {
                    console.log('public_access_tokens table created or already exists');
                }
            });

            // Create external_technicians table
            db.run(`CREATE TABLE IF NOT EXISTS external_technicians (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                token_id INTEGER NOT NULL,
                name VARCHAR(255) NOT NULL,
                phone VARCHAR(20) NOT NULL,
                registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_activity DATETIME,
                FOREIGN KEY (token_id) REFERENCES public_access_tokens(id)
            )`, (err) => {
                if (err) {
                    console.error('Error creating external_technicians table:', err.message);
                } else {
                    console.log('external_technicians table created or already exists');
                }
            });

            // Add tracking columns to boards table
            db.run(`ALTER TABLE boards ADD COLUMN last_external_activity DATETIME`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding last_external_activity column:', err.message);
                } else if (!err) {
                    console.log('Added last_external_activity column to boards table');
                }
            });

            db.run(`ALTER TABLE boards ADD COLUMN last_external_user VARCHAR(255)`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding last_external_user column:', err.message);
                } else if (!err) {
                    console.log('Added last_external_user column to boards table');
                }
            });

            // Add responsible column to boards table
            db.run(`ALTER TABLE boards ADD COLUMN responsible TEXT`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding responsible column to boards:', err.message);
                } else if (!err) {
                    console.log('Added responsible column to boards table');
                }
            });

            // Create task_dependencies table for Gantt chart
            db.run(`CREATE TABLE IF NOT EXISTS task_dependencies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                predecessor_id INTEGER NOT NULL,
                successor_id INTEGER NOT NULL,
                dependency_type TEXT DEFAULT 'finish_to_start',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (predecessor_id) REFERENCES cards (id) ON DELETE CASCADE,
                FOREIGN KEY (successor_id) REFERENCES cards (id) ON DELETE CASCADE,
                UNIQUE(predecessor_id, successor_id)
            )`, (err) => {
                if (err) {
                    console.error('Error creating task_dependencies table:', err.message);
                } else {
                    console.log('task_dependencies table created or already exists');
                }
            });

            // Add Gantt-related columns to cards table
            db.run(`ALTER TABLE cards ADD COLUMN start_date DATETIME`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding start_date column to cards:', err.message);
                } else if (!err) {
                    console.log('Added start_date column to cards table');
                }
            });

            db.run(`ALTER TABLE cards ADD COLUMN end_date DATETIME`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding end_date column to cards:', err.message);
                } else if (!err) {
                    console.log('Added end_date column to cards table');
                    // Update existing cards to set end_date based on due_date
                    db.run(`UPDATE cards SET end_date = due_date WHERE end_date IS NULL AND due_date IS NOT NULL`, (updateErr) => {
                        if (updateErr) {
                            console.error('Error updating end_date from due_date:', updateErr.message);
                        } else {
                            console.log('Updated existing cards with end_date from due_date');
                        }
                    });
                }
            });

            db.run(`ALTER TABLE cards ADD COLUMN progress INTEGER DEFAULT 0`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding progress column to cards:', err.message);
                } else if (!err) {
                    console.log('Added progress column to cards table');
                    // Update progress based on existing status
                    db.run(`UPDATE cards SET progress = 
                        CASE 
                            WHEN status = 'todo' THEN 0
                            WHEN status = 'in_progress' THEN 50
                            WHEN status = 'done' THEN 100
                            ELSE 0
                        END 
                        WHERE progress = 0`, (updateErr) => {
                        if (updateErr) {
                            console.error('Error updating progress from status:', updateErr.message);
                        } else {
                            console.log('Updated existing cards with progress from status');
                        }
                    });
                }
            });

            db.run(`ALTER TABLE cards ADD COLUMN is_milestone BOOLEAN DEFAULT 0`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding is_milestone column to cards:', err.message);
                } else if (!err) {
                    console.log('Added is_milestone column to cards table');
                }
            });

            // Add WIP limit and collapse columns to existing columns table
            db.run(`ALTER TABLE columns ADD COLUMN wip_limit INTEGER DEFAULT NULL`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding wip_limit column to columns:', err.message);
                } else if (!err) {
                    console.log('Added wip_limit column to columns table');
                }
            });

            db.run(`ALTER TABLE columns ADD COLUMN is_collapsed BOOLEAN DEFAULT 0`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding is_collapsed column to columns:', err.message);
                } else if (!err) {
                    console.log('Added is_collapsed column to columns table');
                }
            });

            // Create card_templates table
            db.run(`CREATE TABLE IF NOT EXISTS card_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                priority TEXT DEFAULT 'medium',
                labels TEXT, -- JSON array of label names
                board_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE
            )`, (err) => {
                if (err) {
                    console.error('Error creating card_templates table:', err.message);
                } else {
                    console.log('card_templates table created or already exists');
                }
            });

            // Create projects table
            db.run(`CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                owner_id INTEGER NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                color TEXT DEFAULT '#007bff',
                logo TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (owner_id) REFERENCES users (id)
            )`, (err) => {
                if (err) {
                    console.error('Error creating projects table:', err.message);
                } else {
                    console.log('projects table created or already exists');
                }
            });

            // Create project_members table
            db.run(`CREATE TABLE IF NOT EXISTS project_members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                role TEXT NOT NULL DEFAULT 'member',
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                UNIQUE(project_id, user_id)
            )`, (err) => {
                if (err) {
                    console.error('Error creating project_members table:', err.message);
                } else {
                    console.log('project_members table created or already exists');
                }
            });

            // Add project_id column to boards table
            db.run(`ALTER TABLE boards ADD COLUMN project_id INTEGER`, (err) => {
                if (err && !err.message.includes('duplicate column')) {
                    console.error('Error adding project_id column to boards:', err.message);
                } else if (!err) {
                    console.log('Added project_id column to boards table');
                }
            });

            // Create automations table
            db.run(`CREATE TABLE IF NOT EXISTS automations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                board_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                trigger_type TEXT NOT NULL, -- card_created, card_moved, due_date_approaching, etc
                trigger_config TEXT, -- JSON configuration for trigger
                conditions TEXT, -- JSON array of conditions
                actions TEXT, -- JSON array of actions
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE
            )`, (err) => {
                if (err) {
                    console.error('Error creating automations table:', err.message);
                } else {
                    console.log('automations table created or already exists');
                }
            });

            // Create automation_logs table
            db.run(`CREATE TABLE IF NOT EXISTS automation_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                automation_id INTEGER NOT NULL,
                trigger_data TEXT, -- JSON data that triggered automation
                execution_result TEXT, -- success/failure
                error_message TEXT,
                executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (automation_id) REFERENCES automations (id) ON DELETE CASCADE
            )`, (err) => {
                if (err) {
                    console.error('Error creating automation_logs table:', err.message);
                } else {
                    console.log('automation_logs table created or already exists');
                }
            });

            // Seed default user
            const defaultEmail = 'user@example.com';
            const defaultPassword = 'password123';

            db.get('SELECT * FROM users WHERE email = ?', [defaultEmail], (err, row) => {
                if (err) {
                    console.error('Error checking for default user:', err.message);
                    return;
                }
                if (!row) {
                    bcrypt.hash(defaultPassword, 8, (err, hashedPassword) => {
                        if (err) {
                            console.error('Error hashing password:', err.message);
                            return;
                        }
                        db.run('INSERT INTO users (email, password_hash) VALUES (?, ?)', [defaultEmail, hashedPassword], (err) => {
                            if (err) {
                                console.error('Error inserting default user:', err.message);
                            } else {
                                console.log('Default user created: user@example.com / password123');
                            }
                        });
                    });
                }
            });
        });
    }
});


const run = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) {
                console.error("Database run error:", err.message);
                reject(err);
            } else {
                resolve({ id: this.lastID, changes: this.changes });
            }
        });
    });
};

const get = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, result) => {
            if (err) {
                console.error("Database get error:", err.message);
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
};

const all = (query, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                console.error("Database all error:", err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

module.exports = { db, run, get, all };

