import React, { useState, useEffect } from 'react';
import { Card, Form, Button, ListGroup, ProgressBar, Alert, Spinner, Badge } from 'react-bootstrap';
import { api } from '../lib/api';

interface ChecklistItem {
  id: number;
  checklist_id: number;
  text: string;
  completed: boolean;
  order_index: number;
  created_at: string;
  completed_at?: string | null;
}

interface ChecklistData {
  id: number;
  card_id: number;
  title: string;
  created_at: string;
  total_items: number;
  completed_items: number;
  items: ChecklistItem[];
}

interface ChecklistProps {
  cardId: number;
  onUpdate?: () => void;
}

export const Checklist: React.FC<ChecklistProps> = ({ cardId, onUpdate }) => {
  const [checklists, setChecklists] = useState<ChecklistData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [creatingChecklist, setCreatingChecklist] = useState(false);
  const [newItemTexts, setNewItemTexts] = useState<{ [key: number]: string }>({});
  const [editingTitle, setEditingTitle] = useState<number | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');

  useEffect(() => {
    fetchChecklists();
  }, [cardId]);

  const fetchChecklists = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/cards/${cardId}/checklists`);
      setChecklists(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar checklists');
    } finally {
      setLoading(false);
    }
  };

  const createChecklist = async () => {
    if (!newChecklistTitle.trim()) return;

    try {
      setCreatingChecklist(true);
      const response = await api.post(`/cards/${cardId}/checklists`, {
        title: newChecklistTitle.trim()
      });
      
      setChecklists([...checklists, response.data]);
      setNewChecklistTitle('');
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar checklist');
    } finally {
      setCreatingChecklist(false);
    }
  };

  const updateChecklistTitle = async (checklistId: number, newTitle: string) => {
    if (!newTitle.trim()) return;

    try {
      await api.put(`/checklists/${checklistId}`, { title: newTitle.trim() });
      
      setChecklists(checklists.map(checklist => 
        checklist.id === checklistId 
          ? { ...checklist, title: newTitle.trim() }
          : checklist
      ));
      setEditingTitle(null);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atualizar checklist');
    }
  };

  const deleteChecklist = async (checklistId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta checklist?')) return;

    try {
      await api.delete(`/checklists/${checklistId}`);
      setChecklists(checklists.filter(c => c.id !== checklistId));
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao excluir checklist');
    }
  };

  const addItem = async (checklistId: number) => {
    const text = newItemTexts[checklistId]?.trim();
    if (!text) return;

    try {
      const response = await api.post(`/checklists/${checklistId}/items`, { text });
      
      setChecklists(checklists.map(checklist => {
        if (checklist.id === checklistId) {
          return {
            ...checklist,
            items: [...checklist.items, response.data],
            total_items: checklist.total_items + 1
          };
        }
        return checklist;
      }));
      
      setNewItemTexts({ ...newItemTexts, [checklistId]: '' });
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao adicionar item');
    }
  };

  const toggleItem = async (checklistId: number, itemId: number, completed: boolean) => {
    try {
      await api.put(`/checklist-items/${itemId}`, { completed });
      
      setChecklists(checklists.map(checklist => {
        if (checklist.id === checklistId) {
          const updatedItems = checklist.items.map(item =>
            item.id === itemId 
              ? { ...item, completed, completed_at: completed ? new Date().toISOString() : null }
              : item
          );
          
          const completedCount = updatedItems.filter(item => item.completed).length;
          
          return {
            ...checklist,
            items: updatedItems,
            completed_items: completedCount
          };
        }
        return checklist;
      }));
      
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao atualizar item');
    }
  };

  const deleteItem = async (checklistId: number, itemId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este item?')) return;

    try {
      await api.delete(`/checklist-items/${itemId}`);
      
      setChecklists(checklists.map(checklist => {
        if (checklist.id === checklistId) {
          const updatedItems = checklist.items.filter(item => item.id !== itemId);
          const completedCount = updatedItems.filter(item => item.completed).length;
          
          return {
            ...checklist,
            items: updatedItems,
            total_items: updatedItems.length,
            completed_items: completedCount
          };
        }
        return checklist;
      }));
      
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao excluir item');
    }
  };

  const getProgress = (checklist: ChecklistData) => {
    if (checklist.total_items === 0) return 0;
    return Math.round((checklist.completed_items / checklist.total_items) * 100);
  };

  if (loading) {
    return (
      <div className="text-center p-3">
        <Spinner size="sm" className="me-2" />
        Carregando checklists...
      </div>
    );
  }

  return (
    <div className="checklist-component">
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Add new checklist */}
      <div className="mb-3">
        <div className="d-flex gap-2">
          <Form.Control
            type="text"
            placeholder="Nome da checklist..."
            value={newChecklistTitle}
            onChange={(e) => setNewChecklistTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createChecklist()}
          />
          <Button 
            variant="primary" 
            size="sm"
            onClick={createChecklist}
            disabled={!newChecklistTitle.trim() || creatingChecklist}
          >
            {creatingChecklist ? <Spinner size="sm" /> : '➕ Checklist'}
          </Button>
        </div>
      </div>

      {/* Checklists */}
      {checklists.map((checklist) => (
        <Card key={checklist.id} className="mb-3">
          <Card.Header className="d-flex justify-content-between align-items-center">
            <div className="flex-grow-1">
              {editingTitle === checklist.id ? (
                <Form.Control
                  type="text"
                  value={editingTitleValue}
                  onChange={(e) => setEditingTitleValue(e.target.value)}
                  onBlur={() => updateChecklistTitle(checklist.id, editingTitleValue)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      updateChecklistTitle(checklist.id, editingTitleValue);
                    } else if (e.key === 'Escape') {
                      setEditingTitle(null);
                    }
                  }}
                  autoFocus
                  size="sm"
                />
              ) : (
                <div className="d-flex align-items-center gap-2">
                  <h6 
                    className="mb-0 flex-grow-1" 
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setEditingTitle(checklist.id);
                      setEditingTitleValue(checklist.title);
                    }}
                  >
                    ✅ {checklist.title}
                  </h6>
                  <Badge bg="secondary">
                    {checklist.completed_items}/{checklist.total_items}
                  </Badge>
                </div>
              )}
            </div>
            
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => deleteChecklist(checklist.id)}
            >
              🗑️
            </Button>
          </Card.Header>
          
          <Card.Body>
            {/* Progress bar */}
            {checklist.total_items > 0 && (
              <div className="mb-3">
                <ProgressBar 
                  now={getProgress(checklist)} 
                  label={`${getProgress(checklist)}%`}
                  variant={getProgress(checklist) === 100 ? 'success' : 'primary'}
                />
              </div>
            )}

            {/* Checklist items */}
            <ListGroup variant="flush">
              {checklist.items.map((item) => (
                <ListGroup.Item key={item.id} className="px-0 py-2">
                  <div className="d-flex align-items-center gap-2">
                    <Form.Check
                      type="checkbox"
                      checked={item.completed}
                      onChange={(e) => toggleItem(checklist.id, item.id, e.target.checked)}
                    />
                    <span 
                      className={`flex-grow-1 ${item.completed ? 'text-decoration-line-through text-muted' : ''}`}
                      style={{ fontSize: '0.9rem' }}
                    >
                      {item.text}
                    </span>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => deleteItem(checklist.id, item.id)}
                      style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                    >
                      ✕
                    </Button>
                  </div>
                </ListGroup.Item>
              ))}
            </ListGroup>

            {/* Add new item */}
            <div className="mt-3">
              <div className="d-flex gap-2">
                <Form.Control
                  type="text"
                  placeholder="Adicionar item..."
                  value={newItemTexts[checklist.id] || ''}
                  onChange={(e) => setNewItemTexts({
                    ...newItemTexts,
                    [checklist.id]: e.target.value
                  })}
                  onKeyDown={(e) => e.key === 'Enter' && addItem(checklist.id)}
                  size="sm"
                />
                <Button 
                  variant="outline-primary" 
                  size="sm"
                  onClick={() => addItem(checklist.id)}
                  disabled={!newItemTexts[checklist.id]?.trim()}
                >
                  ➕ Item
                </Button>
              </div>
            </div>
          </Card.Body>
        </Card>
      ))}

      {checklists.length === 0 && !loading && (
        <div className="text-center py-4 text-muted">
          <div style={{ fontSize: '2rem' }}>✅</div>
          <p>Nenhuma checklist ainda</p>
          <small>Crie uma checklist para organizar subtarefas</small>
        </div>
      )}
    </div>
  );
};