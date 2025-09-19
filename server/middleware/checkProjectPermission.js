const { get } = require('../database');
const permissions = require('../permissions');

const checkProjectPermission = (permission) => async (req, res, next) => {
    const projectId = req.params.projectId; // ou de onde vier o ID do projeto
    const userId = req.user.id;

    // Verificar status do trial
    const user = await get('SELECT is_trial_active, trial_ends_at FROM users WHERE id = ?', [userId]);
    if (!user || !user.is_trial_active || (user.trial_ends_at && new Date(user.trial_ends_at) < new Date())) {
        return res.status(403).json({ error: 'Período de teste expirado ou acesso restrito. Por favor, assine para continuar.' });
    }

    const member = await get('SELECT role FROM project_members WHERE project_id = ? AND user_id = ? AND status = \'active\'', [projectId, userId]);

    if (!member || !permissions[member.role]?.includes(permission)) {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    next();
};

module.exports = checkProjectPermission;