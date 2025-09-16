const API_URL = 'http://localhost:8000/api';

async function testProjectsAPI() {
    try {
        console.log('1. Fazendo login...');
        const loginResponse = await fetch(`${API_URL}/users/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'teste@exemplo.com',
                password: '123456'
            })
        });
        
        const loginData = await loginResponse.json();
        const token = loginData.data.token;
        console.log('✅ Login bem-sucedido!');
        console.log('   Token:', token.substring(0, 50) + '...');
        
        console.log('\n2. Buscando projetos...');
        const projectsResponse = await fetch(`${API_URL}/projects`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('   Status:', projectsResponse.status);
        console.log('   Headers:', projectsResponse.headers);
        
        const projectsData = await projectsResponse.json();
        console.log('   Response:', projectsData);
        
        if (Array.isArray(projectsData)) {
            console.log('✅ Projetos encontrados:', projectsData.length);
            console.log('\nProjetos:');
            projectsData.forEach(project => {
                console.log(`  - ID: ${project.id}, Nome: ${project.name}`);
            });
            
            if (projectsData.length === 0) {
                console.log('\n⚠️ Nenhum projeto encontrado! Criando projeto de teste...');
                
                const createResponse = await fetch(`${API_URL}/projects`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: 'Projeto de Teste',
                        description: 'Projeto criado automaticamente para teste',
                        color: '#007bff'
                    })
                });
                
                const createData = await createResponse.json();
                console.log('✅ Projeto criado com sucesso!');
                console.log('   ID:', createData.id);
                console.log('   Nome:', createData.name);
            }
        } else if (projectsData.error) {
            console.error('❌ Erro na API:', projectsData.error);
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

testProjectsAPI();