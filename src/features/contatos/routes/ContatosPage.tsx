import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowLeft, Users, ChevronDown, User, Building2, Truck } from 'lucide-react';
import { ContatoForm } from '../components/ContatoForm';
import { ContatoList } from '../components/ContatoList';
import { BulkOperationPanel } from '@/components/bulk-operations/BulkOperationPanel';
import { Contato } from '../index';
import { storage } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';

export default function ContatosPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast: _toast } = useToast();
  
  const [project, setProject] = useState<any>(null);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"cliente" | "obra" | "fornecedor">("cliente");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContato, setEditingContato] = useState<Contato | null>(null);

  useEffect(() => {
    if (!id) return;
    
    const loadData = async () => {
      const projects = await storage.getProjects();
      const projectData = projects.find(p => p.id === id);
      if (!projectData) {
        navigate('/');
        return;
      }
      
      setProject(projectData);
      await loadContatos();
    };
    
    loadData();
  }, [id, navigate]);

  const loadContatos = async () => {
    if (!id) return;
    const allContacts = await storage.getContacts();
    const allContatos = allContacts.filter(c => c.projetoId === id);
    setContatos(allContatos);
  };

  const handleSaveContato = async (contato: Contato) => {
    // Convert Contato to ProjectContact format
    const contactData = {
      id: editingContato?.id || `contato_${Date.now()}`,
      project_id: id!,
      projetoId: id!,
      name: contato.nome,
      role: contato.tipo,
      phone: contato.telefone || '',
      email: contato.email || '',
      // Keep original fields for compatibility
      tipo: contato.tipo,
      nome: contato.nome,
      empresa: contato.empresa,
      telefone: contato.telefone,
      criadoEm: contato.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    };

    await storage.upsertContact(contactData as any);
    
    await loadContatos();
    setIsFormOpen(false);
    setEditingContato(null);
  };

  const handleEditContato = (contato: Contato) => {
    setEditingContato(contato);
    setActiveTab(contato.tipo);
    setIsFormOpen(true);
  };

  const handleDeleteContato = async (contato: Contato) => {
    await storage.deleteContact(contato.id);
    await loadContatos();
  };

  const handleAddContato = (tipo: "cliente" | "obra" | "fornecedor") => {
    setActiveTab(tipo);
    setEditingContato(null);
    setIsFormOpen(true);
  };

  const getContatosByTipo = (tipo: "cliente" | "obra" | "fornecedor") => {
    return contatos.filter(c => c.tipo === tipo).sort((a, b) => a.nome.localeCompare(b.nome));
  };

  const getContadorContatos = () => {
    const cliente = getContatosByTipo("cliente").length;
    const obra = getContatosByTipo("obra").length;
    const fornecedor = getContatosByTipo("fornecedor").length;
    return { cliente, obra, fornecedor };
  };

  if (!project) return null;

  const contadores = getContadorContatos();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container-modern py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(`/projeto/${id}`)}
              className="gap-2 self-start"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div className="flex items-center gap-2 sm:gap-3">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              <div>
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold">Contatos</h1>
                <p className="text-sm sm:text-base text-muted-foreground truncate">{project.name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container-modern py-4 sm:py-6">
        <div className="space-y-4 sm:space-y-6">
          {/* Categoria Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
              <span>Cliente ({contadores.cliente})</span>
              <span>•</span>
              <span>Obra ({contadores.obra})</span>
              <span>•</span>
              <span>Fornecedor ({contadores.fornecedor})</span>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="mobile-button justify-between">
                  <span>
                    {activeTab === 'cliente' && `Cliente (${contadores.cliente})`}
                    {activeTab === 'obra' && `Obra (${contadores.obra})`}
                    {activeTab === 'fornecedor' && `Fornecedor (${contadores.fornecedor})`}
                  </span>
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setActiveTab('cliente')}>
                  <User className="h-4 w-4 mr-2" />
                  Cliente ({contadores.cliente})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('obra')}>
                  <Building2 className="h-4 w-4 mr-2" />
                  Obra ({contadores.obra})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('fornecedor')}>
                  <Truck className="h-4 w-4 mr-2" />
                  Fornecedor ({contadores.fornecedor})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Bulk Operations Panel */}
          {selectedContacts.length > 0 && (
            <BulkOperationPanel
              items={contatos.filter(c => selectedContacts.includes(c.id))}
              itemType="contacts"
              onItemsChange={(_updatedItems) => {
                loadContatos();
                setSelectedContacts([]);
              }}
            />
          )}

          {/* Content */}
          <div className="mt-4 sm:mt-6">
            <ContatoList
              contatos={getContatosByTipo(activeTab)}
              tipo={activeTab}
              onEdit={handleEditContato}
              onDelete={handleDeleteContato}
              onAdd={() => handleAddContato(activeTab)}
              selectedContacts={selectedContacts}
              onSelectionChange={(contactId, selected) => {
                if (selected) {
                  setSelectedContacts(prev => [...prev, contactId]);
                } else {
                  setSelectedContacts(prev => prev.filter(id => id !== contactId));
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Form Modal */}
      <ContatoForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingContato(null);
        }}
        contato={editingContato}
        tipo={activeTab}
        projetoId={id!}
        onSave={handleSaveContato}
      />
    </div>
  );
}