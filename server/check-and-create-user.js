const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new sqlite3.Database(dbPath);

async function checkAndCreateUser() {
    const email = 'teste@exemplo.com';
    const password = '123456';
    const name = 'Usuário Teste';
    
    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Verificar se o usuário já existe
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) {
            console.error('Erro ao verificar usuário:', err);
            db.close();
            return;
        }
        
        if (row) {
            console.log('✅ Usuário de teste já existe:');
            console.log('   Email:', email);
            console.log('   Senha:', password);
            console.log('   ID:', row.id);
            
            // Verificar se o usuário tem projetos
            db.all('SELECT * FROM project_members WHERE user_id = ?', [row.id], (err, projects) => {
                if (err) {
                    console.error('Erro ao verificar projetos:', err);
                } else if (projects.length === 0) {
                    console.log('\n⚠️ Usuário não tem projetos. Criando projeto padrão...');
                    
                    // Criar projeto padrão
                    db.run(
                        'INSERT INTO projects (name, description, owner_id, slug, color, is_active) VALUES (?, ?, ?, ?, ?, ?)',
                        ['Projeto Inicial', 'Meu primeiro projeto', row.id, 'projeto-inicial-' + Date.now(), '#007bff', 1],
                        function(err) {
                            if (err) {
                                console.error('Erro ao criar projeto:', err);
                            } else {
                                const projectId = this.lastID;
                                console.log('✅ Projeto criado! ID:', projectId);
                                
                                // Adicionar usuário como owner do projeto
                                db.run(
                                    'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
                                    [projectId, row.id, 'owner'],
                                    (err) => {
                                        if (err) {
                                            console.error('Erro ao adicionar membro ao projeto:', err);
                                        } else {
                                            console.log('✅ Usuário adicionado como owner do projeto!');
                                        }
                                        db.close();
                                    }
                                );
                            }
                        }
                    );
                } else {
                    console.log('\n✅ Usuário tem', projects.length, 'projeto(s)');
                    db.close();
                }
            });
        } else {
            console.log('⚠️ Usuário não existe. Criando...');
            
            // Criar o usuário
            db.run(
                'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
                [name, email, hashedPassword],
                function(err) {
                    if (err) {
                        console.error('Erro ao criar usuário:', err);
                        db.close();
                    } else {
                        const userId = this.lastID;
                        console.log('✅ Usuário de teste criado com sucesso!');
                        console.log('   Email:', email);
                        console.log('   Senha:', password);
                        console.log('   ID:', userId);
                        
                        // Criar projeto padrão
                        db.run(
                            'INSERT INTO projects (name, description, owner_id, slug, color, is_active) VALUES (?, ?, ?, ?, ?, ?)',
                            ['Projeto Inicial', 'Meu primeiro projeto', userId, 'projeto-inicial-' + Date.now(), '#007bff', 1],
                            function(err) {
                                if (err) {
                                    console.error('Erro ao criar projeto:', err);
                                    db.close();
                                } else {
                                    const projectId = this.lastID;
                                    console.log('✅ Projeto padrão criado! ID:', projectId);
                                    
                                    // Adicionar usuário como owner do projeto
                                    db.run(
                                        'INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)',
                                        [projectId, userId, 'owner'],
                                        (err) => {
                                            if (err) {
                                                console.error('Erro ao adicionar membro ao projeto:', err);
                                            } else {
                                                console.log('✅ Usuário adicionado como owner do projeto!');
                                            }
                                            db.close();
                                        }
                                    );
                                }
                            }
                        );
                    }
                }
            );
        }
    });
}

checkAndCreateUser();