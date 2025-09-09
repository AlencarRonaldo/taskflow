# 🎨 GUIA DO ESPECIALISTA FRONTEND

## 📋 RESPONSABILIDADES

### **Core Responsibilities**
- Implementar componentes React reutilizáveis
- Otimizar performance e experiência do usuário
- Implementar funcionalidades de drag & drop
- Garantir responsividade e acessibilidade

---

## 🛠️ TECNOLOGIAS PRINCIPAIS

### **React Ecosystem**
```typescript
// Dependências principais
"react": "^18.2.0",
"react-dom": "^18.2.0",
"react-router-dom": "^6.8.0",
"@types/react": "^18.0.28",
"@types/react-dom": "^18.0.11"
```

### **UI/UX Libraries**
```typescript
// Componentes e estilização
"react-bootstrap": "^2.7.0",
"@dnd-kit/core": "^6.0.8",
"@dnd-kit/sortable": "^7.0.2",
"@dnd-kit/utilities": "^3.2.1",
"framer-motion": "^10.0.0"
```

### **State Management**
```typescript
// Gerenciamento de estado
"@tanstack/react-query": "^4.24.0",
"react-hook-form": "^7.43.0",
"zustand": "^4.3.0"
```

---

## 🎯 TAREFAS ESPECÍFICAS

### **1. Correções de Drag & Drop**

#### **Problema Atual**
```typescript
// Layout dividido em seções separadas
<Row>
  <Col md={4}>
    <SortableContext items={userCreatedColumns}>
      {/* Seção de tarefas */}
    </SortableContext>
  </Col>
  <Col md={8}>
    <SortableContext items={statusColumns}>
      {/* Seção de status */}
    </SortableContext>
  </Col>
</Row>
```

#### **Solução Implementada**
```typescript
// Layout unificado
<Row>
  <SortableContext items={board.columns.map(col => `column-${col.id}`)}>
    {board.columns.map(column => (
      <Col md={4} key={column.id}>
        <SortableColumn column={column} />
      </Col>
    ))}
  </SortableContext>
</Row>
```

#### **Melhorias Necessárias**
```typescript
// 1. Feedback visual melhorado
const SortableCard = ({ card, onCardClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: card.id, 
    data: { type: 'card', card } 
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    // Adicionar indicador visual de drag
    border: isDragging ? '2px dashed #007bff' : 'none',
    boxShadow: isDragging ? '0 4px 8px rgba(0,0,0,0.2)' : 'none'
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card className="sortable-card">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center">
            <span>{card.title}</span>
            <div {...listeners} className="drag-handle">
              <GripIcon />
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};
```

### **2. Componentes Reutilizáveis**

#### **Button Component**
```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export const CustomButton: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  children
}) => {
  return (
    <Button
      variant={variant}
      size={size}
      disabled={disabled || loading}
      onClick={onClick}
      className={`custom-button ${loading ? 'loading' : ''}`}
    >
      {loading ? <Spinner size="sm" /> : children}
    </Button>
  );
};
```

#### **Modal Component**
```typescript
interface ModalProps {
  show: boolean;
  onHide: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

export const CustomModal: React.FC<ModalProps> = ({
  show,
  onHide,
  title,
  size = 'md',
  children
}) => {
  return (
    <Modal show={show} onHide={onHide} size={size} centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{children}</Modal.Body>
    </Modal>
  );
};
```

### **3. Performance Optimization**

#### **Lazy Loading**
```typescript
// Lazy load de componentes pesados
const BoardPage = lazy(() => import('./pages/BoardPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Suspense wrapper
<Suspense fallback={<Spinner />}>
  <Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/boards/:id" element={<BoardPage />} />
  </Routes>
</Suspense>
```

#### **Memoization**
```typescript
// Memoizar componentes pesados
const SortableCard = React.memo(({ card, onCardClick }) => {
  // Component logic
});

// Memoizar callbacks
const handleCardClick = useCallback((card: ICard) => {
  setSelectedCard(card);
  setShowCardDetailsModal(true);
}, []);
```

### **4. Responsividade**

#### **Breakpoints**
```scss
// Custom breakpoints
$breakpoints: (
  xs: 0,
  sm: 576px,
  md: 768px,
  lg: 992px,
  xl: 1200px,
  xxl: 1400px
);

// Mobile-first approach
.board-columns {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  
  @media (min-width: 768px) {
    flex-direction: row;
    gap: 1.5rem;
  }
}
```

#### **Touch Gestures**
```typescript
// Suporte a gestos touch
const useTouchGestures = () => {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      // Swipe left action
    }
    if (isRightSwipe) {
      // Swipe right action
    }
  };

  return { onTouchStart, onTouchMove, onTouchEnd };
};
```

---

## 🧪 TESTING STRATEGY

### **Unit Tests**
```typescript
// Teste de componente
import { render, screen, fireEvent } from '@testing-library/react';
import { SortableCard } from './SortableCard';

describe('SortableCard', () => {
  const mockCard = {
    id: 1,
    title: 'Test Card',
    description: 'Test Description',
    column_id: 1,
    order_index: 1,
    status: 'todo'
  };

  it('renders card title', () => {
    render(<SortableCard card={mockCard} onCardClick={jest.fn()} />);
    expect(screen.getByText('Test Card')).toBeInTheDocument();
  });

  it('calls onCardClick when clicked', () => {
    const mockOnClick = jest.fn();
    render(<SortableCard card={mockCard} onCardClick={mockOnClick} />);
    
    fireEvent.click(screen.getByText('Test Card'));
    expect(mockOnClick).toHaveBeenCalledWith(mockCard);
  });
});
```

### **Integration Tests**
```typescript
// Teste de drag and drop
import { render, screen, fireEvent } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { BoardPage } from './BoardPage';

describe('Drag and Drop', () => {
  it('moves card between columns', async () => {
    render(
      <DndContext>
        <BoardPage />
      </DndContext>
    );

    const card = screen.getByText('Test Card');
    const targetColumn = screen.getByText('Target Column');

    // Simular drag and drop
    fireEvent.dragStart(card);
    fireEvent.dragOver(targetColumn);
    fireEvent.drop(targetColumn);

    // Verificar se o card foi movido
    expect(targetColumn).toContainElement(card);
  });
});
```

---

## 🎨 DESIGN SYSTEM

### **Color Palette**
```scss
// Cores principais
$primary: #007bff;
$secondary: #6c757d;
$success: #28a745;
$danger: #dc3545;
$warning: #ffc107;
$info: #17a2b8;
$light: #f8f9fa;
$dark: #343a40;

// Cores específicas do Kanban
$kanban-blue: #0066cc;
$kanban-green: #00b894;
$kanban-orange: #fdcb6e;
$kanban-red: #e17055;
```

### **Typography**
```scss
// Fontes
$font-family-base: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
$font-size-base: 1rem;
$font-weight-normal: 400;
$font-weight-medium: 500;
$font-weight-semibold: 600;
$font-weight-bold: 700;
```

### **Spacing**
```scss
// Espaçamentos
$spacer: 1rem;
$spacers: (
  0: 0,
  1: $spacer * 0.25,
  2: $spacer * 0.5,
  3: $spacer,
  4: $spacer * 1.5,
  5: $spacer * 3
);
```

---

## 📱 MOBILE OPTIMIZATION

### **Touch Targets**
```scss
// Tamanhos mínimos para touch
.touch-target {
  min-height: 44px;
  min-width: 44px;
  padding: 12px;
}

// Botões mobile
.btn-mobile {
  @extend .touch-target;
  font-size: 16px; // Previne zoom no iOS
}
```

### **Mobile Layout**
```typescript
// Layout responsivo para mobile
const MobileBoardLayout = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    return <MobileBoardView />;
  }
  
  return <DesktopBoardView />;
};
```

---

## 🚀 DEPLOYMENT

### **Build Optimization**
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          dnd: ['@dnd-kit/core', '@dnd-kit/sortable'],
          ui: ['react-bootstrap', 'framer-motion']
        }
      }
    }
  }
});
```

### **Environment Variables**
```typescript
// .env
VITE_API_URL=http://localhost:8000/api
VITE_APP_NAME=Kanban Organizer
VITE_APP_VERSION=1.0.0
```

---

## 📊 PERFORMANCE METRICS

### **Target Metrics**
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **Time to Interactive**: < 3.5s

### **Monitoring**
```typescript
// Performance monitoring
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getFCP(console.log);
getLCP(console.log);
getTTFB(console.log);
```

---

**Responsável**: Frontend Specialist
**Última Atualização**: [Data atual]
**Próxima Revisão**: [Data + 1 semana]

