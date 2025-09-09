import React, { useEffect, useState } from 'react';
import { Card, Row, Col, ProgressBar, Badge, Spinner, Alert, ListGroup } from 'react-bootstrap';
import axios from 'axios';

interface UserWorkload {
    userId: number;
    userName: string;
    userEmail: string;
    totalCards: number;
    todoCards: number;
    inProgressCards: number;
    completedCards: number;
    criticalCards: number;
    highCards: number;
    activeCards: number;
    urgentCards: number;
    workloadLevel: 'low' | 'medium' | 'high';
    completionRate: number;
}

interface BoardStat {
    boardId: number;
    boardTitle: string;
    totalCards: number;
    todoCards: number;
    inProgressCards: number;
    completedCards: number;
    completionRate: number;
}

interface UpcomingAppointment {
    id: number;
    title: string;
    due_date: string;
    assignee_name: string;
    board_title: string;
    priority: string;
}

interface AnalyticsData {
    totalCards: number;
    openBoards: number;
    totalOpenBoards: number;
    weeklyCompletedCards: number;
    userWorkload: UserWorkload[];
    boardStats: BoardStat[];
    upcomingAppointments?: UpcomingAppointment[];
    overallProgress: {
        todo: number;
        inProgress: number;
        completed: number;
    };
}

export const WorkloadAnalytics: React.FC = () => {
    const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            
            // Buscar boards da API
            const boardsResponse = await axios.get('http://localhost:3001/api/boards', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            const boards = boardsResponse.data.data || [];
            
            // Calcular estatísticas
            const totalOpenBoards = boards.filter((board: any) => !board.allTasksCompleted).length;
            const completedBoards = boards.filter((board: any) => board.allTasksCompleted).length;
            
            // Calcular boards concluídos nesta semana
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const weeklyCompleted = boards.filter((board: any) => {
                if (!board.allTasksCompleted || !board.last_updated_at) return false;
                return new Date(board.last_updated_at) >= oneWeekAgo;
            }).length;
            
            const analyticsData = {
                totalCards: 0, // Não temos cards no momento
                openBoards: totalOpenBoards,
                totalOpenBoards: totalOpenBoards, // Todos os boards não finalizados
                weeklyCompletedCards: weeklyCompleted,
                userWorkload: [],
                boardStats: [],
                upcomingAppointments: boards
                    .filter((board: any) => board.due_date && !board.allTasksCompleted)
                    .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
                    .slice(0, 3)
                    .map((board: any) => ({
                        id: board.id,
                        title: board.title,
                        due_date: board.due_date,
                        assignee_name: board.responsible || 'Não atribuído',
                        board_title: board.title,
                        priority: 'medium'
                    })),
                overallProgress: {
                    todo: boards.filter((board: any) => !board.allTasksCompleted && !board.due_date).length,
                    inProgress: boards.filter((board: any) => !board.allTasksCompleted && board.due_date).length,
                    completed: completedBoards
                }
            };
            
            setAnalyticsData(analyticsData);
            setError(null);
        } catch (err) {
            console.error('Error fetching analytics:', err);
            // Em caso de erro, usar dados mock para não quebrar a interface
            const mockData = {
                totalCards: 0,
                openBoards: 0,
                totalOpenBoards: 0,
                weeklyCompletedCards: 0,
                userWorkload: [],
                boardStats: [],
                upcomingAppointments: [],
                overallProgress: {
                    todo: 0,
                    inProgress: 0,
                    completed: 0
                }
            };
            setAnalyticsData(mockData);
            setError(null); // Não mostrar erro para não poluir a interface
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
        // Refresh every 30 seconds
        const interval = setInterval(fetchAnalytics, 30000);
        return () => clearInterval(interval);
    }, []);

    const getWorkloadColor = (level: string) => {
        switch (level) {
            case 'high': return 'danger';
            case 'medium': return 'warning';
            case 'low': return 'success';
            default: return 'secondary';
        }
    };

    const getWorkloadText = (level: string) => {
        switch (level) {
            case 'high': return 'Alta Carga';
            case 'medium': return 'Carga Média';
            case 'low': return 'Carga Baixa';
            default: return 'Normal';
        }
    };

    const formatAppointmentDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);

        const isToday = date.toDateString() === today.toDateString();
        const isTomorrow = date.toDateString() === tomorrow.toDateString();

        const timeStr = date.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        if (isToday) {
            return `Hoje, ${timeStr}`;
        } else if (isTomorrow) {
            return `Amanhã, ${timeStr}`;
        } else {
            return `${date.toLocaleDateString('pt-BR')}, ${timeStr}`;
        }
    };

    const getPriorityIcon = (priority: string) => {
        switch (priority) {
            case 'critical': return '🔥';
            case 'high': return '⚡';
            case 'medium': return '📅';
            case 'low': return '⭐';
            default: return '📝';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'critical': return 'danger';
            case 'high': return 'warning';
            case 'medium': return 'info';
            case 'low': return 'success';
            default: return 'secondary';
        }
    };

    if (loading) {
        return (
            <Card className="mb-4">
                <Card.Body className="text-center">
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Carregando...</span>
                    </Spinner>
                    <p className="mt-2">Carregando análises de workload...</p>
                </Card.Body>
            </Card>
        );
    }

    if (error) {
        return (
            <Alert variant="danger" className="mb-4">
                {error}
            </Alert>
        );
    }

    if (!analyticsData) {
        return null;
    }

    const totalTasks = analyticsData.overallProgress.inProgress + analyticsData.overallProgress.completed;
    const completionPercentage = totalTasks > 0 ? Math.round((analyticsData.overallProgress.completed / totalTasks) * 100) : 0;

    return (
        <div className="workload-analytics">
            <h4 className="mb-3">📊 Análise de Carga de Trabalho</h4>
            
            {/* Overview Cards - Centralizados */}
            <Row className="mb-4 g-3 justify-content-center">
                <Col xs={6} md={3}>
                    <Card className="h-100 border-primary">
                        <Card.Body className="text-center py-3 px-2">
                            <h3 className="text-primary mb-2">{analyticsData.totalOpenBoards || 0}</h3>
                            <p className="mb-0 fw-medium">Em Aberto</p>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={6} md={3}>
                    <Card className="h-100 border-success">
                        <Card.Body className="text-center py-3 px-2">
                            <h3 className="text-success mb-2">{analyticsData.weeklyCompletedCards || 0}</h3>
                            <p className="mb-1 fw-medium">Concluídas</p>
                            <small className="text-muted">Esta semana</small>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={6} md={3}>
                    <Card className="h-100 border-info">
                        <Card.Body className="text-center py-3 px-2">
                            <h3 className="text-info mb-2">{analyticsData.overallProgress.inProgress}</h3>
                            <p className="mb-0 fw-medium">Em Andamento</p>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={6} md={3}>
                    <Card className="h-100 border-secondary">
                        <Card.Body className="text-center py-3 px-2">
                            <h3 className="text-secondary mb-2">{analyticsData.overallProgress.completed}</h3>
                            <p className="mb-0 fw-medium">Total Concluído</p>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Overall Progress */}
            <Card className="mb-4">
                <Card.Body>
                    <h5>🎯 Progresso Geral</h5>
                    <div className="d-flex align-items-center">
                        <ProgressBar 
                            className="flex-grow-1 me-3" 
                            style={{ height: '20px' }}
                        >
                            {totalTasks > 0 && [
                                <ProgressBar 
                                    variant="warning" 
                                    now={Math.round((analyticsData.overallProgress.inProgress / totalTasks) * 100)} 
                                    key={1} 
                                />,
                                <ProgressBar 
                                    variant="success" 
                                    now={Math.round((analyticsData.overallProgress.completed / totalTasks) * 100)} 
                                    key={2} 
                                />
                            ]}
                        </ProgressBar>
                        <strong>{completionPercentage}% Completo</strong>
                    </div>
                    <div className="d-flex justify-content-center gap-4 mt-2 small text-muted">
                        <span>🟡 Em Andamento ({analyticsData.overallProgress.inProgress})</span>
                        <span>🟢 Concluído ({analyticsData.overallProgress.completed})</span>
                    </div>
                </Card.Body>
            </Card>

            <Row>
                {/* User Workload */}
                <Col lg={6}>
                    <Card className="mb-4">
                        <Card.Header>
                            <h5 className="mb-0">👥 Carga de Trabalho por Usuário</h5>
                        </Card.Header>
                        <Card.Body>
                            {analyticsData.userWorkload.length > 0 ? (
                                analyticsData.userWorkload.map((user) => (
                                    <div key={user.userId} className="mb-4 p-4 border rounded-3 shadow-sm bg-white">
                                        <div className="row align-items-center">
                                            <div className="col-md-4">
                                                <div className="d-flex align-items-center mb-2">
                                                    <div className="me-3">
                                                        <div className="bg-primary bg-gradient rounded-circle d-inline-flex align-items-center justify-content-center" 
                                                             style={{width: '40px', height: '40px'}}>
                                                            <i className="text-white fw-bold">{user.userName.charAt(0).toUpperCase()}</i>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h6 className="mb-1 fw-semibold">{user.userName}</h6>
                                                        <Badge 
                                                            bg={getWorkloadColor(user.workloadLevel)} 
                                                            className="small"
                                                        >
                                                            {getWorkloadText(user.workloadLevel)}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="text-muted small">
                                                    {user.activeCards} cards ativas • {user.completionRate}% concluído
                                                </div>
                                            </div>
                                            
                                            <div className="col-md-8">
                                                <div className="row g-3 text-center">
                                                    <div className="col-3">
                                                        <div className="p-2 bg-primary bg-opacity-10 rounded-2">
                                                            <div className="h5 mb-1 text-primary fw-bold">{user.totalCards}</div>
                                                            <div className="small text-muted">Total</div>
                                                        </div>
                                                    </div>
                                                    <div className="col-3">
                                                        <div className="p-2 bg-warning bg-opacity-10 rounded-2">
                                                            <div className="h5 mb-1 text-warning fw-bold">{user.todoCards}</div>
                                                            <div className="small text-muted">A Fazer</div>
                                                        </div>
                                                    </div>
                                                    <div className="col-3">
                                                        <div className="p-2 bg-info bg-opacity-10 rounded-2">
                                                            <div className="h5 mb-1 text-info fw-bold">{user.inProgressCards}</div>
                                                            <div className="small text-muted">Em Progresso</div>
                                                        </div>
                                                    </div>
                                                    <div className="col-3">
                                                        <div className="p-2 bg-danger bg-opacity-10 rounded-2">
                                                            <div className="h5 mb-1 text-danger fw-bold">{user.urgentCards}</div>
                                                            <div className="small text-muted">Urgentes</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-muted text-center">Nenhum usuário com cards ativos</p>
                            )}
                        </Card.Body>
                    </Card>
                </Col>

                {/* Upcoming Appointments */}
                <Col lg={6}>
                    <Card className="mb-4">
                        <Card.Header>
                            <h5 className="mb-0">⏰ Próximos Compromissos</h5>
                        </Card.Header>
                        <Card.Body className="p-0">
                            {analyticsData.upcomingAppointments && analyticsData.upcomingAppointments.length > 0 ? (
                                <ListGroup variant="flush">
                                    {analyticsData.upcomingAppointments.slice(0, 5).map((appointment, index) => (
                                        <ListGroup.Item key={appointment.id} className="px-3 py-2">
                                            <div className="d-flex justify-content-between align-items-center">
                                                <div className="flex-grow-1 me-2" style={{ minWidth: 0 }}>
                                                    <div className="d-flex align-items-center">
                                                        <span className="me-2">{getPriorityIcon(appointment.priority)}</span>
                                                        <strong className="text-truncate d-block" style={{ maxWidth: '250px' }}>
                                                            {appointment.title}
                                                        </strong>
                                                    </div>
                                                    <div className="small text-muted">
                                                        👤 {appointment.assignee_name} • {formatAppointmentDate(appointment.due_date)}
                                                    </div>
                                                </div>
                                                <Badge 
                                                    bg={getPriorityColor(appointment.priority)}
                                                    className="ms-2"
                                                    style={{ fontSize: '0.7rem' }}
                                                >
                                                    {appointment.priority === 'critical' ? 'CRÍTICO' : 
                                                     appointment.priority === 'high' ? 'ALTO' :
                                                     appointment.priority === 'medium' ? 'MÉDIO' : 'BAIXO'}
                                                </Badge>
                                            </div>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            ) : (
                                <div className="text-center text-muted py-4">
                                    <p className="mb-0">Nenhum compromisso agendado</p>
                                    <small>Compromissos com data aparecerão aqui</small>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};