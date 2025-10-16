import React, { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Atualiza o state para que a próxima renderização mostre a UI de fallback
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Registra o erro no console para debugging
    console.error('Error caught by ErrorBoundary:', error);
    console.error('Error info:', errorInfo);
    
    // Aqui você pode enviar o erro para um serviço de monitoramento
    // como Sentry, Bugsnag, etc.
    // Exemplo (comentado):
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

  handleReload = (): void => {
    // Recarrega a página
    window.location.reload();
  };

  handleReset = (): void => {
    // Reseta o estado do boundary para tentar renderizar novamente
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full px-6 py-8 bg-white shadow-lg rounded-lg">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Algo deu errado
              </h1>
              
              <p className="text-gray-600 mb-6">
                Ocorreu um erro inesperado. Tente recarregar a página.
              </p>
              
              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={this.handleReload}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 font-medium"
                >
                  Recarregar página
                </button>
                
                <button
                  onClick={this.handleReset}
                  className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors duration-200 font-medium"
                >
                  Tentar novamente
                </button>
              </div>
              
              {/* Botão opcional para reportar erro */}
              {/* <button
                onClick={() => {
                  // Implementar lógica de report
                  console.log('Report error:', this.state.error);
                }}
                className="mt-4 text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Reportar erro
              </button> */}
              
              {/* Mostra detalhes do erro apenas em desenvolvimento */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-6 w-full text-left">
                  <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                    Detalhes do erro (desenvolvimento)
                  </summary>
                  <pre className="mt-2 p-3 bg-gray-100 rounded text-xs text-gray-800 overflow-auto">
                    {this.state.error.toString()}
                    {this.state.error.stack && (
                      <>
                        {'\n\n'}
                        {this.state.error.stack}
                      </>
                    )}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;