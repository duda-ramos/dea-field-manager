import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Users } from 'lucide-react';
import { ContatoForm } from '../components/ContatoForm';
import { ContatoList } from '../components/ContatoList';
import { Contato } from '../index';
import { storage } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';

export default function ContatosPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [project, setProject] = useState<any>(null);
  const [contatos, setContatos] = useState<Contato[]>([]);
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
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(`/projeto/${id}`)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <div className="flex items-center gap-3">
              <Users className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Contatos</h1>
                <p className="text-muted-foreground">{project.name}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Resumo */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>Cliente ({contadores.cliente})</span>
            <span>•</span>
            <span>Obra ({contadores.obra})</span>
            <span>•</span>
            <span>Fornecedor ({contadores.fornecedor})</span>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="cliente" className="gap-2">
                Cliente ({contadores.cliente})
              </TabsTrigger>
              <TabsTrigger value="obra" className="gap-2">
                Obra ({contadores.obra})
              </TabsTrigger>
              <TabsTrigger value="fornecedor" className="gap-2">
                Fornecedor ({contadores.fornecedor})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cliente" className="mt-6">
              <ContatoList
                contatos={getContatosByTipo("cliente")}
                tipo="cliente"
                onEdit={handleEditContato}
                onDelete={handleDeleteContato}
                onAdd={() => handleAddContato("cliente")}
              />
            </TabsContent>

            <TabsContent value="obra" className="mt-6">
              <ContatoList
                contatos={getContatosByTipo("obra")}
                tipo="obra"
                onEdit={handleEditContato}
                onDelete={handleDeleteContato}
                onAdd={() => handleAddContato("obra")}
              />
            </TabsContent>

            <TabsContent value="fornecedor" className="mt-6">
              <ContatoList
                contatos={getContatosByTipo("fornecedor")}
                tipo="fornecedor"
                onEdit={handleEditContato}
                onDelete={handleDeleteContato}
                onAdd={() => handleAddContato("fornecedor")}
              />
            </TabsContent>
          </Tabs>
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