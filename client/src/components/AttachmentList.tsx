import React, { useState, useEffect } from 'react';
import { Card, Button, Spinner, Alert, Badge } from 'react-bootstrap';
import { api } from '../lib/api';

interface Attachment {
  id: number;
  card_id: number;
  filename: string;
  original_name: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
  url: string;
}

interface AttachmentListProps {
  cardId: number;
  attachments: Attachment[];
  onAttachmentDeleted: (attachmentId: number) => void;
}

export const AttachmentList: React.FC<AttachmentListProps> = ({
  cardId,
  attachments,
  onAttachmentDeleted
}) => {
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return '🗂️';
    if (mimeType.startsWith('text/')) return '📃';
    return '📎';
  };

  const handleDelete = async (attachmentId: number) => {
    if (!window.confirm('Are you sure you want to delete this attachment?')) {
      return;
    }

    setDeleting(attachmentId);
    setError(null);

    try {
      await api.delete(`/attachments/${attachmentId}`);
      onAttachmentDeleted(attachmentId);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to delete attachment';
      setError(errorMessage);
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = (attachment: Attachment) => {
    const link = document.createElement('a');
    link.href = `http://localhost:8001${attachment.url}`;
    link.download = attachment.original_name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (attachments.length === 0) {
    return (
      <div className="text-muted text-center py-3">
        <small>No attachments yet. Use the "📎 Attach File" button to add files.</small>
      </div>
    );
  }

  return (
    <div className="attachment-list">
      {error && (
        <Alert variant="danger" className="mb-3" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {attachments.map((attachment) => (
        <Card key={attachment.id} className="mb-2" style={{ fontSize: '0.9rem' }}>
          <Card.Body className="p-3">
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center flex-grow-1 me-2">
                <span className="me-2" style={{ fontSize: '1.2rem' }}>
                  {getFileIcon(attachment.mime_type)}
                </span>
                <div className="flex-grow-1 min-width-0">
                  <div className="text-truncate fw-medium mb-1">
                    {attachment.original_name}
                  </div>
                  <div className="d-flex align-items-center gap-2 text-muted" style={{ fontSize: '0.8rem' }}>
                    <span>{formatFileSize(attachment.file_size)}</span>
                    <span>•</span>
                    <span>{formatDate(attachment.uploaded_at)}</span>
                  </div>
                </div>
              </div>
              
              <div className="d-flex align-items-center gap-2">
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => handleDownload(attachment)}
                  title="Download"
                >
                  ⬇️
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => handleDelete(attachment.id)}
                  disabled={deleting === attachment.id}
                  title="Delete"
                >
                  {deleting === attachment.id ? (
                    <Spinner size="sm" />
                  ) : (
                    '🗑️'
                  )}
                </Button>
              </div>
            </div>
          </Card.Body>
        </Card>
      ))}
    </div>
  );
};