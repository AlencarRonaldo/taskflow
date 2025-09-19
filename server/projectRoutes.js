const express = require('express');
const router = express.Router();
const { run, get, all } = require('./database');
const createProjectStructure = require('./createProjectStructure');

// Middleware to check project access
const checkProjectAccess = (req, res, next) => {
    const projectId = req.params.projectId || req.body.project_id;
    const userId = req.user.id;

    if (!projectId) {
        return res.status(400).json({ error: 'Project ID is required' });
    }

    get(
        `SELECT pm.*, p.* FROM project_members pm 
         JOIN projects p ON pm.project_id = p.id
         WHERE pm.project_id = ? AND pm.user_id = ?`,
        [projectId, userId]
    ).then(member => {
        if (!member) {
            return res.status(403).json({ error: 'Access denied to this project' });
        }
        req.projectMember = member;
        next();
    }).catch(err => {
        return res.status(500).json({ error: 'Database error' });
    });
};

// GET /api/projects - List all projects for the current user
router.get('/', (req, res) => {
    const userId = req.user.id;
    
    console.log('🔍 Getting projects for user:', userId);
    
    console.log('📊 About to call all()...');
    
    try {
        all(
            `SELECT 
                p.id, p.name, p.description, p.color, p.logo, p.created_at, p.updated_at, pm.role, p.is_active,
                (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as members_count,
                (SELECT COUNT(*) FROM boards WHERE project_id = p.id) as boards_count,
                (SELECT COUNT(*) FROM cards c JOIN columns col ON c.column_id = col.id JOIN boards b ON col.board_id = b.id WHERE b.project_id = p.id) as tasks_count,
                (SELECT COUNT(*) FROM cards c JOIN columns col ON c.column_id = col.id JOIN boards b ON col.board_id = b.id WHERE b.project_id = p.id AND c.status = 'done') as completed_tasks_count,
                (SELECT c.title FROM cards c JOIN columns col ON c.column_id = col.id JOIN boards b ON col.board_id = b.id WHERE b.project_id = p.id AND c.due_date > CURRENT_TIMESTAMP ORDER BY c.due_date ASC LIMIT 1) as next_appointment_title,
                (SELECT c.due_date FROM cards c JOIN columns col ON c.column_id = col.id JOIN boards b ON col.board_id = b.id WHERE b.project_id = p.id AND c.due_date > CURRENT_TIMESTAMP ORDER BY c.due_date ASC LIMIT 1) as next_appointment_due_date,
                -- Project completion status
                CASE 
                    WHEN (SELECT COUNT(*) FROM boards WHERE project_id = p.id) = 0 THEN 0
                    WHEN (SELECT COUNT(*) FROM boards WHERE project_id = p.id AND allTasksCompleted = 0) = 0 THEN 1
                    ELSE 0
                END as is_completed,
                -- Completion date (when the last board was completed)
                CASE 
                    WHEN (SELECT COUNT(*) FROM boards WHERE project_id = p.id) = 0 THEN NULL
                    WHEN (SELECT COUNT(*) FROM boards WHERE project_id = p.id AND allTasksCompleted = 0) = 0 THEN 
                        (SELECT MAX(last_updated_at) FROM boards WHERE project_id = p.id AND allTasksCompleted = 1)
                    ELSE NULL
                END as completed_at,
                -- Last activity date (most recent update across all project activities)
                CASE 
                    WHEN (SELECT MAX(last_updated_at) FROM boards WHERE project_id = p.id) IS NOT NULL 
                         AND (SELECT MAX(last_updated_at) FROM boards WHERE project_id = p.id) > COALESCE(p.updated_at, p.created_at)
                    THEN (SELECT MAX(last_updated_at) FROM boards WHERE project_id = p.id)
                    WHEN (SELECT MAX(c.updated_at) FROM cards c JOIN columns col ON c.column_id = col.id JOIN boards b ON col.board_id = b.id WHERE b.project_id = p.id) IS NOT NULL
                         AND (SELECT MAX(c.updated_at) FROM cards c JOIN columns col ON c.column_id = col.id JOIN boards b ON col.board_id = b.id WHERE b.project_id = p.id) > COALESCE(p.updated_at, p.created_at)
                    THEN (SELECT MAX(c.updated_at) FROM cards c JOIN columns col ON c.column_id = col.id JOIN boards b ON col.board_id = b.id WHERE b.project_id = p.id)
                    ELSE COALESCE(p.updated_at, p.created_at)
                END as last_activity_at
             FROM projects p
             JOIN project_members pm ON p.id = pm.project_id
             WHERE pm.user_id = ?
             ORDER BY p.created_at DESC`,
            [userId]
        ).then(projects => {
            console.log('📊 Query executed successfully!');
            console.log('✅ Found projects:', projects?.length || 0);
            console.log('🔍 Projects data:', projects);
            res.json(projects || []);
        }).catch(err => {
            console.error('❌ Error fetching projects:', err);
            res.status(500).json({ error: err.message });
        });
    } catch (error) {
        console.error('💥 Exception calling all():', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// POST /api/projects - Create a new project
router.post('/', async (req, res) => {
    console.log('🆕 POST /projects - Creating new project');
    console.log('   Body:', req.body);
    console.log('   User:', req.user);
    
    const { name, description, color } = req.body;
    const userId = req.user.id;

    if (!name) {
        console.log('❌ Project name is required');
        return res.status(400).json({ error: 'Project name is required' });
    }

    // Generate slug from name
    const slug = name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') + '-' + Date.now();

    try {
        console.log('📝 Inserting project into database...');
        
        const result = await run(
            `INSERT INTO projects (name, description, owner_id, slug, color)
             VALUES (?, ?, ?, ?, ?)`,
            [name, description || '', userId, slug, color || '#007bff']
        );

        const projectId = result.id;
        console.log('✅ Project inserted with ID:', projectId);

        // Add creator as owner
        console.log('👤 Adding project member...');
        await run(
            `INSERT INTO project_members (project_id, user_id, role)
             VALUES (?, ?, 'owner')`,
            [projectId, userId]
        );

        console.log('✅ Project member added');

        // Return the created project
        console.log('🔍 Getting created project...');
        const project = await get(
            `SELECT * FROM projects WHERE id = ?`,
            [projectId]
        );
        
        console.log('✅ Project created successfully:', project);
        res.status(201).json(project);
        
        // Create structure in background without blocking response
        setTimeout(() => {
            createProjectStructure(projectId, userId)
                .then(() => {
                    console.log('✅ Project structure created in background');
                })
                .catch(err => {
                    console.error('❌ Error creating project structure in background:', err);
                });
        }, 100);
        
    } catch (err) {
        console.error('❌ Error creating project:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/projects/:projectId - Get project details
router.get('/:projectId', checkProjectAccess, (req, res) => {
    const projectId = req.params.projectId;

    get(
        `SELECT p.*, 
                (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as members_count,
                (SELECT COUNT(*) FROM boards WHERE project_id = p.id) as boards_count,
                (SELECT COUNT(*) FROM cards c 
                 JOIN columns col ON c.column_id = col.id 
                 JOIN boards b ON col.board_id = b.id 
                 WHERE b.project_id = p.id) as tasks_count
         FROM projects p
         WHERE p.id = ?`,
        [projectId]
    ).then(project => {
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json(project);
    }).catch(err => {
        return res.status(500).json({ error: err.message });
    });
});

// PUT /api/projects/:projectId - Update project
router.put('/:projectId', checkProjectAccess, (req, res) => {
    const projectId = req.params.projectId;
    const { name, description, color, logo } = req.body;
    const role = req.projectMember.role;

    // Only owners and admins can update projects
    if (role !== 'owner' && role !== 'admin') {
        return res.status(403).json({ error: 'Only project owners and admins can update projects' });
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
    }
    if (description !== undefined) {
        updates.push('description = ?');
        values.push(description);
    }
    if (color !== undefined) {
        updates.push('color = ?');
        values.push(color);
    }
    if (logo !== undefined) {
        updates.push('logo = ?');
        values.push(logo);
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(projectId);

    run(
        `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`,
        values
    ).then(result => {
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json({ message: 'Project updated successfully' });
    }).catch(err => {
        return res.status(500).json({ error: err.message });
    });
});

// DELETE /api/projects/:projectId - Archive/delete project
router.delete('/:projectId', checkProjectAccess, (req, res) => {
    const projectId = req.params.projectId;
    const role = req.projectMember.role;

    // Only owners can delete projects
    if (role !== 'owner') {
        return res.status(403).json({ error: 'Only project owners can delete projects' });
    }

    run(
        `UPDATE projects SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [projectId]
    ).then(result => {
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json({ message: 'Project archived successfully' });
    }).catch(err => {
        return res.status(500).json({ error: err.message });
    });
});

// GET /api/projects/:projectId/members - Get project members
router.get('/:projectId/members', checkProjectAccess, (req, res) => {
    const projectId = req.params.projectId;

    all(
        `SELECT u.id, u.name, u.email, pm.role, pm.joined_at
         FROM project_members pm
         JOIN users u ON pm.user_id = u.id
         WHERE pm.project_id = ?
         ORDER BY pm.joined_at ASC`,
        [projectId]
    ).then(members => {
        res.json(members || []);
    }).catch(err => {
        return res.status(500).json({ error: err.message });
    });
});

// POST /api/projects/:projectId/members - Add member to project
router.post('/:projectId/members', checkProjectAccess, (req, res) => {
    const projectId = req.params.projectId;
    const { user_email, role } = req.body;
    const memberRole = req.projectMember.role;

    // Only owners and admins can add members
    if (memberRole !== 'owner' && memberRole !== 'admin') {
        return res.status(403).json({ error: 'Only project owners and admins can add members' });
    }

    // Find user by email
    get(
        `SELECT id FROM users WHERE email = ?`,
        [user_email]
    ).then(user => {
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Add user to project
        return run(
            `INSERT INTO project_members (project_id, user_id, role)
             VALUES (?, ?, ?)`,
            [projectId, user.id, role || 'member']
        ).then(() => {
            res.status(201).json({ message: 'Member added successfully' });
        }).catch(err => {
            if (err.message.includes('UNIQUE')) {
                return res.status(400).json({ error: 'User is already a member of this project' });
            }
            return res.status(500).json({ error: err.message });
        });
    }).catch(err => {
        return res.status(500).json({ error: err.message });
    });
});

// Helper function to create default boards for a new project
function createDefaultBoards(projectId, userId, callback) {
    const defaultBoards = [
        { title: 'Tarefas Gerais', order: 0 },
        { title: 'Sprint Atual', order: 1 },
        { title: 'Backlog', order: 2 }
    ];

    const defaultColumns = [
        { title: 'A Fazer', order: 0 },
        { title: 'Em Progresso', order: 1 },
        { title: 'Concluído', order: 2 }
    ];

    let boardsCreated = 0;

    defaultBoards.forEach(async (board, index) => {
        try {
            const result = await run(
                `INSERT INTO boards (title, user_id_creator, project_id, background_color)
                 VALUES (?, ?, ?, ?)`,
                [board.title, userId, projectId, '#f8f9fa']
            );

            const boardId = result.id;

            // Create columns for this board
            for (const column of defaultColumns) {
                try {
                    await run(
                        `INSERT INTO columns (title, board_id, order_index)
                         VALUES (?, ?, ?)`,
                        [column.title, boardId, column.order]
                    );
                } catch (err) {
                    console.error('Error creating default column:', err);
                }
            }

            boardsCreated++;
            if (boardsCreated === defaultBoards.length) {
                callback();
            }
        } catch (err) {
            console.error('Error creating default board:', err);
        }
    });
}

module.exports = router;