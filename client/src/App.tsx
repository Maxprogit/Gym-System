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

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);


  useEffect(() => {
    const session = localStorage.getItem('goliat_session');
    if (session) {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);


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
        onLoginSuccess={() => setIsAuthenticated(true)} 
      />
    );
  }


  return (
    <BrowserRouter>
      <Routes>
        {/* Layout Principal que contiene el Sidebar */}
        <Route path="/" element={<DashboardLayout />}>
          
          {/* Rutas Hijas (Se renderizan dentro del Layout) */}
          <Route index element={<DashboardPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="whatsapp" element={<WhatsAppPage />} />

        </Route>
        

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;