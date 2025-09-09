import React, { useState, useEffect, useRef } from 'react';
import { Form, ListGroup, Badge, Spinner, Alert, Modal, Button } from 'react-bootstrap';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';

interface SearchResult {
  boards: Array<{
    id: number;
    title: string;
    type: 'board';
  }>;
  cards: Array<{
    id: number;
    title: string;
    description?: string;
    column_id: number;
    board_id: number;
    board_title: string;
    column_title: string;
    type: 'card';
  }>;
  comments: Array<{
    id: number;
    content: string;
    card_id: number;
    card_title: string;
    board_id: number;
    board_title: string;
    type: 'comment';
  }>;
  labels: Array<{
    id: number;
    name: string;
    color: string;
    board_id: number;
    board_title: string;
    type: 'label';
  }>;
}

interface SearchResponse {
  query: string;
  results: SearchResult;
  total: number;
}

interface GlobalSearchProps {
  show: boolean;
  onHide: () => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ show, onHide }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filterOptions = [
    { value: 'boards', label: 'Boards', icon: '📋' },
    { value: 'cards', label: 'Cards', icon: '📝' },
    { value: 'comments', label: 'Comments', icon: '💬' },
    { value: 'labels', label: 'Labels', icon: '🏷️' }
  ];

  useEffect(() => {
    if (show && searchInputRef.current) {
      // Focus search input when modal opens
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [show]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim().length >= 2) {
        performSearch();
      } else {
        setResults(null);
      }
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [query, selectedFilters]);

  const performSearch = async () => {
    if (query.trim().length < 2) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: query.trim()
      });

      if (selectedFilters.length > 0) {
        params.append('type', selectedFilters.join(','));
      }

      const response = await api.get(`/search?${params.toString()}`);
      setResults(response.data.results);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao realizar busca');
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterToggle = (filterValue: string) => {
    setSelectedFilters(prev => 
      prev.includes(filterValue) 
        ? prev.filter(f => f !== filterValue)
        : [...prev, filterValue]
    );
  };

  const handleResultClick = (result: any) => {
    switch (result.type) {
      case 'board':
        navigate(`/boards/${result.id}`);
        break;
      case 'card':
        navigate(`/boards/${result.board_id}`);
        // TODO: Open card modal after navigation
        break;
      case 'comment':
        navigate(`/boards/${result.board_id}`);
        // TODO: Open card modal and scroll to comment
        break;
      case 'label':
        navigate(`/boards/${result.board_id}`);
        break;
    }
    onHide();
  };

  const highlightText = (text: string, searchQuery: string) => {
    if (!searchQuery.trim()) return text;
    
    const regex = new RegExp(`(${searchQuery.trim().replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} style={{ backgroundColor: '#fff3cd', padding: '1px 2px' }}>
          {part}
        </mark>
      ) : part
    );
  };

  const getResultIcon = (type: string) => {
    const icons = {
      board: '📋',
      card: '📝', 
      comment: '💬',
      label: '🏷️'
    };
    return icons[type as keyof typeof icons] || '📄';
  };

  const getTotalResults = () => {
    if (!results) return 0;
    return results.boards.length + results.cards.length + results.comments.length + results.labels.length;
  };

  const renderResults = () => {
    if (!results) return null;

    const allResults = [
      ...results.boards,
      ...results.cards,
      ...results.comments,
      ...results.labels
    ];

    if (allResults.length === 0) {
      return (
        <div className="text-center py-4 text-muted">
          <div style={{ fontSize: '2rem' }}>🔍</div>
          <p>Nenhum resultado encontrado para "{query}"</p>
          <small>Tente termos diferentes ou remova alguns filtros</small>
        </div>
      );
    }

    return (
      <ListGroup variant="flush" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {allResults.map((result, index) => (
          <ListGroup.Item
            key={`${result.type}-${result.id}`}
            action
            onClick={() => handleResultClick(result)}
            className="d-flex align-items-start"
            style={{ cursor: 'pointer' }}
          >
            <div className="me-2" style={{ fontSize: '1.2rem', marginTop: '2px' }}>
              {getResultIcon(result.type)}
            </div>
            <div className="flex-grow-1">
              <div className="d-flex justify-content-between align-items-start">
                <div className="fw-medium">
                  {result.type === 'board' && highlightText(result.title, query)}
                  {result.type === 'card' && highlightText(result.title, query)}
                  {result.type === 'comment' && highlightText(result.card_title, query)}
                  {result.type === 'label' && highlightText(result.name, query)}
                </div>
                <Badge 
                  bg="secondary" 
                  style={{ fontSize: '0.7rem', marginLeft: '8px' }}
                >
                  {result.type === 'board' ? 'Board' : 
                   result.type === 'card' ? 'Card' :
                   result.type === 'comment' ? 'Comment' : 'Label'}
                </Badge>
              </div>
              
              {result.type === 'card' && result.description && (
                <div className="text-muted small mt-1">
                  {highlightText(result.description.substring(0, 100) + '...', query)}
                </div>
              )}
              
              {result.type === 'comment' && (
                <div className="text-muted small mt-1">
                  {highlightText(result.content.substring(0, 100) + '...', query)}
                </div>
              )}
              
              {result.type === 'label' && (
                <div className="mt-1">
                  <Badge style={{ backgroundColor: result.color, color: '#fff' }}>
                    {result.name}
                  </Badge>
                </div>
              )}
              
              <div className="text-muted small mt-1">
                📋 {highlightText(
                  'board_title' in result ? result.board_title : 
                  'title' in result ? result.title : '', 
                  query
                )}
                {result.type === 'card' && (
                  <> • 📂 {result.column_title}</>
                )}
              </div>
            </div>
          </ListGroup.Item>
        ))}
      </ListGroup>
    );
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center">
          <span className="me-2">🔍</span>
          Busca Global
        </Modal.Title>
      </Modal.Header>
      
      <Modal.Body className="p-0">
        <div className="p-3 border-bottom">
          <Form.Control
            ref={searchInputRef}
            type="text"
            placeholder="Buscar em boards, cards, comentários..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="mb-3"
          />
          
          {/* Filter buttons */}
          <div className="d-flex flex-wrap gap-2">
            {filterOptions.map(filter => (
              <Button
                key={filter.value}
                variant={selectedFilters.includes(filter.value) ? 'primary' : 'outline-secondary'}
                size="sm"
                onClick={() => handleFilterToggle(filter.value)}
              >
                <span className="me-1">{filter.icon}</span>
                {filter.label}
              </Button>
            ))}
            {selectedFilters.length > 0 && (
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => setSelectedFilters([])}
              >
                Limpar Filtros
              </Button>
            )}
          </div>
          
          {query.trim().length >= 2 && (
            <div className="d-flex justify-content-between align-items-center mt-2">
              <small className="text-muted">
                {loading ? 'Buscando...' : `${getTotalResults()} resultado(s) encontrado(s)`}
              </small>
              {loading && <Spinner size="sm" />}
            </div>
          )}
        </div>
        
        {error && (
          <Alert variant="danger" className="m-3 mb-0">
            {error}
          </Alert>
        )}
        
        {query.trim().length < 2 && (
          <div className="text-center py-4 text-muted">
            <div style={{ fontSize: '2rem' }}>💭</div>
            <p>Digite pelo menos 2 caracteres para buscar</p>
            <small>Você pode buscar por títulos, descrições, comentários e labels</small>
          </div>
        )}
        
        {query.trim().length >= 2 && !loading && renderResults()}
      </Modal.Body>
    </Modal>
  );
};