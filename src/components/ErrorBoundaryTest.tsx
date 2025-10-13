import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Bug } from 'lucide-react';

/**
 * Componente de teste para Error Boundaries
 * Use este componente apenas em desenvolvimento para testar boundaries
 */

interface ErrorTriggerProps {
  type: 'render' | 'event' | 'async';
  label: string;
  description: string;
}

function ErrorTrigger({ type, label, description }: ErrorTriggerProps) {
  const [shouldThrow, setShouldThrow] = useState(false);

  const triggerError = () => {
    switch (type) {
      case 'render':
        setShouldThrow(true);
        break;
      case 'event':
        throw new Error(`Erro de evento: ${label}`);
      case 'async':
        Promise.reject(new Error(`Erro assíncrono: ${label}`));
        break;
    }
  };

  if (shouldThrow && type === 'render') {
    throw new Error(`Erro de renderização: ${label}`);
  }

  return (
    <div className="p-4 border rounded-lg space-y-2">
      <div className="flex items-center gap-2">
        <Bug className="h-4 w-4 text-destructive" />
        <h4 className="font-medium">{label}</h4>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Button onClick={triggerError} variant="destructive" size="sm" className="w-full">
        Disparar Erro
      </Button>
    </div>
  );
}

export function ErrorBoundaryTest() {
  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <CardTitle>Teste de Error Boundaries</CardTitle>
        </div>
        <CardDescription>
          Use estes botões para testar se os Error Boundaries estão funcionando corretamente.
          Cada botão dispara um tipo diferente de erro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 bg-destructive/10 rounded-md">
          <p className="text-sm text-destructive font-medium">
            ⚠️ Atenção: Usar apenas em ambiente de desenvolvimento
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="font-medium">Tipos de Erro</h3>
          
          <ErrorTrigger
            type="render"
            label="Erro de Renderização"
            description="Dispara um erro durante o ciclo de renderização do componente"
          />

          <ErrorTrigger
            type="event"
            label="Erro de Evento"
            description="Dispara um erro em resposta a um evento de clique"
          />

          <ErrorTrigger
            type="async"
            label="Erro Assíncrono"
            description="Dispara um erro em uma Promise rejeitada"
          />
        </div>

        <div className="pt-4 border-t">
          <h3 className="font-medium mb-3">Como testar</h3>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Escolha um tipo de erro acima</li>
            <li>Clique no botão "Disparar Erro"</li>
            <li>Observe se o Error Boundary captura o erro</li>
            <li>Verifique se a UI de fallback aparece</li>
            <li>Teste os botões de recuperação (Tentar novamente, Voltar, etc.)</li>
          </ol>
        </div>

        <div className="pt-4 border-t">
          <h3 className="font-medium mb-3">Seções a testar</h3>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Dashboard - LoadingBoundary com DashboardErrorFallback</li>
            <li>Projeto (Info) - LoadingBoundary com ProjectErrorFallback</li>
            <li>Upload de Imagens - LoadingBoundary com UploadErrorFallback</li>
            <li>Geração de Relatórios - LoadingBoundary com ReportErrorFallback</li>
            <li>Galeria de Fotos - LoadingBoundary com GalleryErrorFallback</li>
            <li>Importação de Excel - LoadingBoundary com UploadErrorFallback</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Componente wrapper para testar boundaries específicas
 */
export function TestBoundaryWrapper({ 
  children, 
  name 
}: { 
  children: React.ReactNode;
  name: string;
}) {
  return (
    <div className="space-y-4">
      <div className="p-2 bg-muted rounded-md">
        <p className="text-xs font-mono">Testando: {name}</p>
      </div>
      {children}
    </div>
  );
}
