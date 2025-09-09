import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Button, Container, Row, Col, Card, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = 'http://localhost:3001/api';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const { login } = useAuth();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        try {
            const normalizedEmail = email.trim().toLowerCase();
            console.log('Login attempt:', { email: normalizedEmail, passwordLength: password.trim().length });
            const response = await axios.post(`${API_URL}/users/login`, { email: normalizedEmail, password: password.trim() });
            const { token, user } = response.data.data;
            login(token, user); // Save auth state
            navigate('/'); // Redirect to dashboard
        } catch (err: any) {
            console.error('Login error:', err);
            if (axios.isAxiosError(err) && err.response) {
                console.error('Response data:', err.response.data);
                setError(err.response.data.error || 'Ocorreu um erro durante o login.');
            } else {
                setError('Ocorreu um erro inesperado.');
            }
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
                                    <Button variant="primary" type="submit">
                                        Login
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
