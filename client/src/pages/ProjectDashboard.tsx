import React, { useEffect, useState, FormEvent } from 'react';
import { Container, Row, Col, Button, Spinner, Alert, Badge, Modal, Form, ListGroup } from 'react-bootstrap';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { api } from '../lib/api';
import { FaPlus } from 'react-icons/fa';
import { ProjectMetrics } from '../components/ProjectMetrics';

// Interface de Board detalhada, similar ao Dashboard.tsx
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
}

const ProjectDashboard: React.FC = () => {
    const { currentProject, loading: projectLoading, error: projectError } = useProject();
    const navigate = useNavigate();
    const { projectId } = useParams();
    
    const [boards, setBoards] = useState<Board[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Estados para modais
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newBoardTitle, setNewBoardTitle] = useState("");
    const [newBoardDueDate, setNewBoardDueDate] = useState("");
    const [newBoardResponsible, setNewBoardResponsible] = useState("");

    const [editingBoard, setEditingBoard] = useState<Board | null>(null);
    const [editBoardTitle, setEditBoardTitle] = useState("");
    const [editBoardDueDate, setEditBoardDueDate] = useState("");
    const [editBoardResponsible, setEditBoardResponsible] = useState("");

    const [deletingBoard, setDeletingBoard] = useState<Board | null>(null);

    // Funções auxiliares de formatação e lógica de data (copiadas do Dashboard.tsx)
    const formatDate = (dateString?: string) => {
        if (!dateString) return null;
        
        const date = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const diffTime = date.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Hoje';
        if (diffDays === 1) return 'Amanhã';
        if (diffDays === -1) return 'Ontem';
        if (diffDays < 0) return `${Math.abs(diffDays)} dias atrás`;
        if (diffDays <= 7) return `Em ${diffDays} dias`;
        
        return date.toLocaleDateString('pt-BR', { 
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
        if (!board.last_updated_at) return null;
        let userName = 'Usuário';
        if (board.last_updated_user_name) {
            userName = board.last_updated_user_name;
        } else if (board.last_updated_user_email) {
            userName = board.last_updated_user_email.split('@')[0];
        }
        const updateDate = formatDateTime(board.last_updated_at);
        return { userName, updateDate };
    };

    const isOverdue = (dueDateString?: string) => {
        if (!dueDateString) return false;
        const datePart = dueDateString.includes('T') ? dueDateString.split('T')[0] : dueDateString.split(' ')[0];
        const [year, month, day] = datePart.split('-');
        const dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const today = new Date();
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        return dueDate < todayOnly;
    };

    // Função para categorizar boards por prazo de execução
    const categorizeBoardsByDeadline = (boards: Board[]) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        
        const endOfWeek = new Date(today);
        endOfWeek.setDate(today.getDate() + 7);
        
        const endOfNextWeek = new Date(today);
        endOfNextWeek.setDate(today.getDate() + 14);
        
        const endOfMonth = new Date(today);
        endOfMonth.setMonth(today.getMonth() + 1);

        const categories = {
            hoje: [],
            amanha: [],
            estaSemana: [],
            proximaSemana: [],
            esteMes: [],
            semPrazo: []
        };

        boards.forEach(board => {
            if (!board.due_date) {
                categories.semPrazo.push(board);
                return;
            }

            const dueDate = new Date(board.due_date);
            dueDate.setHours(0, 0, 0, 0);

            if (dueDate.getTime() === today.getTime()) {
                categories.hoje.push(board);
            } else if (dueDate.getTime() === tomorrow.getTime()) {
                categories.amanha.push(board);
            } else if (dueDate <= endOfWeek) {
                categories.estaSemana.push(board);
            } else if (dueDate <= endOfNextWeek) {
                categories.proximaSemana.push(board);
            } else {
                categories.esteMes.push(board);
            }
        });

        // Ordenar cada categoria por data
        Object.keys(categories).forEach(key => {
            categories[key].sort((a, b) => {
                if (a.due_date && b.due_date) {
                    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
                }
                return 0;
            });
        });

        return categories;
    };

    // Função de agrupamento por prazo de execução
    const groupBoardsByDeadline = (boards: Board[]) => {
        const emAtendimento = boards.filter(board => !board.allTasksCompleted);
        const concluidos = boards.filter(board => board.allTasksCompleted);

        const emAtendimentoCategorias = categorizeBoardsByDeadline(emAtendimento);
        const concluidosCategorias = categorizeBoardsByDeadline(concluidos);

        return { emAtendimentoCategorias, concluidosCategorias };
    };

    const loadBoards = async () => {
        if (!projectId) return;
        setLoading(true);
        setError(null);
        try {
            const response = await api.get(`/boards?project_id=${projectId}`);
            const boardsData = response.data?.data && Array.isArray(response.data.data) ? response.data.data : [];
            setBoards(boardsData);
        } catch (error) {
            console.error('Error loading boards:', error);
            setError('Falha ao carregar os boards do projeto.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentProject && projectId) {
            loadBoards();
        }
    }, [currentProject, projectId]);

    // Funções de CRUD para boards (adaptadas do Dashboard.tsx)
    const handleCreateBoard = async (e: FormEvent) => {
        e.preventDefault();
        if (!newBoardTitle.trim() || !newBoardResponsible.trim()) {
            setError("Título e Responsável são obrigatórios.");
            return;
        }
        setError(null);
        try {
            const boardData = { 
                title: newBoardTitle,
                due_date: newBoardDueDate || null,
                responsible: newBoardResponsible.trim(),
                project_id: projectId
            };
            await api.post('/boards', boardData);
            setShowCreateModal(false);
            setNewBoardTitle("");
            setNewBoardDueDate("");
            setNewBoardResponsible("");
            loadBoards();
        } catch (err) {
            setError("Falha ao criar o quadro.");
        }
    };

    const openEditBoard = (board: Board) => {
        setEditingBoard(board);
        setEditBoardTitle(board.title);
        setEditBoardDueDate(board.due_date ? board.due_date.split('T')[0] : "");
        setEditBoardResponsible(board.responsible || "");
    };

    const handleUpdateBoard = async (e: FormEvent) => {
        e.preventDefault();
        if (!editingBoard || !editBoardTitle.trim() || !editBoardResponsible.trim()) {
            setError("Título e Responsável são obrigatórios.");
            return;
        }
        setError(null);
        try {
            const boardData = {
                title: editBoardTitle.trim(),
                due_date: editBoardDueDate || null,
                responsible: editBoardResponsible.trim()
            };
            await api.put(`/boards/${editingBoard.id}`, boardData);
            setEditingBoard(null);
            loadBoards();
        } catch (err) {
            setError("Falha ao atualizar o quadro.");
        }
    };

    const openDeleteBoard = (board: Board) => {
        setDeletingBoard(board);
    };

    const handleDeleteBoard = async () => {
        if (!deletingBoard) return;
        setError(null);
        try {
            await api.delete(`/boards/${deletingBoard.id}`);
            setDeletingBoard(null);
            loadBoards();
        } catch (err) {
            setError("Falha ao excluir o quadro.");
        }
    };

    // Função de renderização de grupo (copiada do Dashboard.tsx)

    const renderBoardGroup = (title: string, boards: Board[], badgeVariant?: string, addSpacing: boolean = false, hideActions: boolean = false, isCompleted: boolean = false) => {
        if (boards.length === 0) return null;
        return (
            <div className="mb-4">
                <h5 className="mb-3">
                    {title} 
                    <Badge bg={badgeVariant || "secondary"} className="ms-2">{boards.length}</Badge>
                </h5>
                <ListGroup className={addSpacing ? "board-list spaced-cards" : "board-list"}>
                    {boards.map(board => (
                        <ListGroup.Item key={board.id} className="board-list-item d-flex justify-content-between align-items-center">
                            <div className="flex-grow-1">
                                <Link to={`/projects/${projectId}/boards/${board.id}`} className="text-decoration-none">
                                    <div className="fw-bold">{board.title}</div>
                                    <div className="d-flex flex-column">
                                        {board.responsible && <small className="text-muted d-block">Responsável: <strong>{board.responsible}</strong></small>}
                                        {board.due_date && <small className={`text-muted d-block ${isOverdue(board.due_date) ? 'text-danger' : ''}`}>Prazo: {formatDate(board.due_date)}{isOverdue(board.due_date) && ' (Atrasado)'}</small>}
                                        {(() => {
                                            const lastUpdated = getLastUpdatedInfo(board);
                                            if (lastUpdated) {
                                                return <small className="text-muted">{isCompleted ? 'Concluído por:' : 'Atualizado por:'} <strong>{lastUpdated.userName}</strong> em {lastUpdated.updateDate}</small>;
                                            }
                                            return null;
                                        })()}
                                    </div>
                                </Link>
                            </div>
                            <div className="d-flex align-items-center ms-2" style={{ gap: '0.5rem' }}>
                                {board.allTasksCompleted && <Badge bg="success">Concluído</Badge>}
                                {isOverdue(board.due_date) && !board.allTasksCompleted && <Badge bg="danger">Atrasado</Badge>}
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

    // Renderização do componente
    if (projectLoading) return <Container className="text-center py-5"><Spinner animation="border" /></Container>;
    if (projectError) return <Container className="text-center py-5"><Alert variant="danger">{projectError}</Alert></Container>;
    if (!currentProject) return <Container className="text-center py-5"><h3>Projeto não encontrado</h3></Container>;

    return (
        <>
            <Container fluid className="py-4">
                {/* Cabeçalho do Projeto */}
                <Row className="mb-4">
                    <Col>
                        <div className="d-flex align-items-center mb-3">
                            <div className="me-3" style={{ width: '8px', height: '40px', backgroundColor: currentProject.color || '#007bff', borderRadius: '4px' }} />
                            <div>
                                <h1 className="display-6 mb-0">{currentProject.name}</h1>
                                {currentProject.description && <p className="text-muted mb-0">{currentProject.description}</p>}
                            </div>
                        </div>
                        <div className="d-flex gap-2 flex-wrap mb-3">
                            <Button variant="outline-primary" onClick={() => navigate(`/projects/${projectId}/calendar`)}>📅 Calendário</Button>
                            <Button variant="outline-secondary" onClick={() => navigate('/projects')}>← Todos os Projetos</Button>
                        </div>
                    </Col>
                </Row>

                {/* Métricas do Projeto */}
                <ProjectMetrics projectId={currentProject.id} projectName={currentProject.name} projectColor={currentProject.color || '#007bff'} />

                {/* Seção de Boards */}
                <Row className="mb-4">
                    <Col>
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h3>📋 Boards do Projeto</h3>
                            <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}><FaPlus className="me-2" />Novo Board</Button>
                        </div>
                        {error && <Alert variant="danger">{error}</Alert>}
                        {loading ? (
                            <div className="text-center py-4"><Spinner animation="border" /></div>
                        ) : boards.length > 0 ? (() => {
                            const groupedBoards = groupBoardsByDeadline(boards);
                            return (
                                <div>
                                    {/* Boards Em Atendimento por Prazo */}
                                    {groupedBoards.emAtendimentoCategorias.hoje.length > 0 && 
                                        renderBoardGroup("🔥 Hoje", groupedBoards.emAtendimentoCategorias.hoje, "danger")}
                                    {groupedBoards.emAtendimentoCategorias.amanha.length > 0 && 
                                        renderBoardGroup("⚡ Amanhã", groupedBoards.emAtendimentoCategorias.amanha, "warning")}
                                    {groupedBoards.emAtendimentoCategorias.estaSemana.length > 0 && 
                                        renderBoardGroup("📅 Esta Semana", groupedBoards.emAtendimentoCategorias.estaSemana, "info")}
                                    {groupedBoards.emAtendimentoCategorias.proximaSemana.length > 0 && 
                                        renderBoardGroup("📆 Próxima Semana", groupedBoards.emAtendimentoCategorias.proximaSemana, "primary")}
                                    {groupedBoards.emAtendimentoCategorias.esteMes.length > 0 && 
                                        renderBoardGroup("🗓️ Este Mês", groupedBoards.emAtendimentoCategorias.esteMes, "secondary")}
                                    {groupedBoards.emAtendimentoCategorias.semPrazo.length > 0 && 
                                        renderBoardGroup("📝 Sem Prazo", groupedBoards.emAtendimentoCategorias.semPrazo, "outline-secondary")}
                                    
                                    {/* Boards Concluídos */}
                                    {renderBoardGroup("✅ Concluídos", boards.filter(board => board.allTasksCompleted), "success", true, true, true)}
                                </div>
                            );
                        })() : (
                            <Alert variant="info">Nenhum board encontrado para este projeto. Crie um para começar!</Alert>
                        )}
                    </Col>
                </Row>
            </Container>

            {/* Modal de Criar Board */}
            <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} centered className="app-modal" backdrop={true} keyboard={true}>
                <Modal.Header closeButton>
                    <Modal.Title>Criar Novo Board</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleCreateBoard}>
                        <Form.Group className="mb-3">
                            <Form.Label>Título do Board</Form.Label>
                            <Form.Control type="text" value={newBoardTitle} onChange={(e) => setNewBoardTitle(e.target.value)} required />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Responsável</Form.Label>
                            <Form.Control type="text" value={newBoardResponsible} onChange={(e) => setNewBoardResponsible(e.target.value)} required />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Data de Vencimento (Opcional)</Form.Label>
                            <Form.Control type="date" value={newBoardDueDate} onChange={(e) => setNewBoardDueDate(e.target.value)} />
                        </Form.Group>
                        <Button variant="primary" type="submit" className="mt-3">Criar</Button>
                    </Form>
                </Modal.Body>
            </Modal>

            {/* Modal de Editar Board */}
            <Modal show={!!editingBoard} onHide={() => setEditingBoard(null)} centered className="app-modal" backdrop="static" keyboard={false}>
                <Modal.Header closeButton>
                    <Modal.Title>Editar Board</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleUpdateBoard}>
                        <Form.Group className="mb-3">
                            <Form.Label>Título do Board</Form.Label>
                            <Form.Control type="text" value={editBoardTitle} onChange={(e) => setEditBoardTitle(e.target.value)} required />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Responsável</Form.Label>
                            <Form.Control type="text" value={editBoardResponsible} onChange={(e) => setEditBoardResponsible(e.target.value)} required />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Data de Vencimento (Opcional)</Form.Label>
                            <Form.Control type="date" value={editBoardDueDate} onChange={(e) => setEditBoardDueDate(e.target.value)} />
                        </Form.Group>
                        <Button variant="primary" type="submit" className="mt-3">Salvar</Button>
                    </Form>
                </Modal.Body>
            </Modal>

            {/* Modal de Excluir Board */}
            <Modal show={!!deletingBoard} onHide={() => setDeletingBoard(null)} centered className="app-modal" backdrop="static" keyboard={false}>
                <Modal.Header closeButton>
                    <Modal.Title>Confirmar Exclusão</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    Tem certeza que deseja excluir o board "{deletingBoard?.title}"?
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setDeletingBoard(null)}>Cancelar</Button>
                    <Button variant="danger" onClick={handleDeleteBoard}>Excluir</Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default ProjectDashboard;
