import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Search, FileText, Plus, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Budget {
  id: string;
  project_id: string;
  supplier: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  projects: {
    name: string;
    client: string;
  };
}

export default function BudgetsListPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadBudgets();
    }
  }, [user]);

  const loadBudgets = async () => {
    if (!user) return;

    try {
      const { data: budgetsData, error } = await supabase
        .from('budgets')
        .select(`
          *,
          projects (
            name,
            client
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && budgetsData) {
        setBudgets(budgetsData as Budget[]);
      } else {
        toast({
          title: "Erro",
          description: "Erro ao carregar orçamentos",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao carregar orçamentos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredBudgets = budgets.filter(budget => {
    const matchesSearch = 
      budget.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      budget.projects.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      budget.projects.client.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || budget.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

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

  if (loading) {
    return (
      <div className="container-modern py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando orçamentos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-modern py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Orçamentos</h1>
          <p className="text-muted-foreground">Gerencie todos os orçamentos dos seus projetos</p>
        </div>
        <Button onClick={() => navigate('/projetos')} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Orçamento
        </Button>
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
            <p className="text-xs text-muted-foreground">
              {budgets.length} orçamentos
            </p>
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
            <p className="text-xs text-muted-foreground">
              {budgets.filter(b => b.status === 'approved').length} aprovados
            </p>
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
            <p className="text-xs text-muted-foreground">
              {budgets.filter(b => b.status === 'pending').length} pendentes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar por fornecedor, projeto ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Rejeitados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Budgets List */}
      <div className="space-y-4">
        {filteredBudgets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchTerm || statusFilter !== "all" 
                  ? "Nenhum orçamento encontrado" 
                  : "Nenhum orçamento criado"
                }
              </h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchTerm || statusFilter !== "all"
                  ? "Tente ajustar os filtros de busca"
                  : "Vá para um projeto específico para criar orçamentos"
                }
              </p>
              {!searchTerm && statusFilter === "all" && (
                <Button onClick={() => navigate('/projetos')} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Ver Projetos
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredBudgets.map(budget => (
            <Card key={budget.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{budget.supplier}</CardTitle>
                      <Badge className={getStatusColor(budget.status)}>
                        {getStatusText(budget.status)}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <strong>{budget.projects.name}</strong> • {budget.projects.client}
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate(`/projeto/${budget.project_id}/orcamentos`)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Projeto
                  </Button>
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
    </div>
  );
}