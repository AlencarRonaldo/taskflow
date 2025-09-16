const axios = require('axios');

async function testCreateSimple() {
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
                name: 'Projeto Teste Simples',
                description: 'Teste de criação',
                color: '#ff5722'
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        console.log('✅ Projeto criado:', projectResponse.data);
        
        console.log('\n📋 Listando projetos...');
        const listResponse = await axios.get('http://localhost:8000/api/projects', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('✅ Projetos atuais:', listResponse.data.length);
        listResponse.data.forEach(p => {
            console.log(`   - ${p.name} (ID: ${p.id})`);
        });
        
    } catch (error) {
        console.error('❌ Erro:', error.response?.data || error.message);
    }
}

testCreateSimple();