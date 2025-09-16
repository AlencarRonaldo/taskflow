import React, { useEffect, useState, FormEvent, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Container, Card, Spinner, Alert, Button, Modal, Form, Badge } from 'react-bootstrap';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import '../styles/priority.css';

interface ICard {
  id: number;
  title: string;
  description: string | null;
  order_index: number;
  column_id: number;
  status: string;
  priority?: string;
  assignee_id?: number | null;
  column_title?: string;
}

interface IColumn {
  id: number;
  title: string;
  order_index: number;
  cards: ICard[];
}

interface IBoard {
  id: number;
  title: string;
  columns: IColumn[];
}

interface ITechnicianInfo {
  name: string;
  phone: string;
  registered: boolean;
}

interface IComment {
  id?: number;
  content: string;
  technician_name?: string;
  timestamp?: string;
}

const SortableCard: React.FC<{ card: ICard, onCardClick: (card: ICard) => void }> = ({ card, onCardClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: `card-${card.id}`, 
    data: { 
      type: 'card', 
      card: card 
    } 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'todo': return 'card-status-todo';
      case 'in-progress': return 'card-status-in-progress';
      case 'completed': return 'card-status-completed';
      default: return 'card-status-todo';
    }
  };

  const getPriorityClass = (priority?: string) => {
    switch (priority) {
      case 'critical': return 'priority-critical';
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return 'priority-medium';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`mb-2 ${isDragging ? 'dragging' : ''}`}
    >
      <Card className={`card-item ${getStatusClass(card.status)} ${getPriorityClass(card.priority)} public-card`}>
        <Card.Body className="p-2">
          <div className="d-flex justify-content-between align-items-start mb-1">
            <h6 className="mb-1 card-title text-truncate flex-grow-1">{card.title}</h6>
            <div className="d-flex gap-1">
              {card.priority && (
                <Badge bg="secondary" className={`priority-badge ${getPriorityClass(card.priority)}`}>
                  {card.priority}
                </Badge>
              )}
              <Button 
                size="sm" 
                variant="outline-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onCardClick(card);
                }}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem' }}
              >
                📝
              </Button>
            </div>
          </div>
          {card.description && (
            <p className="text-muted small mb-0">{card.description.substring(0, 100)}...</p>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

const Column: React.FC<{ column: IColumn, onCardClick: (card: ICard) => void }> = ({ column, onCardClick }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
    data: {
      type: 'column',
      column: column,
    },
  });

  return (
    <div className="board-column">
      <Card className={`h-100 ${isOver ? 'column-dragover' : ''}`}>
        <Card.Header className="column-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">{column.title}</h5>
          <Badge bg="primary">{column.cards.length}</Badge>
        </Card.Header>
        <Card.Body ref={setNodeRef} className="column-body">
          <SortableContext items={column.cards.map(card => `card-${card.id}`)} strategy={verticalListSortingStrategy}>
            <div className="cards-container">
              {column.cards
                .sort((a, b) => a.order_index - b.order_index)
                .map(card => (
                  <SortableCard key={card.id} card={card} onCardClick={onCardClick} />
                ))}
              {column.cards.length === 0 && (
                <p className="text-muted text-center">Arraste cards para cá</p>
              )}
            </div>
          </SortableContext>
        </Card.Body>
      </Card>
    </div>
  );
};

const PublicBoardPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [board, setBoard] = useState<IBoard | null>(null);
  const [activeCard, setActiveCard] = useState<ICard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [technicianInfo, setTechnicianInfo] = useState<ITechnicianInfo>({
    name: '',
    phone: '',
    registered: false
  });
  const [isRegistering, setIsRegistering] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [cardComment, setCardComment] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (token) {
      fetchBoard();
      
      // TEMPORARILY DISABLED: Set up polling for updates every 30 seconds
      // const interval = setInterval(() => {
      //   if (technicianInfo.registered) {
      //     fetchBoard();
      //   }
      // }, 30000);
      
      // return () => clearInterval(interval);
    }
  }, [token, technicianInfo.registered]);

  const fetchBoard = async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:8001/api/public/${token}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Link de compartilhamento inválido ou expirado');
        } else {
          setError('Erro ao carregar o quadro');
        }
        return;
      }
      
      const data = await response.json();
      setBoard(data.data.board);
      setTokenInfo(data.data.tokenInfo);
      
      // Check if technician is already registered (from localStorage)
      const savedTechnician = localStorage.getItem(`technician_${token}`);
      if (savedTechnician) {
        const techData = JSON.parse(savedTechnician);
        setTechnicianInfo({ ...techData, registered: true });
      } else {
        setShowRegistrationModal(true);
      }
      
    } catch (err) {
      console.error('Error fetching board:', err);
      setError('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegistration = async (e: FormEvent) => {
    e.preventDefault();
    if (!technicianInfo.name.trim() || !technicianInfo.phone.trim()) {
      setError('Nome e telefone são obrigatórios');
      return;
    }

    setIsRegistering(true);
    setError(null);

    try {
      const response = await fetch(`http://localhost:8001/api/public/${token}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: technicianInfo.name.trim(),
          phone: technicianInfo.phone.trim()
        })
      });

      if (!response.ok) {
        throw new Error('Falha no registro');
      }

      const result = await response.json();
      
      // Save technician info to localStorage
      localStorage.setItem(`technician_${token}`, JSON.stringify({
        name: technicianInfo.name,
        phone: technicianInfo.phone
      }));

      setTechnicianInfo(prev => ({ ...prev, registered: true }));
      setShowRegistrationModal(false);

    } catch (err) {
      console.error('Registration error:', err);
      setError('Falha ao registrar. Tente novamente.');
    } finally {
      setIsRegistering(false);
    }
  };

  // Helper function to find card by ID
  const findCardById = useCallback((cardId: number): ICard | null => {
    if (!board) return null;
    for (const column of board.columns) {
      const card = column.cards.find(c => c.id === cardId);
      if (card) return card;
    }
    return null;
  }, [board]);

  const handleCardClick = useCallback((card: ICard) => {
    console.log('=== CARD CLICK EVENT ===');
    console.log('Clicked card ID:', card.id);
    console.log('Clicked card title:', card.title);
    console.log('Current selectedCardId before:', selectedCardId);
    setSelectedCardId(card.id);
    setShowCardModal(true);
    setCardComment('');
    console.log('Modal should show now for card:', card.id, card.title);
    console.log('=== END CARD CLICK ===');
  }, [selectedCardId]);

  const handleAddComment = async () => {
    const selectedCard = selectedCardId ? findCardById(selectedCardId) : null;
    if (!selectedCard || !cardComment.trim() || !technicianInfo.name) return;

    setIsAddingComment(true);
    setError(null);

    try {
      const response = await fetch(`http://localhost:8001/api/public/${token}/cards/${selectedCard.id}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: cardComment.trim(),
          technicianName: technicianInfo.name,
          technicianPhone: technicianInfo.phone
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao adicionar informação');
      }

      // Clear comment and close modal
      setCardComment('');
      alert('Informação adicionada com sucesso!');
      setShowCardModal(false);
      
      // Don't refresh board to avoid state interference
      // await fetchBoard();

    } catch (err) {
      console.error('Error adding comment:', err);
      setError('Falha ao adicionar informação. Tente novamente.');
    } finally {
      setIsAddingComment(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    
    if (active.data.current?.type === 'card') {
      setActiveCard(active.data.current.card as ICard);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveCard(null);
      return;
    }

    if (active.data.current?.type === 'card' && over.data.current?.type === 'column') {
      const card = active.data.current.card as ICard;
      const targetColumn = over.data.current.column as IColumn;

      if (card.column_id === targetColumn.id) {
        setActiveCard(null);
        return;
      }

      // Optimistically update the UI
      const newBoard = { ...board! };
      const sourceColumn = newBoard.columns.find(col => 
        col.cards.some(c => c.id === card.id)
      );
      const destColumn = newBoard.columns.find(col => col.id === targetColumn.id);

      if (sourceColumn && destColumn) {
        // Remove from source
        const cardIndex = sourceColumn.cards.findIndex(c => c.id === card.id);
        const [movedCard] = sourceColumn.cards.splice(cardIndex, 1);

        // Add to destination
        destColumn.cards.push({
          ...movedCard,
          column_id: targetColumn.id,
          order_index: destColumn.cards.length + 1
        });

        // Update order indices
        sourceColumn.cards.forEach((c, i) => c.order_index = i + 1);
        destColumn.cards.forEach((c, i) => c.order_index = i + 1);

        setBoard(newBoard);

        // Send to backend
        try {
          const response = await fetch(`http://localhost:8001/api/public/${token}/cards/${card.id}/move`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              columnId: targetColumn.id,
              orderIndex: destColumn.cards.length,
              technicianName: technicianInfo.name,
              technicianPhone: technicianInfo.phone
            })
          });

          if (!response.ok) {
            throw new Error('Falha ao mover card');
          }

          // Refresh board to ensure consistency
          fetchBoard();
        } catch (err) {
          console.error('Error moving card:', err);
          setError('Falha ao mover card. A página será recarregada.');
          // Revert optimistic update by refetching
          fetchBoard();
        }
      }
    }

    setActiveCard(null);
  };

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <Spinner animation="border" role="status" />
          <div className="mt-2">Carregando quadro...</div>
        </div>
      </Container>
    );
  }

  if (error && !board) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
        <Alert variant="danger" className="text-center">
          <Alert.Heading>Erro de Acesso</Alert.Heading>
          <p>{error}</p>
          <Button variant="outline-danger" onClick={() => window.location.reload()}>
            Tentar Novamente
          </Button>
        </Alert>
      </Container>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={{ 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <Container fluid className="p-4" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(5px)' }}>
          {error && <Alert variant="danger">{error}</Alert>}
          
          {board && (
            <>
              <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                  <h1 className="text-white text-shadow mb-1">{board.title}</h1>
                  <p className="text-white-50 mb-0">
                    📋 Acesso Técnico - {technicianInfo.name}
                    {tokenInfo?.creatorName && ` | Criado por: ${tokenInfo.creatorName}`}
                  </p>
                </div>
                <div className="text-white-50 small">
                  <div>🕐 Válido até: {tokenInfo?.expiresAt ? new Date(tokenInfo.expiresAt).toLocaleString('pt-BR') : 'N/A'}</div>
                </div>
              </div>

              <div className="alert alert-info mb-4">
                <strong>ℹ️ Como usar:</strong> Arraste os cards entre as colunas para atualizar o status dos trabalhos. 
                Todas as suas ações são registradas e o responsável pelo quadro será notificado.
              </div>

              <div className="board-columns-row">
                <SortableContext items={board.columns.map(col => `column-${col.id}`)} strategy={horizontalListSortingStrategy}>
                  {board.columns.sort((a, b) => a.order_index - b.order_index).map(column => (
                    <div key={column.id} className="board-column-wrapper">
                      <Column column={column} onCardClick={handleCardClick} />
                    </div>
                  ))}
                </SortableContext>
              </div>
            </>
          )}
        </Container>

        <DragOverlay>
          {activeCard && (
            <Card className="shadow-lg opacity-75">
              <Card.Body>{activeCard.title}</Card.Body>
            </Card>
          )}
        </DragOverlay>

        {/* Registration Modal */}
        <Modal 
          show={showRegistrationModal} 
          onHide={() => {}} 
          backdrop="static" 
          keyboard={false}
          className="app-modal"
        >
          <Modal.Header>
            <Modal.Title>
              🔧 Identificação do Técnico
            </Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleRegistration}>
            <Modal.Body>
              <div className="alert alert-info">
                <strong>Bem-vindo!</strong><br />
                Para acessar este quadro, precisamos de algumas informações básicas para identificação.
              </div>

              <div className="mb-3">
                <label htmlFor="technicianName" className="form-label fw-bold">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="technicianName"
                  value={technicianInfo.name}
                  onChange={(e) => setTechnicianInfo(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: João Silva"
                  required
                />
              </div>

              <div className="mb-3">
                <label htmlFor="technicianPhone" className="form-label fw-bold">
                  Telefone/WhatsApp *
                </label>
                <input
                  type="tel"
                  className="form-control"
                  id="technicianPhone"
                  value={technicianInfo.phone}
                  onChange={(e) => setTechnicianInfo(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Ex: (11) 99999-9999"
                  required
                />
              </div>

              <small className="text-muted">
                * Estas informações são usadas apenas para identificação nas atividades do quadro.
              </small>
            </Modal.Body>
            <Modal.Footer>
              <Button 
                variant="primary" 
                type="submit" 
                disabled={isRegistering}
                className="w-100"
              >
                {isRegistering ? (
                  <>
                    <Spinner size="sm" className="me-2" />
                    Registrando...
                  </>
                ) : (
                  'Acessar Quadro'
                )}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* Card Details Modal */}
        <Modal
          show={showCardModal}
          onHide={() => setShowCardModal(false)}
          className="app-modal"
          size="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title>
              📝 {selectedCardId ? findCardById(selectedCardId)?.title : 'Card não encontrado'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {(() => {
              const selectedCard = selectedCardId ? findCardById(selectedCardId) : null;
              if (!selectedCard) return <p>Card não encontrado</p>;
              
              console.log('=== MODAL RENDER ===', 'Card ID:', selectedCard.id, 'Title:', selectedCard.title);
              return (
                <>
                  <div className="mb-3">
                  <strong>Descrição:</strong>
                  <p className="text-muted mt-1">
                    {selectedCard.description || 'Nenhuma descrição disponível'}
                  </p>
                </div>

                <div className="mb-3">
                  <strong>Status:</strong>
                  <Badge 
                    bg={
                      selectedCard.column_title === 'To Do' ? 'warning' :
                      selectedCard.column_title === 'In Progress' ? 'info' :
                      'success'
                    }
                    className="ms-2"
                  >
                    {selectedCard.column_title}
                  </Badge>
                </div>

                {selectedCard.priority && (
                  <div className="mb-3">
                    <strong>Prioridade:</strong>
                    <Badge 
                      bg={
                        selectedCard.priority === 'urgent' ? 'danger' :
                        selectedCard.priority === 'high' ? 'warning' :
                        selectedCard.priority === 'medium' ? 'info' :
                        'secondary'
                      }
                      className="ms-2"
                    >
                      {selectedCard.priority === 'urgent' ? 'Urgente' :
                       selectedCard.priority === 'high' ? 'Alta' :
                       selectedCard.priority === 'medium' ? 'Média' :
                       'Normal'}
                    </Badge>
                  </div>
                )}

                <div className="mb-4">
                  <strong>Adicionar Informação/Comentário:</strong>
                  <Form.Group className="mt-2">
                    <Form.Control
                      as="textarea"
                      rows={3}
                      placeholder="Digite informações sobre o progresso do trabalho, observações técnicas, ou qualquer comentário relevante..."
                      value={cardComment}
                      onChange={(e) => setCardComment(e.target.value)}
                      disabled={isAddingComment}
                    />
                  </Form.Group>
                  <small className="text-muted">
                    📌 Esta informação será registrada e o responsável pelo quadro será notificado.
                  </small>
                </div>
                </>
              );
            })()}
          </Modal.Body>
          <Modal.Footer>
            <Button 
              variant="secondary" 
              onClick={() => setShowCardModal(false)}
              disabled={isAddingComment}
            >
              Fechar
            </Button>
            <Button
              variant="primary"
              onClick={handleAddComment}
              disabled={!cardComment.trim() || isAddingComment}
            >
              {isAddingComment ? (
                <>
                  <Spinner size="sm" className="me-2" />
                  Adicionando...
                </>
              ) : (
                '💾 Adicionar Informação'
              )}
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </DndContext>
  );
};

export default PublicBoardPage;