import React, { useEffect, useState, FormEvent, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Container, Card, Spinner, Alert, Button, Modal, Form, Badge } from 'react-bootstrap';
import { api } from '../lib/api';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Label } from '../components/Label';
import { LabelPicker } from '../components/LabelPicker';
import { DueDatePicker } from '../components/DueDatePicker';
import { RichTextEditor } from '../components/RichTextEditor';
import { FileUpload } from '../components/FileUpload';
import { AttachmentList } from '../components/AttachmentList';
import { ActivityLog } from '../components/ActivityLog';
import { Checklist } from '../components/Checklist';
import { PriorityPicker } from '../components/PriorityPicker';
import AutomationsManager from '../components/AutomationsManager';
import '../styles/priority.css';
import '../styles/quick-actions.css';


interface IComment {
  id: number;
  content: string;
  user_id_author: number;
  timestamp: string;
}

interface ILabel {
  id: number;
  name: string;
  color: string;
}

interface IAttachment {
  id: number;
  card_id: number;
  filename: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  url: string;
}

interface IUser {
  id: number;
  name: string;
  email: string;
}

interface ICard {
  id: number;
  title: string;
  description: string | null;
  order_index: number; // Changed from 'order' to 'order_index' to match backend
  column_id: number;
  status: string; // Added status field
  priority?: string; // Added priority field
  assignee_id?: number | null; // Added assignee field
  comments?: IComment[]; // Optional comments array
  labels?: ILabel[]; // Added labels array
  due_date?: string | null; // Added due_date field
  attachments?: IAttachment[]; // Added attachments array
}

interface IColumn {
  id: number;
  title: string;
  order_index: number;
  cards: ICard[];
  wip_limit?: number | null;
  is_collapsed?: boolean;
}

interface IBoard {
  id: number;
  title: string;
  columns: IColumn[];
  background_image?: string | null;
  background_color?: string;
}

const SortableCard: React.FC<{ 
  card: ICard, 
  onCardClick: (card: ICard) => void,
  isSelected?: boolean,
  onSelect?: (cardId: number, selected: boolean) => void,
  bulkMode?: boolean,
  columnTitle?: string,
  onQuickMove?: (cardId: number, targetStatus: string) => void,
  onDeleteCard?: (cardId: number) => void
}> = ({ card, onCardClick, isSelected, onSelect, bulkMode, columnTitle, onQuickMove, onDeleteCard }) => {
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
            default: return '';
        }
    };

    const getPriorityClass = (priority?: string) => {
        switch (priority) {
            case 'critical': return 'priority-critical';
            case 'high': return 'priority-high';
            case 'medium': return 'priority-medium';
            case 'low': return 'priority-low';
            case 'none': return 'priority-none';
            default: return 'priority-medium';
        }
    };

    const handleCardClick = (e: React.MouseEvent) => {
        if (bulkMode && onSelect) {
            e.preventDefault();
            e.stopPropagation();
            onSelect(card.id, !isSelected);
        } else if (!bulkMode) {
            onCardClick(card);
        }
    };

    const getQuickActionButton = () => {
        if (!onQuickMove || !columnTitle) return null;

        const title = columnTitle.toLowerCase();
        console.log('🔍 Checking column for quick action:', title);
        
        // Primeira coluna (A Fazer) -> botão "Mover para Em Progresso"
        // Verifica por nome ou se é a primeira coluna (índice 0)
        const isFirstColumn = title.includes('fazer') || 
                            title.includes('todo') || 
                            title.includes('backlog') ||
                            title.includes('pendente') ||
                            title.includes('novo') ||
                            title.includes('aberto');
        
        if (isFirstColumn) {
            return (
                <Button
                    variant="outline-success"
                    size="sm"
                    className="quick-action-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        console.log('🚀 Moving card to in-progress:', card.id);
                        onQuickMove(card.id, 'in-progress');
                        // Feedback visual
                        const target = e.currentTarget;
                        target.classList.add('success-animation');
                        setTimeout(() => {
                            if (target && target.classList) {
                                target.classList.remove('success-animation');
                            }
                        }, 300);
                    }}
                    title="Mover para Em Progresso"
                    style={{
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: '1px solid #28a745',
                        fontWeight: 'bold'
                    }}
                >
                    ✓
                </Button>
            );
        }
        
        // Coluna Em Progresso -> botão "Marcar como Concluído"
        const isProgressColumn = title.includes('progresso') || 
                                title.includes('progress') || 
                                title.includes('fazendo') || 
                                title.includes('doing') ||
                                title.includes('andamento') ||
                                title.includes('desenvolvimento') ||
                                title.includes('execu');
        
        if (isProgressColumn) {
            return (
                <Button
                    variant="outline-success"
                    size="sm"
                    className="quick-action-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        console.log('🚀 Moving card to completed:', card.id);
                        onQuickMove(card.id, 'completed');
                        // Feedback visual
                        const target = e.currentTarget;
                        target.classList.add('success-animation');
                        setTimeout(() => {
                            if (target && target.classList) {
                                target.classList.remove('success-animation');
                            }
                        }, 300);
                    }}
                    title="Marcar como Concluído"
                    style={{
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: '1px solid #28a745',
                        fontWeight: 'bold'
                    }}
                >
                    ✓
                </Button>
            );
        }

        return null;
    };

    const getDeleteButton = () => {
        if (bulkMode || !onDeleteCard) return null;
        
        return (
            <Button
                variant="outline-danger"
                size="sm"
                className="quick-action-btn"
                onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Tem certeza que deseja excluir este card?')) {
                        console.log('🗑️ Deleting card:', card.id);
                        onDeleteCard(card.id);
                    }
                }}
                title="Excluir Card"
                style={{
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: '1px solid #dc3545',
                    fontWeight: 'bold',
                    marginLeft: '4px'
                }}
            >
                🗑️
            </Button>
        );
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes}>
            <Card 
                onClick={handleCardClick}
                onContextMenu={(e) => {
                    if (onSelect) {
                        e.preventDefault();
                        onSelect(card.id, !isSelected);
                    }
                }}
                style={{ 
                    cursor: bulkMode ? 'default' : 'pointer', 
                    userSelect: 'none',
                    border: isSelected ? '2px solid #007bff' : undefined,
                    backgroundColor: isSelected ? '#f0f8ff' : undefined
                }} 
                className={`${getStatusClass(card.status)} ${getPriorityClass(card.priority)} card-transition`}
            >
                <Card.Body>
                    {bulkMode && onSelect && (
                        <div className="position-absolute top-0 start-0 m-2">
                            <Form.Check 
                                type="checkbox" 
                                checked={isSelected || false}
                                onChange={(e) => onSelect(card.id, e.target.checked)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}
                    {/* Badge de prioridade no topo do card */}
                    {card.priority && card.priority !== 'none' && card.priority !== 'medium' && (
                        <div className="mb-2">
                            <PriorityPicker
                                priority={card.priority}
                                onPriorityChange={() => {}}
                                showAsCard={true}
                            />
                        </div>
                    )}
                    <div className="d-flex justify-content-between align-items-start mb-2">
                        <span className="flex-grow-1" style={{ fontWeight: card.priority === 'critical' || card.priority === 'high' ? '600' : 'normal' }}>
                            {card.title}
                        </span>
                        <div className="d-flex align-items-center gap-1">
                            {/* Botão de ação rápida para mobile */}
                            {getQuickActionButton()}
                            
                            {/* Botão de exclusão sempre visível */}
                            {getDeleteButton()}
                            
                            {!bulkMode && (
                                <div 
                                    {...listeners}
                                    style={{ cursor: 'grab', padding: '4px' }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="d-none d-lg-block" // Só visível no desktop
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-grip-vertical flex-shrink-0" viewBox="0 0 16 16">
                                        <path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/>
                                    </svg>
                                </div>
                            )}
                        </div>
                    </div>
                    {card.description && card.description.trim() && (
                        <div className="mb-2">
                            <RichTextEditor
                                value={card.description}
                                onChange={() => {}}
                                readOnly={true}
                                hideToolbar={true}
                                height={60}
                            />
                        </div>
                    )}
                    {(card.labels && card.labels.length > 0) || card.due_date ? (
                        <div className="d-flex flex-wrap gap-1 align-items-center">
                            {card.labels && card.labels.slice(0, 3).map(label => (
                                <Label
                                    key={label.id}
                                    {...label}
                                    size="sm"
                                />
                            ))}
                            {card.labels && card.labels.length > 3 && (
                                <Badge bg="secondary" style={{ fontSize: '0.7rem' }}>
                                    +{card.labels.length - 3}
                                </Badge>
                            )}
                            {card.due_date && (
                                <DueDatePicker
                                    dueDate={card.due_date}
                                    onDateChange={() => {}} // Not used in card display
                                    showAsCard={true}
                                />
                            )}
                        </div>
                    ) : null}
                </Card.Body>
            </Card>
        </div>
    );
};
const Column: React.FC<{ 
  column: IColumn, 
  onAddCard: (columnId: number) => void, 
  onCardClick: (card: ICard) => void, 
  onDeleteColumn: (columnId: number) => void, 
  onUpdateColumnTitle: (columnId: number, newTitle: string) => void, 
  isOverlay?: boolean, 
  dragHandleProps?: any,
  isCollapsed?: boolean,
  onToggleCollapse?: () => void,
  onEditColumn?: () => void,
  filteredCards?: ICard[],
  swimlanesEnabled?: boolean,
  users?: IUser[],
  selectedCards?: Set<number>,
  onCardSelect?: (cardId: number, isSelected: boolean) => void,
  bulkActionMode?: boolean,
  onQuickMove?: (cardId: number, targetStatus: string) => void,
  onDeleteCard?: (cardId: number) => void
}> = ({ 
  column, 
  onAddCard, 
  onCardClick, 
  onDeleteColumn, 
  onUpdateColumnTitle, 
  isOverlay, 
  dragHandleProps,
  isCollapsed,
  onToggleCollapse,
  onEditColumn,
  filteredCards,
  swimlanesEnabled,
  users = [],
  selectedCards = new Set(),
  onCardSelect,
  bulkActionMode,
  onQuickMove,
  onDeleteCard
}) => {
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [columnTitle, setColumnTitle] = useState(column.title);
    const [sortByPriority, setSortByPriority] = useState(false);

    const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
        id: `column-${column.id}`,
        data: { 
            type: 'column', 
            column: column 
        },
    });

    const handleTitleBlur = () => {
        setIsEditingTitle(false);
        if (columnTitle.trim() !== column.title) {
            onUpdateColumnTitle(column.id, columnTitle);
        }
    };

    const handleTitleClick = () => {
        setIsEditingTitle(true);
    };

    const cardIds = column.cards.map(c => `card-${c.id}`);

    const sortCards = (cards: ICard[]) => {
        if (!sortByPriority) {
            return cards.sort((a, b) => a.order_index - b.order_index);
        }
        
        const priorityOrder: { [key: string]: number } = {
            'critical': 1,
            'high': 2,
            'medium': 3,
            'low': 4,
            'none': 5
        };
        
        return [...cards].sort((a, b) => {
            const priorityA = priorityOrder[a.priority || 'medium'] || 3;
            const priorityB = priorityOrder[b.priority || 'medium'] || 3;
            
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            return a.order_index - b.order_index;
        });
    };

    const cardsToShow = filteredCards || column.cards;
    const sortedCards = sortCards(cardsToShow);
    
    const isWipExceeded = column.wip_limit && cardsToShow.length > column.wip_limit;
    
    const getAssigneeGroups = (cards: ICard[]) => {
      const groups: { [key: string]: ICard[] } = {};
      cards.forEach(card => {
        const assigneeId = card.assignee_id?.toString() || 'unassigned';
        if (!groups[assigneeId]) groups[assigneeId] = [];
        groups[assigneeId].push(card);
      });
      return groups;
    };
    
    const getAssigneeName = (assigneeId: string) => {
      if (assigneeId === 'unassigned') return 'Não Atribuído';
      const user = users.find(u => u.id.toString() === assigneeId);
      return user?.name || user?.email || 'Usuário Desconhecido';
    };

    return (
        <div className={isOverlay ? "shadow-lg" : ""} style={{ width: isCollapsed ? '60px' : '100%' }}>
            <Card bg="light" className="h-100" style={{ 
                backgroundColor: isOver ? '#f0f8ff' : (isWipExceeded ? '#fff5f5' : undefined),
                borderColor: isOver ? '#007bff' : (isWipExceeded ? '#dc3545' : undefined),
                borderWidth: isOver || isWipExceeded ? '2px' : undefined,
                transition: 'all 0.2s ease'
            }}>
                <Card.Header as="h5" className="d-flex justify-content-between align-items-center">
                    <div {...dragHandleProps} style={{ cursor: 'grab', padding: '8px', flex: 1 }}>
                        {!isCollapsed && (
                            isEditingTitle ? (
                                <Form.Control
                                    type="text"
                                    value={columnTitle}
                                    onChange={(e) => setColumnTitle(e.target.value)}
                                    onBlur={handleTitleBlur}
                                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                    autoFocus
                                />
                            ) : (
                                <div className="d-flex align-items-center gap-2">
                                    <span onClick={handleTitleClick} style={{ cursor: 'pointer' }}>
                                        {column.title}
                                    </span>
                                    {column.wip_limit && (
                                        <Badge 
                                            bg={isWipExceeded ? 'danger' : 'secondary'} 
                                            title={`WIP Limit: ${cardsToShow.length}/${column.wip_limit}`}
                                        >
                                            {cardsToShow.length}/{column.wip_limit}
                                        </Badge>
                                    )}
                                </div>
                            )
                        )}
                        {isCollapsed && (
                            <div className="text-center">
                                <div style={{ writingMode: 'vertical-lr', textOrientation: 'mixed' }}>
                                    {column.title}
                                </div>
                                <Badge bg="secondary" className="mt-1">
                                    {cardsToShow.length}
                                </Badge>
                            </div>
                        )}
                    </div>
                    {!isCollapsed && (
                        <div className="d-flex align-items-center gap-1">
                            <Button 
                                variant="outline-secondary" 
                                size="sm" 
                                onClick={onEditColumn}
                                title="Editar coluna"
                            >
                                ⚙️
                            </Button>
                            <Button 
                                variant={sortByPriority ? "primary" : "outline-secondary"} 
                                size="sm" 
                                onClick={() => setSortByPriority(!sortByPriority)}
                                title="Ordenar por prioridade"
                            >
                                ⬆️
                            </Button>
                            <Button variant="outline-danger" size="sm" onClick={() => onDeleteColumn(column.id)}>-</Button>
                            <Button variant="outline-primary" size="sm" onClick={() => onAddCard(column.id)}>+</Button>
                        </div>
                    )}
                    <Button 
                        variant="outline-secondary" 
                        size="sm" 
                        onClick={onToggleCollapse}
                        title={isCollapsed ? "Expandir" : "Recolher"}
                    >
                        {isCollapsed ? '→' : '←'}
                    </Button>
                </Card.Header>
                {!isCollapsed && (
                    <Card.Body ref={setDroppableNodeRef} style={{ minHeight: '200px' }}>
                        {swimlanesEnabled ? (
                            <div>
                                {Object.entries(getAssigneeGroups(sortedCards)).map(([assigneeId, cards]) => (
                                    <div key={assigneeId} className="mb-3">
                                        <div className="d-flex align-items-center mb-2">
                                            <Badge bg="info" className="me-2">
                                                {getAssigneeName(assigneeId)}
                                            </Badge>
                                            <span className="text-muted small">({cards.length})</span>
                                        </div>
                                        <SortableContext items={cards.map(c => `card-${c.id}`)} strategy={verticalListSortingStrategy}>
                                            <div className="d-flex flex-column" style={{ gap: '0.5rem', minHeight: '50px' }}>
                                                {cards.map(card => (
                                                    <SortableCard 
                                                        key={card.id} 
                                                        card={card} 
                                                        onCardClick={onCardClick}
                                                        isSelected={selectedCards.has(card.id)}
                                                        onSelect={onCardSelect}
                                                        bulkMode={bulkActionMode}
                                                        columnTitle={column.title}
                                                        onQuickMove={onQuickMove}
                                                        onDeleteCard={onDeleteCard}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </div>
                                ))}
                                {Object.keys(getAssigneeGroups(sortedCards)).length === 0 && (
                                    <p className="text-muted text-center">Arraste cards para cá</p>
                                )}
                            </div>
                        ) : (
                            <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
                                <div className="d-flex flex-column" style={{ gap: '0.5rem', minHeight: '100px' }}>
                                    {sortedCards.map(card => (
                                        <SortableCard 
                                            key={card.id} 
                                            card={card} 
                                            onCardClick={onCardClick}
                                            isSelected={selectedCards.has(card.id)}
                                            onSelect={onCardSelect}
                                            bulkMode={bulkActionMode}
                                            columnTitle={column.title}
                                            onQuickMove={onQuickMove}
                                            onDeleteCard={onDeleteCard}
                                        />
                                    ))}
                                    {sortedCards.length === 0 && (
                                        <p className="text-muted text-center">Arraste cards para cá</p>
                                    )}
                                </div>
                            </SortableContext>
                        )}
                    </Card.Body>
                )}
            </Card>
        </div>
    );
};


const SortableColumn: React.FC<{ 
  column: IColumn, 
  onAddCard: (columnId: number) => void, 
  onCardClick: (card: ICard) => void, 
  onDeleteColumn: (columnId: number) => void, 
  onUpdateColumnTitle: (columnId: number, newTitle: string) => void,
  isCollapsed?: boolean,
  onToggleCollapse?: () => void,
  onEditColumn?: () => void,
  filteredCards?: ICard[],
  swimlanesEnabled?: boolean,
  users?: IUser[],
  selectedCards?: Set<number>,
  onCardSelect?: (cardId: number, isSelected: boolean) => void,
  bulkActionMode?: boolean,
  onQuickMove?: (cardId: number, targetStatus: string) => void
}> = ({ 
  column, 
  onAddCard, 
  onCardClick, 
  onDeleteColumn, 
  onUpdateColumnTitle, 
  isCollapsed,
  onToggleCollapse,
  onEditColumn,
  filteredCards,
  swimlanesEnabled,
  users,
  selectedCards,
  onCardSelect,
  bulkActionMode,
  onQuickMove
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `column-${column.id}`, data: { type: 'column', column: column } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style}>
            <Column 
                column={column} 
                onAddCard={onAddCard} 
                onCardClick={onCardClick} 
                onDeleteColumn={onDeleteColumn} 
                onUpdateColumnTitle={onUpdateColumnTitle} 
                dragHandleProps={{...attributes, ...listeners}}
                isCollapsed={isCollapsed}
                onToggleCollapse={onToggleCollapse}
                onEditColumn={onEditColumn}
                filteredCards={filteredCards}
                swimlanesEnabled={swimlanesEnabled}
                users={users}
                selectedCards={selectedCards}
                onCardSelect={onCardSelect}
                bulkActionMode={bulkActionMode}
                onQuickMove={onQuickMove}
            />
        </div>
    );
};


const BoardPage: React.FC = () => {
  const { id, projectId } = useParams<{ id: string; projectId: string }>();
  const boardId = parseInt(id || '0');
  
  const [board, setBoard] = useState<IBoard | null>(null);
  const [activeColumn, setActiveColumn] = useState<IColumn | null>(null);
  const [activeCard, setActiveCard] = useState<ICard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewColumnModal, setShowNewColumnModal] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [showNewCardModal, setShowNewCardModal] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newCardDescription, setNewCardDescription] = useState("");
  const [newCardPriority, setNewCardPriority] = useState("medium");
  const [newCardAssigneeId, setNewCardAssigneeId] = useState<number | null>(null);
  const [newCardColumnId, setNewCardColumnId] = useState<number | null>(null);
  const [newCardDueDate, setNewCardDueDate] = useState<string | null>(null);
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [users, setUsers] = useState<IUser[]>([]);
  const [showCardDetailsModal, setShowCardDetailsModal] = useState(false);
  const [selectedCard, setSelectedCard] = useState<ICard | null>(null);
  const [newCommentContent, setNewCommentContent] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editedCommentContent, setEditedCommentContent] = useState("");
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [attachments, setAttachments] = useState<IAttachment[]>([]);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [activityLogType, setActivityLogType] = useState<'board' | 'card'>('board');
  const [activityLogId, setActivityLogId] = useState<number | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharingLink, setSharingLink] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [swimlanesEnabled, setSwimlanes] = useState(false);
  const [collapsedColumns, setCollapsedColumns] = useState<Set<number>>(new Set());
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    priority: '',
    assignee: '',
    labels: [] as string[],
    search: ''
  });
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [bulkActionMode, setBulkActionMode] = useState(false);
  const [showColumnEditModal, setShowColumnEditModal] = useState(false);
  const [editingColumn, setEditingColumn] = useState<IColumn | null>(null);
  const [showAutomationsModal, setShowAutomationsModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchBoard = async () => {
    try {
      const response = await api.get(`/boards/${boardId}`);
      setBoard(response.data.data);
    } catch (err) {
      setError('Failed to fetch board data.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      // Mock users for testing (replace with real API call later)
      const mockUsers = [
        { id: 1, name: 'João Silva', email: 'joao@email.com' },
        { id: 2, name: 'Maria Santos', email: 'maria@email.com' },
        { id: 3, name: 'Carlos Oliveira', email: 'carlos@email.com' },
        { id: 4, name: 'Ana Costa', email: 'ana@email.com' }
      ];
      setUsers(mockUsers);
      
      // TODO: Replace with actual API call when authentication is fixed
      // const response = await api.get('/users');
      // setUsers(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  };

  useEffect(() => {
    fetchBoard();
    fetchUsers();
    loadCollapsedColumns();
    
    // Set up polling for external technician updates every 30 seconds
    // Avoid polling while dragging to prevent interference
    const interval = setInterval(() => {
      if (!isDragging) {
        fetchBoard();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [boardId, isDragging]);

  const loadCollapsedColumns = () => {
    const saved = localStorage.getItem(`collapsed-columns-${boardId}`);
    if (saved) {
      setCollapsedColumns(new Set(JSON.parse(saved)));
    }
  };

  const saveCollapsedColumns = (collapsed: Set<number>) => {
    localStorage.setItem(`collapsed-columns-${boardId}`, JSON.stringify([...collapsed]));
  };

  const toggleColumnCollapse = (columnId: number) => {
    const newCollapsed = new Set(collapsedColumns);
    if (newCollapsed.has(columnId)) {
      newCollapsed.delete(columnId);
    } else {
      newCollapsed.add(columnId);
    }
    setCollapsedColumns(newCollapsed);
    saveCollapsedColumns(newCollapsed);
  };

  const handleCardSelect = (cardId: number, isSelected: boolean) => {
    const newSelected = new Set(selectedCards);
    if (isSelected) {
      newSelected.add(cardId);
    } else {
      newSelected.delete(cardId);
    }
    setSelectedCards(newSelected);
  };

  const clearSelection = () => {
    setSelectedCards(new Set());
  };

  const handleQuickMove = async (cardId: number, targetStatus: string) => {
    if (!board) return;
    
    console.log('🚀 Quick move:', { cardId, targetStatus });
    
    try {
      // Encontrar o card atual
      const currentCard = board.columns.flatMap(col => col.cards).find(c => c.id === cardId);
      if (!currentCard) {
        console.error('Card not found:', cardId);
        return;
      }

      // Encontrar a coluna de destino baseada no status
      let targetColumn: IColumn | undefined;
      
      if (targetStatus === 'in-progress') {
        targetColumn = board.columns.find(col => 
          col.title.toLowerCase().includes('progresso') || 
          col.title.toLowerCase().includes('progress') ||
          col.title.toLowerCase().includes('andamento') ||
          col.title.toLowerCase().includes('fazendo') ||
          col.title.toLowerCase().includes('doing') ||
          col.title.toLowerCase().includes('desenvolvimento') ||
          col.title.toLowerCase().includes('execu')
        );
        
        // Se não encontrar coluna com nome específico, usar a segunda coluna (índice 1)
        if (!targetColumn && board.columns.length > 1) {
          targetColumn = board.columns[1];
          console.log('📍 Using second column as In Progress:', targetColumn.title);
        }
      } else if (targetStatus === 'completed') {
        targetColumn = board.columns.find(col => 
          col.title.toLowerCase().includes('conclu') || 
          col.title.toLowerCase().includes('done') || 
          col.title.toLowerCase().includes('complete') ||
          col.title.toLowerCase().includes('finalizada') ||
          col.title.toLowerCase().includes('pronto') ||
          col.title.toLowerCase().includes('feito')
        );
        
        // Se não encontrar coluna com nome específico, usar a última coluna
        if (!targetColumn && board.columns.length > 0) {
          targetColumn = board.columns[board.columns.length - 1];
          console.log('📍 Using last column as Completed:', targetColumn.title);
        }
      }

      if (!targetColumn) {
        console.error('Target column not found for status:', targetStatus);
        setError('Não foi possível encontrar a coluna de destino. Verifique se existem colunas no board.');
        return;
      }

      console.log('📦 Moving card from column', currentCard.column_id, 'to column', targetColumn.id);
      console.log('📝 Card details:', {
        id: cardId,
        from_column: currentCard.column_id, 
        to_column: targetColumn.id,
        new_status: targetStatus,
        new_order: targetColumn.cards.length + 1
      });

      // Atualizar via API
      const response = await api.put(`/cards/${cardId}`, {
        column_id: targetColumn.id,
        status: targetStatus,
        order_index: targetColumn.cards.length + 1
      });
      
      console.log('✅ API Response:', response.data);

      console.log('✅ Quick move completed successfully');
      
      // Recarregar board para refletir mudanças
      fetchBoard();
    } catch (err: any) {
      console.error('❌ Error in quick move:', err);
      
      if (err.response?.status === 409) {
        // Conflito de horário detectado
        const conflictDetails = err.response.data?.details || 'Conflito de horário detectado';
        setError(`⚠️ ${conflictDetails}`);
      } else {
        setError('Falha ao mover o card');
      }
    }
  };

  const bulkMoveCards = async (targetColumnId: number) => {
    for (const cardId of selectedCards) {
      const card = board?.columns.flatMap(col => col.cards).find(c => c.id === cardId);
      if (card && card.column_id !== targetColumnId) {
        try {
          await api.put(`/cards/${cardId}`, {
            column_id: targetColumnId,
            status: getStatusFromColumn(targetColumnId)
          });
        } catch (err) {
          console.error('Error moving card:', err);
        }
      }
    }
    clearSelection();
    fetchBoard();
  };

  const bulkDeleteCards = async () => {
    if (window.confirm(`Delete ${selectedCards.size} selected cards?`)) {
      for (const cardId of selectedCards) {
        try {
          await api.delete(`/cards/${cardId}`);
        } catch (err) {
          console.error('Error deleting card:', err);
        }
      }
      clearSelection();
      fetchBoard();
    }
  };

  const getStatusFromColumn = (columnId: number) => {
    const column = board?.columns.find(col => col.id === columnId);
    if (!column) return 'todo';
    
    const title = column.title.toLowerCase();
    if (title.includes('fazer') || title.includes('todo')) return 'todo';
    if (title.includes('andamento') || title.includes('progress')) return 'in-progress';
    if (title.includes('conclu') || title.includes('done') || title.includes('complete')) return 'completed';
    return 'todo';
  };

  const filterCards = (cards: ICard[]) => {
    return cards.filter(card => {
      if (filters.search && !card.title.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      if (filters.priority && card.priority !== filters.priority) {
        return false;
      }
      if (filters.assignee && card.assignee_id?.toString() !== filters.assignee) {
        return false;
      }
      if (filters.labels.length > 0 && !card.labels?.some(label => filters.labels.includes(label.name))) {
        return false;
      }
      return true;
    });
  };

  const getAssigneeGroups = (cards: ICard[]) => {
    const groups: { [key: string]: ICard[] } = {};
    
    cards.forEach(card => {
      const assigneeId = card.assignee_id?.toString() || 'unassigned';
      if (!groups[assigneeId]) {
        groups[assigneeId] = [];
      }
      groups[assigneeId].push(card);
    });
    
    return groups;
  };

  const getAssigneeName = (assigneeId: string) => {
    if (assigneeId === 'unassigned') return 'Não Atribuído';
    const user = users.find(u => u.id.toString() === assigneeId);
    return user?.name || user?.email || 'Usuário Desconhecido';
  };

  const handleAddCardClick = (columnId: number) => {
    setNewCardColumnId(columnId);
    setShowNewCardModal(true);
  };

  const handleCardClick = (card: ICard) => {
    setSelectedCard(card);
    setShowCardDetailsModal(true);
    fetchAttachments(card.id);
  };

  const handleCreateNewCard = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCardTitle.trim()) {
      setError("Card title cannot be empty.");
      return;
    }
    if (newCardColumnId === null) {
      setError("Column not selected for new card.");
      return;
    }
    setError(null);
    setIsCreatingCard(true);

    try {
      await api.post('/cards', {
        column_id: newCardColumnId,
        title: newCardTitle,
        description: newCardDescription || null,
        priority: newCardPriority,
        assignee_id: newCardAssigneeId,
        due_date: newCardDueDate,
      });
      setNewCardTitle("");
      setNewCardDescription("");
      setNewCardPriority("medium");
      setNewCardAssigneeId(null);
      setNewCardDueDate(null);
      setShowNewCardModal(false);
      fetchBoard(); // Refresh the board data
    } catch (err: any) {
      if (err.response?.status === 409) {
        // Conflict error - scheduling conflict
        setError(`Conflito de horário: ${err.response.data.details}`);
      } else {
        setError("Falha ao criar card.");
      }
      console.error(err);
    } finally {
      setIsCreatingCard(false);
    }
  };

  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCommentContent.trim()) {
      setError("Comment cannot be empty.");
      return;
    }
    if (!selectedCard) {
      setError("No card selected for comment.");
      return;
    }
    setError(null);

    try {
      await api.post(`/cards/${selectedCard.id}/comments`, { content: newCommentContent });
      setNewCommentContent("");
      fetchBoard(); // Refresh board to get new comments
    } catch (err) {
      setError("Failed to add comment.");
      console.error(err);
    }
  };

  const handleUpdateCardDetails = async () => {
    if (!selectedCard) return;

    setError(null);
    try {
      await api.put(`/cards/${selectedCard.id}`, {
        title: selectedCard.title,
        description: selectedCard.description,
        priority: selectedCard.priority,
        due_date: selectedCard.due_date,
        assignee_id: selectedCard.assignee_id,
      });
      fetchBoard(); // Refresh board to ensure data consistency
    } catch (err: any) {
      if (err.response?.status === 409) {
        // Conflict error - scheduling conflict
        setError(`Conflito de horário: ${err.response.data.details}`);
      } else {
        setError("Falha ao atualizar detalhes do card.");
      }
      console.error(err);
    }
  };

  const handleDeleteCard = async () => {
    if (!selectedCard) return;

    if (window.confirm('Are you sure you want to delete this card?')) {
      setError(null);
      try {
        await api.delete(`/cards/${selectedCard.id}`);
        setShowCardDetailsModal(false); // Close modal after deletion
        fetchBoard(); // Refresh board data
      } catch (err) {
        setError("Failed to delete card.");
        console.error(err);
      }
    }
  };

  const handleDeleteColumn = async (columnId: number) => {
    if (window.confirm('Are you sure you want to delete this column and all its cards?')) {
      setError(null);
      try {
        await api.delete(`/columns/${columnId}`);
        fetchBoard(); // Refresh board data
      } catch (err) {
        setError("Failed to delete column.");
        console.error(err);
      }
    }
  };

  const handleUpdateColumnTitle = async (columnId: number, newTitle: string) => {
    setError(null);
    try {
      await api.put(`/columns/${columnId}`, { title: newTitle });
      fetchBoard(); // Refresh board to ensure data consistency
    } catch (err) {
      setError("Failed to update column title.");
      console.error(err);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    console.log('🎯 Drag started:', event.active.id, event.active.data.current);
    setIsDragging(true);
    if (event.active.data.current?.type === 'card') {
      const card = event.active.data.current.card;
      console.log('📦 Dragging card:', card.id, card.title);
      setActiveCard(card);
    } else if (event.active.data.current?.type === 'column') {
      const column = event.active.data.current.column;
      console.log('📋 Dragging column:', column.id, column.title);
      setActiveColumn(column);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    console.log('🎯 Drag end:', {
      activeId: active.id,
      activeType: active.data.current?.type,
      overId: over?.id,
      overType: over?.data.current?.type,
      board: !!board
    });

    if (!over || !board) {
      console.log('❌ Drag cancelled - no valid drop target or board missing');
      setActiveCard(null);
      setActiveColumn(null);
      setIsDragging(false);
      return;
    }

    // Handle card movement
    if (active.data.current?.type === 'card' && over.data.current) {
      const activeCard = active.data.current.card as ICard;
      let newColumnId: number | null = null;
      let newOrderIndex: number | null = null;
      let newStatus: string = activeCard.status;

      // Dropped on a card
      if (over.data.current.type === 'card') {
        const overCard = over.data.current.card as ICard;
        newColumnId = overCard.column_id;
        console.log('📦➡️📦 Card dropped on card:', {
          draggedCard: activeCard.id,
          targetCard: overCard.id,
          targetColumn: newColumnId
        });

        // Encontrar colunas de origem e destino
        const sourceColumn = board.columns.find(col => 
          col.cards.some(c => c.id === activeCard.id)
        );
        const targetColumn = board.columns.find(col => col.id === newColumnId);

        if (sourceColumn && targetColumn) {
          // Criar cópia do board para atualizar
          const newBoard = { ...board };
          const newSourceColumn = newBoard.columns.find(col => col.id === sourceColumn.id)!;
          const newTargetColumn = newBoard.columns.find(col => col.id === targetColumn.id)!;

          // Remover card da coluna de origem
          const cardIndex = newSourceColumn.cards.findIndex(c => c.id === activeCard.id);
          const [movedCard] = newSourceColumn.cards.splice(cardIndex, 1);

          // Determinar novo status baseado na coluna de destino
          if (targetColumn.title.toLowerCase().includes('fazer') || targetColumn.title.toLowerCase().includes('todo')) {
            newStatus = 'todo';
          } else if (targetColumn.title.toLowerCase().includes('andamento') || targetColumn.title.toLowerCase().includes('progress')) {
            newStatus = 'in-progress';
          } else if (targetColumn.title.toLowerCase().includes('conclu') || targetColumn.title.toLowerCase().includes('done') || targetColumn.title.toLowerCase().includes('complete')) {
            newStatus = 'completed';
          }

          // Se movendo para a mesma coluna (reordenação)
          if (sourceColumn.id === targetColumn.id) {
            const overCardIndex = newTargetColumn.cards.findIndex(c => c.id === overCard.id);
            newTargetColumn.cards.splice(overCardIndex, 0, movedCard);
          } else {
            // Movendo para coluna diferente
            const overCardIndex = newTargetColumn.cards.findIndex(c => c.id === overCard.id);
            if (overCardIndex >= 0) {
              newTargetColumn.cards.splice(overCardIndex, 0, { ...movedCard, column_id: targetColumn.id, status: newStatus });
            } else {
              newTargetColumn.cards.push({ ...movedCard, column_id: targetColumn.id, status: newStatus });
            }
          }

          // Atualizar order_index de todos os cards afetados
          newSourceColumn.cards = newSourceColumn.cards.map((card, index) => ({
            ...card,
            order_index: index + 1
          }));
          newTargetColumn.cards = newTargetColumn.cards.map((card, index) => ({
            ...card,
            order_index: index + 1,
            status: sourceColumn.id === targetColumn.id ? card.status : newStatus
          }));

          setBoard(newBoard);

          // Persistir mudanças no backend
          try {
            const targetCard = newTargetColumn.cards.find(c => c.id === activeCard.id);
            if (targetCard) {
              console.log('💾 Saving card movement to backend:', {
                cardId: activeCard.id,
                newColumn: targetColumn.id,
                newOrderIndex: targetCard.order_index,
                newStatus: targetCard.status
              });
              await api.put(`/cards/${activeCard.id}`, {
                column_id: targetColumn.id,
                order_index: targetCard.order_index,
                status: newStatus
              });
              console.log('✅ Card movement saved successfully');
            }
            // Evitar fetchBoard() durante drag operations para prevenir re-renders
            if (!isDragging) {
              fetchBoard(); // Recarregar apenas se não estiver arrastando
            }
          } catch (err) {
            console.error('❌ Erro ao atualizar card:', err);
            setError('Falha ao mover o card');
            if (!isDragging) {
              fetchBoard();
            }
          }
        }
      } else if (over.data.current.type === 'column') {
        // Card solto diretamente na coluna (área vazia)
        const targetColumn = over.data.current.column as IColumn;
        newColumnId = targetColumn.id;

        const sourceColumn = board.columns.find(col => 
          col.cards.some(c => c.id === activeCard.id)
        );

        if (sourceColumn && targetColumn) {
          const newBoard = { ...board };
          const newSourceColumn = newBoard.columns.find(col => col.id === sourceColumn.id)!;
          const newTargetColumn = newBoard.columns.find(col => col.id === newColumnId)!;

          // Remover card da coluna de origem
          const cardIndex = newSourceColumn.cards.findIndex(c => c.id === activeCard.id);
          const [movedCard] = newSourceColumn.cards.splice(cardIndex, 1);

          // Determinar novo status
          if (targetColumn.title.toLowerCase().includes('fazer') || targetColumn.title.toLowerCase().includes('todo')) {
            newStatus = 'todo';
          } else if (targetColumn.title.toLowerCase().includes('andamento') || targetColumn.title.toLowerCase().includes('progress')) {
            newStatus = 'in-progress';
          } else if (targetColumn.title.toLowerCase().includes('conclu') || targetColumn.title.toLowerCase().includes('done') || targetColumn.title.toLowerCase().includes('complete')) {
            newStatus = 'completed';
          }

          // Adicionar ao final da coluna de destino
          newTargetColumn.cards.push({ 
            ...movedCard, 
            column_id: newColumnId, 
            status: newStatus,
            order_index: newTargetColumn.cards.length + 1
          });

          // Recalcular order_index
          newSourceColumn.cards = newSourceColumn.cards.map((card, index) => ({
            ...card,
            order_index: index + 1
          }));
          newTargetColumn.cards = newTargetColumn.cards.map((card, index) => ({
            ...card,
            order_index: index + 1
          }));

          setBoard(newBoard);

          // Persistir no backend
          try {
            const targetCard = newTargetColumn.cards.find(c => c.id === activeCard.id);
            if (targetCard) {
              await api.put(`/cards/${activeCard.id}`, {
                column_id: newColumnId,
                order_index: targetCard.order_index,
                status: newStatus
              });
            }
            if (!isDragging) {
              fetchBoard();
            }
          } catch (err) {
            console.error('Erro ao atualizar card:', err);
            setError('Falha ao mover o card');
            if (!isDragging) {
              fetchBoard();
            }
          }
        }
      }
    } else if (active.data.current?.type === 'column' && over.data.current?.type === 'column') {
      // Handle column movement
      const activeColumn = active.data.current.column as IColumn;
      const overColumn = over.data.current.column as IColumn;

      if (activeColumn.id === overColumn.id) return;

      const newBoard = { ...board! };
      const oldColumnIndex = newBoard.columns.findIndex(col => col.id === activeColumn.id);
      const newColumnIndex = newBoard.columns.findIndex(col => col.id === overColumn.id);

      const newColumns = arrayMove(newBoard.columns, oldColumnIndex, newColumnIndex);
      newBoard.columns = newColumns.map((col, index) => ({ ...col, order_index: index + 1 }));

      setBoard(newBoard);

      try {
        // Persist column order to backend
        await api.put(`/columns/order`, {
          boardId: newBoard.id,
          order: newBoard.columns.map(col => col.id),
        });
      } catch (err) {
        setError('Failed to update column order.');
        console.error(err);
        fetchBoard();
      }
    }

    setActiveCard(null);
    setActiveColumn(null);
    setIsDragging(false);
    console.log('🏁 Drag operation completed');
    
    // Force board refresh after drag is complete to ensure synchronization
    setTimeout(() => {
      fetchBoard();
    }, 500);
  };

  const handleCreateNewColumn = async (e: FormEvent) => {
    e.preventDefault();
    if (!newColumnTitle.trim()) {
      setError("Column title cannot be empty.");
      return;
    }
    setError(null);

    try {
      await api.post('/columns', { board_id: boardId, title: newColumnTitle });
      setNewColumnTitle("");
      setShowNewColumnModal(false);
      fetchBoard(); // Refresh the board data
    } catch (err) {
      setError("Failed to create column.");
      console.error(err);
    }
  }

  const handleEditCommentClick = (commentId: number, content: string) => {
    setEditingCommentId(commentId);
    setEditedCommentContent(content);
  };

  const handleUpdateComment = async (commentId: number, content: string) => {
    setError(null);
    try {
      await api.put(`/comments/${commentId}`, { content });
      setEditingCommentId(null);
      setEditedCommentContent("");
      fetchBoard(); // Refresh board to show updated comment
    } catch (err) {
      setError("Failed to update comment.");
      console.error(err);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (window.confirm("Are you sure you want to delete this comment?")) {
      setError(null);
      try {
        await api.delete(`/comments/${commentId}`);
        fetchBoard(); // Refresh board to remove deleted comment
      } catch (err) {
        setError("Failed to delete comment.");
        console.error(err);
      }
    }
  };

  const fetchAttachments = async (cardId: number) => {
    try {
      const response = await api.get(`/cards/${cardId}/attachments`);
      setAttachments(response.data);
    } catch (err) {
      console.error('Failed to fetch attachments:', err);
      setAttachments([]);
    }
  };

  const handleAttachmentUploaded = (attachment: IAttachment) => {
    setAttachments(prev => [attachment, ...prev]);
  };

  const handleAttachmentDeleted = (attachmentId: number) => {
    setAttachments(prev => prev.filter(att => att.id !== attachmentId));
  };

  const handleShareWithTechnician = useCallback(async () => {
    if (!board) return;
    
    setIsGeneratingLink(true);
    setError(null);
    
    try {
      const response = await api.post(`/boards/${board.id}/share`, {
        expiresIn: 24 * 60 * 60 * 1000 // 24 hours in milliseconds
      });
      
      const token = response.data.data.token;
      const shareLink = `${window.location.origin}/public/${token}`;
      setSharingLink(shareLink);
      setShowShareModal(true);
    } catch (err) {
      console.error('Error generating sharing link:', err);
      setError('Falha ao gerar link de compartilhamento');
    } finally {
      setIsGeneratingLink(false);
    }
  }, [board]);

  const handleWhatsAppShare = () => {
    if (!sharingLink || !board) return;
    
    const message = `🔧 *Atualização do Quadro: ${board.title}*\n\n` +
                   `Olá! Você pode acessar e atualizar este quadro através do link abaixo:\n\n` +
                   `${sharingLink}\n\n` +
                   `ℹ️ *Instruções:*\n` +
                   `1. Clique no link acima\n` +
                   `2. Informe seu nome e telefone\n` +
                   `3. Mova os cards conforme o andamento\n\n` +
                   `Este link é válido por 24 horas e permite apenas visualização e movimentação de cards.`;
    
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleCopyLink = async () => {
    if (!sharingLink) return;
    
    try {
      await navigator.clipboard.writeText(sharingLink);
      // You could add a toast notification here
      alert('Link copiado para a área de transferência!');
    } catch (err) {
      console.error('Failed to copy link:', err);
      alert('Falha ao copiar link');
    }
  };


  const boardStyle = board ? {
    backgroundImage: board.background_image ? `url(${board.background_image})` : undefined,
    backgroundColor: board.background_color || '#f8f9fa',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    minHeight: '100vh',
  } : {};

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div style={boardStyle}>
        <Container fluid className="p-4" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(5px)' }}>
          {loading && <Spinner animation="border" role="status"><span className="visually-hidden">Loading...</span></Spinner>}
          {error && <Alert variant="danger">{error}</Alert>}
          {board && (
            <>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h1 className="text-shadow mb-0">{board.title}</h1>
                <div className="d-flex gap-2">
                  <Button 
                    variant={showFilters ? "light" : "outline-light"}
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    🔍 Filtros
                  </Button>
                  <Button 
                    variant={swimlanesEnabled ? "primary" : "outline-primary"}
                    onClick={() => setSwimlanes(!swimlanesEnabled)}
                  >
                    📋 Swimlanes
                  </Button>
                  <Button 
                    variant={bulkActionMode ? "success" : "outline-success"}
                    onClick={() => {
                      setBulkActionMode(!bulkActionMode);
                      if (bulkActionMode) clearSelection();
                    }}
                  >
                    ☑️ Seleção
                  </Button>
                  <Button 
                    variant="outline-info" 
                    onClick={() => {
                      setActivityLogType('board');
                      setActivityLogId(board.id);
                      setShowActivityLog(true);
                    }}
                  >
                    📜 Atividades
                  </Button>
                  <Button 
                    variant="outline-warning" 
                    onClick={() => setShowAutomationsModal(true)}
                  >
                    🤖 Automações
                  </Button>
                  <Button variant="outline-secondary" onClick={() => console.log('Background picker')}>
                    🎨 Background
                  </Button>
                </div>
              </div>
              
              {/* Filtros */}
              {showFilters && (
                <Card className="mb-3" style={{ backgroundColor: 'rgba(255, 255, 255, 0.9)' }}>
                  <Card.Body>
                    <div className="row g-3">
                      <div className="col-md-3">
                        <Form.Control
                          type="text"
                          placeholder="Buscar cards..."
                          value={filters.search}
                          onChange={(e) => setFilters({...filters, search: e.target.value})}
                        />
                      </div>
                      <div className="col-md-2">
                        <Form.Select
                          value={filters.priority}
                          onChange={(e) => setFilters({...filters, priority: e.target.value})}
                        >
                          <option value="">Todas Prioridades</option>
                          <option value="critical">Crítica</option>
                          <option value="high">Alta</option>
                          <option value="medium">Média</option>
                          <option value="low">Baixa</option>
                        </Form.Select>
                      </div>
                      <div className="col-md-3">
                        <Form.Select
                          value={filters.assignee}
                          onChange={(e) => setFilters({...filters, assignee: e.target.value})}
                        >
                          <option value="">Todos Responsáveis</option>
                          {users.map(user => (
                            <option key={user.id} value={user.id}>
                              {user.name || user.email}
                            </option>
                          ))}
                        </Form.Select>
                      </div>
                      <div className="col-md-2">
                        <Button 
                          variant="outline-secondary" 
                          onClick={() => setFilters({priority: '', assignee: '', labels: [], search: ''})}
                        >
                          Limpar
                        </Button>
                      </div>
                      <div className="col-md-2">
                        <Button variant="outline-info" onClick={() => setShowTemplateModal(true)}>
                          📄 Templates
                        </Button>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              )}
              
              {/* Bulk Actions */}
              {bulkActionMode && selectedCards.size > 0 && (
                <Card className="mb-3 border-primary" style={{ backgroundColor: 'var(--card-bg)' }}>
                  <Card.Body>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span className="text-primary fw-bold me-3">
                        <strong>{selectedCards.size}</strong> cards selecionados
                      </span>
                      {board.columns.map(col => (
                        <Button 
                          key={col.id}
                          variant="primary"
                          size="sm"
                          onClick={() => bulkMoveCards(col.id)}
                        >
                          → {col.title}
                        </Button>
                      ))}
                      <Button variant="danger" size="sm" onClick={bulkDeleteCards}>
                        🗑️ Deletar
                      </Button>
                      <Button variant="secondary" size="sm" onClick={clearSelection}>
                        ✖ Limpar
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              )}
              <div className="d-flex gap-2 mb-3">
                <Button 
                  variant="primary" 
                  onClick={() => window.location.href = projectId ? `/projects/${projectId}` : '/projects'}
                  title="Voltar ao Dashboard do Projeto"
                >
                  ← Voltar
                </Button>
                <Button variant="success" onClick={handleShareWithTechnician} disabled={isGeneratingLink}>
                  {isGeneratingLink ? (
                    <span key="loading">
                      <Spinner size="sm" className="me-2" />
                      Gerando...
                    </span>
                  ) : (
                    <span key="default">
                      📱 Compartilhar com Técnico
                    </span>
                  )}
                </Button>
              </div>
              <div className="board-columns-row">
                <SortableContext items={board.columns.map(col => `column-${col.id}`)} strategy={horizontalListSortingStrategy}>
                  {board.columns.sort((a, b) => a.order_index - b.order_index).map(column => {
                    const filteredCards = filterCards(column.cards);
                    return (
                      <div key={column.id} className="board-column-wrapper">
                        <SortableColumn 
                          column={column} 
                          onAddCard={handleAddCardClick} 
                          onCardClick={handleCardClick} 
                          onDeleteColumn={handleDeleteColumn} 
                          onUpdateColumnTitle={handleUpdateColumnTitle}
                          isCollapsed={collapsedColumns.has(column.id)}
                          onToggleCollapse={() => toggleColumnCollapse(column.id)}
                          onEditColumn={() => {
                            setEditingColumn(column);
                            setShowColumnEditModal(true);
                          }}
                          filteredCards={filteredCards}
                          swimlanesEnabled={swimlanesEnabled}
                          users={users}
                          selectedCards={selectedCards}
                          onCardSelect={handleCardSelect}
                          bulkActionMode={bulkActionMode}
                          onQuickMove={handleQuickMove}
                          onDeleteCard={handleDeleteCard}
                        />
                      </div>
                    );
                  })}
                </SortableContext>
              </div>
            </>
          )}
        </Container>
      </div>

      <Modal show={showNewColumnModal} onHide={() => setShowNewColumnModal(false)} className="app-modal">
        <Modal.Header closeButton>
          <Modal.Title>Create New Column</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleCreateNewColumn}>
            <Form.Group className="mb-3">
              <Form.Label>Column Title</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter column title"
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                required
              />
            </Form.Group>
            <Button variant="primary" type="submit">
              Create Column
            </Button>
          </Form>
        </Modal.Body>
      </Modal>

            <Modal show={showNewCardModal} onHide={() => {
                setShowNewCardModal(false);
                setError(null);
            }} className="app-modal">
                <Modal.Header closeButton>
                    <Modal.Title>Create New Card</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {error && (
                        <Alert variant="danger" dismissible onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    )}
                    <Form onSubmit={handleCreateNewCard}>
                        <Form.Group className="mb-3">
                            <Form.Label>Card Title</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Enter card title"
                                value={newCardTitle}
                                onChange={(e) => setNewCardTitle(e.target.value)}
                                required
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Description (Optional)</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                placeholder="Enter card description"
                                value={newCardDescription}
                                onChange={(e) => setNewCardDescription(e.target.value)}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <PriorityPicker
                                priority={newCardPriority}
                                onPriorityChange={setNewCardPriority}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Responsável</Form.Label>
                            <Form.Select
                                value={newCardAssigneeId || ''}
                                onChange={(e) => setNewCardAssigneeId(e.target.value ? Number(e.target.value) : null)}
                            >
                                <option value="">Selecione um responsável</option>
                                {users.map(user => (
                                    <option key={user.id} value={user.id}>
                                        {user.name || user.email}
                                    </option>
                                ))}
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <DueDatePicker
                                dueDate={newCardDueDate}
                                onDateChange={setNewCardDueDate}
                            />
                        </Form.Group>
                        <Button 
                            variant="primary" 
                            type="submit"
                            disabled={isCreatingCard}
                        >
                            {isCreatingCard ? (
                                <>
                                    <Spinner 
                                        as="span" 
                                        animation="border" 
                                        size="sm" 
                                        role="status" 
                                        aria-hidden="true" 
                                        className="me-2"
                                    />
                                    Creating...
                                </>
                            ) : (
                                'Create Card'
                            )}
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>

            {/* Card Details Modal */}
            <Modal 
                show={showCardDetailsModal} 
                onHide={() => setShowCardDetailsModal(false)} 
                size="xl" 
                className="app-modal"
                centered
                scrollable
            >
                <Modal.Header closeButton className="pb-2">
                    <Form.Control
                        type="text"
                        value={selectedCard?.title || ''}
                        onChange={(e) => setSelectedCard(prev => prev ? { ...prev, title: e.target.value } : null)}
                        onBlur={handleUpdateCardDetails}
                        className="h5 border-0 fw-bold"
                        style={{ backgroundColor: 'transparent' }}
                    />
                </Modal.Header>
                <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                    {selectedCard && (
                        <div className="row">
                            <div className="col-md-8">
                                {/* Description */}
                                <div className="mb-4">
                                    <label className="form-label fw-bold text-muted small">DESCRIÇÃO</label>
                                    <RichTextEditor
                                        value={selectedCard?.description}
                                        onChange={(value) => {
                                            setSelectedCard(prev => prev ? { ...prev, description: value } : null);
                                            setTimeout(() => {
                                                handleUpdateCardDetails();
                                            }, 500);
                                        }}
                                        placeholder="Adicione uma descrição detalhada..."
                                        height={200}
                                    />
                                </div>
                                
                                {/* Comments Section */}
                                <div className="mb-4">
                                    <h6 className="fw-bold text-muted">COMENTÁRIOS</h6>
                                    <div className="comments-list mb-3" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                        {selectedCard.comments && selectedCard.comments.length > 0 ? (
                                            selectedCard.comments.map(comment => (
                                                <div key={comment.id} className="mb-2 p-2 border rounded bg-light">
                                                    <div className="d-flex justify-content-between align-items-start">
                                                        {editingCommentId === comment.id ? (
                                                            <Form.Control
                                                                as="textarea"
                                                                rows={1}
                                                                value={editedCommentContent}
                                                                onChange={(e) => setEditedCommentContent(e.target.value)}
                                                                onBlur={() => handleUpdateComment(comment.id, editedCommentContent)}
                                                                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                                                                autoFocus
                                                            />
                                                        ) : (
                                                            <p className="mb-0" onClick={() => handleEditCommentClick(comment.id, comment.content)} style={{ cursor: 'pointer' }}>{comment.content}</p>
                                                        )}
                                                        <Button variant="link" size="sm" className="text-danger p-0" onClick={() => handleDeleteComment(comment.id)}>×</Button>
                                                    </div>
                                                    <small className="text-muted">{new Date(comment.timestamp).toLocaleString()}</small>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-muted small">Nenhum comentário ainda.</p>
                                        )}
                                    </div>
                                    <Form onSubmit={handleAddComment}>
                                        <div className="input-group">
                                            <Form.Control
                                                type="text"
                                                placeholder="Adicionar comentário..."
                                                value={newCommentContent}
                                                onChange={(e) => setNewCommentContent(e.target.value)}
                                            />
                                            <Button variant="primary" type="submit">
                                                Enviar
                                            </Button>
                                        </div>
                                    </Form>
                                </div>
                            </div>
                            
                            <div className="col-md-4">
                                {/* Priority */}
                                <div className="mb-3">
                                    <label className="form-label fw-bold text-muted small">PRIORIDADE</label>
                                    <PriorityPicker
                                        priority={selectedCard?.priority || 'medium'}
                                        onPriorityChange={(priority) => {
                                            setSelectedCard(prev => prev ? { ...prev, priority } : null);
                                            setTimeout(() => {
                                                handleUpdateCardDetails();
                                            }, 500);
                                        }}
                                    />
                                </div>
                                
                                {/* Labels */}
                                {selectedCard.labels && selectedCard.labels.length > 0 && (
                                    <div className="mb-3">
                                        <label className="form-label fw-bold text-muted small">ETIQUETAS</label>
                                        <div className="d-flex flex-wrap gap-1">
                                            {selectedCard.labels.map(label => (
                                                <Label key={label.id} {...label} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {/* Actions */}
                                <div className="mb-3">
                                    <label className="form-label fw-bold text-muted small">AÇÕES</label>
                                    <div className="d-grid gap-2">
                                        <Button variant="outline-primary" size="sm" onClick={() => setShowLabelPicker(true)}>
                                            🏷️ Gerenciar Etiquetas
                                        </Button>
                                        <Button 
                                            variant="outline-info" 
                                            size="sm" 
                                            onClick={() => {
                                                setActivityLogType('card');
                                                setActivityLogId(selectedCard.id);
                                                setShowActivityLog(true);
                                            }}
                                        >
                                            📜 Ver Atividades
                                        </Button>
                                        <Button variant="outline-danger" size="sm" onClick={handleDeleteCard}>
                                            🗑️ Excluir Card
                                        </Button>
                                    </div>
                                </div>
                                
                                {/* Attachments */}
                                <div className="mb-3">
                                    <label className="form-label fw-bold text-muted small">ANEXOS</label>
                                    <FileUpload
                                        cardId={selectedCard.id}
                                        onUploadComplete={handleAttachmentUploaded}
                                    />
                                    <AttachmentList
                                        cardId={selectedCard.id}
                                        attachments={attachments}
                                        onDelete={handleAttachmentDeleted}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </Modal.Body>
            </Modal>

            <DragOverlay>
                {activeCard ? (
                    <Card className="shadow-lg">
                        <Card.Body>{activeCard.title}</Card.Body>
                    </Card>
                ) : activeColumn ? (
                    <Column 
                        column={activeColumn} 
                        onAddCard={handleAddCardClick} 
                        onCardClick={handleCardClick} 
                        onDeleteColumn={handleDeleteColumn} 
                        onUpdateColumnTitle={handleUpdateColumnTitle} 
                        isOverlay={true} 
                        dragHandleProps={{}}
                        onQuickMove={handleQuickMove}
                        onDeleteCard={handleDeleteCard}
                    />
                ) : null}
            </DragOverlay>

            {/* Label Picker Modal */}
            {selectedCard && board && (
                <LabelPicker
                    show={showLabelPicker}
                    onHide={() => setShowLabelPicker(false)}
                    boardId={board.id}
                    cardId={selectedCard.id}
                    currentLabels={selectedCard.labels || []}
                    onLabelsChange={() => {
                        fetchBoard(); // Refresh board to update labels
                    }}
                />
            )}

            {/* Activity Log Modal */}
            <ActivityLog
                show={showActivityLog}
                onHide={() => setShowActivityLog(false)}
                boardId={activityLogType === 'board' ? activityLogId || undefined : undefined}
                cardId={activityLogType === 'card' ? activityLogId || undefined : undefined}
                title={
                    activityLogType === 'board' 
                        ? `Atividades do Board "${board?.title || ''}"` 
                        : `Atividades do Card "${selectedCard?.title || ''}"`
                }
            />

            {/* Share Modal */}
            {/* Column Edit Modal */}
            <Modal show={showColumnEditModal} onHide={() => setShowColumnEditModal(false)} className="app-modal">
                <Modal.Header closeButton>
                    <Modal.Title>Editar Coluna</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {editingColumn && (
                        <Form>
                            <Form.Group className="mb-3">
                                <Form.Label>Título da Coluna</Form.Label>
                                <Form.Control
                                    type="text"
                                    value={editingColumn.title}
                                    onChange={(e) => setEditingColumn({...editingColumn, title: e.target.value})}
                                />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Limite WIP (Work In Progress)</Form.Label>
                                <Form.Control
                                    type="number"
                                    placeholder="Deixe vazio para sem limite"
                                    value={editingColumn.wip_limit || ''}
                                    onChange={(e) => setEditingColumn({
                                        ...editingColumn, 
                                        wip_limit: e.target.value ? parseInt(e.target.value) : null
                                    })}
                                />
                                <Form.Text className="text-muted">
                                    Define o número máximo de cards permitidos nesta coluna. 
                                    A coluna ficará vermelha quando exceder o limite.
                                </Form.Text>
                            </Form.Group>
                            <div className="d-flex gap-2">
                                <Button 
                                    variant="primary" 
                                    onClick={() => {
                                        handleUpdateColumnTitle(editingColumn.id, editingColumn.title);
                                        setShowColumnEditModal(false);
                                    }}
                                >
                                    Salvar
                                </Button>
                                <Button variant="secondary" onClick={() => setShowColumnEditModal(false)}>
                                    Cancelar
                                </Button>
                            </div>
                        </Form>
                    )}
                </Modal.Body>
            </Modal>

            {/* Template Modal */}
            <Modal show={showTemplateModal} onHide={() => setShowTemplateModal(false)} size="lg" className="app-modal">
                <Modal.Header closeButton>
                    <Modal.Title>📄 Templates de Cards</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="row">
                        <div className="col-md-6">
                            <h6>Templates Salvos</h6>
                            <div className="list-group">
                                {templates.map(template => (
                                    <div key={template.id} className="list-group-item d-flex justify-content-between align-items-center">
                                        <div>
                                            <strong>{template.name}</strong>
                                            <br />
                                            <small className="text-muted">{template.title}</small>
                                        </div>
                                        <div>
                                            <Button 
                                                size="sm" 
                                                variant="outline-primary"
                                                onClick={() => {
                                                    setSelectedTemplate(template);
                                                    setNewCardTitle(template.title);
                                                    setNewCardDescription(template.description || '');
                                                    setNewCardPriority(template.priority);
                                                    setShowTemplateModal(false);
                                                    setShowNewCardModal(true);
                                                }}
                                            >
                                                Usar
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant="outline-danger" 
                                                className="ms-1"
                                                onClick={() => {/* Delete template */}}
                                            >
                                                🗑️
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {templates.length === 0 && (
                                    <p className="text-muted">Nenhum template salvo ainda.</p>
                                )}
                            </div>
                        </div>
                        <div className="col-md-6">
                            <h6>Criar Novo Template</h6>
                            <Form>
                                <Form.Group className="mb-2">
                                    <Form.Control
                                        size="sm"
                                        placeholder="Nome do template"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-2">
                                    <Form.Control
                                        size="sm"
                                        placeholder="Título padrão do card"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-2">
                                    <Form.Control
                                        as="textarea"
                                        rows={2}
                                        size="sm"
                                        placeholder="Descrição padrão"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-2">
                                    <Form.Select size="sm">
                                        <option value="medium">Média</option>
                                        <option value="low">Baixa</option>
                                        <option value="high">Alta</option>
                                        <option value="critical">Crítica</option>
                                    </Form.Select>
                                </Form.Group>
                                <Button size="sm" variant="success">
                                    💾 Salvar Template
                                </Button>
                            </Form>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>

            <Modal show={showShareModal} onHide={() => setShowShareModal(false)} className="app-modal">
                <Modal.Header closeButton>
                    <Modal.Title>
                        📱 Compartilhar com Técnico
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {isGeneratingLink ? (
                        <div className="text-center" key="modal-loading">
                            <Spinner animation="border" role="status" className="me-2" />
                            <span>Gerando link de compartilhamento...</span>
                        </div>
                    ) : sharingLink ? (
                        <>
                            <div className="alert alert-info">
                                <strong>✅ Link gerado com sucesso!</strong><br />
                                Este link permite que técnicos externos visualizem e movam cards entre colunas. 
                                Válido por 24 horas.
                            </div>
                            
                            <div className="mb-3">
                                <label className="form-label fw-bold">Link de Acesso:</label>
                                <div className="input-group">
                                    <input 
                                        type="text" 
                                        className="form-control" 
                                        value={sharingLink} 
                                        readOnly 
                                    />
                                    <Button 
                                        variant="outline-secondary" 
                                        onClick={handleCopyLink}
                                    >
                                        📋 Copiar
                                    </Button>
                                </div>
                            </div>

                            <div className="d-grid gap-2">
                                <Button 
                                    variant="success" 
                                    size="lg" 
                                    onClick={handleWhatsAppShare}
                                    className="d-flex align-items-center justify-content-center gap-2"
                                >
                                    <span>📱</span>
                                    Enviar via WhatsApp
                                </Button>
                            </div>

                            <div className="mt-3">
                                <small className="text-muted">
                                    <strong>Como funciona:</strong><br />
                                    1. O técnico clica no link<br />
                                    2. Informa nome e telefone<br />
                                    3. Pode visualizar e mover cards<br />
                                    4. Todas as ações são registradas
                                </small>
                            </div>
                        </>
                    ) : (
                        <div className="alert alert-warning">
                            Falha ao gerar link. Tente novamente.
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowShareModal(false)}>
                        Fechar
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Automations Modal */}
            {board && (
                <AutomationsManager
                    show={showAutomationsModal}
                    onHide={() => setShowAutomationsModal(false)}
                    boardId={board.id}
                />
            )}
        </DndContext>
    );
};

export default BoardPage;