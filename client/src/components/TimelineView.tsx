import React, { useEffect, useRef, useState } from 'react';
import { Timeline } from 'vis-timeline/standalone';
import { Container, Row, Col, Form, Button, ButtonGroup, Alert, Badge, Card } from 'react-bootstrap';
import { api } from '../lib/api';
import 'vis-timeline/styles/vis-timeline-graph2d.css';
import '../styles/timeline-grid.css';

interface TimelineEvent {
    id: number;
    title: string;
    description?: string;
    start: Date;
    end?: Date;
    board_id: number;
    board_title: string;
    status: string;
    priority: string;
    responsible?: string;
    color?: string;
    group?: string;
}

interface FilterState {
    status: string;
    responsible: string;
    priority: string;
    board: string;
}

const TimelineView: React.FC = () => {
    const timelineRef = useRef<HTMLDivElement>(null);
    const timelineInstance = useRef<Timeline | null>(null);
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<FilterState>({
        status: '',
        responsible: '',
        priority: '',
        board: ''
    });
    const [zoomLevel, setZoomLevel] = useState('month');
    const [showGrouped, setShowGrouped] = useState(true);

    // Get unique values for filters
    const getUniqueValues = (field: keyof TimelineEvent) => {
        return [...new Set(events.map(event => event[field]).filter(Boolean))];
    };

    // Get priority color
    const getPriorityColor = (priority: string) => {
        switch (priority.toLowerCase()) {
            case 'baixa':
                return '#28a745';
            case 'média':
                return '#ffc107';
            case 'alta':
                return '#fd7e14';
            case 'crítica':
                return '#dc3545';
            default:
                return '#6c757d';
        }
    };

    // Get status color
    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'todo':
            case 'a fazer':
                return '#6c757d';
            case 'doing':
            case 'em andamento':
                return '#007bff';
            case 'done':
            case 'concluído':
                return '#28a745';
            default:
                return '#6c757d';
        }
    };

    // Filter events based on current filters
    const getFilteredEvents = () => {
        return events.filter(event => {
            if (filters.status && event.status !== filters.status) return false;
            if (filters.responsible && event.responsible !== filters.responsible) return false;
            if (filters.priority && event.priority !== filters.priority) return false;
            if (filters.board && event.board_title !== filters.board) return false;
            return true;
        });
    };

    // Convert events to timeline format
    const convertToTimelineData = (events: TimelineEvent[]): any[] => {
        return events.map(event => ({
            id: event.id,
            content: `
                <div class="timeline-event-card">
                    <div class="timeline-event-title">${event.title}</div>
                    <div class="timeline-event-info">
                        <span class="timeline-event-board">📋 ${event.board_title}</span>
                    </div>
                    ${event.responsible ? `<div class="timeline-event-responsible">👤 ${event.responsible}</div>` : ''}
                </div>
            `,
            start: event.start,
            end: event.end,
            group: showGrouped ? (event.responsible || 'Sem Responsável') : undefined,
            className: `timeline-item priority-${event.priority.toLowerCase().replace(' ', '-')} status-${event.status.toLowerCase().replace(' ', '-')}`,
            style: `background-color: ${getPriorityColor(event.priority)}; border-left: 4px solid ${getStatusColor(event.status)};`,
            title: `${event.title}\nBoard: ${event.board_title}\nStatus: ${event.status}\nPrioridade: ${event.priority}${event.responsible ? `\nResponsável: ${event.responsible}` : ''}`
        }));
    };

    // Get groups for grouped view
    const getGroups = () => {
        if (!showGrouped) return [];
        
        const responsibles = getUniqueValues('responsible');
        const groups = responsibles.map(responsible => ({
            id: responsible || 'Sem Responsável',
            content: responsible || 'Sem Responsável',
            className: 'timeline-group'
        }));

        // Add "Sem Responsável" group if not exists
        if (!groups.find(g => g.id === 'Sem Responsável')) {
            groups.push({
                id: 'Sem Responsável',
                content: 'Sem Responsável',
                className: 'timeline-group'
            });
        }

        return groups;
    };

    // Fetch timeline data
    const fetchTimelineData = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await api.get('/timeline/events');
            setEvents(response.data.data);
        } catch (err) {
            console.error('Error fetching timeline data:', err);
            setError('Erro ao carregar dados da timeline.');
        } finally {
            setLoading(false);
        }
    };

    // Initialize timeline
    const initializeTimeline = () => {
        if (!timelineRef.current) return;

        const filteredEvents = getFilteredEvents();
        const timelineData = convertToTimelineData(filteredEvents);
        const groups = getGroups();

        const options = {
            height: '700px',
            stack: true,
            showCurrentTime: true,
            zoomable: true,
            moveable: true,
            groupOrder: 'content',
            orientation: 'top',
            margin: {
                item: {
                    horizontal: 20,
                    vertical: 10
                },
                axis: 20
            },
            format: {
                minorLabels: {
                    minute: 'HH:mm',
                    hour: 'HH:mm',
                    weekday: 'ddd D',
                    day: 'D',
                    week: 'w',
                    month: 'MMM'
                },
                majorLabels: {
                    minute: 'HH:mm dddd MMMM Do YYYY',
                    hour: 'dddd MMMM Do YYYY',
                    weekday: 'MMMM YYYY',
                    day: 'MMMM YYYY',
                    week: 'MMMM YYYY',
                    month: 'YYYY'
                }
            }
        };

        if (timelineInstance.current) {
            timelineInstance.current.destroy();
        }

        timelineInstance.current = new Timeline(
            timelineRef.current,
            timelineData,
            showGrouped ? groups : undefined,
            options
        );

        // Add click event
        timelineInstance.current.on('select', (properties) => {
            if (properties.items.length > 0) {
                const eventId = properties.items[0];
                const event = events.find(e => e.id === eventId);
                if (event) {
                    // Navigate to board or show event details
                    window.open(`/boards/${event.board_id}`, '_blank');
                }
            }
        });

        // Set initial zoom level
        handleZoomLevel(zoomLevel);
    };

    // Handle zoom level change
    const handleZoomLevel = (level: string) => {
        if (!timelineInstance.current) return;

        const now = new Date();
        let start: Date, end: Date;

        switch (level) {
            case 'day':
                start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                break;
            case 'week':
                start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
                break;
            case 'year':
                start = new Date(now.getFullYear() - 1, 0, 1);
                end = new Date(now.getFullYear() + 1, 11, 31);
                break;
            default:
                return;
        }

        timelineInstance.current.setWindow(start, end);
    };

    // Handle filter change
    const handleFilterChange = (field: keyof FilterState, value: string) => {
        setFilters(prev => ({ ...prev, [field]: value }));
    };

    // Clear all filters
    const clearFilters = () => {
        setFilters({
            status: '',
            responsible: '',
            priority: '',
            board: ''
        });
    };

    useEffect(() => {
        fetchTimelineData();
        
        return () => {
            if (timelineInstance.current) {
                timelineInstance.current.destroy();
            }
        };
    }, []);

    useEffect(() => {
        if (!loading && events.length > 0) {
            initializeTimeline();
        }
    }, [events, filters, showGrouped, loading]);

    useEffect(() => {
        handleZoomLevel(zoomLevel);
    }, [zoomLevel]);

    if (loading) {
        return (
            <Container>
                <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
                    <div className="text-center">
                        <div className="spinner-border" role="status">
                            <span className="visually-hidden">Carregando...</span>
                        </div>
                        <p className="mt-2">Carregando timeline...</p>
                    </div>
                </div>
            </Container>
        );
    }

    if (error) {
        return (
            <Container>
                <Alert variant="danger">
                    {error}
                    <div className="mt-2">
                        <Button variant="outline-danger" onClick={fetchTimelineData}>
                            Tentar Novamente
                        </Button>
                    </div>
                </Alert>
            </Container>
        );
    }

    const filteredEvents = getFilteredEvents();

    return (
        <Container fluid>
            {/* Header */}
            <Row className="mb-4">
                <Col>
                    <h1>Vista Timeline</h1>
                    <p className="text-muted">
                        Visualização temporal dos cards organizados por responsável
                    </p>
                </Col>
            </Row>

            {/* Controls */}
            <Row className="mb-4">
                <Col>
                    <Card>
                        <Card.Body>
                            <Row>
                                {/* Filters */}
                                <Col md={2}>
                                    <Form.Label>Status</Form.Label>
                                    <Form.Select
                                        value={filters.status}
                                        onChange={(e) => handleFilterChange('status', e.target.value)}
                                        size="sm"
                                    >
                                        <option value="">Todos</option>
                                        {getUniqueValues('status').map(status => (
                                            <option key={status} value={status}>{status}</option>
                                        ))}
                                    </Form.Select>
                                </Col>

                                <Col md={2}>
                                    <Form.Label>Responsável</Form.Label>
                                    <Form.Select
                                        value={filters.responsible}
                                        onChange={(e) => handleFilterChange('responsible', e.target.value)}
                                        size="sm"
                                    >
                                        <option value="">Todos</option>
                                        {getUniqueValues('responsible').map(responsible => (
                                            <option key={responsible} value={responsible}>{responsible}</option>
                                        ))}
                                    </Form.Select>
                                </Col>

                                <Col md={2}>
                                    <Form.Label>Prioridade</Form.Label>
                                    <Form.Select
                                        value={filters.priority}
                                        onChange={(e) => handleFilterChange('priority', e.target.value)}
                                        size="sm"
                                    >
                                        <option value="">Todas</option>
                                        {getUniqueValues('priority').map(priority => (
                                            <option key={priority} value={priority}>{priority}</option>
                                        ))}
                                    </Form.Select>
                                </Col>

                                <Col md={2}>
                                    <Form.Label>Board</Form.Label>
                                    <Form.Select
                                        value={filters.board}
                                        onChange={(e) => handleFilterChange('board', e.target.value)}
                                        size="sm"
                                    >
                                        <option value="">Todos</option>
                                        {getUniqueValues('board_title').map(board => (
                                            <option key={board} value={board}>{board}</option>
                                        ))}
                                    </Form.Select>
                                </Col>

                                <Col md={2}>
                                    <Form.Label>Zoom</Form.Label>
                                    <Form.Select
                                        value={zoomLevel}
                                        onChange={(e) => setZoomLevel(e.target.value)}
                                        size="sm"
                                    >
                                        <option value="day">Dia</option>
                                        <option value="week">Semana</option>
                                        <option value="month">Mês</option>
                                        <option value="year">Ano</option>
                                    </Form.Select>
                                </Col>

                                <Col md={2} className="d-flex flex-column">
                                    <Form.Label>&nbsp;</Form.Label>
                                    <div>
                                        <Button
                                            variant="outline-secondary"
                                            size="sm"
                                            onClick={clearFilters}
                                            className="me-2"
                                        >
                                            Limpar Filtros
                                        </Button>
                                        <Form.Check
                                            type="checkbox"
                                            label="Agrupar"
                                            checked={showGrouped}
                                            onChange={(e) => setShowGrouped(e.target.checked)}
                                            className="mt-1"
                                        />
                                    </div>
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Stats */}
            <Row className="mb-3">
                <Col>
                    <div className="d-flex gap-3">
                        <Badge bg="primary">
                            Total: {filteredEvents.length} eventos
                        </Badge>
                        <Badge bg="success">
                            Concluídos: {filteredEvents.filter(e => e.status.toLowerCase().includes('concluí') || e.status.toLowerCase() === 'done').length}
                        </Badge>
                        <Badge bg="warning">
                            Em Andamento: {filteredEvents.filter(e => e.status.toLowerCase().includes('andamento') || e.status.toLowerCase() === 'doing').length}
                        </Badge>
                        <Badge bg="secondary">
                            A Fazer: {filteredEvents.filter(e => e.status.toLowerCase().includes('fazer') || e.status.toLowerCase() === 'todo').length}
                        </Badge>
                    </div>
                </Col>
            </Row>

            {/* Timeline */}
            <Row>
                <Col>
                    <Card>
                        <Card.Body style={{ padding: '10px' }}>
                            <div ref={timelineRef} style={{ height: '700px', width: '100%' }} />
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Legend */}
            <Row className="mt-3">
                <Col>
                    <Card>
                        <Card.Header>
                            <strong>Legenda</strong>
                        </Card.Header>
                        <Card.Body>
                            <Row>
                                <Col md={6}>
                                    <h6>Prioridades (cor de fundo):</h6>
                                    <div className="d-flex flex-wrap gap-2 mb-3">
                                        <Badge style={{ backgroundColor: getPriorityColor('baixa') }}>Baixa</Badge>
                                        <Badge style={{ backgroundColor: getPriorityColor('média') }}>Média</Badge>
                                        <Badge style={{ backgroundColor: getPriorityColor('alta') }}>Alta</Badge>
                                        <Badge style={{ backgroundColor: getPriorityColor('crítica') }}>Crítica</Badge>
                                    </div>
                                </Col>
                                <Col md={6}>
                                    <h6>Status (cor da borda):</h6>
                                    <div className="d-flex flex-wrap gap-2">
                                        <Badge style={{ backgroundColor: 'transparent', color: getStatusColor('todo'), border: `2px solid ${getStatusColor('todo')}` }}>A Fazer</Badge>
                                        <Badge style={{ backgroundColor: 'transparent', color: getStatusColor('doing'), border: `2px solid ${getStatusColor('doing')}` }}>Em Andamento</Badge>
                                        <Badge style={{ backgroundColor: 'transparent', color: getStatusColor('done'), border: `2px solid ${getStatusColor('done')}` }}>Concluído</Badge>
                                    </div>
                                </Col>
                            </Row>
                            <div className="mt-2">
                                <small className="text-muted">
                                    Dica: Clique em um evento para abrir o board correspondente. Use a roda do mouse para zoom e arraste para navegar.
                                </small>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Custom CSS for timeline styling */}
            <style>{`
                /* Timeline Event Card Styling */
                .timeline-event-card {
                    padding: 8px 12px;
                    min-width: 180px;
                    max-width: 300px;
                    cursor: pointer;
                }
                
                .timeline-event-title {
                    font-weight: 600;
                    font-size: 14px;
                    color: white;
                    margin-bottom: 4px;
                    line-height: 1.3;
                    word-wrap: break-word;
                }
                
                .timeline-event-info {
                    font-size: 12px;
                    color: rgba(255, 255, 255, 0.9);
                    margin-bottom: 2px;
                }
                
                .timeline-event-board {
                    display: inline-block;
                    padding: 2px 6px;
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 3px;
                    margin-right: 4px;
                }
                
                .timeline-event-responsible {
                    font-size: 11px;
                    color: rgba(255, 255, 255, 0.85);
                    margin-top: 4px;
                }
                
                /* Timeline Group Headers */
                .timeline-group {
                    font-weight: bold;
                    padding: 8px 12px;
                    background: #f8f9fa;
                    border-left: 3px solid #007bff;
                }
                
                /* Timeline Items */
                .vis-timeline .vis-item {
                    border-radius: 6px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.15);
                    border: none !important;
                    min-height: 50px;
                    transition: all 0.2s ease;
                }
                
                .vis-timeline .vis-item:hover {
                    box-shadow: 0 4px 8px rgba(0,0,0,0.25);
                    transform: translateY(-1px);
                }
                
                .vis-timeline .vis-item.vis-selected {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    transform: scale(1.02);
                }
                
                /* Ensure items have minimum width */
                .vis-timeline .vis-item.vis-range,
                .vis-timeline .vis-item.vis-box {
                    min-width: 200px !important;
                }
                
                /* Timeline background and grid */
                .vis-timeline {
                    border: 1px solid #dee2e6;
                    border-radius: 8px;
                    background: #ffffff;
                }
                
                .vis-timeline .vis-time-axis .vis-grid.vis-minor {
                    border-color: #f0f0f0;
                }
                
                .vis-timeline .vis-time-axis .vis-grid.vis-major {
                    border-color: #dee2e6;
                }
                
                /* Current time indicator */
                .vis-timeline .vis-current-time {
                    background-color: #dc3545;
                    width: 2px;
                }
                
                /* Group labels */
                .vis-timeline .vis-labelset .vis-label {
                    background: #f8f9fa;
                    border-bottom: 1px solid #dee2e6;
                    color: #495057;
                    font-weight: 500;
                    padding: 8px 12px;
                }
                
                /* Scrollbar styling */
                .vis-timeline .vis-panel.vis-center {
                    scrollbar-width: thin;
                    scrollbar-color: #dee2e6 #f8f9fa;
                }
                
                .vis-timeline .vis-panel.vis-center::-webkit-scrollbar {
                    height: 8px;
                    width: 8px;
                }
                
                .vis-timeline .vis-panel.vis-center::-webkit-scrollbar-track {
                    background: #f8f9fa;
                }
                
                .vis-timeline .vis-panel.vis-center::-webkit-scrollbar-thumb {
                    background: #dee2e6;
                    border-radius: 4px;
                }
                
                .vis-timeline .vis-panel.vis-center::-webkit-scrollbar-thumb:hover {
                    background: #adb5bd;
                }
            `}</style>
        </Container>
    );
};

export default TimelineView;