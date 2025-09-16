const axios = require('axios');

async function testCreateProject() {
    try {
        console.log('🔐 Login...');
        const loginResponse = await axios.post('http://localhost:8000/api/users/login', {
            email: 'teste@exemplo.com',
            password: '123456'
        });
        
        const token = loginResponse.data.data.token;
        console.log('✅ Login ok');
        
        console.log('\n📦 Criando projeto...');
        const projectResponse = await axios.post(
            'http://localhost:8000/api/projects',
            {
                name: 'Teste Projeto Direto',
                description: 'Teste de criação direta',
                color: '#ff5722'
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ Projeto criado:', projectResponse.data);
        
    } catch (error) {
        console.error('❌ Erro:', error.response?.status, error.response?.data || error.message);
    }
}

testCreateProject();