import React, { useState, useRef } from 'react';
import { Button, Alert, Spinner, ProgressBar } from 'react-bootstrap';
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

interface FileUploadProps {
  cardId: number;
  onUploadComplete: (attachment: Attachment) => void;
  onError?: (error: string) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  cardId,
  onUploadComplete,
  onError
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      if (onError) onError('File size must be less than 10MB');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post(`/cards/${cardId}/attachments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          }
        },
      });

      onUploadComplete(response.data);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to upload file';
      setError(errorMessage);
      if (onError) onError(errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getSupportedFormats = (): string => {
    return 'Images (JPEG, PNG, GIF, WebP), Documents (PDF, DOC, DOCX, TXT, CSV), Spreadsheets (XLS, XLSX), Archives (ZIP)';
  };

  return (
    <div className="file-upload">
      <div className="d-flex align-items-center gap-2 mb-2">
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <Spinner size="sm" className="me-2" />
              Uploading...
            </>
          ) : (
            <>
              📎 Attach File
            </>
          )}
        </Button>
        
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
          accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.zip"
        />
      </div>

      {uploading && (
        <div className="mb-2">
          <ProgressBar now={uploadProgress} label={`${uploadProgress}%`} />
        </div>
      )}

      {error && (
        <Alert variant="danger" className="mb-2" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <small className="text-muted">
        Supported formats: {getSupportedFormats()}
        <br />
        Maximum file size: 10MB
      </small>
    </div>
  );
};