import { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Button, Alert, Form, Modal, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
// Tipos removidos devido a incompatibilidade de versão
import { api } from '../lib/api';

interface CalendarEvent {
    id: string;
    title: string;
    start: string;
    backgroundColor: string;
    borderColor: string;
    textColor: string;
    extendedProps: {
        description: string;
        priority: 'critical' | 'high' | 'medium' | 'low';
        status: 'todo' | 'in_progress' | 'completed';
        boardTitle: string;
        responsible: string;
        boardId: number;
        columnTitle: string;
    };
}

const CalendarView = () => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [filteredEvents, setFilteredEvents] = useState<CalendarEvent[]>([]);
    const [originalEvents, setOriginalEvents] = useState<any[]>([]); // Store original API data for filtering
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [showEventModal, setShowEventModal] = useState(false);
    const navigate = useNavigate();
    const calendarRef = useRef<FullCalendar>(null);

    // Filter states
    const [filterResponsible, setFilterResponsible] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterPriority, setFilterPriority] = useState<string>('all');
    
    // Get unique values for filters
    const [responsibleList, setResponsibleList] = useState<string[]>([]);

    const fetchEvents = async () => {
        setLoading(true);
        setError(null);
        try {
            console.log('📅 Fetching calendar events...');
            const response = await api.get('/calendar/events');
            const eventsData = response.data.data.map((event: any, index: number) => {
                console.log(`📊 Processing event ${index + 1}/${response.data.data.length}:`, event.title, 'Original start:', event.start);
                
                // Safely format the date to handle both "YYYY-MM-DD HH:mm:ss" and "YYYY-MM-DD" formats
                let formattedStart: string;
                try {
                    if (event.start.includes(' ')) {
                        // Has time: "2025-01-15 10:00:00" -> "2025-01-15T10:00:00"
                        formattedStart = new Date(event.start.replace(' ', 'T')).toISOString();
                        console.log('✅ Formatted with time:', event.title, '→', formattedStart);
                    } else {
                        // Only date: "2025-11-10" -> "2025-11-10T00:00:00"
                        formattedStart = new Date(event.start + 'T00:00:00').toISOString();
                        console.log('✅ Formatted date only:', event.title, '→', formattedStart);
                    }
                } catch (error) {
                    console.error('❌ Date formatting error for event:', event.title, event.start, error);
                    // Fallback to current date if parsing fails
                    formattedStart = new Date().toISOString();
                }

                const formattedEvent = {
                    id: String(event.id),
                    title: event.title,
                    start: formattedStart,
                    backgroundColor: event.backgroundColor,
                    borderColor: event.borderColor,
                    textColor: event.textColor,
                    // Keep extendedProps for event details and filtering
                    extendedProps: event.extendedProps
                };
                console.log('🔧 Final formatted event:', {
                    id: formattedEvent.id,
                    title: formattedEvent.title,
                    start: formattedEvent.start,
                    color: formattedEvent.backgroundColor
                });
                return formattedEvent;
            });
            console.log('✅ Successfully loaded', eventsData.length, 'events');
            console.log('📅 All formatted events:', eventsData);
            setEvents(eventsData);
            setFilteredEvents(eventsData);
            
            // Store original API data for filtering
            setOriginalEvents(response.data.data);
            
            // Extract unique responsible names for filter (excluding null values)
            const uniqueResponsible = [...new Set(response.data.data.map((event: any) => event.extendedProps?.responsible).filter(r => r !== null && r !== undefined))];
            console.log('📋 Unique responsible list:', uniqueResponsible);
            setResponsibleList(uniqueResponsible as string[]);
        } catch (err: any) {
            setError('Erro ao carregar eventos do calendário.');
            console.error('❌ Calendar fetch error:', err);
            console.error('❌ Error response:', err.response);
            console.error('❌ Error headers:', err.response?.headers);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    // Apply filters
    useEffect(() => {
        let filtered = events;
        console.log('🔍 Applying filters to', events.length, 'events');
        console.log('🔍 Current filter values:', {
            responsible: filterResponsible,
            status: filterStatus,
            priority: filterPriority
        });

        if (filterResponsible !== 'all') {
            filtered = filtered.filter((event) => {
                const responsible = event.extendedProps?.responsible;
                console.log('🔍 Filtering event:', event.title, 'responsible:', responsible, 'filter:', filterResponsible);
                // Handle null/undefined responsible values
                if (!responsible && filterResponsible === 'no-responsible') {
                    return true;
                }
                return responsible === filterResponsible;
            });
            console.log('🔍 After responsible filter:', filtered.length, 'events');
        }

        if (filterStatus !== 'all') {
            filtered = filtered.filter((event) => {
                const status = event.extendedProps?.status;
                // Handle both "in_progress" and "in-progress" formats
                const normalizedStatus = status?.replace('-', '_');
                const normalizedFilter = filterStatus.replace('-', '_');
                console.log(`🔍 Checking status: ${status} (normalized: ${normalizedStatus}) vs filter: ${filterStatus} (normalized: ${normalizedFilter})`);
                return normalizedStatus === normalizedFilter;
            });
            console.log('🔍 After status filter:', filtered.length, 'events');
        }

        if (filterPriority !== 'all') {
            filtered = filtered.filter((event) => {
                return event.extendedProps?.priority === filterPriority;
            });
            console.log('🔍 After priority filter:', filtered.length, 'events');
        }

        console.log('🔍 Final filtered events:', filtered.length);
        console.log('📋 Events being sent to FullCalendar:', filtered.map(e => ({
            id: e.id,
            title: e.title,
            start: e.start
        })));
        setFilteredEvents(filtered);
    }, [events, originalEvents, filterResponsible, filterStatus, filterPriority]);

    const handleEventClick = (clickInfo: any) => {
        const event = clickInfo.event;
        const calendarEvent: CalendarEvent = {
            id: event.id,
            title: event.title,
            start: event.startStr,
            backgroundColor: event.backgroundColor || '#6c757d',
            borderColor: event.borderColor || '#5c636a',
            textColor: event.textColor || '#ffffff',
            extendedProps: event.extendedProps as CalendarEvent['extendedProps']
        };
        setSelectedEvent(calendarEvent);
        setShowEventModal(true);
    };

    const handleEventDrop = async (dropInfo: any) => {
        try {
            const eventId = dropInfo.event.id;
            const newStart = dropInfo.event.start?.toISOString();
            
            if (!newStart) {
                dropInfo.revert();
                return;
            }

            await api.put(`/calendar/events/${eventId}`, {
                start: newStart
            });

            // Update local state
            setEvents(prevEvents => 
                prevEvents.map(event => 
                    event.id === eventId 
                        ? { ...event, start: newStart }
                        : event
                )
            );

            setError(null);
        } catch (err: any) {
            dropInfo.revert();
            setError('Erro ao atualizar data do evento.');
            console.error('Event drop error:', err);
        }
    };

    const goToBoard = (boardId: number) => {
        navigate(`/boards/${boardId}`);
        setShowEventModal(false);
    };

    const resetFilters = () => {
        setFilterResponsible('all');
        setFilterStatus('all');
        setFilterPriority('all');
    };

    const getPriorityLabel = (priority: string) => {
        const labels = {
            critical: 'Crítica',
            high: 'Alta',
            medium: 'Média',
            low: 'Baixa'
        };
        return labels[priority as keyof typeof labels] || 'Média';
    };

    const getStatusLabel = (status: string) => {
        const labels = {
            todo: 'A Fazer',
            in_progress: 'Em Andamento',
            completed: 'Concluído'
        };
        return labels[status as keyof typeof labels] || 'A Fazer';
    };

    const getPriorityVariant = (priority: string) => {
        const variants = {
            critical: 'danger',
            high: 'warning',
            medium: 'primary',
            low: 'success'
        };
        return variants[priority as keyof typeof variants] || 'secondary';
    };

    const getStatusVariant = (status: string) => {
        const variants = {
            todo: 'secondary',
            in_progress: 'warning',
            completed: 'success'
        };
        return variants[status as keyof typeof variants] || 'secondary';
    };

    return (
        <Container fluid>
            <Row className="align-items-center mb-4">
                <Col>
                    <h1>📅 Vista Calendário</h1>
                    <p className="text-muted">Visualize e gerencie seus compromissos em formato de calendário</p>
                </Col>
                <Col xs="auto">
                    <Button variant="outline-primary" onClick={() => navigate('/')}>
                        ← Voltar ao Dashboard
                    </Button>
                </Col>
            </Row>

            {error && <Alert variant="danger">{error}</Alert>}

            {/* Filters */}
            <Row className="mb-4">
                <Col md={3}>
                    <Form.Group>
                        <Form.Label>Responsável</Form.Label>
                        <Form.Select 
                            value={filterResponsible}
                            onChange={(e) => setFilterResponsible(e.target.value)}
                        >
                            <option value="all">Todos os responsáveis</option>
                            <option value="no-responsible">Sem responsável</option>
                            {responsibleList.map(responsible => (
                                <option key={responsible} value={responsible}>
                                    {responsible}
                                </option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                </Col>
                <Col md={3}>
                    <Form.Group>
                        <Form.Label>Status</Form.Label>
                        <Form.Select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="all">Todos os status</option>
                            <option value="todo">A Fazer</option>
                            <option value="in_progress">Em Andamento</option>
                            <option value="completed">Concluído</option>
                        </Form.Select>
                    </Form.Group>
                </Col>
                <Col md={3}>
                    <Form.Group>
                        <Form.Label>Prioridade</Form.Label>
                        <Form.Select
                            value={filterPriority}
                            onChange={(e) => setFilterPriority(e.target.value)}
                        >
                            <option value="all">Todas as prioridades</option>
                            <option value="critical">Crítica</option>
                            <option value="high">Alta</option>
                            <option value="medium">Média</option>
                            <option value="low">Baixa</option>
                        </Form.Select>
                    </Form.Group>
                </Col>
                <Col md={3} className="d-flex align-items-end">
                    <Button variant="outline-secondary" onClick={resetFilters}>
                        Limpar Filtros
                    </Button>
                </Col>
            </Row>

            {/* Calendar */}
            <Row>
                <Col>
                    <div className="calendar-container">
                        {loading ? (
                            <div className="text-center p-4">
                                <div className="spinner-border" role="status">
                                    <span className="visually-hidden">Carregando...</span>
                                </div>
                                <p className="mt-2">Carregando eventos...</p>
                            </div>
                        ) : (
                            <FullCalendar
                                ref={calendarRef}
                                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                                initialView="dayGridMonth"
                                headerToolbar={{
                                    left: 'prev,next today',
                                    center: 'title',
                                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                                }}
                                events={filteredEvents}
                                eventClick={handleEventClick}
                                eventDrop={handleEventDrop}
                                editable={true}
                                droppable={true}
                                selectable={true}
                                dayMaxEvents={true}
                                height="600px"
                                eventDidMount={(info) => {
                                    console.log('✅ Event mounted in calendar:', info.event.title, 'Start:', info.event.startStr);
                                }}
                                eventWillUnmount={(info) => {
                                    console.log('❌ Event unmounting from calendar:', info.event.title);
                                }}
                                locale="pt-br"
                                buttonText={{
                                    today: 'Hoje',
                                    month: 'Mês',
                                    week: 'Semana',
                                    day: 'Dia'
                                }}
                                eventDisplay="block"
                                eventTextColor="#ffffff"
                                eventTimeFormat={{
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    meridiem: false
                                }}
                                eventDidMount={(info) => {
                                    console.log('🎯 FullCalendar event mounted:', info.event.title, info.event.start);
                                }}
                                eventWillUnmount={(info) => {
                                    console.log('🎯 FullCalendar event unmounting:', info.event.title);
                                }}
                            />
                        )}
                    </div>
                </Col>
            </Row>

            {/* Legend */}
            <div className="d-flex align-items-center gap-3 mt-3 mb-2 px-2 small text-muted">
                <span className="fw-bold">Legenda:</span>
                <span className="d-flex align-items-center gap-1">
                    <span style={{
                        width: '10px', 
                        height: '10px', 
                        backgroundColor: '#dc3545',
                        borderRadius: '2px',
                        display: 'inline-block'
                    }}></span>
                    Crítica
                </span>
                <span className="d-flex align-items-center gap-1">
                    <span style={{
                        width: '10px', 
                        height: '10px', 
                        backgroundColor: '#fd7e14',
                        borderRadius: '2px',
                        display: 'inline-block'
                    }}></span>
                    Alta
                </span>
                <span className="d-flex align-items-center gap-1">
                    <span style={{
                        width: '10px', 
                        height: '10px', 
                        backgroundColor: '#0d6efd',
                        borderRadius: '2px',
                        display: 'inline-block'
                    }}></span>
                    Média
                </span>
                <span className="d-flex align-items-center gap-1">
                    <span style={{
                        width: '10px', 
                        height: '10px', 
                        backgroundColor: '#198754',
                        borderRadius: '2px',
                        display: 'inline-block'
                    }}></span>
                    Baixa
                </span>
                <span className="d-flex align-items-center gap-1">
                    <span style={{
                        width: '10px', 
                        height: '10px', 
                        backgroundColor: '#6c757d80',
                        borderRadius: '2px',
                        display: 'inline-block'
                    }}></span>
                    Concluída
                </span>
            </div>

            {/* Event Details Modal */}
            <Modal show={showEventModal} onHide={() => setShowEventModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>Detalhes do Compromisso</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {selectedEvent && (
                        <div>
                            <h5>{selectedEvent.title}</h5>
                            
                            {selectedEvent.extendedProps.description && (
                                <div className="mb-3">
                                    <strong>Descrição:</strong>
                                    <p className="mt-1">{selectedEvent.extendedProps.description}</p>
                                </div>
                            )}
                            
                            <div className="mb-3">
                                <strong>Data/Hora:</strong>
                                <p className="mt-1">
                                    {new Date(selectedEvent.start).toLocaleString('pt-BR')}
                                </p>
                            </div>
                            
                            <div className="mb-3">
                                <strong>Quadro:</strong>
                                <p className="mt-1">
                                    {selectedEvent.extendedProps.boardTitle}
                                    <Button 
                                        variant="link" 
                                        size="sm" 
                                        onClick={() => goToBoard(selectedEvent.extendedProps.boardId)}
                                        className="ms-2"
                                    >
                                        Abrir Quadro →
                                    </Button>
                                </p>
                            </div>
                            
                            <div className="mb-3">
                                <strong>Coluna:</strong>
                                <p className="mt-1">{selectedEvent.extendedProps.columnTitle}</p>
                            </div>
                            
                            <div className="mb-3">
                                <strong>Responsável:</strong>
                                <p className="mt-1">{selectedEvent.extendedProps.responsible}</p>
                            </div>
                            
                            <div className="mb-3 d-flex gap-2">
                                <Badge bg={getPriorityVariant(selectedEvent.extendedProps.priority)}>
                                    {getPriorityLabel(selectedEvent.extendedProps.priority)}
                                </Badge>
                                <Badge bg={getStatusVariant(selectedEvent.extendedProps.status)}>
                                    {getStatusLabel(selectedEvent.extendedProps.status)}
                                </Badge>
                            </div>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowEventModal(false)}>
                        Fechar
                    </Button>
                    {selectedEvent && (
                        <Button 
                            variant="primary" 
                            onClick={() => goToBoard(selectedEvent.extendedProps.boardId)}
                        >
                            Ir para o Quadro
                        </Button>
                    )}
                </Modal.Footer>
            </Modal>

            {/* Custom CSS */}
            <style>{`
                .calendar-container .fc {
                    font-family: inherit;
                }
                .calendar-container .fc-event {
                    font-size: 0.875rem;
                    font-weight: 500;
                    border: none !important;
                    cursor: pointer;
                }
                .calendar-container .fc-event:hover {
                    filter: brightness(1.1);
                }
                .calendar-container .fc-daygrid-event {
                    border-radius: 4px;
                    margin: 1px;
                }
                .calendar-container .fc-button {
                    background-color: var(--bs-primary);
                    border-color: var(--bs-primary);
                }
                .calendar-container .fc-button:hover {
                    background-color: var(--bs-primary);
                    border-color: var(--bs-primary);
                    filter: brightness(0.9);
                }
                .calendar-container .fc-button-active {
                    background-color: var(--bs-primary) !important;
                    border-color: var(--bs-primary) !important;
                }
                .calendar-container .fc-today {
                    background-color: rgba(var(--bs-primary-rgb), 0.1) !important;
                }
            `}</style>
        </Container>
    );
};

export default CalendarView;