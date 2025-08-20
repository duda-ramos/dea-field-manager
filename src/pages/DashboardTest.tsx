export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-blue-600 text-white p-8 rounded-lg mb-8">
          <h1 className="text-3xl font-bold mb-2">DEA Manager</h1>
          <p className="text-blue-100">Sistema de Gestão de Projetos e Instalações</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Bem-vindo ao DEA Manager</h2>
          <p className="text-gray-600 mb-4">
            Sistema profissional para gestão de projetos e instalações com funcionalidade offline.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-800">📋 Gestão de Projetos</h3>
              <p className="text-sm text-gray-600 mt-2">
                Organize e acompanhe todos os seus projetos em um local centralizado.
              </p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-800">⚙️ Controle de Instalações</h3>
              <p className="text-sm text-gray-600 mt-2">
                Gerencie instalações com checklist, fotos e observações detalhadas.
              </p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-800">📱 Interface Responsiva</h3>
              <p className="text-sm text-gray-600 mt-2">
                Funciona perfeitamente em desktop e mobile para uso em campo.
              </p>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-green-800 font-semibold">✅ Sistema Funcionando!</h3>
            <p className="text-green-700 text-sm mt-1">
              O DEA Manager está carregando corretamente. Agora você pode usar todas as funcionalidades.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}