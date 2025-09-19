const permissions = {
    owner: [ 'project:delete', 'project:edit', 'members:invite', 'members:remove', 'members:change_role', /* ...todas as outras */ ],
    project_manager: [ 'project:edit', 'members:invite', 'members:remove', /* ... */ ],
    team_member: [ 'cards:create', 'cards:edit', 'comments:create' ],
    viewer: [ 'project:view' ]
};

module.exports = permissions;