import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Container, Nav, Navbar, Button } from 'react-bootstrap';
import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';
import { ThemeProvider } from './context/ThemeContext';
import { ThemeToggle } from './components/ThemeToggle';
import { GlobalSearch } from './components/GlobalSearch';
import { useKeyboardShortcut } from './hooks/useKeyboardShortcut';

// Page Components
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import BoardPage from './pages/BoardPage';
import PublicBoardPage from './pages/PublicBoardPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDashboard from './pages/ProjectDashboard';
import ProjectSwitcher from './components/ProjectSwitcher';
import CalendarView from './components/CalendarView';
import TimelineView from './components/TimelineView';
import GridView from './components/GridView';
import PrivateRoute from './components/PrivateRoute';

// A helper component to include useNavigate hook for the logout button
const AuthNav = () => {
    const { isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();
    const [showSearch, setShowSearch] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Keyboard shortcut for global search (Ctrl+K)
    useKeyboardShortcut('k', () => {
        if (isAuthenticated) {
            setShowSearch(true);
        }
    }, true);

    return (
        <>
            <Nav className="ms-auto d-flex align-items-center gap-2">
                {isAuthenticated && (
                    <>
                        <ProjectSwitcher />
                        <Button 
                            variant="outline-light" 
                            size="sm"
                            onClick={() => setShowSearch(true)}
                            title="Busca Global (Ctrl+K)"
                        >
                            🔍 Buscar
                        </Button>
                    </>
                )}
                <ThemeToggle />
                {isAuthenticated ? (
                    <Button variant="outline-light" onClick={handleLogout}>Logout</Button>
                ) : (
                    <>
                        <Nav.Link as={Link} to="/login">Login</Nav.Link>
                        <Nav.Link as={Link} to="/register">Register</Nav.Link>
                    </>
                )}
            </Nav>
            
            {isAuthenticated && (
                <GlobalSearch
                    show={showSearch}
                    onHide={() => setShowSearch(false)}
                />
            )}
        </>
    );
};


function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* Rotas que não precisam do layout padrão (Navbar + Container fluid) */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/public/:token" element={<PublicBoardPage />} />

          {/* Rotas que precisam do layout padrão */}
          <Route path="*" element={
            <>
              <Navbar bg="dark" variant="dark" expand="lg" fixed="top">
                <Container fluid>
                  <Navbar.Brand as={Link} to="/projects">⚡ TaskFlow Pro</Navbar.Brand>
                  <AuthNav />
                </Container>
              </Navbar>
              <Container fluid style={{ marginTop: '76px' }}>
                <Routes>
                  <Route path="/" element={<PrivateRoute />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/projects" element={<ProjectsPage />} />
                    <Route path="/projects/:projectId/*" element={
                      <ProjectProvider>
                        <Routes>
                          <Route path="/" element={<ProjectDashboard />} />
                          <Route path="/boards" element={<Dashboard />} />
                          <Route path="/boards/:id" element={<BoardPage />} />
                          <Route path="/calendar" element={<CalendarView />} />
                          <Route path="/timeline" element={<TimelineView />} />
                          <Route path="/grid" element={<GridView />} />
                        </Routes>
                      </ProjectProvider>
                    } />
                    
                    {/* Legacy routes (will redirect to projects) */}
                    <Route path="/calendar" element={<CalendarView />} />
                    <Route path="/timeline" element={<TimelineView />} />
                    <Route path="/grid" element={<GridView />} />
                    <Route path="/boards/:id" element={<BoardPage />} />
                  </Route>
                </Routes>
              </Container>
            </>
          } />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
