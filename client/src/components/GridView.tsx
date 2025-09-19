import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
// Importações corrigidas para AG Grid v34 - Tipos de evento agora são importados dos eventos
import type { 
    ColDef, 
    GridApi,
    GridReadyEvent,
    SelectionChangedEvent,
    CellEditingStoppedEvent
} from 'ag-grid-community';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);
import { Container, Row, Col, Button, Form, InputGroup, Alert, Badge, ButtonGroup, Modal, ProgressBar, Card } from 'react-bootstrap';
import { api } from '../lib/api';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import '../styles/timeline-grid.css';

interface GridCard {
    id: number;
    title: string;
    description?: string;
    board_id: number;
    board_title: string;
    column_title: string;
    status: string;
    priority: string;
    responsible?: string;
    due_date?: string;
    progress?: number;
    created_at: string;
    updated_at: string;
    labels?: string;
}

interface GridFilters {
    globalSearch: string;
    board: string;
    status: string;
    priority: string;
    responsible: string;
}

interface BulkUpdateData {
    ids: number[];
    updates: {
        status?: string;
        priority?: string;
        responsible?: string;
        due_date?: string;
    };
}

// Custom cell renderers
const PriorityRenderer = (params: any) => {
    const priority = params.value?.toLowerCase();
    let variant = 'secondary';
    
    switch (priority) {
        case 'baixa':
            variant = 'success';
            break;
        case 'média':
            variant = 'warning';
            break;
        case 'alta':
            variant = 'danger';
            break;
        case 'crítica':
            variant = 'dark';
            break;
    }
    
    return <Badge bg={variant}>{params.value || 'N/A'}</Badge>;
};

const StatusRenderer = (params: any) => {
    const status = params.value?.toLowerCase();
    let variant = 'secondary';
    
    if (status?.includes('concluí') || status === 'done') {
        variant = 'success';
    } else if (status?.includes('andamento') || status === 'doing') {
        variant = 'primary';
    } else if (status?.includes('fazer') || status === 'todo') {
        variant = 'secondary';
    }
    
    return <Badge bg={variant}>{params.value || 'N/A'}</Badge>;
};

const ProgressRenderer = (params: any) => {
    const progress = params.value || 0;
    let variant = 'secondary';
    
    if (progress >= 75) variant = 'success';
    else if (progress >= 50) variant = 'info';
    else if (progress >= 25) variant = 'warning';
    else if (progress > 0) variant = 'danger';
    
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ProgressBar 
                now={progress} 
                variant={variant} 
                style={{ flexGrow: 1, height: '20px' }}
            />
            <small>{progress}%</small>
        </div>
    );
};

const DueDateRenderer = (params: any) => {
    if (!params.value) return <span className="text-muted">Sem prazo</span>;
    
    const dueDate = new Date(params.value);
    const today = new Date();
    const isOverdue = dueDate < today;
    const isToday = dueDate.toDateString() === today.toDateString();
    
    let className = 'text-muted';
    if (isOverdue) className = 'text-danger fw-bold';
    else if (isToday) className = 'text-warning fw-bold';
    
    return (
        <span className={className}>
            {dueDate.toLocaleDateString('pt-BR')}
            {isOverdue && ' (Atrasado)'}
            {isToday && ' (Hoje)'}
        </span>
    );
};

const GridView: React.FC = () => {
    const [gridData, setGridData] = useState<GridCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [gridApi, setGridApi] = useState<GridApi | null>(null);
    const [selectedRows, setSelectedRows] = useState<GridCard[]>([]);
    
    const handleDeleteCard = async (cardId: number) => {
        if (!window.confirm('Tem certeza que deseja excluir este card?')) {
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await api.delete(`/cards/${cardId}`);
            setGridData(prev => prev.filter(card => card.id !== cardId));
            if (gridApi) {
                gridApi.deselectAll();
            }
        } catch (err) {
            console.error('Error deleting card:', err);
            setError('Erro ao excluir card.');
        } finally {
            setLoading(false);
        }
    };

    // Filters
    const [filters, setFilters] = useState<GridFilters>({
        globalSearch: '',
        board: '',
        status: '',
        priority: '',
        responsible: ''
    });
    
    // Bulk update modal
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkUpdates, setBulkUpdates] = useState({
        status: '',
        priority: '',
        responsible: '',
        due_date: ''
    });
    
    // Export state
    const [exporting, setExporting] = useState(false);

    // Column definitions
    const columnDefs: ColDef[] = useMemo(() => [
        {
            headerName: '',
            width: 70, // Increased width to accommodate the button
            pinned: 'left',
            lockPosition: true,
            cellRenderer: (params: any) => {
                return (
                    <Button 
                        variant="danger" 
                        size="sm" 
                        onClick={() => handleDeleteCard(params.data.id)}
                        title="Excluir Card"
                    >
                        🗑️
                    </Button>
                );
            }
        },
        {
            headerName: 'ID',
            field: 'id',
            width: 70,
            pinned: 'left',
            sort: 'desc'
        },
        {
            headerName: 'Título',
            field: 'title',
            width: 300,
            pinned: 'left',
            editable: true,
            cellStyle: { fontWeight: 'bold' }
        },
        {
            headerName: 'Board',
            field: 'board_title',
            width: 150,
            filter: true
        },
        {
            headerName: 'Coluna',
            field: 'column_title',
            width: 120,
            filter: true
        },
        {
            headerName: 'Status',
            field: 'status',
            width: 120,
            cellRenderer: StatusRenderer,
            filter: true,
            editable: true,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
                values: ['A Fazer', 'Em Andamento', 'Concluído']
            }
        },
        {
            headerName: 'Prioridade',
            field: 'priority',
            width: 120,
            cellRenderer: PriorityRenderer,
            filter: true,
            editable: true,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
                values: ['Baixa', 'Média', 'Alta', 'Crítica']
            }
        },
        {
            headerName: 'Responsável',
            field: 'responsible',
            width: 150,
            filter: true,
            editable: true
        },
        {
            headerName: 'Prazo',
            field: 'due_date',
            width: 150,
            cellRenderer: DueDateRenderer,
            filter: 'agDateColumnFilter',
            editable: true,
            cellEditor: 'agDateCellEditor'
        },
        {
            headerName: 'Progresso',
            field: 'progress',
            width: 150,
            cellRenderer: ProgressRenderer,
            editable: true,
            cellEditor: 'agNumberCellEditor',
            cellEditorParams: {
                min: 0,
                max: 100
            }
        },
        {
            headerName: 'Criado em',
            field: 'created_at',
            width: 130,
            filter: 'agDateColumnFilter',
            valueFormatter: (params) => {
                return params.value ? new Date(params.value).toLocaleDateString('pt-BR') : '';
            }
        },
        {
            headerName: 'Atualizado em',
            field: 'updated_at',
            width: 130,
            filter: 'agDateColumnFilter',
            valueFormatter: (params) => {
                return params.value ? new Date(params.value).toLocaleDateString('pt-BR') : '';
            }
        },
        {
            headerName: 'Descrição',
            field: 'description',
            width: 300,
            editable: true,
            cellEditor: 'agLargeTextCellEditor',
            cellEditorPopup: true,
            valueFormatter: (params) => {
                if (!params.value) return '';
                return params.value.length > 50 ? params.value.substring(0, 50) + '...' : params.value;
            },
            tooltipField: 'description'
        }
    ], []);

    // Default column definition
    const defaultColDef: ColDef = useMemo(() => ({
        resizable: true,
        sortable: true,
        filter: true,
        floatingFilter: true
    }), []);

    // Get unique filter values
    const getUniqueValues = useCallback((field: keyof GridCard) => {
        return [...new Set(gridData.map(item => item[field]).filter(Boolean))];
    }, [gridData]);

    // Fetch grid data
    const fetchGridData = async () => {
        setLoading(true);
        setError(null);
        
        try {
            const response = await api.get('/grid/data');
            setGridData(response.data.data || []);
        } catch (err) {
            console.error('Error fetching grid data:', err);
            setError('Erro ao carregar dados da tabela.');
        } finally {
            setLoading(false);
        }
    };

    // Handle grid ready
    const onGridReady = useCallback((params: GridReadyEvent) => {
        setGridApi(params.api);
        params.api.sizeColumnsToFit();
    }, []);

    // Handle selection change
    const onSelectionChanged = useCallback((event: SelectionChangedEvent) => {
        const selectedRows = event.api.getSelectedRows();
        setSelectedRows(selectedRows);
    }, []);

    // Handle cell editing
    const onCellEditingStopped = useCallback(async (event: CellEditingStoppedEvent) => {
        if (event.valueChanged && event.data) {
            try {
                const updates = { [event.colDef.field!]: event.newValue };
                await api.put(`/cards/${event.data.id}`, updates);
                
                // Update local data
                setGridData(prev => prev.map(item => 
                    item.id === event.data.id ? { ...item, ...updates } : item
                ));
            } catch (err) {
                console.error('Error updating card:', err);
                setError('Erro ao atualizar card.');
                // Revert the change - AG Grid v34 usa rowNodes em vez de nodes
                event.api.refreshCells({ rowNodes: [event.node!], force: true });
            }
        }
    }, []);

    // Apply filters
    const applyFilters = useCallback(() => {
        if (!gridApi) return;

        // AG Grid v34 usa setGridOption para quickFilter em vez de setQuickFilter
        gridApi.setGridOption('quickFilterText', filters.globalSearch);

        // Apply column filters
        const filterModel: any = {};
        
        if (filters.board) {
            filterModel.board_title = {
                type: 'equals',
                filter: filters.board
            };
        }
        
        if (filters.status) {
            filterModel.status = {
                type: 'equals',
                filter: filters.status
            };
        }
        
        if (filters.priority) {
            filterModel.priority = {
                type: 'equals',
                filter: filters.priority
            };
        }
        
        if (filters.responsible) {
            filterModel.responsible = {
                type: 'equals',
                filter: filters.responsible
            };
        }

        gridApi.setFilterModel(filterModel);
    }, [gridApi, filters]);

    // Clear all filters
    const clearFilters = useCallback(() => {
        setFilters({
            globalSearch: '',
            board: '',
            status: '',
            priority: '',
            responsible: ''
        });
        
        if (gridApi) {
            // AG Grid v34 usa setGridOption para quickFilter em vez de setQuickFilter
            gridApi.setGridOption('quickFilterText', '');
            gridApi.setFilterModel(null);
        }
    }, [gridApi]);

    // Handle bulk update
    const handleBulkUpdate = async () => {
        if (selectedRows.length === 0) return;

        const updates: any = {};
        if (bulkUpdates.status) updates.status = bulkUpdates.status;
        if (bulkUpdates.priority) updates.priority = bulkUpdates.priority;
        if (bulkUpdates.responsible) updates.responsible = bulkUpdates.responsible;
        if (bulkUpdates.due_date) updates.due_date = bulkUpdates.due_date;

        if (Object.keys(updates).length === 0) return;

        try {
            const bulkData: BulkUpdateData = {
                ids: selectedRows.map(row => row.id),
                updates
            };

            await api.put('/grid/bulk-update', bulkData);
            
            // Update local data
            setGridData(prev => prev.map(item => 
                selectedRows.some(row => row.id === item.id) 
                    ? { ...item, ...updates }
                    : item
            ));
            
            setShowBulkModal(false);
            setBulkUpdates({ status: '', priority: '', responsible: '', due_date: '' });
            
            if (gridApi) {
                gridApi.deselectAll();
            }
            
        } catch (err) {
            console.error('Error bulk updating:', err);
            setError('Erro ao atualizar cards em massa.');
        }
    };

    // Handle export
    const handleExport = async (format: 'excel' | 'csv') => {
        setExporting(true);
        
        try {
            const response = await api.get(`/grid/export?format=${format}`, {
                responseType: 'blob'
            });
            
            const blob = new Blob([response.data], {
                type: format === 'excel' 
                    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    : 'text/csv'
            });
            
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `cards_export.${format === 'excel' ? 'xlsx' : 'csv'}`;
            link.click();
            
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error exporting:', err);
            setError('Erro ao exportar dados.');
        } finally {
            setExporting(false);
        }
    };

    // Effects
    useEffect(() => {
        fetchGridData();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [applyFilters]);

    if (loading) {
        return (
            <Container>
                <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
                    <div className="text-center">
                        <div className="spinner-border" role="status">
                            <span className="visually-hidden">Carregando...</span>
                        </div>
                        <p className="mt-2">Carregando dados...</p>
                    </div>
                </div>
            </Container>
        );
    }

    return (
        <Container fluid>
            {/* Header */}
            <Row className="mb-4">
                <Col>
                    <h1>Vista Tabela</h1>
                    <p className="text-muted">
                        Visualização em grade com funcionalidades avançadas de filtro e edição
                    </p>
                </Col>
            </Row>

            {error && (
                <Alert variant="danger" dismissible onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Controls */}
            <Row className="mb-4">
                <Col>
                    <Card>
                        <Card.Body>
                            <Row className="align-items-end">
                                {/* Search */}
                                <Col md={3}>
                                    <Form.Label>Busca Global</Form.Label>
                                    <InputGroup>
                                        <Form.Control
                                            type="text"
                                            placeholder="Buscar em todos os campos..."
                                            value={filters.globalSearch}
                                            onChange={(e) => setFilters(prev => ({ ...prev, globalSearch: e.target.value }))}
                                        />
                                        <Button 
                                            variant="outline-secondary" 
                                            onClick={() => setFilters(prev => ({ ...prev, globalSearch: '' }))}
                                        >
                                            ✕
                                        </Button>
                                    </InputGroup>
                                </Col>

                                {/* Filters */}
                                <Col md={2}>
                                    <Form.Label>Board</Form.Label>
                                    <Form.Select
                                        value={filters.board}
                                        onChange={(e) => setFilters(prev => ({ ...prev, board: e.target.value }))}
                                    >
                                        <option value="">Todos</option>
                                        {getUniqueValues('board_title').map(board => (
                                            <option key={board} value={board}>{board}</option>
                                        ))}
                                    </Form.Select>
                                </Col>

                                <Col md={1}>
                                    <Form.Label>Status</Form.Label>
                                    <Form.Select
                                        value={filters.status}
                                        onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                                    >
                                        <option value="">Todos</option>
                                        {getUniqueValues('status').map(status => (
                                            <option key={status} value={status}>{status}</option>
                                        ))}
                                    </Form.Select>
                                </Col>

                                <Col md={1}>
                                    <Form.Label>Prioridade</Form.Label>
                                    <Form.Select
                                        value={filters.priority}
                                        onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                                    >
                                        <option value="">Todas</option>
                                        {getUniqueValues('priority').map(priority => (
                                            <option key={priority} value={priority}>{priority}</option>
                                        ))}
                                    </Form.Select>
                                </Col>

                                <Col md={2}>
                                    <Form.Label>Responsável</Form.Label>
                                    <Form.Select
                                        value={filters.responsible}
                                        onChange={(e) => setFilters(prev => ({ ...prev, responsible: e.target.value }))}
                                    >
                                        <option value="">Todos</option>
                                        {getUniqueValues('responsible').map(responsible => (
                                            <option key={responsible} value={responsible}>{responsible}</option>
                                        ))}
                                    </Form.Select>
                                </Col>

                                {/* Actions */}
                                <Col md={3}>
                                    <Form.Label>&nbsp;</Form.Label>
                                    <div className="d-flex gap-2">
                                        <Button variant="outline-secondary" size="sm" onClick={clearFilters}>
                                            Limpar Filtros
                                        </Button>
                                        <Button
                                            variant="primary"
                                            size="sm"
                                            disabled={selectedRows.length === 0}
                                            onClick={() => setShowBulkModal(true)}
                                        >
                                            Edição em Massa ({selectedRows.length})
                                        </Button>
                                        <ButtonGroup size="sm">
                                            <Button
                                                variant="success"
                                                onClick={() => handleExport('excel')}
                                                disabled={exporting}
                                            >
                                                {exporting ? 'Exportando...' : 'Excel'}
                                            </Button>
                                            <Button
                                                variant="success"
                                                onClick={() => handleExport('csv')}
                                                disabled={exporting}
                                            >
                                                CSV
                                            </Button>
                                        </ButtonGroup>
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
                        <Badge bg="primary">Total: {gridData.length} cards</Badge>
                        <Badge bg="success">
                            Concluídos: {gridData.filter(c => c.status?.toLowerCase().includes('concluí') || c.status?.toLowerCase() === 'done').length}
                        </Badge>
                        <Badge bg="warning">
                            Em Andamento: {gridData.filter(c => c.status?.toLowerCase().includes('andamento') || c.status?.toLowerCase() === 'doing').length}
                        </Badge>
                        <Badge bg="secondary">
                            A Fazer: {gridData.filter(c => c.status?.toLowerCase().includes('fazer') || c.status?.toLowerCase() === 'todo').length}
                        </Badge>
                        {selectedRows.length > 0 && (
                            <Badge bg="info">Selecionados: {selectedRows.length}</Badge>
                        )}
                    </div>
                </Col>
            </Row>

            {/* Grid */}
            <Row>
                <Col>
                    <div className="ag-theme-alpine" style={{ height: '600px', width: '100%' }}>
                        <AgGridReact
                            rowData={gridData}
                            columnDefs={columnDefs}
                            defaultColDef={defaultColDef}
                            rowSelection={{
                                mode: 'multiRow',
                                checkboxes: true,
                                headerCheckbox: true,
                                enableClickSelection: false
                            }}
                            onGridReady={onGridReady}
                            onSelectionChanged={onSelectionChanged}
                            onCellEditingStopped={onCellEditingStopped}
                            pagination={true}
                            paginationPageSize={50}
                            paginationPageSizeSelector={[25, 50, 100, 200]}
                            enableCellTextSelection={true}
                        />
                    </div>
                </Col>
            </Row>

            {/* Bulk Update Modal */}
            <Modal show={showBulkModal} onHide={() => setShowBulkModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>Edição em Massa</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Atualizando {selectedRows.length} cards selecionados:</p>
                    
                    <Row>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Status</Form.Label>
                                <Form.Select
                                    value={bulkUpdates.status}
                                    onChange={(e) => setBulkUpdates(prev => ({ ...prev, status: e.target.value }))}
                                >
                                    <option value="">Não alterar</option>
                                    <option value="A Fazer">A Fazer</option>
                                    <option value="Em Andamento">Em Andamento</option>
                                    <option value="Concluído">Concluído</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Prioridade</Form.Label>
                                <Form.Select
                                    value={bulkUpdates.priority}
                                    onChange={(e) => setBulkUpdates(prev => ({ ...prev, priority: e.target.value }))}
                                >
                                    <option value="">Não alterar</option>
                                    <option value="Baixa">Baixa</option>
                                    <option value="Média">Média</option>
                                    <option value="Alta">Alta</option>
                                    <option value="Crítica">Crítica</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                    </Row>
                    
                    <Row>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Responsável</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="Não alterar"
                                    value={bulkUpdates.responsible}
                                    onChange={(e) => setBulkUpdates(prev => ({ ...prev, responsible: e.target.value }))}
                                />
                            </Form.Group>
                        </Col>
                        
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>Data de Vencimento</Form.Label>
                                <Form.Control
                                    type="date"
                                    value={bulkUpdates.due_date}
                                    onChange={(e) => setBulkUpdates(prev => ({ ...prev, due_date: e.target.value }))}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowBulkModal(false)}>
                        Cancelar
                    </Button>
                    <Button variant="primary" onClick={handleBulkUpdate}>
                        Aplicar Alterações
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Instructions */}
            <Row className="mt-3">
                <Col>
                    <Card>
                        <Card.Body>
                            <h6>Instruções de Uso:</h6>
                            <ul className="mb-0">
                                <li><strong>Edição:</strong> Clique duas vezes em uma célula para editar</li>
                                <li><strong>Seleção:</strong> Use as checkboxes para selecionar múltiplas linhas</li>
                                <li><strong>Ordenação:</strong> Clique nos cabeçalhos das colunas para ordenar</li>
                                <li><strong>Filtros:</strong> Use os filtros flutuantes sob os cabeçalhos ou os controles acima</li>
                                <li><strong>Redimensionar:</strong> Arraste as bordas das colunas para redimensionar</li>
                                <li><strong>Exportar:</strong> Use os botões Excel/CSV para exportar os dados</li>
                            </ul>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default GridView;