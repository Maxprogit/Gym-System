import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import DashboardLayout from './layouts/DashboardLayout';

// Páginas
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MembersPage from './pages/MembersPage';
import WhatsAppPage from './pages/WhatssAppPage';
import PaymentsPage from './pages/PaymentsPage';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);


  useEffect(() => {
    const session = sessionStorage.getItem('goliat_session');
    if (session) {
      setIsAuthenticated(true);
      setUser(JSON.parse(session));
    }
    setIsLoading(false);
  }, []);

  const handleLoginSuccess = (userData: any) => {
    setIsAuthenticated(true);
    setUser(userData);
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-[#09090b] flex items-center justify-center">
        <div className="text-[#D4FF00] font-mono animate-pulse">Cargando GOLIAT OS...</div>
      </div>
    );
  }


  if (!isAuthenticated) {
    return (
      <LoginPage 
        onLoginSuccess={handleLoginSuccess} 
      />
    );
  }


  return (
    <BrowserRouter>
      <Routes>
        {/* Layout Principal que contiene el Sidebar */}
        <Route path="/" element={<ProtectedRoute><DashboardLayout user={user} /></ProtectedRoute>}>
          {/* Rutas Hijas (Se renderizan dentro del Layout) */}
          <Route index element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="members" element={<ProtectedRoute><MembersPage /></ProtectedRoute>} />
          <Route path="payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
          <Route path="whatsapp" element={<ProtectedRoute><WhatsAppPage /></ProtectedRoute>} />

        </Route>
        

        <Route path="*" element={<ProtectedRoute><Navigate to="/" replace /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;