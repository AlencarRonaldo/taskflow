import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Button, Alert, ListGroup, Modal, Form, Badge } from 'react-bootstrap';
import { api } from '../lib/api';
import { WorkloadAnalytics } from '../components/WorkloadAnalytics';

interface Board {
    id: number;
    title: string;
    allTasksCompleted: boolean;
    due_date?: string;
    created_at?: string;
    responsible?: string;
    last_updated_by?: number;
    last_updated_at?: string;
    last_updated_user_name?: string;
    last_updated_user_email?: string;
    project_id?: number;
}

const Dashboard = () => {
    const [boards, setBoards] = useState<Board[]>([]);
    const [error, setError] = useState<string | null>(null);

    const formatDate = (dateString?: string) => {
        if (!dateString) return null;
        
        // Extrair apenas a parte da data (YYYY-MM-DD) para evitar problemas de fuso horário
        const datePart = dateString.includes('T') ? dateString.split('T')[0] : dateString.split(' ')[0];
        const [year, month, day] = datePart.split('-');
        
        // Criar data local sem problemas de fuso horário
        const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        
        return localDate.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatDateTime = (dateString?: string) => {
        if (!dateString) return null;
        return new Date(dateString).toLocaleString('pt-BR');
    };

    const getLastUpdatedInfo = (board: Board) => {
        if (!board.last_updated_at) {
            return null;
        }
        
        // Use o nome completo se disponível, senão use a parte antes do @ do email
        let userName = 'Usuário';
        if (board.last_updated_user_name) {
            userName = board.last_updated_user_name;
        } else if (board.last_updated_user_email) {
            userName = board.last_updated_user_email.split('@')[0];
        }
        
        const updateDate = formatDateTime(board.last_updated_at);
        
        return {
            userName,
            updateDate
        };
    };

    const isOverdue = (dueDateString?: string) => {
        if (!dueDateString) return false;
        
        // Extrair apenas a parte da data para evitar problemas de fuso horário
        const datePart = dueDateString.includes('T') ? dueDateString.split('T')[0] : dueDateString.split(' ')[0];
        const [year, month, day] = datePart.split('-');
        const dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        const today = new Date();
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        
        return dueDate < todayOnly;
    };

    const isToday = (dueDateString?: string) => {
        if (!dueDateString) return false;
        
        // Extrair apenas a parte da data para evitar problemas de fuso horário
        const datePart = dueDateString.includes('T') ? dueDateString.split('T')[0] : dueDateString.split(' ')[0];
        const [year, month, day] = datePart.split('-');
        const dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        const today = new Date();
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        
        return dueDate.getTime() === todayOnly.getTime();
    };

    const isThisWeek = (dueDateString?: string) => {
        if (!dueDateString) return false;
        
        // Extrair apenas a parte da data para evitar problemas de fuso horário
        const datePart = dueDateString.includes('T') ? dueDateString.split('T')[0] : dueDateString.split(' ')[0];
        const [year, month, day] = datePart.split('-');
        const dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        const today = new Date();
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const weekFromNow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
        
        return dueDate > todayOnly && dueDate <= weekFromNow;
    };

    const groupBoardsByDate = (boards: Board[]) => {
        const emAtendimento = boards
            .filter(board => !board.allTasksCompleted)
            .sort((a, b) => {
                // Primeiro: boards com data de vencimento (ordem crescente)
                if (a.due_date && b.due_date) {
                    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
                }
                // Segundo: boards com data vêm antes dos sem data
                if (a.due_date && !b.due_date) return -1;
                if (!a.due_date && b.due_date) return 1;
                // Terceiro: boards sem data ordenados por data de criação (mais recentes primeiro)
                if (a.created_at && b.created_at) {
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                }
                return 0;
            });

        const concluidos = boards
            .filter(board => board.allTasksCompleted)
            .sort((a, b) => {
                if (a.last_updated_at && b.last_updated_at) {
                    return new Date(b.last_updated_at).getTime() - new Date(a.last_updated_at).getTime();
                }
                return 0;
            });

        return { emAtendimento, concluidos };
    };

    const [showModal, setShowModal] = useState(false);
    const [newBoardTitle, setNewBoardTitle] = useState("");
    const [newBoardDueDate, setNewBoardDueDate] = useState("");
    const [newBoardResponsible, setNewBoardResponsible] = useState("");

    // Edit board state
    const [editingBoard, setEditingBoard] = useState<Board | null>(null);
    const [editBoardTitle, setEditBoardTitle] = useState("");
    const [editBoardDueDate, setEditBoardDueDate] = useState("");
    const [editBoardResponsible, setEditBoardResponsible] = useState("");

    // Delete board state
    const [deletingBoard, setDeletingBoard] = useState<Board | null>(null);

    const handleCloseModal = () => setShowModal(false);
    const handleShowModal = () => setShowModal(true);

    const fetchBoards = async () => {
        setError(null);
        try {
            const response = await api.get('/boards');
            setBoards(response.data.data);
        } catch (err) {
            setError('Failed to fetch boards.');
        }
    };

    useEffect(() => {
        fetchBoards();
    }, []);

    const handleCreateBoard = async (e: FormEvent) => {
        e.preventDefault();
        if (!newBoardTitle.trim()) {
            setError("Título do quadro não pode estar vazio.");
            return;
        }
        if (!newBoardResponsible.trim()) {
            setError("Nome do responsável é obrigatório.");
            return;
        }
        setError(null);

        try {
            const boardData = { 
                title: newBoardTitle,
                due_date: newBoardDueDate || null,
                responsible: newBoardResponsible.trim()
            };
            const response = await api.post('/boards', boardData);
            const boardId = response.data.data.id;

            // Default columns are created automatically by the backend

            setNewBoardTitle("");
            setNewBoardDueDate("");
            setNewBoardResponsible("");
            handleCloseModal();
            fetchBoards(); // Refresh the board list
        } catch (err) {
            setError("Falha ao criar quadro ou colunas.");
        }
    };

    const openEditBoard = (board: Board) => {
        setEditingBoard(board);
        setEditBoardTitle(board.title);
        setEditBoardDueDate(board.due_date ? board.due_date.split('T')[0] : "");
        setEditBoardResponsible(board.responsible || "");
    };

    const handleUpdateBoardTitle = async (e: FormEvent) => {
        e.preventDefault();
        if (!editingBoard) return;
        const trimmed = editBoardTitle.trim();
        if (!trimmed) {
            setError("Título do quadro não pode estar vazio.");
            return;
        }
        if (!editBoardResponsible.trim()) {
            setError("Nome do responsável é obrigatório.");
            return;
        }
        setError(null);
        try {
            const boardData = {
                title: trimmed,
                due_date: editBoardDueDate || null,
                responsible: editBoardResponsible.trim()
            };
            await api.put(`/boards/${editingBoard.id}`, boardData);
            setEditingBoard(null);
            setEditBoardTitle("");
            setEditBoardDueDate("");
            setEditBoardResponsible("");
            fetchBoards();
        } catch (err) {
            setError("Falha ao atualizar quadro.");
        }
    };

    const openDeleteBoard = (board: Board) => {
        setDeletingBoard(board);
    };

    const renderBoardGroup = (title: string, boards: Board[], badgeVariant?: string, addSpacing: boolean = false, hideActions: boolean = false, isCompleted: boolean = false) => {
        if (boards.length === 0) return null;
        
        const listGroupClass = addSpacing ? "board-list spaced-cards" : "board-list";
        
        return (
            <div className="mb-4">
                <h5 className="mb-3">
                    {title} 
                    <Badge bg={badgeVariant || "secondary"} className="ms-2">{boards.length}</Badge>
                </h5>
                <ListGroup className={listGroupClass}>
                    {boards.map(board => (
                        <ListGroup.Item key={board.id} className="board-list-item d-flex justify-content-between align-items-center">
                            <div className="flex-grow-1">
                                <Link to={board.project_id ? `/projects/${board.project_id}/boards/${board.id}` : `/boards/${board.id}`} className="text-decoration-none">
                                    <div className="fw-bold">{board.title}</div>
                                    <div className="d-flex flex-column">
                                        {board.responsible && (
                                            <small className="text-muted d-block">
                                                Responsável: <strong>{board.responsible}</strong>
                                            </small>
                                        )}
                                        {board.due_date && (
                                            <small className={`text-muted d-block ${isOverdue(board.due_date) ? 'text-danger' : ''}`}>
                                                Prazo: {formatDate(board.due_date)}
                                                {isOverdue(board.due_date) && ' (Atrasado)'}
                                            </small>
                                        )}
                                        {(() => {
                                            const lastUpdated = getLastUpdatedInfo(board);
                                            if (lastUpdated) {
                                                return (
                                                    <small className="text-muted">
                                                        {isCompleted ? 'Concluído por:' : 'Atualizado por:'} <strong>{lastUpdated.userName}</strong> em {lastUpdated.updateDate}
                                                    </small>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                </Link>
                            </div>
                            <div className="d-flex align-items-center ms-2" style={{ gap: '0.5rem' }}>
                                {board.allTasksCompleted && (
                                    <Badge bg="success">Concluído</Badge>
                                )}
                                {isOverdue(board.due_date) && !board.allTasksCompleted && (
                                    <Badge bg="danger">Atrasado</Badge>
                                )}
                                {isToday(board.due_date) && !board.allTasksCompleted && (
                                    <Badge bg="warning" text="dark">Hoje</Badge>
                                )}
                                {!hideActions && (
                                    <>
                                        <Button variant="outline-secondary" size="sm" onClick={() => openEditBoard(board)}>Editar</Button>
                                        <Button variant="outline-danger" size="sm" onClick={() => openDeleteBoard(board)}>Excluir</Button>
                                    </>
                                )}
                            </div>
                        </ListGroup.Item>
                    ))}
                </ListGroup>
            </div>
        );
    };

    const handleDeleteBoard = async () => {
        if (!deletingBoard) return;
        setError(null);
        try {
            await api.delete(`/boards/${deletingBoard.id}`);
            setDeletingBoard(null);
            fetchBoards();
        } catch (err) {
            setError("Failed to delete board.");
        }
    };

    return (
        <>
            <Container className="dashboard-container">
                <Row className="align-items-center mb-0 py-3">
                    <Col>
                        <h1>Dashboard</h1>
                    </Col>
                    <Col xs="auto" className="d-flex gap-2">
                        <Button variant="outline-primary" as={Link} to="/calendar">
                            📅 Vista Calendário
                        </Button>
                        <Button variant="outline-info" as={Link} to="/timeline">
                            ⏱️ Vista Timeline
                        </Button>
                        <Button variant="outline-secondary" as={Link} to="/grid">
                            📋 Vista Tabela
                        </Button>
                        <Button variant="primary" onClick={handleShowModal}>+ Novo Compromisso</Button>
                    </Col>
                </Row>
                {error && <Alert variant="danger">{error}</Alert>}
                
                {/* Analytics Section */}
                <WorkloadAnalytics />
                {boards.length > 0 ? (() => {
                    const groupedBoards = groupBoardsByDate(boards);
                    return (
                        <div>
                            {renderBoardGroup("Em Atendimento", groupedBoards.emAtendimento, "primary")}
                            {renderBoardGroup("Concluídos", groupedBoards.concluidos, "success", true, true, true)}
                        </div>
                    );
                })() : (
                    <p>Nenhum quadro encontrado. Crie um para começar!</p>
                )}
            </Container>

            <Modal 
                show={showModal} 
                onHide={handleCloseModal} 
                className="app-modal"
                centered
                backdrop={true}
                keyboard={true}
            >
                <Modal.Header closeButton>
                    <Modal.Title>Criar Novo Quadro</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleCreateBoard}>
                        <Form.Group className="mb-3">
                            <Form.Label>Título do Quadro</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Digite o título do quadro"
                                value={newBoardTitle}
                                onChange={(e) => setNewBoardTitle(e.target.value)}
                                required
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Responsável</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Nome do responsável pelo quadro"
                                value={newBoardResponsible}
                                onChange={(e) => setNewBoardResponsible(e.target.value)}
                                required
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Data de Execução (Opcional)</Form.Label>
                            <Form.Control
                                type="date"
                                value={newBoardDueDate}
                                onChange={(e) => setNewBoardDueDate(e.target.value)}
                            />
                        </Form.Group>
                        <Button variant="primary" type="submit" className="mt-3">
                            Criar Quadro
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>

            {/* Edit Board Modal */}
            <Modal 
                show={!!editingBoard} 
                onHide={() => setEditingBoard(null)} 
                className="app-modal"
                centered
                backdrop="static"
                keyboard={false}
            >
                <Modal.Header closeButton>
                    <Modal.Title>Editar Board</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleUpdateBoardTitle}>
                        <Form.Group className="mb-3">
                            <Form.Label>Título do Board</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Digite o novo título"
                                value={editBoardTitle}
                                onChange={(e) => setEditBoardTitle(e.target.value)}
                                required
                                autoFocus
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Responsável</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Nome do responsável pelo quadro"
                                value={editBoardResponsible}
                                onChange={(e) => setEditBoardResponsible(e.target.value)}
                                required
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Data de Execução (Opcional)</Form.Label>
                            <Form.Control
                                type="date"
                                value={editBoardDueDate}
                                onChange={(e) => setEditBoardDueDate(e.target.value)}
                            />
                        </Form.Group>
                        <Button variant="primary" type="submit" className="mt-3">
                            Salvar Alterações
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>

            {/* Delete Board Confirm Modal */}
            <Modal 
                show={!!deletingBoard} 
                onHide={() => setDeletingBoard(null)} 
                className="app-modal"
                centered
                backdrop="static"
                keyboard={false}
            >
                <Modal.Header closeButton>
                    <Modal.Title>⚠️ Confirmar Exclusão</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {deletingBoard && (
                        <>Tem certeza que deseja excluir o board "{deletingBoard.title}"? Essa ação removerá também suas colunas e cartões.</>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setDeletingBoard(null)}>Cancelar</Button>
                    <Button variant="danger" onClick={handleDeleteBoard}>Excluir</Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default Dashboard;
