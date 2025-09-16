const axios = require('axios');

async function testProjectDetails() {
    try {
        console.log('🔐 Fazendo login...');
        const loginResponse = await axios.post('http://localhost:8000/api/users/login', {
            email: 'teste@exemplo.com',
            password: '123456'
        });
        
        const token = loginResponse.data.data.token;
        console.log('✅ Login ok');
        
        const projectId = 4;
        
        console.log(`\n📋 Testando detalhes do projeto ${projectId}...`);
        const projectResponse = await axios.get(`http://localhost:8000/api/projects/${projectId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('✅ Projeto encontrado:', projectResponse.data);
        
        console.log('\n🎯 Testando boards...');
        const boardsResponse = await axios.get('http://localhost:8000/api/boards', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('✅ Resposta boards:', boardsResponse.data);
        
    } catch (error) {
        console.error('❌ Erro:', error.response?.data || error.message);
        console.error('Status:', error.response?.status);
    }
}

testProjectDetails();