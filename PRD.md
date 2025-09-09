# PRD: Painel de Acompanhamento de Implantação

-   **Versão:** 1.0 (MVP)
-   **Data:** 02 de Setembro de 2025
-   **Autor:** AI-Consortium (PM, UX, Arquiteto, QA)
-   **Status Geral:** Não Iniciado

---

## 1. Introdução e Visão Geral

Este documento descreve os requisitos para a criação de uma aplicação web de painel de tarefas (Kanban), projetada para ser uma ferramenta simples e colaborativa. O objetivo é permitir que equipes pequenas organizem e atualizem o status de tarefas de projetos de implantação de sistemas de forma visual e em tempo real. A principal premissa para o MVP é a simplicidade, removendo a complexidade de múltiplos perfis de permissão; todos os usuários cadastrados terão controle total sobre o conteúdo.

## 2. O Problema e a Solução

-   **Problema:** Equipes de implantação que utilizam ferramentas de comunicação genéricas (como WhatsApp) ou planilhas perdem a visibilidade do status real das tarefas. A informação fica descentralizada, gerando a necessidade de reuniões constantes de alinhamento e dificultando a identificação de gargalos.
-   **Solução:** Uma plataforma centralizada e visual onde o progresso é atualizado através de uma ação simples (arrastar um cartão). Isso fornece clareza instantânea sobre o status de cada tarefa e do projeto como um todo, para todos os membros da equipe.

## 3. Objetivos e Métricas de Sucesso (MVP)

-   **Objetivo 1:** Centralizar 100% das tarefas de um projeto de implantação piloto na plataforma.
-   **Objetivo 2:** Aumentar a visibilidade do status do projeto, reduzindo a necessidade de reuniões de alinhamento em 50%.
-   **Métrica de Sucesso:** Adoção total pela equipe piloto (2 técnicos e 1 gerente) durante o primeiro projeto. Feedback qualitativo positivo sobre a facilidade de uso.

## 4. User Stories (Histórias de Usuário)

-   **US-1 (Autenticação):** Como um membro da equipe, eu quero criar uma conta e fazer login com e-mail e senha, para que eu possa acessar os painéis de projetos.
    -   **Status:** Concluído (Frontend e Backend - Debugando erro de login)
-   **US-2 (Gestão de Painéis):** Como um membro da equipe, eu quero criar um novo painel para cada projeto de implantação e definir suas colunas (status), para que eu possa organizar o trabalho de forma personalizada.
    -   **Status:** Concluído (Criação, Edição e Exclusão de Colunas)
-   **US-3 (Gestão de Tarefas):** Como um membro da equipe, eu quero criar um cartão (tarefa) em uma coluna, para que eu possa registrar o trabalho a ser feito.
    -   **Status:** Concluído (Criação, Edição e Exclusão de Cartões)
-   **US-4 (Atualização de Status):** Como um membro da equipe, eu quero arrastar e soltar um cartão de uma coluna para outra, para que eu possa atualizar seu status de forma rápida e visual.
    -   **Status:** Concluído
-   **US-5 (Detalhamento de Tarefas):** Como um membro da equipe, eu quero adicionar comentários a um cartão, para que eu possa registrar o histórico de atualizações e comunicar detalhes sobre a tarefa.
    -   **Status:** Concluído (Adição, Visualização, Edição e Exclusão de Comentários)

## 5. Fluxo do Usuário e Requisitos de UI/UX

-   **1. Tela de Login/Cadastro:** Interface simples com campos para e-mail e senha.
    -   **Status:** Concluído (Layout em Ajuste)
-   **2. Tela de Dashboard (Painéis):**
    -   Exibe uma lista de painéis existentes.
    -   Botão "Criar Novo Painel".
    -   **Status:** Concluído
-   **3. Tela do Painel (Kanban View):**
    -   A tela principal. Exibe as colunas lado a lado.
    -   Dentro de cada coluna, exibe os cartões empilhados verticalmente.
    -   Botão "+" no topo de cada coluna para adicionar um novo cartão rapidamente.
    -   Os cartões devem ser "agarráveis" para a funcionalidade de arrastar e soltar.
    -   **Status:** Concluído
-   **4. Modal de Detalhes do Cartão:**
    -   Aparece ao clicar em um cartão.
    -   Exibe o título, um campo de descrição (editável), e uma lista de comentários em ordem cronológica.
    -   Campo de texto para adicionar um novo comentário.
    -   **Status:** Concluído

## 6. Arquitetura Técnica e Modelo de Dados

### Modelo de Dados (Tabelas do Banco de Dados)

-   `users` (id, email, password_hash)
-   `boards` (id, title, user_id_creator)
-   `columns` (id, title, board_id, order_index)
-   `cards` (id, title, description, column_id, order_index)
-   `comments` (id, content, card_id, user_id_author, timestamp)
-   **Status:** Concluído

### API Endpoints (RESTful - Principais)

-   `POST /api/users/register`
    -   **Status:** Concluído
-   `POST /api/users/login`
    -   **Status:** Concluído
-   `GET /api/boards` (Lista painéis do usuário)
    -   **Status:** Concluído
-   `POST /api/boards` (Cria um novo painel)
    -   **Status:** Concluído
-   `GET /api/boards/:id` (Obtém um painel específico com suas colunas e cartões)
    -   **Status:** Concluído
-   `POST /api/cards` (Cria um novo cartão)
    -   **Status:** Concluído
-   `PUT /api/cards/:id` (Atualiza um cartão, incluindo a movimentação entre colunas)
    -   **Status:** Concluído
-   `POST /api/cards/:id/comments` (Adiciona um comentário)
    -   **Status:** Concluído
-   `PUT /columns/:id`
    -   **Status:** Concluído
-   `DELETE /columns/:id`
    -   **Status:** Concluído
-   `PUT /comments/:id`
    -   **Status:** Concluído
-   `DELETE /comments/:id`
    -   **Status:** Concluído

## 7. Critérios de Aceite (MVP)

-   **Login:** Um usuário deve conseguir se cadastrar e fazer login com sucesso.
    -   **Status:** Concluído
-   **Criação de Painel:** Um usuário logado deve ser capaz de criar um painel com pelo menos 3 colunas.
    -   **Status:** Concluído
-   **Criação de Cartão:** O usuário deve conseguir adicionar um novo cartão na primeira coluna de um painel.
    -   **Status:** Concluído
-   **Movimentação de Cartão:** Quando um usuário arrasta um cartão da coluna A para a coluna B, a mudança deve ser salva no banco de dados e persistir após a página ser recarregada.
    -   **Status:** Concluído
-   **Comentários:** Um usuário deve ser capaz de abrir um cartão e adicionar um comentário, que deve aparecer na lista de histórico com a data/hora.
    -   **Status:** Concluído
