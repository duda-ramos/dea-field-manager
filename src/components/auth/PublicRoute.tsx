import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuthContext';
import { Loader2 } from 'lucide-react';

interface PublicRouteProps {
  children: ReactNode;
}

export const PublicRoute = ({ children }: PublicRouteProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Carregando...</span>
        </div>
      </div>
    );
  }

  if (user) {
    // User is already logged in, redirect to dashboard
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};