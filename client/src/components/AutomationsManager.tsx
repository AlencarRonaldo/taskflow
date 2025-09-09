import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Card, Badge, Alert, Tabs, Tab, Spinner } from 'react-bootstrap';
import { api } from '../lib/api';

interface Automation {
  id: number;
  board_id: number;
  name: string;
  trigger_type: string;
  trigger_config: string;
  conditions: string;
  actions: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AutomationLog {
  id: number;
  automation_id: number;
  trigger_data: string;
  execution_result: string;
  error_message?: string;
  executed_at: string;
}

interface AutomationsManagerProps {
  show: boolean;
  onHide: () => void;
  boardId: number;
}

const AutomationsManager: React.FC<AutomationsManagerProps> = ({ show, onHide, boardId }) => {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [selectedAutomationLogs, setSelectedAutomationLogs] = useState<AutomationLog[]>([]);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [activeTab, setActiveTab] = useState('list');

  // Form states
  const [newAutomation, setNewAutomation] = useState({
    name: '',
    trigger_type: 'card_created',
    trigger_config: {},
    conditions: [],
    actions: []
  });

  const triggerTypes = [
    { value: 'card_created', label: 'Card Criado', description: 'Quando um novo card é criado' },
    { value: 'card_moved', label: 'Card Movido', description: 'Quando um card é movido entre colunas' },
    { value: 'card_updated', label: 'Card Atualizado', description: 'Quando um card é editado' },
    { value: 'due_date_approaching', label: 'Prazo Próximo', description: 'Quando um card está próximo do prazo' },
    { value: 'card_completed', label: 'Card Completo', description: 'Quando um card é marcado como completo' },
    { value: 'checklist_completed', label: 'Checklist Completo', description: 'Quando um checklist é completado' }
  ];

  const conditionTypes = [
    { value: 'priority_equals', label: 'Prioridade igual a', fields: ['priority'] },
    { value: 'assignee_equals', label: 'Responsável igual a', fields: ['assignee_id'] },
    { value: 'column_equals', label: 'Coluna igual a', fields: ['column_id'] },
    { value: 'label_contains', label: 'Contém label', fields: ['label_name'] },
    { value: 'title_contains', label: 'Título contém', fields: ['text'] },
    { value: 'days_until_due', label: 'Dias até vencimento', fields: ['days'] }
  ];

  const actionTypes = [
    { value: 'send_notification', label: 'Enviar Notificação', fields: ['message', 'recipient'] },
    { value: 'move_card', label: 'Mover Card', fields: ['target_column_id'] },
    { value: 'update_priority', label: 'Alterar Prioridade', fields: ['priority'] },
    { value: 'assign_user', label: 'Atribuir Usuário', fields: ['user_id'] },
    { value: 'add_comment', label: 'Adicionar Comentário', fields: ['comment_text'] },
    { value: 'create_card', label: 'Criar Novo Card', fields: ['title', 'description', 'column_id'] },
    { value: 'add_label', label: 'Adicionar Label', fields: ['label_name'] }
  ];

  useEffect(() => {
    if (show) {
      fetchAutomations();
    }
  }, [show, boardId]);

  const fetchAutomations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/boards/${boardId}/automations`);
      setAutomations(response.data.data || []);
    } catch (err: any) {
      setError('Erro ao carregar automações');
      console.error('Error fetching automations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAutomation = async () => {
    try {
      const response = await api.post('/automations', {
        board_id: boardId,
        ...newAutomation,
        trigger_config: JSON.stringify(newAutomation.trigger_config),
        conditions: JSON.stringify(newAutomation.conditions),
        actions: JSON.stringify(newAutomation.actions)
      });
      
      setAutomations([response.data.data, ...automations]);
      setShowCreateModal(false);
      resetForm();
    } catch (err: any) {
      setError('Erro ao criar automação');
      console.error('Error creating automation:', err);
    }
  };

  const handleUpdateAutomation = async (automation: Automation) => {
    try {
      const response = await api.put(`/automations/${automation.id}`, {
        name: automation.name,
        trigger_type: automation.trigger_type,
        trigger_config: automation.trigger_config,
        conditions: automation.conditions,
        actions: automation.actions,
        is_active: automation.is_active
      });
      
      setAutomations(automations.map(a => a.id === automation.id ? response.data.data : a));
      setEditingAutomation(null);
    } catch (err: any) {
      setError('Erro ao atualizar automação');
      console.error('Error updating automation:', err);
    }
  };

  const handleDeleteAutomation = async (id: number) => {
    if (window.confirm('Tem certeza que deseja deletar esta automação?')) {
      try {
        await api.delete(`/automations/${id}`);
        setAutomations(automations.filter(a => a.id !== id));
      } catch (err: any) {
        setError('Erro ao deletar automação');
        console.error('Error deleting automation:', err);
      }
    }
  };

  const handleToggleActive = async (automation: Automation) => {
    try {
      const response = await api.put(`/automations/${automation.id}`, {
        ...automation,
        is_active: !automation.is_active
      });
      
      setAutomations(automations.map(a => a.id === automation.id ? response.data.data : a));
    } catch (err: any) {
      setError('Erro ao alterar status da automação');
      console.error('Error toggling automation:', err);
    }
  };

  const handleTestAutomation = async (automation: Automation) => {
    try {
      const response = await api.post(`/automations/${automation.id}/test`, {
        testData: { simulation: true }
      });
      
      alert('Teste executado com sucesso! Verifique os logs para detalhes.');
    } catch (err: any) {
      setError('Erro ao testar automação');
      console.error('Error testing automation:', err);
    }
  };

  const fetchAutomationLogs = async (automationId: number) => {
    try {
      const response = await api.get(`/automations/${automationId}/logs`);
      setSelectedAutomationLogs(response.data.data || []);
      setShowLogsModal(true);
    } catch (err: any) {
      setError('Erro ao carregar logs');
      console.error('Error fetching logs:', err);
    }
  };

  const resetForm = () => {
    setNewAutomation({
      name: '',
      trigger_type: 'card_created',
      trigger_config: {},
      conditions: [],
      actions: []
    });
  };

  const addCondition = () => {
    setNewAutomation({
      ...newAutomation,
      conditions: [...newAutomation.conditions, { type: 'priority_equals', value: '' }]
    });
  };

  const addAction = () => {
    setNewAutomation({
      ...newAutomation,
      actions: [...newAutomation.actions, { type: 'send_notification', config: {} }]
    });
  };

  const removeCondition = (index: number) => {
    setNewAutomation({
      ...newAutomation,
      conditions: newAutomation.conditions.filter((_, i) => i !== index)
    });
  };

  const removeAction = (index: number) => {
    setNewAutomation({
      ...newAutomation,
      actions: newAutomation.actions.filter((_, i) => i !== index)
    });
  };

  return (
    <>
      <Modal show={show} onHide={onHide} size="xl" className="automations-manager">
        <Modal.Header closeButton>
          <Modal.Title>🤖 Gerenciador de Automações</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          
          <Tabs activeKey={activeTab} onSelect={(key) => setActiveTab(key || 'list')}>
            <Tab eventKey="list" title="Automações Ativas">
              <div className="mt-3">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5>Automações do Board</h5>
                  <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                    ➕ Nova Automação
                  </Button>
                </div>
                
                {loading ? (
                  <div className="text-center">
                    <Spinner animation="border" />
                  </div>
                ) : (
                  <div className="row">
                    {automations.map(automation => (
                      <div key={automation.id} className="col-md-6 mb-3">
                        <Card className={automation.is_active ? 'border-success' : 'border-secondary'}>
                          <Card.Header className="d-flex justify-content-between align-items-center">
                            <div className="d-flex align-items-center gap-2">
                              <strong>{automation.name}</strong>
                              <Badge bg={automation.is_active ? 'success' : 'secondary'}>
                                {automation.is_active ? 'Ativa' : 'Inativa'}
                              </Badge>
                            </div>
                            <div className="d-flex gap-1">
                              <Button
                                size="sm"
                                variant={automation.is_active ? 'outline-warning' : 'outline-success'}
                                onClick={() => handleToggleActive(automation)}
                              >
                                {automation.is_active ? '⏸️' : '▶️'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-info"
                                onClick={() => handleTestAutomation(automation)}
                              >
                                🧪
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-primary"
                                onClick={() => fetchAutomationLogs(automation.id)}
                              >
                                📋
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => handleDeleteAutomation(automation.id)}
                              >
                                🗑️
                              </Button>
                            </div>
                          </Card.Header>
                          <Card.Body>
                            <div className="mb-2">
                              <strong>Trigger:</strong>{' '}
                              <Badge bg="info">
                                {triggerTypes.find(t => t.value === automation.trigger_type)?.label || automation.trigger_type}
                              </Badge>
                            </div>
                            
                            <div className="mb-2">
                              <strong>Condições:</strong>{' '}
                              {JSON.parse(automation.conditions || '[]').length} configuradas
                            </div>
                            
                            <div className="mb-2">
                              <strong>Ações:</strong>{' '}
                              {JSON.parse(automation.actions || '[]').length} configuradas
                            </div>
                            
                            <small className="text-muted">
                              Criado: {new Date(automation.created_at).toLocaleDateString()}
                            </small>
                          </Card.Body>
                        </Card>
                      </div>
                    ))}
                    
                    {automations.length === 0 && !loading && (
                      <div className="col-12 text-center text-muted">
                        <p>Nenhuma automação configurada ainda.</p>
                        <Button variant="outline-primary" onClick={() => setShowCreateModal(true)}>
                          Criar primeira automação
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Tab>
            
            <Tab eventKey="help" title="Ajuda">
              <div className="mt-3">
                <h5>Como usar as Automações</h5>
                <div className="row">
                  <div className="col-md-4">
                    <Card>
                      <Card.Header><strong>1. Triggers (Gatilhos)</strong></Card.Header>
                      <Card.Body>
                        <p>Os gatilhos definem quando uma automação deve ser executada:</p>
                        <ul>
                          {triggerTypes.map(trigger => (
                            <li key={trigger.value}>
                              <strong>{trigger.label}:</strong> {trigger.description}
                            </li>
                          ))}
                        </ul>
                      </Card.Body>
                    </Card>
                  </div>
                  
                  <div className="col-md-4">
                    <Card>
                      <Card.Header><strong>2. Condições</strong></Card.Header>
                      <Card.Body>
                        <p>As condições filtram quando a automação deve executar:</p>
                        <ul>
                          {conditionTypes.slice(0, 4).map(condition => (
                            <li key={condition.value}>
                              <strong>{condition.label}</strong>
                            </li>
                          ))}
                        </ul>
                        <p><em>Todas as condições devem ser verdadeiras.</em></p>
                      </Card.Body>
                    </Card>
                  </div>
                  
                  <div className="col-md-4">
                    <Card>
                      <Card.Header><strong>3. Ações</strong></Card.Header>
                      <Card.Body>
                        <p>As ações definem o que acontece quando ativada:</p>
                        <ul>
                          {actionTypes.slice(0, 4).map(action => (
                            <li key={action.value}>
                              <strong>{action.label}</strong>
                            </li>
                          ))}
                        </ul>
                        <p><em>Todas as ações são executadas em sequência.</em></p>
                      </Card.Body>
                    </Card>
                  </div>
                </div>
              </div>
            </Tab>
          </Tabs>
        </Modal.Body>
      </Modal>

      {/* Create Automation Modal */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Nova Automação</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Nome da Automação</Form.Label>
              <Form.Control
                type="text"
                value={newAutomation.name}
                onChange={(e) => setNewAutomation({...newAutomation, name: e.target.value})}
                placeholder="Ex: Notificar quando card crítico for criado"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Gatilho</Form.Label>
              <Form.Select
                value={newAutomation.trigger_type}
                onChange={(e) => setNewAutomation({...newAutomation, trigger_type: e.target.value})}
              >
                {triggerTypes.map(trigger => (
                  <option key={trigger.value} value={trigger.value}>
                    {trigger.label} - {trigger.description}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center">
                <Form.Label>Condições</Form.Label>
                <Button size="sm" variant="outline-primary" onClick={addCondition}>
                  ➕ Adicionar Condição
                </Button>
              </div>
              {newAutomation.conditions.map((condition: any, index) => (
                <div key={index} className="border p-2 mt-2 rounded">
                  <div className="d-flex gap-2 align-items-center">
                    <Form.Select
                      value={condition.type}
                      onChange={(e) => {
                        const newConditions = [...newAutomation.conditions];
                        newConditions[index] = {...condition, type: e.target.value};
                        setNewAutomation({...newAutomation, conditions: newConditions});
                      }}
                    >
                      {conditionTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Control
                      type="text"
                      value={condition.value}
                      onChange={(e) => {
                        const newConditions = [...newAutomation.conditions];
                        newConditions[index] = {...condition, value: e.target.value};
                        setNewAutomation({...newAutomation, conditions: newConditions});
                      }}
                      placeholder="Valor"
                    />
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => removeCondition(index)}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-3">
              <div className="d-flex justify-content-between align-items-center">
                <Form.Label>Ações</Form.Label>
                <Button size="sm" variant="outline-primary" onClick={addAction}>
                  ➕ Adicionar Ação
                </Button>
              </div>
              {newAutomation.actions.map((action: any, index) => (
                <div key={index} className="border p-2 mt-2 rounded">
                  <div className="d-flex gap-2 align-items-center mb-2">
                    <Form.Select
                      value={action.type}
                      onChange={(e) => {
                        const newActions = [...newAutomation.actions];
                        newActions[index] = {...action, type: e.target.value};
                        setNewAutomation({...newAutomation, actions: newActions});
                      }}
                    >
                      {actionTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </Form.Select>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => removeAction(index)}
                    >
                      ✕
                    </Button>
                  </div>
                  <Form.Control
                    as="textarea"
                    rows={1}
                    value={JSON.stringify(action.config || {})}
                    onChange={(e) => {
                      try {
                        const config = JSON.parse(e.target.value);
                        const newActions = [...newAutomation.actions];
                        newActions[index] = {...action, config};
                        setNewAutomation({...newAutomation, actions: newActions});
                      } catch (err) {
                        // Invalid JSON, ignore
                      }
                    }}
                    placeholder='{"message": "Card criado!", "recipient": "admin"}'
                  />
                </div>
              ))}
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
            Cancelar
          </Button>
          <Button 
            variant="primary" 
            onClick={handleCreateAutomation}
            disabled={!newAutomation.name || !newAutomation.trigger_type}
          >
            Criar Automação
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Logs Modal */}
      <Modal show={showLogsModal} onHide={() => setShowLogsModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>📋 Logs de Execução</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="table-responsive">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Resultado</th>
                  <th>Dados do Trigger</th>
                  <th>Erro</th>
                </tr>
              </thead>
              <tbody>
                {selectedAutomationLogs.map(log => (
                  <tr key={log.id}>
                    <td>{new Date(log.executed_at).toLocaleString()}</td>
                    <td>
                      <Badge bg={log.execution_result === 'success' ? 'success' : 'danger'}>
                        {log.execution_result}
                      </Badge>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.8em' }}>
                        {log.trigger_data}
                      </code>
                    </td>
                    <td>
                      {log.error_message && (
                        <small className="text-danger">{log.error_message}</small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedAutomationLogs.length === 0 && (
              <p className="text-center text-muted">Nenhum log encontrado.</p>
            )}
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default AutomationsManager;