const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando servidor...');

const server = spawn('node', ['index.js'], {
  cwd: __dirname,
  stdio: 'inherit'
});

server.on('error', (err) => {
  console.error('❌ Erro ao iniciar servidor:', err);
});

server.on('close', (code) => {
  console.log(`📝 Servidor encerrado com código: ${code}`);
});

// Manter o processo vivo
process.on('SIGINT', () => {
  console.log('🛑 Encerrando servidor...');
  server.kill();
  process.exit();
});

console.log('✅ Servidor iniciado! Pressione Ctrl+C para parar.');






