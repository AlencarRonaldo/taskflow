import React from 'react';
import { Dropdown, DropdownButton, Badge } from 'react-bootstrap';

interface PriorityPickerProps {
    priority: string;
    onPriorityChange: (priority: string) => void;
    showAsCard?: boolean;
}

export const PriorityPicker: React.FC<PriorityPickerProps> = ({ priority, onPriorityChange, showAsCard = false }) => {
    const priorities = [
        { value: 'critical', label: 'Crítica', color: 'danger', icon: '🔴' },
        { value: 'high', label: 'Alta', color: 'warning', icon: '🟠' },
        { value: 'medium', label: 'Média', color: 'primary', icon: '🔵' },
        { value: 'low', label: 'Baixa', color: 'success', icon: '🟢' },
        { value: 'none', label: 'Sem prioridade', color: 'secondary', icon: '⚪' }
    ];

    const currentPriority = priorities.find(p => p.value === priority) || priorities[2]; // Default to medium

    const getPriorityBadge = () => {
        return (
            <Badge 
                bg={currentPriority.color} 
                style={{ 
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    padding: '0.3rem 0.6rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontWeight: '600',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }}
            >
                <span style={{ fontSize: '1rem' }}>{currentPriority.icon}</span>
                <span>{currentPriority.label.toUpperCase()}</span>
            </Badge>
        );
    };

    if (showAsCard) {
        return getPriorityBadge();
    }

    return (
        <div className="priority-picker">
            <label className="form-label">Prioridade</label>
            <DropdownButton
                id="priority-dropdown"
                title={
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{currentPriority.icon}</span>
                        {currentPriority.label}
                    </span>
                }
                variant={currentPriority.color}
                size="sm"
            >
                {priorities.map(p => (
                    <Dropdown.Item
                        key={p.value}
                        onClick={() => onPriorityChange(p.value)}
                        active={p.value === priority}
                    >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>{p.icon}</span>
                            {p.label}
                        </span>
                    </Dropdown.Item>
                ))}
            </DropdownButton>
        </div>
    );
};