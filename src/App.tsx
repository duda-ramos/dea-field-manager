import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PublicRoute } from "@/components/auth/PublicRoute";
import Dashboard from "./pages/Dashboard";
import ProjectDetailNew from "./pages/ProjectDetailNew";
import { ContatosPage } from "./features/contatos";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/auth/login" element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            } />
            <Route path="/auth/register" element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            } />
            <Route path="/auth/forgot-password" element={
              <PublicRoute>
                <ForgotPasswordPage />
              </PublicRoute>
            } />
            
            {/* Protected routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/projeto/:id" element={
              <ProtectedRoute>
                <ProjectDetailNew />
              </ProtectedRoute>
            } />
            <Route path="/projeto/:id/pecas" element={
              <ProtectedRoute>
                <ProjectDetailNew />
              </ProtectedRoute>
            } />
            <Route path="/projeto/:id/relatorios" element={
              <ProtectedRoute>
                <ProjectDetailNew />
              </ProtectedRoute>
            } />
            <Route path="/projeto/:id/orcamentos" element={
              <ProtectedRoute>
                <ProjectDetailNew />
              </ProtectedRoute>
            } />
            <Route path="/projeto/:id/contatos" element={
              <ProtectedRoute>
                <ContatosPage />
              </ProtectedRoute>
            } />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
