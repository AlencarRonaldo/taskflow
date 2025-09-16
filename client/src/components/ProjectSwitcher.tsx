import React, { useState, useEffect } from 'react';
import { Dropdown, Spinner, Badge } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { FaFolder, FaChevronDown, FaPlus, FaCheck } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface Project {
    id: number;
    name: string;
    color: string;
    role: string;
}

const ProjectSwitcher: React.FC = () => {
    const { isAuthenticated, token } = useAuth();
    const navigate = useNavigate();
    const params = useParams();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentProject, setCurrentProject] = useState<Project | null>(null);

    // If we're in a project route, try to get current project info from URL
    const projectIdFromUrl = params.projectId ? parseInt(params.projectId) : null;

    useEffect(() => {
        // Load projects if authenticated and have a token
        if (isAuthenticated && token) {
            console.log('🔄 ProjectSwitcher: Authentication confirmed, loading projects...');
            loadProjects();
        }
    }, [isAuthenticated, token]);

    // Separate effect to set current project from URL
    useEffect(() => {
        if (projectIdFromUrl && projects.length > 0) {
            const project = projects.find(p => p.id === projectIdFromUrl);
            if (project) {
                setCurrentProject(project);
            }
        } else if (!projectIdFromUrl) {
            setCurrentProject(null);
        }
    }, [projectIdFromUrl, projects]);

    const loadProjects = async () => {
        if (loading) return; // Prevent multiple calls
        
        setLoading(true);
        try {
            console.log('🔄 ProjectSwitcher: Loading projects...');
            const response = await api.get('/projects');
            console.log('✅ ProjectSwitcher: Projects loaded:', response.data.length);
            setProjects(response.data);
        } catch (error: any) {
            console.error('❌ ProjectSwitcher: Error loading projects:', error);
            // If unauthorized, redirect to login
            if (error.response?.status === 401) {
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleProjectSelect = (projectId: number) => {
        if (currentProject?.id !== projectId) {
            navigate(`/projects/${projectId}`);
        }
    };

    const handleCreateNew = () => {
        navigate('/projects');
    };

    if (!currentProject) {
        return null; // Don't show switcher when not in a project context
    }

    return (
        <Dropdown className="project-switcher">
            <Dropdown.Toggle 
                variant="light" 
                id="project-switcher-dropdown"
                className="d-flex align-items-center"
            >
                <div 
                    className="project-color-indicator me-2"
                    style={{
                        width: '12px',
                        height: '12px',
                        backgroundColor: currentProject.color,
                        borderRadius: '2px'
                    }}
                />
                <span className="me-2">{currentProject.name}</span>
                <FaChevronDown size={12} />
            </Dropdown.Toggle>

            <Dropdown.Menu style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <Dropdown.Header>
                    <strong>Trocar Projeto</strong>
                </Dropdown.Header>
                
                {loading ? (
                    <Dropdown.Item disabled>
                        <Spinner size="sm" animation="border" className="me-2" />
                        Carregando...
                    </Dropdown.Item>
                ) : (
                    <>
                        {projects.map((project) => (
                            <Dropdown.Item
                                key={project.id}
                                onClick={() => handleProjectSelect(project.id)}
                                className="d-flex align-items-center justify-content-between"
                                active={project.id === currentProject.id}
                            >
                                <div className="d-flex align-items-center">
                                    <div 
                                        className="project-color-indicator me-2"
                                        style={{
                                            width: '10px',
                                            height: '10px',
                                            backgroundColor: project.color,
                                            borderRadius: '2px'
                                        }}
                                    />
                                    <span>{project.name}</span>
                                    {project.role === 'owner' && (
                                        <Badge bg="danger" className="ms-2" pill>
                                            Owner
                                        </Badge>
                                    )}
                                </div>
                                {project.id === currentProject.id && (
                                    <FaCheck className="text-primary" />
                                )}
                            </Dropdown.Item>
                        ))}
                        
                        <Dropdown.Divider />
                        
                        <Dropdown.Item onClick={handleCreateNew}>
                            <FaPlus className="me-2" />
                            Criar Novo Projeto
                        </Dropdown.Item>
                        
                        <Dropdown.Item onClick={() => navigate('/projects')}>
                            <FaFolder className="me-2" />
                            Ver Todos os Projetos
                        </Dropdown.Item>
                    </>
                )}
            </Dropdown.Menu>
        </Dropdown>
    );
};

export default ProjectSwitcher;