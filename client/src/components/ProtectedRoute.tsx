export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const session = sessionStorage.getItem('goliat_session');
    if (!session) {
        window.location.href = '/';
        return null;
    }
    return <>{children}</>;
}