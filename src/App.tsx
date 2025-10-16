import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster as HotToaster } from "react-hot-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/providers/theme-provider";
import { AuthProvider } from '@/hooks/useAuth';
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PublicRoute } from "@/components/auth/PublicRoute";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { useEffect } from "react";
import { onlineMonitor } from "@/services/sync/onlineMonitor";
import ErrorBoundary from "./components/ErrorBoundary";
import { useUndoShortcut } from "@/hooks/useUndoShortcut";
import { ConflictManager } from "@/components/ConflictManager";

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
import Debug from "./pages/Debug";
import NotFound from "./pages/NotFound";
import { TestConflictIntegration } from "./components/test-conflict-integration";
import { PublicReportView } from "./components/reports/PublicReportView";

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
  // Hook para atalho Ctrl+Z
  useUndoShortcut();

  useEffect(() => {
    // Inicializar monitor de conexão
    onlineMonitor.initialize();
    
    return () => {
      onlineMonitor.cleanup();
    };
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" storageKey="dea-theme">
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <HotToaster 
                position="top-right"
                toastOptions={{
                  duration: 3000,
                  style: {
                    background: 'hsl(var(--background))',
                    color: 'hsl(var(--foreground))',
                    border: '1px solid hsl(var(--border))',
                  },
                  success: {
                    iconTheme: {
                      primary: 'hsl(var(--primary))',
                      secondary: 'hsl(var(--primary-foreground))',
                    },
                  },
                  error: {
                    iconTheme: {
                      primary: 'hsl(var(--destructive))',
                      secondary: 'hsl(var(--destructive-foreground))',
                    },
                  },
                }}
              />
              <ConflictManager />
              <BrowserRouter>
                <ErrorBoundary>
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
                    
                    {/* Public report view route */}
                    <Route path="/public/report/:token" element={<PublicReportView />} />
                    
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
                          <ErrorBoundary>
                            <ProjectDetailNew />
                          </ErrorBoundary>
                        </AppLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/projeto/:id/pecas" element={
                      <ProtectedRoute>
                        <AppLayout>
                          <ErrorBoundary>
                            <ProjectDetailNew />
                          </ErrorBoundary>
                        </AppLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/projeto/:id/relatorios" element={
                      <ProtectedRoute>
                        <AppLayout>
                          <ErrorBoundary>
                            <ProjectDetailNew />
                          </ErrorBoundary>
                        </AppLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/projeto/:id/contatos" element={
                      <ProtectedRoute>
                        <AppLayout>
                          <ErrorBoundary>
                            <ContatosPage />
                          </ErrorBoundary>
                        </AppLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/projeto/:id/orcamentos" element={
                      <ProtectedRoute>
                        <AppLayout>
                          <ErrorBoundary>
                            <ProjectDetailNew />
                          </ErrorBoundary>
                        </AppLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/projeto/:id/arquivos" element={
                      <ProtectedRoute>
                        <AppLayout>
                          <ErrorBoundary>
                            <ProjectDetailNew />
                          </ErrorBoundary>
                        </AppLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/projeto/:id/colaboracao" element={
                      <ProtectedRoute>
                        <AppLayout>
                          <ErrorBoundary>
                            <ProjectDetailNew />
                          </ErrorBoundary>
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
                          <ErrorBoundary>
                            <ReportsPage />
                          </ErrorBoundary>
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
                    <Route path="/debug" element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Debug />
                        </AppLayout>
                      </ProtectedRoute>
                    } />
                    <Route path="/test-conflicts" element={
                      <ProtectedRoute>
                        <AppLayout>
                          <TestConflictIntegration />
                        </AppLayout>
                      </ProtectedRoute>
                    } />
                    
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </ErrorBoundary>
              </BrowserRouter>
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
