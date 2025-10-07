import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/providers/theme-provider";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PublicRoute } from "@/components/auth/PublicRoute";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { useEffect } from "react";
import { onlineMonitor } from "@/services/sync/onlineMonitor";

// Pages
import Dashboard from "./pages/Dashboard";
import ProjectDetailNew from "./pages/ProjectDetailNew";
import ProjectsPage from "./pages/ProjectsPage";
import ReportsPage from "./pages/ReportsPage";
import CalendarPage from "./pages/CalendarPage";
import { ContatosPage } from "./features/contatos";
import GlobalContactsPage from "./pages/GlobalContactsPage";
import ConfiguracoesPage from "./pages/ConfiguracoesPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { RegisterPage } from "./pages/auth/RegisterPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <AppHeader />
          <main className="flex-1 overflow-auto container-modern py-4 sm:py-6 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

const App = () => {
  useEffect(() => {
    // Inicializar monitor de conexão
    onlineMonitor.initialize();
    
    return () => {
      onlineMonitor.cleanup();
    };
  }, []);

  return (
    <ThemeProvider defaultTheme="system" storageKey="dea-theme">
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
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/projeto/:id" element={
                <ProtectedRoute>
                  <AppLayout>
                    <ProjectDetailNew />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/projeto/:id/pecas" element={
                <ProtectedRoute>
                  <AppLayout>
                    <ProjectDetailNew />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/projeto/:id/relatorios" element={
                <ProtectedRoute>
                  <AppLayout>
                    <ProjectDetailNew />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/projeto/:id/contatos" element={
                <ProtectedRoute>
                  <AppLayout>
                    <ContatosPage />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/projeto/:id/orcamentos" element={
                <ProtectedRoute>
                  <AppLayout>
                    <ProjectDetailNew />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/projeto/:id/arquivos" element={
                <ProtectedRoute>
                  <AppLayout>
                    <ProjectDetailNew />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/projeto/:id/colaboracao" element={
                <ProtectedRoute>
                  <AppLayout>
                    <ProjectDetailNew />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/projetos" element={
                <ProtectedRoute>
                  <AppLayout>
                    <ProjectsPage />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/relatorios" element={
                <ProtectedRoute>
                  <AppLayout>
                    <ReportsPage />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/agenda" element={
                <ProtectedRoute>
                  <AppLayout>
                    <CalendarPage />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/contatos" element={
                <ProtectedRoute>
                  <AppLayout>
                    <GlobalContactsPage />
                  </AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/configuracoes" element={
                <ProtectedRoute>
                  <AppLayout>
                    <ConfiguracoesPage />
                  </AppLayout>
                </ProtectedRoute>
              } />
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
  );
};

export default App;
