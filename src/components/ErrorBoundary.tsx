import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Atualiza o state para que a próxima renderização mostre a UI de fallback
    // Chamado durante a fase de render
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Loga o erro com contexto completo
    console.error('Error caught by ErrorBoundary:', error);
    console.error('Error info:', errorInfo);
    console.error('Component stack:', errorInfo.componentStack);
    
    // Salva o errorInfo no estado para exibir detalhes
    this.setState({
      errorInfo,
    });
    
    // Aqui você pode usar um logger existente se disponível
    // Exemplo com serviço de monitoramento:
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, {
    //     contexts: {
    //       react: {
    //         componentStack: errorInfo.componentStack,
    //       },
    //     },
    //   });
    // }
  }

  handleReset = (): void => {
    // Reseta o estado do boundary para tentar re-renderizar o componente
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleGoHome = (): void => {
    // Navega para a página inicial com reload completo da aplicação
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Se foi fornecido um fallback customizado, usa ele
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Caso contrário, mostra a UI de erro padrão
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-md w-full p-6">
            <div className="flex flex-col items-center text-center">
              {/* Ícone de alerta */}
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              
              {/* Título */}
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Algo deu errado
              </h1>
              
              {/* Mensagem */}
              <p className="text-muted-foreground mb-6">
                Um erro inesperado ocorreu. Por favor, tente novamente.
              </p>
              
              {/* Botões de ação */}
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <Button
                  onClick={this.handleReset}
                  className="flex-1"
                  variant="default"
                >
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  Tentar Novamente
                </Button>
                
                <Button
                  onClick={this.handleGoHome}
                  className="flex-1"
                  variant="outline"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Voltar para Início
                </Button>
              </div>
              
              {/* Detalhes do erro - apenas em desenvolvimento */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-6 w-full text-left">
                  <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground font-medium">
                    Detalhes do erro (apenas em desenvolvimento)
                  </summary>
                  <div className="mt-3 space-y-3">
                    {/* Mensagem do erro */}
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1">Erro:</p>
                      <pre className="p-3 bg-muted rounded text-xs text-foreground overflow-auto max-h-32">
                        {this.state.error.toString()}
                      </pre>
                    </div>
                    
                    {/* Stack trace */}
                    {this.state.error.stack && (
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-1">Stack Trace:</p>
                        <pre className="p-3 bg-muted rounded text-xs text-foreground overflow-auto max-h-48">
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}
                    
                    {/* Component stack */}
                    {this.state.errorInfo?.componentStack && (
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-1">Component Stack:</p>
                        <pre className="p-3 bg-muted rounded text-xs text-foreground overflow-auto max-h-48">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;