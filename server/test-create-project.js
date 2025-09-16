const axios = require('axios');

const API_URL = 'http://localhost:8000/api';
const email = 'teste@exemplo.com';
const password = '123456';

async function testCreateProject() {
    try {
        // 1. Login primeiro
        console.log('🔐 Fazendo login...');
        const loginResponse = await axios.post(`${API_URL}/users/login`, {
            email,
            password
        });
        
        const token = loginResponse.data.data.token;
        console.log('✅ Login bem-sucedido!');
        
        // 2. Criar novo projeto
        const projectName = `Projeto Teste ${new Date().toLocaleTimeString()}`;
        console.log(`\n📦 Criando projeto: "${projectName}"...`);
        
        const projectResponse = await axios.post(
            `${API_URL}/projects`,
            {
                name: projectName,
                description: 'Projeto de teste com estrutura completa',
                color: '#4CAF50'
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        const project = projectResponse.data;
        console.log(`✅ Projeto criado com sucesso!`);
        console.log(`   ID: ${project.id}`);
        console.log(`   Nome: ${project.name}`);
        console.log(`   Cor: ${project.color}`);
        
        // 3. Verificar boards criados
        console.log('\n🔍 Verificando estrutura criada...');
        
        const boardsResponse = await axios.get(
            `${API_URL}/boards`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );
        
        const projectBoards = boardsResponse.data.data.filter(b => b.project_id === project.id);
        console.log(`\n📋 Boards criados: ${projectBoards.length}`);
        
        for (const board of projectBoards) {
            console.log(`\n   📌 ${board.title} (ID: ${board.id})`);
            console.log(`      Descrição: ${board.description || 'N/A'}`);
            
            // Buscar colunas do board
            const columnsResponse = await axios.get(
                `${API_URL}/boards/${board.id}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );
            
            const columns = columnsResponse.data.data.columns || [];
            console.log(`      Colunas: ${columns.length}`);
            
            for (const column of columns) {
                const cards = column.cards || [];
                console.log(`         • ${column.name} (${cards.length} cards)`);
                
                for (const card of cards) {
                    console.log(`            - ${card.title}`);
                }
            }
        }
        
        console.log('\n🎉 Teste concluído com sucesso!');
        console.log(`   Acesse: http://localhost:5174/projects/${project.id}`);
        
    } catch (error) {
        console.error('❌ Erro:', error.response?.data || error.message);
    }
}

testCreateProject();