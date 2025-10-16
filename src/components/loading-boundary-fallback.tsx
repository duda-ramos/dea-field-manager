export const DefaultErrorFallback = ({ error }: { error?: Error }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-destructive text-lg font-semibold">
          Algo deu errado
        </div>
        <div className="text-muted-foreground">
          {error?.message || 'Ocorreu um erro inesperado.'}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Recarregar página
        </button>
      </div>
    </div>
  );
};
