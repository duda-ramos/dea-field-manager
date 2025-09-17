import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, DollarSign, FileText, Calendar, Trash2, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { storage } from "@/lib/storage";

interface Budget {
  id: string;
  project_id: string;
  supplier: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

interface Project {
  id: string;
  name: string;
  client: string;
}

export default function BudgetPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [project, setProject] = useState<Project | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [newBudget, setNewBudget] = useState({
    supplier: "",
    amount: "",
    status: "pending" as const
  });

  useEffect(() => {
    if (id && user) {
      loadProjectData();
      loadBudgets();
    }
  }, [id, user]);

  const loadProjectData = async () => {
    console.log('loadProjectData called - raw id:', id, 'typeof:', typeof id);
    console.log('loadProjectData called - user:', user?.id);
    
    if (!id || !user) {
      console.log('Missing id or user, returning early - id:', id, 'user:', !!user);
      return;
    }

    // Additional validation for id
    if (id === ':id' || id.includes(':')) {
      console.error('Invalid ID detected:', id);
      toast({
        title: "Erro de navegação",
        description: "ID do projeto inválido",
        variant: "destructive"
      });
      navigate('/projetos');
      return;
    }
    
    try {
      // Primeiro tenta carregar do storage local
      const projects = await storage.getProjects();
      const localProject = projects.find(p => p.id === id);
      
      if (localProject) {
        setProject({
          id: localProject.id,
          name: localProject.name,
          client: localProject.client
        });
        return;
      }

      // Se não encontrou localmente, tenta carregar do Supabase
      const { data: projectData, error } = await supabase
        .from('projects')
        .select('id, name, client')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        toast({
          title: "Erro",
          description: "Erro ao carregar projeto",
          variant: "destructive"
        });
        navigate('/projetos');
        return;
      }

      if (!projectData) {
        toast({
          title: "Projeto não encontrado",
          description: "Projeto não foi encontrado ou você não tem acesso a ele",
          variant: "destructive"
        });
        navigate('/projetos');
        return;
      }
      
      setProject(projectData);
    } catch (error) {
      navigate('/projetos');
    }
  };

  const loadBudgets = async () => {
    if (!id || !user) return;

    // Verificar se o ID é um UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(id)) {
      setBudgets([]);
      return;
    }
      return;
    }

    try {
      const { data: budgetsData, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('project_id', id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading budgets:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar orçamentos",
          variant: "destructive"
        });
        return;
      }

      if (budgetsData) {
        setBudgets(budgetsData as Budget[]);
      }
    } catch (error) {
      console.error('Unexpected error loading budgets:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao carregar orçamentos",
        variant: "destructive"
      });
    }
  };

  const handleCreateBudget = async () => {
    if (!newBudget.supplier || !newBudget.amount || !id || !user) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    // Verificar se o projeto precisa ser sincronizado primeiro
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(id)) {
      toast({
        title: "Projeto não sincronizado",
        description: "Este projeto precisa ser sincronizado com o servidor antes de criar orçamentos. Acesse a página de projetos e clique em sincronizar.",
        variant: "destructive"
      });
      return;
    }

    const { data, error } = await supabase
      .from('budgets')
      .insert([{
        project_id: id,
        supplier: newBudget.supplier,
        amount: parseFloat(newBudget.amount),
        status: newBudget.status,
        user_id: user.id
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating budget:', error);
      toast({
        title: "Erro ao criar orçamento",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    if (data) {
      setBudgets([data as Budget, ...budgets]);
      setNewBudget({ supplier: '', amount: '', status: 'pending' });
      setIsCreateModalOpen(false);
      toast({
        title: "Orçamento criado",
        description: `Orçamento de ${newBudget.supplier} foi criado com sucesso.`,
      });
    }
  };

  const handleUpdateBudget = async (budget: Budget) => {
    if (!user) return;

    const { error } = await supabase
      .from('budgets')
      .update({
        supplier: budget.supplier,
        amount: budget.amount,
        status: budget.status
      })
      .eq('id', budget.id)
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar orçamento",
        variant: "destructive"
      });
      return;
    }

    await loadBudgets();
    setEditingBudget(null);
    
    toast({
      title: "Orçamento atualizado",
      description: "Orçamento foi atualizado com sucesso"
    });
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', budgetId)
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao excluir orçamento",
        variant: "destructive"
      });
      return;
    }

    await loadBudgets();
    
    toast({
      title: "Orçamento excluído",
      description: "Orçamento foi excluído com sucesso"
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'Aprovado';
      case 'rejected': return 'Rejeitado';
      default: return 'Pendente';
    }
  };

  const totalAmount = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const approvedAmount = budgets.filter(b => b.status === 'approved').reduce((sum, budget) => sum + budget.amount, 0);
  const pendingAmount = budgets.filter(b => b.status === 'pending').reduce((sum, budget) => sum + budget.amount, 0);

  if (!user) {
    return (
      <div className="container-modern py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2">Acesso negado</h3>
            <p className="text-muted-foreground">Você precisa estar logado para acessar esta página</p>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container-modern py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando projeto...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-modern py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => navigate(`/projeto/${id}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-foreground">Orçamentos</h1>
          <p className="text-muted-foreground">{project.name} - {project.client}</p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Orçamento
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Novo Orçamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="supplier">Fornecedor *</Label>
                <Input 
                  id="supplier" 
                  value={newBudget.supplier} 
                  onChange={e => setNewBudget(prev => ({ ...prev, supplier: e.target.value }))} 
                  placeholder="Nome do fornecedor" 
                />
              </div>
              <div>
                <Label htmlFor="amount">Valor *</Label>
                <Input 
                  id="amount" 
                  type="number"
                  step="0.01"
                  value={newBudget.amount} 
                  onChange={e => setNewBudget(prev => ({ ...prev, amount: e.target.value }))} 
                  placeholder="0.00" 
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={newBudget.status} onValueChange={(value: any) => setNewBudget(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="rejected">Rejeitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreateBudget} className="w-full">
                Criar Orçamento
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Geral</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(totalAmount)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovados</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(approvedAmount)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <DollarSign className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(pendingAmount)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Budgets List */}
      <div className="space-y-4">
        {budgets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum orçamento encontrado</h3>
              <p className="text-muted-foreground text-center mb-4">
                Comece criando seu primeiro orçamento para este projeto
              </p>
              <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Criar Primeiro Orçamento
              </Button>
            </CardContent>
          </Card>
        ) : (
          budgets.map(budget => (
            <Card key={budget.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">{budget.supplier}</CardTitle>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(budget.status)}`}>
                      {getStatusText(budget.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setEditingBudget(budget)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDeleteBudget(budget.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL'
                    }).format(budget.amount)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Criado em {new Date(budget.created_at).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Budget Dialog */}
      {editingBudget && (
        <Dialog open={!!editingBudget} onOpenChange={() => setEditingBudget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Orçamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-supplier">Fornecedor *</Label>
                <Input 
                  id="edit-supplier" 
                  value={editingBudget.supplier} 
                  onChange={e => setEditingBudget(prev => prev ? { ...prev, supplier: e.target.value } : null)} 
                  placeholder="Nome do fornecedor" 
                />
              </div>
              <div>
                <Label htmlFor="edit-amount">Valor *</Label>
                <Input 
                  id="edit-amount" 
                  type="number"
                  step="0.01"
                  value={editingBudget.amount} 
                  onChange={e => setEditingBudget(prev => prev ? { ...prev, amount: parseFloat(e.target.value) || 0 } : null)} 
                  placeholder="0.00" 
                />
              </div>
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select value={editingBudget.status} onValueChange={(value: any) => setEditingBudget(prev => prev ? { ...prev, status: value } : null)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="rejected">Rejeitado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => editingBudget && handleUpdateBudget(editingBudget)} className="w-full">
                Atualizar Orçamento
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}