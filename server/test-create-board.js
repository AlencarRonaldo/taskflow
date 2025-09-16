const axios = require('axios');

async function testCreateBoard() {
    try {
        console.log('🔐 Login...');
        const loginResponse = await axios.post('http://localhost:8000/api/users/login', {
            email: 'teste@exemplo.com',
            password: '123456'
        });
        
        const token = loginResponse.data.data.token;
        console.log('✅ Login ok, token:', token.substring(0, 10) + '...');
        
        console.log('\n📋 Criando board...');
        const boardResponse = await axios.post(
            'http://localhost:8000/api/boards',
            {
                title: 'Board Teste API',
                description: 'Teste via API direta',
                background_color: '#ff5722',
                project_id: 4,
                responsible: 'Admin'
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ Board criado:', boardResponse.data);
        
    } catch (error) {
        console.error('❌ Erro:', error.response?.status, error.response?.data || error.message);
    }
}

testCreateBoard();