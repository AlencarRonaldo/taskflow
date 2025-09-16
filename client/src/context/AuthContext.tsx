import { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import axios from 'axios';
import { api } from '../lib/api';

interface AuthContextType {
    token: string | null;
    user: { id: number; email: string } | null;
    login: (token: string, user: { id: number; email: string }) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [user, setUser] = useState<{ id: number; email: string } | null>(() => {
        const storedUser = localStorage.getItem('user');
        return storedUser ? JSON.parse(storedUser) : null;
    });

    // Initialize authentication headers on app startup
    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        if (storedToken) {
            const cleanToken = storedToken.replace(/"/g, '');
            console.log('🔐 Initial setup - Setting authorization header with token:', cleanToken.substring(0, 50) + '...');
            axios.defaults.headers.common['Authorization'] = `Bearer ${cleanToken}`;
            api.defaults.headers.common['Authorization'] = `Bearer ${cleanToken}`;
            
            // Also set the token state if not already set
            if (!token) {
                console.log('🔄 Setting token state from localStorage');
                setToken(cleanToken);
            }
        } else {
            console.log('❌ No token found in localStorage on app startup');
            // Clear any existing headers
            delete axios.defaults.headers.common['Authorization'];
            delete api.defaults.headers.common['Authorization'];
        }
    }, []);

    useEffect(() => {
        if (token) {
            localStorage.setItem('token', token);
            // Configure both global axios and api instance for compatibility
            // Remove quotes if present to prevent "Bearer ""token""" format
            const cleanToken = token.replace(/"/g, '');
            console.log('🔄 Updating authorization header with new token:', cleanToken.substring(0, 50) + '...');
            axios.defaults.headers.common['Authorization'] = `Bearer ${cleanToken}`;
            api.defaults.headers.common['Authorization'] = `Bearer ${cleanToken}`;
        } else {
            console.log('❌ Removing authorization headers');
            localStorage.removeItem('token');
            delete axios.defaults.headers.common['Authorization'];
            delete api.defaults.headers.common['Authorization'];
        }
    }, [token]);

    useEffect(() => {
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
        } else {
            localStorage.removeItem('user');
        }
    }, [user]);

    const login = (newToken: string, newUser: { id: number; email: string }) => {
        const cleanToken = newToken.replace(/"/g, '');
        api.defaults.headers.common['Authorization'] = `Bearer ${cleanToken}`;
        axios.defaults.headers.common['Authorization'] = `Bearer ${cleanToken}`;
        setToken(newToken);
        setUser(newUser);
    };

    const logout = () => {
        setToken(null);
        setUser(null);
    };

    const isAuthenticated = !!token;

    return (
        <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
