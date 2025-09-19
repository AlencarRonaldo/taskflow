import React, { useEffect, useState } from 'react';
import { Card, Row, Col, ProgressBar, Badge, Spinner, Alert, ListGroup } from 'react-bootstrap';
import { api } from '../lib/api';

interface ProjectMetricsProps {
    projectId: number;
    projectName: string;
    projectColor: string;
}

interface Board {
    id: number;
    title: string;
    cards_count: number;
    columns_count: number;
    created_at: string;
    due_date?: string;
}

interface Card {
    id: number;
    title: string;
    status: string;
    priority: string;
    due_date?: string;
    board_title: string;
}

interface ProjectAnalytics {
    totalBoards: number;
    totalCards: number; // This will now be the total cards from analytics endpoint
    boardsWithCards: number;
    emptyBoards: number;
    cardsCompleted: number;
    cardsInProgress: number;
    cardsTodo: number;
    criticalCards: number;
    boards: Board[];
    recentCards: Card[];
    completionRate: number;
    totalCompletedProjects: number; // New field
}

export const ProjectMetrics: React.FC<ProjectMetricsProps> = ({ projectId, projectName, projectColor }) => {
    const [analytics, setAnalytics] = useState<ProjectAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showUrgentCards, setShowUrgentCards] = useState(false);

    const fetchProjectAnalytics = async () => {
        try {
            setLoading(true);
            
            // Fetch aggregated analytics data for the project
            const analyticsResponse = await api.get(`/v1/analytics/dashboard?project_id=${projectId}`);
            const analyticsData = analyticsResponse.data.totals;

            // Fetch boards for the current project
            const boardsResponse = await api.get(`/boards?project_id=${projectId}`);
            const boards = Array.isArray(boardsResponse.data) ? boardsResponse.data : 
                          boardsResponse.data?.data && Array.isArray(boardsResponse.data.data) ? boardsResponse.data.data : [];
            
            // Fetch all cards for the current project to calculate recentCards, criticalCards, cardsInProgress, cardsTodo
            let allCards: Card[] = [];
            for (const board of boards) {
                try {
                    const boardResponse = await api.get(`/boards/${board.id}`);
                    const boardData = boardResponse.data.data;
                    if (boardData.columns) {
                        for (const column of boardData.columns) {
                            if (column.cards) {
                                const boardCards = column.cards.map((card: any) => ({
                                    ...card,
                                    board_title: board.title,
                                    column_title: column.title
                                }));
                                allCards = [...allCards, ...boardCards];
                            }
                        }
                    }
                } catch (error) {
                    console.log(`Erro ao buscar dados do board ${board.id}:`, error);
                }
            }

            const recentCards = allCards
                .sort((a, b) => new Date(b.due_date || '').getTime() - new Date(a.due_date || '').getTime())
                .slice(0, 5);
            
            const criticalCards = allCards.filter(card => card.priority === 'critical' || card.priority === 'high').length;

            const boardsWithCards = boards.filter((board: Board) => board.cards_count > 0).length;
            const emptyBoards = boards.length - boardsWithCards;

            // Recalculate cardsInProgress and cardsTodo using the allCards array
            const cardsCompleted = allCards.filter(card => {
                if (card.status === 'completed') return true;
                if (card.column_title) {
                    const columnTitle = card.column_title.toLowerCase();
                    return columnTitle.includes('concluí') || columnTitle.includes('completed');
                }
                return card.status === 'Concluído';
            }).length;
            
            const cardsInProgress = allCards.filter(card => {
                if (card.status === 'completed') return false;
                if (card.column_title) {
                    const columnTitle = card.column_title.toLowerCase();
                    if (columnTitle.includes('concluí') || columnTitle.includes('completed')) {
                        return false;
                    }
                }
                const cardStatusLower = card.status?.toLowerCase();
                return card.status === 'in_progress' || card.status === 'Em Andamento' || cardStatusLower?.includes('andamento') || card.status === 'doing';
            }).length;
            
            const cardsTodo = allCards.filter(card => {
                if (card.status === 'completed') return false;
                if (card.column_title) {
                    const columnTitle = card.column_title.toLowerCase();
                    if (columnTitle.includes('concluí') || columnTitle.includes('completed')) {
                        return false;
                    }
                }
                const cardStatusLower = card.status?.toLowerCase();
                if (card.status === 'in_progress' || card.status === 'Em Andamento' || cardStatusLower?.includes('andamento') || card.status === 'doing') return false;
                
                return card.status === 'todo' || card.status === 'A Fazer' || cardStatusLower?.includes('fazer');
            }).length;

            const completionRate = allCards.length > 0 ? Math.round((cardsCompleted / allCards.length) * 100) : 0;

            const projectAnalytics: ProjectAnalytics = {
                totalBoards: analyticsData.totalBoards,
                totalCards: analyticsData.totalCards, // This is total cards from analytics endpoint
                boardsWithCards: boardsWithCards,
                emptyBoards: emptyBoards,
                cardsCompleted: cardsCompleted,
                cardsInProgress: cardsInProgress,
                cardsTodo: cardsTodo,
                criticalCards: criticalCards,
                boards: boards,
                recentCards: recentCards,
                completionRate: completionRate,
                totalCompletedProjects: analyticsData.totalCompletedProjects
            };
            
            setAnalytics(projectAnalytics);
            setError(null);
        } catch (err) {
            console.error('Error fetching project analytics:', err);
            setError('Erro ao carregar métricas do projeto');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) {
            fetchProjectAnalytics();
            // Refresh a cada 30 segundos
            const interval = setInterval(fetchProjectAnalytics, 30000);
            return () => clearInterval(interval);
        }
    }, [projectId]);

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('pt-BR');
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

    const getPriorityLabel = (priority: string) => {
        switch (priority) {
            case 'critical': return 'CRÍTICO';
            case 'high': return 'ALTO';
            case 'medium': return 'MÉDIO';
            case 'low': return 'BAIXO';
            default: return priority.toUpperCase();
        }
    };

    if (loading) {
        return (
            <Card className="mb-4">
                <Card.Body className="text-center">
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Carregando...</span>
                    </Spinner>
                    <p className="mt-2">Carregando métricas do projeto...</p>
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

    if (!analytics) {
        return null;
    }

    return (
        <div className="project-metrics">
            <div className="d-flex align-items-center mb-4">
                <div 
                    className="me-3"
                    style={{
                        width: '8px',
                        height: '40px',
                        backgroundColor: projectColor,
                        borderRadius: '4px'
                    }}
                />
                <h4 className="mb-0">📊 Métricas do Projeto {projectName}</h4>
            </div>
            
            {/* Cards de Overview */}
            <Row className="mb-4 g-3">
                <Col xs={6} md={3}>
                    <Card className="h-100 border-primary">
                        <Card.Body className="text-center py-3 px-2">
                            <h3 className="text-primary mb-2">{analytics.totalBoards}</h3>
                            <p className="mb-0 fw-medium">Total de projetos em aberto</p>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={6} md={3}>
                    <Card className="h-100 border-success">
                        <Card.Body className="text-center py-3 px-2">
                            <h3 className="text-success mb-2">{analytics.totalCompletedProjects}</h3>
                            <p className="mb-0 fw-medium">Total de projetos concluídos</p>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={6} md={3}>
                    <Card className="h-100 border-info">
                        <Card.Body className="text-center py-3 px-2">
                            <h3 className="text-info mb-2">{analytics.boardsWithCards}</h3>
                            <p className="mb-0 fw-medium">Boards Ativos</p>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={6} md={3}>
                    <Card 
                        className="h-100 border-warning" 
                        style={{ cursor: 'pointer' }}
                        onClick={() => setShowUrgentCards(!showUrgentCards)}
                    >
                        <Card.Body className="text-center py-3 px-2">
                            <h3 className="text-warning mb-2">{analytics.criticalCards}</h3>
                            <p className="mb-0 fw-medium">Cards Urgentes</p>
                            <small className="text-muted">Clique para ver</small>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Progresso dos Cards */}
            <Card className="mb-4">
                <Card.Body>
                    <h5>🎯 Progresso das Tarefas</h5>
                    <div className="d-flex align-items-center">
                        <ProgressBar 
                            className="flex-grow-1 me-3" 
                            style={{ height: '20px' }}
                        >
                            {analytics.totalCards > 0 && [
                                <ProgressBar 
                                    variant="warning" 
                                    now={Math.round((analytics.cardsTodo / analytics.totalCards) * 100)} 
                                    key={1} 
                                />,
                                <ProgressBar 
                                    variant="info" 
                                    now={Math.round((analytics.cardsInProgress / analytics.totalCards) * 100)} 
                                    key={2} 
                                />,
                                <ProgressBar 
                                    variant="success" 
                                    now={Math.round((analytics.cardsCompleted / analytics.totalCards) * 100)} 
                                    key={3} 
                                />
                            ]}
                        </ProgressBar>
                        <strong>{analytics.completionRate}% Completo</strong>
                    </div>
                    <div className="d-flex justify-content-center gap-4 mt-2 small text-muted">
                        <span>🟡 A Fazer ({analytics.cardsTodo})</span>
                        <span>🔵 Em Progresso ({analytics.cardsInProgress})</span>
                        <span>🟢 Concluído ({analytics.cardsCompleted})</span>
                    </div>
                </Card.Body>
            </Card>

            {/* Cards Urgentes */}
            {showUrgentCards && analytics && (
                <Card className="mb-4">
                    <Card.Header className="d-flex justify-content-between align-items-center">
                        <h5 className="mb-0">🔥 Cards Urgentes ({analytics.criticalCards})</h5>
                        <Button 
                            variant="outline-secondary" 
                            size="sm" 
                            onClick={() => setShowUrgentCards(false)}
                        >
                            ✕ Fechar
                        </Button>
                    </Card.Header>
                    <Card.Body>
                        {(() => {
                            // Buscar todos os cards urgentes de todos os boards
                            let urgentCards: any[] = [];
                            analytics.boards.forEach(board => {
                                // Simular busca de cards urgentes (em um cenário real, isso viria da API)
                                // Por enquanto, vamos mostrar uma mensagem informativa
                            });
                            
                            if (analytics.criticalCards === 0) {
                                return (
                                    <div className="text-center py-4">
                                        <p className="text-muted mb-0">🎉 Nenhum card urgente encontrado!</p>
                                        <small className="text-muted">Todos os cards estão com prioridade normal ou baixa.</small>
                                    </div>
                                );
                            }
                            
                            return (
                                <div className="text-center py-4">
                                    <p className="text-warning mb-2">⚠️ {analytics.criticalCards} cards urgentes encontrados</p>
                                    <small className="text-muted">
                                        Cards com prioridade <strong>Crítica</strong> ou <strong>Alta</strong> em todos os boards do projeto.
                                    </small>
                                    <div className="mt-3">
                                        <small className="text-muted">
                                            💡 <strong>Dica:</strong> Acesse os boards individuais para ver e gerenciar os cards urgentes.
                                        </small>
                                    </div>
                                </div>
                            );
                        })()}
                    </Card.Body>
                </Card>
            )}

            <Row>
                
            </Row>
        </div>
    );
};