import { useState, FormEvent } from 'react';
import { Form, Button, Container, Row, Col, Card, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://localhost:8001/api';

const Register = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        try {
            const normalizedEmail = email.trim().toLowerCase();
            const normalizedName = name.trim();
            const response = await axios.post(`${API_URL}/users/register`, { 
                name: normalizedName, 
                email: normalizedEmail, 
                password: password.trim() 
            });
            if (response.status === 201) {
                setSuccess('Cadastro realizado com sucesso! Redirecionando para o login...');
                setName('');
                setEmail('');
                setPassword('');
                setConfirmPassword('');
                setTimeout(() => navigate('/login'), 1200);
            }
        } catch (err: any) {
            if (axios.isAxiosError(err) && err.response?.status === 409) {
                setError('Email já cadastrado. Vá para a página de Login.');
                return;
            }
            if (axios.isAxiosError(err) && err.response) {
                setError(err.response.data.error || 'Ocorreu um erro durante o cadastro.');
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
                                <h5 className="text-center mb-4 text-muted">Crie sua conta</h5>
                            {error && <Alert variant="danger">{error}</Alert>}
                            {success && <Alert variant="success">{success}</Alert>}
                            <Form onSubmit={handleSubmit}>
                                <Form.Group className="mb-3" controlId="formBasicName">
                                    <Form.Label>Nome Completo</Form.Label>
                                    <Form.Control 
                                        type="text" 
                                        placeholder="Digite seu nome completo" 
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                    />
                                </Form.Group>

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

                                <Form.Group className="mb-3" controlId="formBasicConfirmPassword">
                                    <Form.Label>Confirmar Senha</Form.Label>
                                    <Form.Control 
                                        type="password" 
                                        placeholder="Confirmar Senha" 
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                    />
                                </Form.Group>

                                <div className="d-grid">
                                    <Button variant="primary" type="submit">
                                        Cadastrar
                                    </Button>
                                </div>
                            </Form>
                                <div className="text-center mt-3">
                                    Já tem uma conta? <Link to="/login">Entrar</Link>
                                </div>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default Register;
