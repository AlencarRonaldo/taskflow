import React from 'react';
import { Badge } from 'react-bootstrap';

interface DueDatePickerProps {
  dueDate?: string | null;
  onDateChange: (date: string | null) => void;
  showAsCard?: boolean;
}

export const DueDatePicker: React.FC<DueDatePickerProps> = ({ 
  dueDate, 
  onDateChange, 
  showAsCard = false 
}) => {
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onDateChange(value || null);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeValue = e.target.value;
    if (dueDate && timeValue) {
      // Combine existing date with new time
      const dateOnly = dueDate.split('T')[0];
      const newDateTime = `${dateOnly}T${timeValue}:00`;
      onDateChange(newDateTime);
    } else if (timeValue) {
      // If no date set, use today with the selected time
      const today = new Date().toISOString().split('T')[0];
      const newDateTime = `${today}T${timeValue}:00`;
      onDateChange(newDateTime);
    }
  };

  const clearDate = () => {
    onDateChange(null);
  };

  // Parse due date and determine status
  const getDueDateStatus = (dateStr: string | null) => {
    if (!dateStr) return null;
    
    const dueDate = new Date(dateStr);
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    
    const diffTime = dueDateStart.getTime() - todayStart.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { status: 'overdue', days: Math.abs(diffDays) };
    if (diffDays === 0) return { status: 'today', days: 0 };
    if (diffDays === 1) return { status: 'tomorrow', days: 1 };
    if (diffDays <= 7) return { status: 'upcoming', days: diffDays };
    return { status: 'future', days: diffDays };
  };

  const formatDueDateDisplay = (dateStr: string | null) => {
    if (!dateStr) return null;
    
    const dueDateStatus = getDueDateStatus(dateStr);
    if (!dueDateStatus) return null;

    const date = new Date(dateStr);
    const formattedDate = date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
    
    const hasTime = dateStr.includes('T') && dateStr !== `${dateStr.split('T')[0]}T00:00:00`;
    const timeStr = hasTime ? ` às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : '';

    let variant: string = 'secondary';
    let icon = '📅';
    let text = formattedDate;

    switch (dueDateStatus.status) {
      case 'overdue':
        variant = 'danger';
        icon = '⚠️';
        text = `${formattedDate}${timeStr} (${dueDateStatus.days} dias atrás)`;
        break;
      case 'today':
        variant = 'warning';
        icon = '🎯';
        text = `Hoje (${formattedDate})${timeStr}`;
        break;
      case 'tomorrow':
        variant = 'info';
        icon = '📅';
        text = `Amanhã (${formattedDate})${timeStr}`;
        break;
      case 'upcoming':
        variant = 'primary';
        icon = '📅';
        text = `${formattedDate}${timeStr} (${dueDateStatus.days} dias)`;
        break;
      case 'future':
        variant = 'secondary';
        icon = '📅';
        text = `${formattedDate}${timeStr}`;
        break;
    }

    return { variant, icon, text, status: dueDateStatus.status };
  };

  // For card display (compact view)
  if (showAsCard && dueDate) {
    const dateInfo = formatDueDateDisplay(dueDate);
    if (!dateInfo) return null;

    return (
      <Badge 
        bg={dateInfo.variant} 
        style={{ fontSize: '0.75rem' }}
        title={`Vencimento: ${dateInfo.text}`}
      >
        {dateInfo.icon} {new Date(dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
        {dueDate.includes('T') && (
          <span className="ms-1">
            {new Date(dueDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </Badge>
    );
  }

  // For modal form (full picker)
  return (
    <div className="due-date-picker">
      <div className="d-flex align-items-center gap-2 mb-2">
        <label htmlFor="due-date-input" className="form-label mb-0">
          📅 Data de Vencimento
        </label>
        {dueDate && (
          <button
            type="button"
            onClick={clearDate}
            className="btn btn-sm btn-outline-secondary"
            title="Remover data"
          >
            ✕
          </button>
        )}
      </div>
      
      <div className="row">
        <div className="col-md-7">
          <input
            id="due-date-input"
            type="date"
            className="form-control"
            value={dueDate ? new Date(dueDate).toISOString().split('T')[0] : ''}
            onChange={handleDateChange}
            min={new Date().toISOString().split('T')[0]} // Prevent selecting past dates for new cards
          />
        </div>
        <div className="col-md-5">
          <input
            type="time"
            className="form-control"
            value={dueDate && dueDate.includes('T') ? 
              dueDate.split('T')[1].substring(0, 5) : ''
            }
            onChange={handleTimeChange}
            placeholder="Horário"
          />
        </div>
      </div>
      
      {dueDate && (
        <div className="mt-2">
          {(() => {
            const dateInfo = formatDueDateDisplay(dueDate);
            if (!dateInfo) return null;
            
            return (
              <Badge bg={dateInfo.variant}>
                {dateInfo.icon} {dateInfo.text}
              </Badge>
            );
          })()}
        </div>
      )}
    </div>
  );
};