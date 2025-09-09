import React, { useState, useEffect } from 'react';
import { Card, ListGroup, Badge, Spinner, Alert, Button, Modal } from 'react-bootstrap';
import { api } from '../lib/api';

interface ActivityItem {
  id: number;
  user_id: number;
  board_id?: number;
  card_id?: number;
  action_type: 'create' | 'update' | 'delete' | 'move' | 'assign' | 'remove';
  entity_type: 'board' | 'card' | 'column' | 'comment' | 'attachment' | 'label';
  entity_id: number;
  old_values?: any;
  new_values?: any;
  description: string;
  timestamp: string;
  user_email: string;
  board_title?: string;
  card_title?: string;
}

interface ActivityLogProps {
  show: boolean;
  onHide: () => void;
  boardId?: number;
  cardId?: number;
  title: string;
}

export const ActivityLog: React.FC<ActivityLogProps> = ({
  show,
  onHide,
  boardId,
  cardId,
  title
}) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (show && (boardId || cardId)) {
      fetchActivities();
    }
  }, [show, boardId, cardId]);

  const fetchActivities = async () => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = boardId 
        ? `/boards/${boardId}/activity`
        : `/cards/${cardId}/activity`;
      
      const response = await api.get(endpoint);
      setActivities(response.data.activities || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar atividades');
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (actionType: string, entityType: string) => {
    if (actionType === 'create') {
      return entityType === 'board' ? '📋' :
             entityType === 'card' ? '📝' :
             entityType === 'column' ? '📂' :
             entityType === 'comment' ? '💬' :
             entityType === 'attachment' ? '📎' :
             entityType === 'label' ? '🏷️' : '✨';
    }
    
    if (actionType === 'update') return '✏️';
    if (actionType === 'delete') return '🗑️';
    if (actionType === 'move') return '↔️';
    if (actionType === 'assign') return '🔗';
    if (actionType === 'remove') return '❌';
    
    return '📄';
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'create': return 'success';
      case 'update': return 'primary';
      case 'delete': return 'danger';
      case 'move': return 'warning';
      case 'assign': return 'info';
      case 'remove': return 'secondary';
      default: return 'light';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Se for hoje
    if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
    
    // Se for esta semana
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const dayNames = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
      return `${dayNames[date.getDay()]} ${date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })}`;
    }
    
    // Formato completo
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderActivityDetails = (activity: ActivityItem) => {
    if (activity.old_values || activity.new_values) {
      return (
        <div className="mt-2">
          {activity.old_values && (
            <div className="small text-muted">
              <strong>Antes:</strong> {JSON.stringify(activity.old_values, null, 2)}
            </div>
          )}
          {activity.new_values && (
            <div className="small text-muted">
              <strong>Depois:</strong> {JSON.stringify(activity.new_values, null, 2)}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center">
          <span className="me-2">📜</span>
          {title}
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {loading && (
          <div className="text-center py-4">
            <Spinner animation="border" size="sm" className="me-2" />
            Carregando atividades...
          </div>
        )}

        {error && (
          <Alert variant="danger">
            {error}
          </Alert>
        )}

        {!loading && !error && activities.length === 0 && (
          <div className="text-center py-4 text-muted">
            <div style={{ fontSize: '2rem' }}>📜</div>
            <p>Nenhuma atividade registrada ainda</p>
            <small>As ações realizadas aparecerão aqui</small>
          </div>
        )}

        {!loading && activities.length > 0 && (
          <ListGroup variant="flush">
            {activities.map((activity) => (
              <ListGroup.Item key={activity.id} className="border-0">
                <div className="d-flex align-items-start">
                  <div className="me-3" style={{ fontSize: '1.5rem', marginTop: '2px' }}>
                    {getActivityIcon(activity.action_type, activity.entity_type)}
                  </div>
                  
                  <div className="flex-grow-1">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <div className="fw-medium mb-1">
                          {activity.description}
                        </div>
                        <div className="small text-muted">
                          por {activity.user_email} • {formatTimestamp(activity.timestamp)}
                        </div>
                      </div>
                      
                      <div className="d-flex align-items-center gap-2 ms-2">
                        <Badge bg={getActionColor(activity.action_type)} className="text-capitalize">
                          {activity.action_type === 'create' ? 'Criou' :
                           activity.action_type === 'update' ? 'Editou' :
                           activity.action_type === 'delete' ? 'Excluiu' :
                           activity.action_type === 'move' ? 'Moveu' :
                           activity.action_type === 'assign' ? 'Atribuiu' :
                           activity.action_type === 'remove' ? 'Removeu' :
                           activity.action_type}
                        </Badge>
                        
                        <Badge bg="light" text="dark" style={{ fontSize: '0.7rem' }}>
                          {activity.entity_type === 'board' ? 'Board' :
                           activity.entity_type === 'card' ? 'Card' :
                           activity.entity_type === 'column' ? 'Coluna' :
                           activity.entity_type === 'comment' ? 'Comentário' :
                           activity.entity_type === 'attachment' ? 'Anexo' :
                           activity.entity_type === 'label' ? 'Label' :
                           activity.entity_type}
                        </Badge>
                      </div>
                    </div>
                    
                    {renderActivityDetails(activity)}
                  </div>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Modal.Body>
      
      <Modal.Footer>
        <div className="w-100 d-flex justify-content-between align-items-center">
          <small className="text-muted">
            {activities.length > 0 && `${activities.length} atividade(s) encontrada(s)`}
          </small>
          <Button variant="secondary" onClick={onHide}>
            Fechar
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};