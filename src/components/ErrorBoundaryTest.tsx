import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * Test component to verify ErrorBoundary functionality
 * This component can throw an error on demand to test error handling
 */
export function ErrorBoundaryTest() {
  const [throwError, setThrowError] = useState(false);

  if (throwError) {
    throw new Error('Teste de Error Boundary - Erro forçado para validação');
  }

  return (
    <Card className="p-6 max-w-md mx-auto mt-8">
      <h2 className="text-xl font-bold mb-4">Teste de Error Boundary</h2>
      <p className="text-muted-foreground mb-4">
        Clique no botão abaixo para forçar um erro de renderização e testar o Error Boundary.
      </p>
      <Button 
        onClick={() => setThrowError(true)}
        variant="destructive"
      >
        Forçar Erro de Renderização
      </Button>
    </Card>
  );
}
