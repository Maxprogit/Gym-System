import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sileo';
import 'sileo/styles.css';
import { ProtectedRoute } from './ProtectedRoute';
import { AppLayout } from '../layouts/AppLayout';
import { useAuthStore } from '../stores/authStore';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';

const LoginPage = lazy(() => import('../features/auth/LoginPage').then((module) => ({ default: module.LoginPage })));
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const MembersPage = lazy(() => import('../features/members/MembersPage').then((module) => ({ default: module.MembersPage })));
const PaymentsPage = lazy(() => import('../features/payments/PaymentsPage').then((module) => ({ default: module.PaymentsPage })));
const ExercisesPage = lazy(() => import('../features/exercises/ExercisesPage').then((module) => ({ default: module.ExercisesPage })));
const WhatsAppPage = lazy(() => import('../features/whatsapp/WhatsAppPage').then((module) => ({ default: module.WhatsAppPage })));

export function App() {
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    const unauthorized = () => logout();
    window.addEventListener('goliat:unauthorized', unauthorized);
    return () => {
      window.removeEventListener('goliat:unauthorized', unauthorized);
    };
  }, [logout]);

  return (
    <>
      <Suspense fallback={<div className="route-loader"><span>G</span><p>Preparando módulo…</p></div>}>
        <ErrorBoundary><Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="exercises" element={<ExercisesPage />} />
            <Route path="whatsapp" element={<WhatsAppPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes></ErrorBoundary>
      </Suspense>
      <Toaster position="top-right" offset={{ top: 78, right: 22 }} options={{ fill: '#191917', roundness: 8 }} />
    </>
  );
}
