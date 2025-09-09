import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Row, Col, Badge } from 'react-bootstrap';
import { api } from '../lib/api';
import { Label } from './Label';

interface ILabel {
  id: number;
  name: string;
  color: string;
  board_id: number;
}

interface LabelPickerProps {
  show: boolean;
  onHide: () => void;
  boardId: number;
  cardId: number;
  currentLabels: ILabel[];
  onLabelsChange: () => void;
}

const PRESET_COLORS = [
  '#28a745', '#dc3545', '#ffc107', '#007bff', '#6f42c1', 
  '#fd7e14', '#20c997', '#6c757d', '#e83e8c', '#17a2b8'
];

export const LabelPicker: React.FC<LabelPickerProps> = ({ 
  show, 
  onHide, 
  boardId, 
  cardId, 
  currentLabels, 
  onLabelsChange 
}) => {
  const [availableLabels, setAvailableLabels] = useState<ILabel[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(PRESET_COLORS[0]);
  const [loading, setLoading] = useState(false);

  const currentLabelIds = currentLabels.map(label => label.id);

  useEffect(() => {
    if (show && boardId) {
      fetchLabels();
    }
  }, [show, boardId]);

  const fetchLabels = async () => {
    try {
      const response = await api.get(`/boards/${boardId}/labels`);
      setAvailableLabels(response.data.data);
    } catch (err) {
      console.error('Error fetching labels:', err);
    }
  };

  const handleCreateLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;

    setLoading(true);
    try {
      await api.post('/labels', {
        name: newLabelName.trim(),
        color: newLabelColor,
        board_id: boardId
      });
      setNewLabelName('');
      setNewLabelColor(PRESET_COLORS[0]);
      setShowCreateForm(false);
      await fetchLabels();
    } catch (err) {
      console.error('Error creating label:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignLabel = async (labelId: number) => {
    try {
      await api.post(`/cards/${cardId}/labels`, { label_id: labelId });
      onLabelsChange();
    } catch (err) {
      console.error('Error assigning label:', err);
    }
  };

  const handleRemoveLabel = async (labelId: number) => {
    try {
      await api.delete(`/cards/${cardId}/labels/${labelId}`);
      onLabelsChange();
    } catch (err) {
      console.error('Error removing label:', err);
    }
  };

  const handleDeleteLabel = async (labelId: number) => {
    if (!window.confirm('Delete this label? It will be removed from all cards.')) {
      return;
    }
    
    try {
      await api.delete(`/labels/${labelId}`);
      await fetchLabels();
      onLabelsChange();
    } catch (err) {
      console.error('Error deleting label:', err);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Manage Labels</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {/* Current Labels */}
        <div className="mb-4">
          <h6>Current Labels</h6>
          <div className="d-flex flex-wrap gap-2">
            {currentLabels.length > 0 ? (
              currentLabels.map(label => (
                <Label
                  key={label.id}
                  {...label}
                  showRemove
                  onRemove={handleRemoveLabel}
                />
              ))
            ) : (
              <span className="text-muted">No labels assigned</span>
            )}
          </div>
        </div>

        {/* Available Labels */}
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h6>Available Labels</h6>
            <Button 
              variant="outline-primary" 
              size="sm"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              {showCreateForm ? 'Cancel' : 'New Label'}
            </Button>
          </div>

          {/* Create Label Form */}
          {showCreateForm && (
            <Form onSubmit={handleCreateLabel} className="mb-3 p-3 border rounded">
              <Row>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Label Name</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Enter label name"
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Color</Form.Label>
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      {PRESET_COLORS.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewLabelColor(color)}
                          style={{
                            width: '30px',
                            height: '30px',
                            backgroundColor: color,
                            border: newLabelColor === color ? '3px solid #000' : '1px solid #ccc',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                          title={color}
                        />
                      ))}
                    </div>
                    <Form.Control
                      type="color"
                      value={newLabelColor}
                      onChange={(e) => setNewLabelColor(e.target.value)}
                      style={{ width: '60px', height: '40px' }}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <div className="d-flex gap-2 mt-3">
                <Button type="submit" variant="primary" size="sm" disabled={loading}>
                  Create Label
                </Button>
                <Button 
                  type="button" 
                  variant="secondary" 
                  size="sm"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </Form>
          )}

          {/* Labels List */}
          <div className="d-flex flex-wrap gap-2">
            {availableLabels.map(label => (
              <div key={label.id} className="position-relative">
                <Badge
                  bg={currentLabelIds.includes(label.id) ? 'success' : 'secondary'}
                  style={{
                    backgroundColor: label.color,
                    color: getTextColor(label.color),
                    cursor: 'pointer',
                    opacity: currentLabelIds.includes(label.id) ? 0.6 : 1,
                    position: 'relative',
                    paddingRight: '24px'
                  }}
                  onClick={() => {
                    if (currentLabelIds.includes(label.id)) {
                      handleRemoveLabel(label.id);
                    } else {
                      handleAssignLabel(label.id);
                    }
                  }}
                  title={currentLabelIds.includes(label.id) ? 'Click to remove' : 'Click to assign'}
                >
                  {label.name}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteLabel(label.id);
                    }}
                    style={{
                      position: 'absolute',
                      right: '4px',
                      top: '2px',
                      background: 'none',
                      border: 'none',
                      color: 'inherit',
                      fontSize: '12px',
                      cursor: 'pointer',
                      lineHeight: '1'
                    }}
                    title="Delete label"
                  >
                    ×
                  </button>
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

function getTextColor(backgroundColor: string) {
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}