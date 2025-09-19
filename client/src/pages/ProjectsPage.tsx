import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Modal, Form, Badge, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { FaPlus, FaFolder, FaUsers, FaClipboardList, FaTasks, FaClock, FaCheckCircle } from 'react-icons/fa';
import './ProjectsPage.css';

interface Project {
    id: number;
    name: string;
    description: string;
    color: string;
    logo?: string;
    members_count: number;
    boards_count: number;
    tasks_count?: number;
    completed_tasks_count?: number;
    role: string;
    created_at: string;
    updated_at: string;
    next_appointment_title?: string;
    next_appointment_due_date?: string;
    is_active: boolean;
    is_completed?: number;
    completed_at?: string;
    last_activity_at?: string;
}

const ProjectsPage: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newProject, setNewProject] = useState({
        name: '',
        description: '',
        color: '#007bff'
    });
    const [creating, setCreating] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        try {
            console.log('🔄 Loading projects...');
            const response = await api.get('/projects');
            console.log('✅ Projects loaded:', response.data);
            setProjects(response.data);
        } catch (error: any) {
            console.error('❌ Error loading projects:', error);
            if (error.response?.status === 401) {
                console.log('🔒 Redirecting to login due to unauthorized');
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCreateProject = async () => {
        if (!newProject.name.trim()) {
            alert('Por favor, insira um nome para o projeto');
            return;
        }

        setCreating(true);
        try {
            const response = await api.post('/projects', newProject);
            setProjects([response.data, ...projects]);
            setShowCreateModal(false);
            setNewProject({ name: '', description: '', color: '#007bff' });
            
            // Navigate to the new project
            navigate(`/projects/${response.data.id}`);
        } catch (error) {
            console.error('Error creating project:', error);
            alert('Erro ao criar projeto. Tente novamente.');
        } finally {
            setCreating(false);
        }
    };

    const handleProjectClick = (projectId: number) => {
        navigate(`/projects/${projectId}`);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR');
    };

    const formatDateTime = (dateString: string) => {
        return new Date(dateString).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getRoleBadge = (role: string) => {
        const badges: { [key: string]: string } = {
            owner: 'danger',
            admin: 'warning',
            member: 'primary',
            viewer: 'secondary'
        };
        const labels: { [key: string]: string } = {
            owner: 'Proprietário',
            admin: 'Admin',
            member: 'Membro',
            viewer: 'Visualizador'
        };
        return <Badge bg={badges[role] || 'secondary'}>{labels[role] || role}</Badge>;
    };

    const getProjectCategory = (project: Project): string => {
        if (project.is_active === 0) {
            return 'Arquivado';
        }
        if (project.is_completed === 1) {
            return 'Concluído';
        }
        if (project.tasks_count !== undefined && project.tasks_count > 0 && project.tasks_count > project.completed_tasks_count) {
            return 'Em Andamento';
        }
        return 'A Iniciar';
    };

    const isApproaching = (dateString: string) => {
        if (!dateString) return false;
        const dueDate = new Date(dateString);
        const now = new Date();
        const diff = dueDate.getTime() - now.getTime();
        const hours = diff / (1000 * 60 * 60);
        return hours > 0 && hours <= 24;
    };

    if (loading) {
        return (
            <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
                <Spinner animation="border" variant="primary" />
            </Container>
        );
    }

    const categorizedProjects: { [key: string]: Project[] } = {
        'A Iniciar': [],
        'Em Andamento': [],
        'Concluído': [],
        'Arquivado': [],
    };

    projects.forEach(project => {
        const category = getProjectCategory(project);
        if (categorizedProjects[category]) {
            categorizedProjects[category].push(project);
        } else {
            categorizedProjects[category] = [project];
        }
    });

    return (
        <Container fluid className="py-4">
            <Row className="mb-4">
                <Col>
                    <h1 className="display-6">
                        <FaFolder className="me-2" />
                        Meus Projetos
                    </h1>
                </Col>
                <Col xs="auto">
                    <Button 
                        variant="primary" 
                        size="lg"
                        onClick={() => setShowCreateModal(true)}
                    >
                        <FaPlus className="me-2" />
                        Novo Projeto
                    </Button>
                </Col>
            </Row>

            {projects.length === 0 ? (
                <Card className="text-center py-5">
                    <Card.Body>
                        <FaFolder size={64} className="text-muted mb-3" />
                        <h3>Nenhum projeto ainda</h3>
                        <p className="text-muted">
                            Crie seu primeiro projeto para começar a organizar suas tarefas
                        </p>
                        <Button 
                            variant="primary" 
                            size="lg"
                            onClick={() => setShowCreateModal(true)}
                        >
                            <FaPlus className="me-2" />
                            Criar Primeiro Projeto
                        </Button>
                    </Card.Body>
                </Card>
            ) : (
                <div>
                    {Object.entries(categorizedProjects).map(([category, categoryProjects]) => {
                        if (categoryProjects.length === 0) return null;
                        
                        return (
                            <div key={category} className="mb-5">
                                <h3 className="mb-3 text-muted">
                                    {category} ({categoryProjects.length})
                                </h3>
                                <Row>
                                    {categoryProjects.map((project) => (
                                        <Col key={project.id} xs={12} sm={6} md={4} lg={3} className="mb-4">
                                            <Card 
                                                className="h-100"
                                                style={{ 
                                                    cursor: 'pointer',
                                                    borderTop: `3px solid ${project.color}`,
                                                    height: '200px'
                                                }}
                                                onClick={() => handleProjectClick(project.id)}
                                            >
                                                <Card.Body className="p-2">
                                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                                        <div className="d-flex align-items-center">
                                                            <div 
                                                                className="me-3 rounded-circle d-flex align-items-center justify-content-center"
                                                                style={{ 
                                                                    width: '40px', 
                                                                    height: '40px', 
                                                                    backgroundColor: project.color,
                                                                    fontSize: '16px',
                                                                    color: 'white',
                                                                    fontWeight: 'bold'
                                                                }}
                                                            >
                                                                {project.logo ? (
                                                                    <img 
                                                                        src={project.logo} 
                                                                        alt={project.name} 
                                                                        style={{ width: '24px', height: '24px' }}
                                                                    />
                                                                ) : (
                                                                    project.name.charAt(0).toUpperCase()
                                                                )}
                                                            </div>
                                                            <div>
                                                                <h5 className="mb-1" style={{ fontSize: '14px' }}>
                                                                    {project.name}
                                                                </h5>
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <Badge 
                                                                        bg={project.is_completed === 1 ? 'success' : 'primary'} 
                                                                        className="px-2 py-1"
                                                                        style={{ fontSize: '10px' }}
                                                                    >
                                                                        {project.is_completed === 1 ? 'Concluído' : getProjectCategory(project)}
                                                                    </Badge>
                                                                    {getRoleBadge(project.role)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    {project.description && (
                                                        <p className="text-muted mb-2" style={{ fontSize: '11px' }}>
                                                            {project.description.length > 60 
                                                                ? project.description.substring(0, 60) + '...'
                                                                : project.description}
                                                        </p>
                                                    )}

                                                    <div className="d-flex justify-content-between mb-2">
                                                        <small className="text-muted" style={{ fontSize: '10px' }}>
                                                            <FaFolder className="me-1" />
                                                            {project.boards_count} boards
                                                        </small>
                                                        <small className="text-muted" style={{ fontSize: '10px' }}>
                                                            <FaUsers className="me-1" />
                                                            {project.members_count} membros
                                                        </small>
                                                    </div>

                                                    {project.next_appointment_title && project.next_appointment_due_date && (
                                                        <div className={`p-2 rounded mb-2 ${isApproaching(project.next_appointment_due_date) ? 'bg-warning bg-opacity-10' : 'bg-light'}`}>
                                                            <div className="d-flex align-items-center">
                                                                <FaClock className="me-2 text-warning" style={{ fontSize: '10px' }} />
                                                                <div>
                                                                    <div className="fw-medium" style={{ fontSize: '10px' }}>
                                                                        {project.next_appointment_title.length > 20 ? 
                                                                            `${project.next_appointment_title.substring(0, 20)}...` : 
                                                                            project.next_appointment_title
                                                                        }
                                                                    </div>
                                                                    <small className="text-muted" style={{ fontSize: '9px' }}>
                                                                        {formatDate(project.next_appointment_due_date)}
                                                                    </small>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="mt-auto pt-2 border-top">
                                                        <div className="d-flex justify-content-between align-items-center">
                                                            <small className="text-muted" style={{ fontSize: '9px' }}>
                                                                Criado {formatDate(project.created_at)}
                                                            </small>
                                                            {project.is_completed === 1 && project.completed_at ? (
                                                                <small className="text-success fw-medium" style={{ fontSize: '9px' }}>
                                                                    <FaCheckCircle className="me-1" />
                                                                    {formatDate(project.completed_at)}
                                                                </small>
                                                            ) : project.last_activity_at ? (
                                                                <small className="text-info fw-medium" style={{ fontSize: '9px' }}>
                                                                    <FaClock className="me-1" />
                                                                    {formatDateTime(project.last_activity_at)}
                                                                </small>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                    ))}
                                </Row>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Project Modal */}
            <Modal 
                show={showCreateModal} 
                onHide={() => setShowCreateModal(false)}
                centered
            >
                <Modal.Header closeButton>
                    <Modal.Title>
                        <FaPlus className="me-2" />
                        Criar Novo Projeto
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Nome do Projeto *</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Ex: Projeto Website"
                                value={newProject.name}
                                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                                autoFocus
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Descrição</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                placeholder="Descreva brevemente o projeto..."
                                value={newProject.description}
                                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Cor do Projeto</Form.Label>
                            <Form.Control
                                type="color"
                                value={newProject.color}
                                onChange={(e) => setNewProject({ ...newProject, color: e.target.value })}
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button 
                        variant="secondary" 
                        onClick={() => setShowCreateModal(false)}
                        disabled={creating}
                    >
                        Cancelar
                    </Button>
                    <Button 
                        variant="primary" 
                        onClick={handleCreateProject}
                        disabled={creating || !newProject.name.trim()}
                    >
                        {creating ? (
                            <>
                                <Spinner size="sm" animation="border" className="me-2" />
                                Criando...
                            </>
                        ) : (
                            <>
                                <FaPlus className="me-2" />
                                Criar Projeto
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            <style>{`
                .project-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 0.5rem 1rem rgba(0,0,0,.15) !important;
                }
                @keyframes flash {
                    0%, 100% { color: red; }
                    50% { color: inherit; }
                }
                .flashing-red {
                    animation: flash 1.5s infinite;
                }
            `}</style>
        </Container>
    );
};

export default ProjectsPage;