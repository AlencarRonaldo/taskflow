const axios = require('axios');

async function testAPI() {
    try {
        console.log('🔐 Fazendo login...');
        const loginResponse = await axios.post('http://localhost:8000/api/users/login', {
            email: 'teste@exemplo.com',
            password: '123456'
        });
        
        const token = loginResponse.data.data.token;
        console.log('✅ Login ok, token obtido');
        
        console.log('\n📋 Testando lista de projetos...');
        const projectsResponse = await axios.get('http://localhost:8000/api/projects', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('✅ Projetos encontrados:', projectsResponse.data.length);
        console.log(JSON.stringify(projectsResponse.data, null, 2));
        
    } catch (error) {
        console.error('❌ Erro:', error.response?.data || error.message);
    }
}

testAPI();