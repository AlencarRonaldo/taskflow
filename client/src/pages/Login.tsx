import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Button, Container, Row, Col, Card, Alert, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

const API_URL = 'http://localhost:8001/api';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const normalizedEmail = email.trim().toLowerCase();
            console.log('🔐 Login attempt:', { email: normalizedEmail, passwordLength: password.trim().length });
            
            // Step 1: Authenticate user
            const response = await axios.post(`${API_URL}/users/login`, { email: normalizedEmail, password: password.trim() });
            const { token, user } = response.data.data;
            
            console.log('✅ Authentication successful');
            login(token, user); // Save auth state

            // Explicitly set Authorization header for the api instance before making the request
            api.defaults.headers.common['Authorization'] = `Bearer ${token.replace(/"/g, '')}`;

            // Step 2: Get user's projects
            try {
                console.log('🔄 Fetching user projects...');
                const projectsResponse = await api.get('/projects');
                const projects = projectsResponse.data;
                
                console.log('📊 Projects found:', projects);
                
                if (projects && projects.length > 0) {
                    // Check if there's a last accessed project in localStorage
                    const lastProjectId = localStorage.getItem('lastProjectId');
                    const targetProject = lastProjectId 
                        ? projects.find((p: any) => p.id === parseInt(lastProjectId)) || projects[0]
                        : projects[0];
                    
                    console.log('🎯 Redirecting to project:', targetProject);
                    navigate(`/projects/${targetProject.id}`);
                } else {
                    // No projects, redirect to projects page to create one
                    console.log('📋 No projects found, redirecting to projects page');
                    navigate('/projects');
                }
            } catch (projectError) {
                console.error('❌ Error fetching projects:', projectError);
                // Fallback to projects page
                navigate('/projects');
            }
        } catch (err: any) {
            console.error('❌ Login error:', err);
            if (axios.isAxiosError(err) && err.response) {
                console.error('Response data:', err.response.data);
                setError(err.response.data.error || 'Ocorreu um erro durante o login.');
            } else {
                setError('Ocorreu um erro inesperado.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center">
            <Container>
                <Row className="justify-content-center">
                    <Col xs={12} sm={10} md={8} lg={6} xl={5}>
                        <Card style={{ maxWidth: '450px', margin: '0 auto' }}>
                            <Card.Body className="p-4">
                                {/* Logo ATIVA */}
                                <div className="text-center mb-4">
                                    <img 
                                        src="/assets/logo-ativa.png" 
                                        alt="ATIVA Logo" 
                                        style={{ 
                                            maxWidth: '200px', 
                                            maxHeight: '80px',
                                            objectFit: 'contain'
                                        }}
                                        onError={(e) => {
                                            // Fallback se a imagem não existir
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                </div>
                                <Card.Title className="text-center mb-4 h3">⚡ TaskFlow Pro</Card.Title>
                            <h5 className="text-center mb-4 text-muted">Faça login em sua conta</h5>
                            {error && <Alert variant="danger">{error}</Alert>}
                            <Form onSubmit={handleSubmit}>
                                <Form.Group className="mb-3" controlId="formBasicEmail">
                                    <Form.Label>Endereço de Email</Form.Label>
                                    <Form.Control 
                                        type="email" 
                                        placeholder="Digite seu email" 
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3" controlId="formBasicPassword">
                                    <Form.Label>Senha</Form.Label>
                                    <Form.Control 
                                        type="password" 
                                        placeholder="Senha" 
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </Form.Group>

                                <div className="d-grid">
                                    <Button variant="primary" type="submit" disabled={loading}>
                                        {loading ? (
                                            <>
                                                <Spinner size="sm" animation="border" className="me-2" />
                                                Carregando...
                                            </>
                                        ) : (
                                            'Login'
                                        )}
                                    </Button>
                                </div>
                            </Form>
                            <div className="text-center mt-3">
                                Não tem uma conta? <Link to="/register">Cadastre-se</Link>
                            </div>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default Login;
