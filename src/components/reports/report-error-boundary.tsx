import React, { Component, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertCircle, RotateCcw, X } from 'lucide-react';
import { errorMonitoring } from '@/services/errorMonitoring';

interface ReportErrorBoundaryProps {
  /** Child components to wrap */
  children: ReactNode;
  /** Callback to close the modal/dialog */
  onClose?: () => void;
  /** Optional fallback component to render instead of default error UI */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ReportErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string | null;
}

/**
 * Error Boundary component for report generation
 * 
 * Wraps report generation UI and catches errors during:
 * - generatePDFReport()
 * - generateXLSXReport()
 * - Any other report-related operations
 * 
 * Features:
 * - Captures and logs errors using ErrorMonitoring
 * - Shows friendly error UI with technical details in collapsible section
 * - Provides "Try Again" button to reset the boundary
 * - Provides "Go Back" button to close the modal
 * 
 * @example
 * ```tsx
 * <ReportErrorBoundary onClose={handleCloseModal}>
 *   <ReportGenerationForm onGenerate={handleGenerate} />
 * </ReportErrorBoundary>
 * ```
 */
export class ReportErrorBoundary extends Component<ReportErrorBoundaryProps, ReportErrorBoundaryState> {
  constructor(props: ReportErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ReportErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to ErrorMonitoring service
    const errorId = errorMonitoring.captureError(
      error,
      {
        component: 'ReportErrorBoundary',
        action: 'report_generation_error',
        metadata: {
          componentStack: errorInfo.componentStack,
          errorBoundary: 'ReportErrorBoundary',
        },
      },
      'high' // Report generation errors are high severity
    );

    // Update state with error details
    this.setState({
      errorInfo,
      errorId,
    });

    // Additional logging for debugging
    console.error('Report Error Boundary caught an error:', error, errorInfo);
  }

  /**
   * Reset the error boundary state
   * Allows user to retry the operation
   */
  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    });
  };

  /**
   * Handle closing the modal/dialog
   */
  handleClose = (): void => {
    const { onClose } = this.props;
    
    // Reset state before closing
    this.handleReset();
    
    // Call parent's onClose handler
    if (onClose) {
      onClose();
    }
  };

  render(): ReactNode {
    const { hasError, error, errorInfo, errorId } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // If custom fallback is provided, use it
      if (fallback) {
        return fallback(error, this.handleReset);
      }

      // Default error UI
      return (
        <div className="flex items-center justify-center p-4 min-h-[400px]">
          <Card className="max-w-2xl w-full border-destructive">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="p-2 bg-destructive/10 rounded-full">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl text-destructive">
                    Erro ao gerar relatório
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Ocorreu um erro durante a geração do relatório. Por favor, tente novamente ou entre em contato com o suporte se o problema persistir.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Mensagem:</strong> {error.message || 'Erro desconhecido'}
                </AlertDescription>
              </Alert>

              {/* Technical details in collapsible accordion */}
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="technical-details" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-sm font-medium hover:no-underline">
                    Detalhes técnicos (para debug)
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3 pt-2">
                    {errorId && (
                      <div className="text-xs">
                        <strong className="text-muted-foreground">ID do Erro:</strong>
                        <code className="block mt-1 p-2 bg-muted rounded font-mono text-xs break-all">
                          {errorId}
                        </code>
                      </div>
                    )}

                    {error.stack && (
                      <div className="text-xs">
                        <strong className="text-muted-foreground">Stack Trace:</strong>
                        <pre className="mt-1 p-3 bg-muted rounded text-xs overflow-x-auto max-h-48 overflow-y-auto">
                          {error.stack}
                        </pre>
                      </div>
                    )}

                    {errorInfo?.componentStack && (
                      <div className="text-xs">
                        <strong className="text-muted-foreground">Component Stack:</strong>
                        <pre className="mt-1 p-3 bg-muted rounded text-xs overflow-x-auto max-h-48 overflow-y-auto">
                          {errorInfo.componentStack}
                        </pre>
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground pt-2 border-t">
                      <p>
                        Este erro foi registrado automaticamente. Se o problema persistir, 
                        compartilhe o ID do erro com a equipe de suporte.
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>

            <CardFooter className="flex gap-2 justify-end">
              {this.props.onClose && (
                <Button
                  variant="outline"
                  onClick={this.handleClose}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Voltar
                </Button>
              )}
              <Button
                onClick={this.handleReset}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Tentar Novamente
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    // No error, render children normally
    return children;
  }
}
