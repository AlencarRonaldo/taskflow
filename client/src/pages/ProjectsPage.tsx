import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Modal, Form, Badge, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { FaPlus, FaFolder, FaUsers, FaClipboardList, FaTasks, FaClock } from 'react-icons/fa';

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
            return 'Finalizado';
        }
        if (project.tasks_count !== undefined && project.tasks_count > 0 && project.tasks_count === project.completed_tasks_count) {
            return 'Finalizado';
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
        'Finalizado': [],
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
                <Row>
                    {projects.map((project) => (
                        <Col key={project.id} xs={12} md={6} lg={4} xl={3} className="mb-4">
                            <Card 
                                className="h-100 shadow-sm project-card"
                                style={{ 
                                    cursor: 'pointer',
                                    borderTop: `4px solid ${project.color}`,
                                    transition: 'transform 0.2s, box-shadow 0.2s'
                                }}
                                onClick={() => handleProjectClick(project.id)}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-5px)';
                                    e.currentTarget.style.boxShadow = '0 0.5rem 1rem rgba(0,0,0,.15)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '';
                                }}
                            >
                                <Card.Body>
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <h5 className="card-title mb-0">{project.name}</h5>
                                        {getRoleBadge(project.role)}
                                    </div>
                                    
                                    {project.description && (
                                        <p className="text-muted small mb-3">
                                            {project.description.length > 100 
                                                ? project.description.substring(0, 100) + '...'
                                                : project.description}
                                        </p>
                                    )}

                                    <div className="d-flex justify-content-between text-muted small">
                                        <span>
                                            <FaClipboardList className="me-1" />
                                            {project.boards_count} boards
                                        </span>
                                        <span>
                                            <FaUsers className="me-1" />
                                            {project.members_count} {project.members_count === 1 ? 'membro' : 'membros'}
                                        </span>
                                    </div>

                                    {project.tasks_count !== undefined && (
                                        <div className="mt-2 text-muted small">
                                            <FaTasks className="me-1" />
                                            {project.tasks_count} tarefas
                                        </div>
                                    )}

                                    {project.next_appointment_title && project.next_appointment_due_date && (
                                        <div className={`mt-2 text-muted small ${isApproaching(project.next_appointment_due_date) ? 'flashing-red' : ''}`}>
                                            <FaClock className="me-1" />
                                            <strong>Próximo:</strong> {project.next_appointment_title} em {formatDate(project.next_appointment_due_date)}
                                        </div>
                                    )}

                                    <div className="mt-3 text-muted small">
                                        <FaClock className="me-1" />
                                        Criado em {formatDate(project.created_at)}
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
                </Row>
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