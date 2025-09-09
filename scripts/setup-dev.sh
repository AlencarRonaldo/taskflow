#!/bin/bash

# 🚀 Script de Configuração do Ambiente de Desenvolvimento
# Sistema Kanban Organizer

set -e

echo "🎯 Configurando ambiente de desenvolvimento..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log colorido
log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar se Node.js está instalado
check_node() {
    if ! command -v node &> /dev/null; then
        error "Node.js não está instalado. Por favor, instale Node.js 18+ primeiro."
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    log "Node.js versão: $NODE_VERSION"
}

# Verificar se npm está instalado
check_npm() {
    if ! command -v npm &> /dev/null; then
        error "npm não está instalado. Por favor, instale npm primeiro."
        exit 1
    fi
    
    NPM_VERSION=$(npm --version)
    log "npm versão: $NPM_VERSION"
}

# Instalar dependências do servidor
install_server_deps() {
    log "Instalando dependências do servidor..."
    cd server
    
    if [ ! -f "package.json" ]; then
        error "package.json não encontrado no diretório server/"
        exit 1
    fi
    
    npm install
    log "✅ Dependências do servidor instaladas"
    cd ..
}

# Instalar dependências do cliente
install_client_deps() {
    log "Instalando dependências do cliente..."
    cd client
    
    if [ ! -f "package.json" ]; then
        error "package.json não encontrado no diretório client/"
        exit 1
    fi
    
    npm install
    log "✅ Dependências do cliente instaladas"
    cd ..
}

# Criar diretórios necessários
create_directories() {
    log "Criando diretórios necessários..."
    
    mkdir -p server/logs
    mkdir -p server/data
    mkdir -p server/backups
    mkdir -p docs
    mkdir -p scripts
    
    log "✅ Diretórios criados"
}

# Configurar variáveis de ambiente
setup_env() {
    log "Configurando variáveis de ambiente..."
    
    # Criar .env para o servidor
    if [ ! -f "server/.env" ]; then
        cat > server/.env << EOF
NODE_ENV=development
PORT=8000
JWT_SECRET=dev-secret-key-change-in-production
DATABASE_URL=./data/db.sqlite
LOG_LEVEL=debug
EOF
        log "✅ Arquivo .env do servidor criado"
    else
        warn "Arquivo .env do servidor já existe"
    fi
    
    # Criar .env para o cliente
    if [ ! -f "client/.env" ]; then
        cat > client/.env << EOF
VITE_API_URL=http://localhost:8000/api
VITE_APP_NAME=Kanban Organizer
VITE_APP_VERSION=1.0.0
EOF
        log "✅ Arquivo .env do cliente criado"
    else
        warn "Arquivo .env do cliente já existe"
    fi
}

# Inicializar banco de dados
init_database() {
    log "Inicializando banco de dados..."
    
    cd server
    
    # Verificar se o banco já existe
    if [ -f "data/db.sqlite" ]; then
        warn "Banco de dados já existe. Pulando inicialização."
        cd ..
        return
    fi
    
    # Criar banco de dados
    node -e "
    const { db } = require('./database');
    console.log('Banco de dados inicializado com sucesso!');
    "
    
    log "✅ Banco de dados inicializado"
    cd ..
}

# Executar testes
run_tests() {
    log "Executando testes..."
    
    # Testes do servidor
    cd server
    if npm run test 2>/dev/null; then
        log "✅ Testes do servidor passaram"
    else
        warn "Testes do servidor não configurados ou falharam"
    fi
    cd ..
    
    # Testes do cliente
    cd client
    if npm run test 2>/dev/null; then
        log "✅ Testes do cliente passaram"
    else
        warn "Testes do cliente não configurados ou falharam"
    fi
    cd ..
}

# Verificar linting
run_lint() {
    log "Executando linting..."
    
    # Linting do servidor
    cd server
    if npm run lint 2>/dev/null; then
        log "✅ Linting do servidor passou"
    else
        warn "Linting do servidor não configurado ou falhou"
    fi
    cd ..
    
    # Linting do cliente
    cd client
    if npm run lint 2>/dev/null; then
        log "✅ Linting do cliente passou"
    else
        warn "Linting do cliente não configurado ou falhou"
    fi
    cd ..
}

# Criar scripts úteis
create_scripts() {
    log "Criando scripts úteis..."
    
    # Script para iniciar desenvolvimento
    cat > scripts/start-dev.sh << 'EOF'
#!/bin/bash
echo "🚀 Iniciando ambiente de desenvolvimento..."

# Iniciar servidor em background
cd server && npm start &
SERVER_PID=$!

# Aguardar servidor iniciar
sleep 3

# Iniciar cliente
cd ../client && npm run dev &
CLIENT_PID=$!

echo "✅ Servidor rodando em http://localhost:8000"
echo "✅ Cliente rodando em http://localhost:3000"
echo "Pressione Ctrl+C para parar"

# Aguardar interrupção
trap "kill $SERVER_PID $CLIENT_PID; exit" INT
wait
EOF
    
    chmod +x scripts/start-dev.sh
    
    # Script para backup
    cat > scripts/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
DB_FILE="./server/data/db.sqlite"
BACKUP_FILE="$BACKUP_DIR/kanban_backup_$DATE.sqlite"

mkdir -p $BACKUP_DIR
cp $DB_FILE $BACKUP_FILE
gzip $BACKUP_FILE

echo "✅ Backup criado: $BACKUP_FILE.gz"
EOF
    
    chmod +x scripts/backup.sh
    
    log "✅ Scripts criados"
}

# Mostrar informações do projeto
show_info() {
    echo ""
    echo "🎉 Configuração concluída com sucesso!"
    echo ""
    echo "📋 Informações do projeto:"
    echo "  • Servidor: http://localhost:8000"
    echo "  • Cliente: http://localhost:3000"
    echo "  • API: http://localhost:8000/api"
    echo "  • Banco: ./server/data/db.sqlite"
    echo ""
    echo "🚀 Comandos úteis:"
    echo "  • Iniciar desenvolvimento: ./scripts/start-dev.sh"
    echo "  • Backup do banco: ./scripts/backup.sh"
    echo "  • Testes: npm test (em cada diretório)"
    echo "  • Linting: npm run lint (em cada diretório)"
    echo ""
    echo "📚 Documentação:"
    echo "  • Plano de implementação: IMPLEMENTATION_PLAN.md"
    echo "  • Guia Frontend: docs/FRONTEND_SPECIALIST_GUIDE.md"
    echo "  • Guia Backend: docs/BACKEND_SPECIALIST_GUIDE.md"
    echo "  • Guia DevOps: docs/DEVOPS_SPECIALIST_GUIDE.md"
    echo "  • Documentação técnica: docs/CONTEXT7_TECHNICAL_DOCUMENTATION.md"
    echo ""
}

# Função principal
main() {
    echo "🎯 Sistema Kanban Organizer - Configuração de Desenvolvimento"
    echo "=============================================================="
    echo ""
    
    check_node
    check_npm
    create_directories
    setup_env
    install_server_deps
    install_client_deps
    init_database
    run_tests
    run_lint
    create_scripts
    show_info
}

# Executar função principal
main "$@"

