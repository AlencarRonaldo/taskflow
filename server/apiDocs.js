const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TaskFlow Pro API',
      version: '1.0.0',
      description: 'API completa para sistema de gerenciamento de tarefas com Kanban, Timeline, Grid e Automações',
      contact: {
        name: 'TaskFlow Pro',
        email: 'support@taskflowpro.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor de desenvolvimento'
      },
      {
        url: 'https://api.taskflowpro.com',
        description: 'Servidor de produção'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          required: ['id', 'username', 'email'],
          properties: {
            id: {
              type: 'integer',
              description: 'ID único do usuário'
            },
            username: {
              type: 'string',
              description: 'Nome de usuário'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email do usuário'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação'
            }
          }
        },
        Board: {
          type: 'object',
          required: ['id', 'name', 'userId'],
          properties: {
            id: {
              type: 'integer',
              description: 'ID único do quadro'
            },
            name: {
              type: 'string',
              description: 'Nome do quadro'
            },
            description: {
              type: 'string',
              description: 'Descrição do quadro'
            },
            userId: {
              type: 'integer',
              description: 'ID do proprietário'
            },
            background: {
              type: 'string',
              description: 'Cor ou imagem de fundo'
            },
            isPublic: {
              type: 'boolean',
              description: 'Se o quadro é público'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação'
            }
          }
        },
        Column: {
          type: 'object',
          required: ['id', 'name', 'boardId'],
          properties: {
            id: {
              type: 'integer',
              description: 'ID único da coluna'
            },
            name: {
              type: 'string',
              description: 'Nome da coluna'
            },
            boardId: {
              type: 'integer',
              description: 'ID do quadro'
            },
            position: {
              type: 'integer',
              description: 'Posição da coluna'
            },
            color: {
              type: 'string',
              description: 'Cor da coluna'
            }
          }
        },
        Card: {
          type: 'object',
          required: ['id', 'title', 'columnId'],
          properties: {
            id: {
              type: 'integer',
              description: 'ID único do card'
            },
            title: {
              type: 'string',
              description: 'Título do card'
            },
            description: {
              type: 'string',
              description: 'Descrição do card'
            },
            columnId: {
              type: 'integer',
              description: 'ID da coluna'
            },
            position: {
              type: 'integer',
              description: 'Posição do card na coluna'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'urgent'],
              description: 'Prioridade do card'
            },
            dueDate: {
              type: 'string',
              format: 'date-time',
              description: 'Data de vencimento'
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Tags do card'
            },
            assignees: {
              type: 'array',
              items: {
                type: 'integer'
              },
              description: 'IDs dos usuários assignados'
            },
            attachments: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'URLs dos anexos'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data da última atualização'
            }
          }
        },
        Webhook: {
          type: 'object',
          required: ['id', 'url', 'events'],
          properties: {
            id: {
              type: 'integer',
              description: 'ID único do webhook'
            },
            url: {
              type: 'string',
              format: 'uri',
              description: 'URL do webhook'
            },
            events: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Eventos que acionam o webhook'
            },
            active: {
              type: 'boolean',
              description: 'Se o webhook está ativo'
            },
            secret: {
              type: 'string',
              description: 'Chave secreta para validação'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data de criação'
            }
          }
        },
        Analytics: {
          type: 'object',
          properties: {
            totalBoards: {
              type: 'integer',
              description: 'Total de quadros'
            },
            totalCards: {
              type: 'integer',
              description: 'Total de cards'
            },
            completedCards: {
              type: 'integer',
              description: 'Cards completos'
            },
            overduCards: {
              type: 'integer',
              description: 'Cards vencidos'
            },
            productivity: {
              type: 'object',
              properties: {
                cardsCreated: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      date: {
                        type: 'string',
                        format: 'date'
                      },
                      count: {
                        type: 'integer'
                      }
                    }
                  }
                },
                cardsCompleted: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      date: {
                        type: 'string',
                        format: 'date'
                      },
                      count: {
                        type: 'integer'
                      }
                    }
                  }
                }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Mensagem de erro'
            },
            code: {
              type: 'integer',
              description: 'Código do erro'
            },
            details: {
              type: 'object',
              description: 'Detalhes adicionais do erro'
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Token de acesso ausente ou inválido',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Token inválido',
                code: 401
              }
            }
          }
        },
        NotFoundError: {
          description: 'Recurso não encontrado',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Recurso não encontrado',
                code: 404
              }
            }
          }
        },
        ValidationError: {
          description: 'Erro de validação',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Dados inválidos',
                code: 400,
                details: {
                  field: 'email',
                  message: 'Email é obrigatório'
                }
              }
            }
          }
        },
        RateLimitError: {
          description: 'Limite de requisições excedido',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                error: 'Muitas requisições',
                code: 429
              }
            }
          },
          headers: {
            'X-RateLimit-Limit': {
              description: 'Limite de requisições por minuto',
              schema: {
                type: 'integer'
              }
            },
            'X-RateLimit-Remaining': {
              description: 'Requisições restantes',
              schema: {
                type: 'integer'
              }
            },
            'X-RateLimit-Reset': {
              description: 'Timestamp de reset do limite',
              schema: {
                type: 'integer'
              }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./server/*.js', './server/routes/*.js'] // Caminhos para os arquivos com anotações
};

const specs = swaggerJSDoc(options);

module.exports = specs;