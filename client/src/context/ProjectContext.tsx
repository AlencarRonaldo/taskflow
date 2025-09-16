import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface Project {
    id: number;
    name: string;
    description: string;
    color: string;
    logo?: string;
    owner_id: number;
    members_count: number;
    boards_count: number;
    tasks_count?: number;
    created_at: string;
    updated_at: string;
}

interface ProjectContextType {
    currentProject: Project | null;
    loading: boolean;
    error: string | null;
    setCurrentProject: (project: Project | null) => void;
    refreshProject: () => Promise<void>;
    switchProject: (projectId: number) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProject = () => {
    const context = useContext(ProjectContext);
    if (!context) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
};

interface ProjectProviderProps {
    children: ReactNode;
}

export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children }) => {
    const [currentProject, setCurrentProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    // Get projectId from URL params if in a project route
    const params = useParams();
    const projectIdFromUrl = params.projectId ? parseInt(params.projectId) : null;

    console.log('🏗️ ProjectProvider: Rendering with params:', params);
    console.log('🏗️ ProjectProvider: projectIdFromUrl:', projectIdFromUrl);
    console.log('🏗️ ProjectProvider: currentProject:', currentProject);
    console.log('🏗️ ProjectProvider: loading:', loading);

    useEffect(() => {
        console.log('🔄 ProjectProvider useEffect triggered');
        console.log('   projectIdFromUrl:', projectIdFromUrl);
        console.log('   currentProject:', currentProject);
        
        if (projectIdFromUrl && (!currentProject || currentProject.id !== projectIdFromUrl)) {
            console.log('   → Will load project:', projectIdFromUrl);
            loadProject(projectIdFromUrl);
        } else if (!projectIdFromUrl) {
            console.log('   → Will clear project');
            // Clear project when not in a project route
            setCurrentProject(null);
        } else {
            console.log('   → No action needed');
        }
    }, [projectIdFromUrl]);

    const loadProject = async (projectId: number) => {
        setLoading(true);
        setError(null);
        try {
            console.log('🔄 ProjectContext: Loading project with ID:', projectId);
            console.log('🔄 ProjectContext: Using fallback - getting project from list');
            // FALLBACK: Get project from projects list instead of specific endpoint
            const response = await api.get('/projects');
            console.log('✅ ProjectContext: Projects list loaded:', response.data);
            
            // Find the specific project in the list
            const project = response.data.find((p: any) => p.id === projectId);
            if (project) {
                console.log('✅ ProjectContext: Found project in list:', project);
                setCurrentProject(project);
            } else {
                throw new Error(`Project with ID ${projectId} not found`);
            }
            
            // Store current project ID in localStorage for quick access
            localStorage.setItem('lastProjectId', projectId.toString());
        } catch (error: any) {
            console.error('❌ ProjectContext: Error loading project:', error);
            console.error('❌ ProjectContext: Error details:', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            });
            setError(error.response?.data?.error || 'Failed to load project');
            
            // If access denied, redirect to projects list
            if (error.response?.status === 403) {
                navigate('/projects');
            }
        } finally {
            setLoading(false);
        }
    };

    const refreshProject = async () => {
        if (currentProject) {
            await loadProject(currentProject.id);
        }
    };

    const switchProject = (projectId: number) => {
        navigate(`/projects/${projectId}`);
    };

    return (
        <ProjectContext.Provider
            value={{
                currentProject,
                loading,
                error,
                setCurrentProject,
                refreshProject,
                switchProject
            }}
        >
            {children}
        </ProjectContext.Provider>
    );
};

// Hook to ensure user is in a project context
export const useRequireProject = () => {
    const { currentProject, loading } = useProject();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !currentProject) {
            // Redirect to projects list if no project is selected
            navigate('/projects');
        }
    }, [currentProject, loading, navigate]);

    return { currentProject, loading };
};