import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Upload, FileText, Edit, Trash2, Download, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface SupplierProposal {
  id: string;
  project_id: string;
  supplier: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  file_name?: string;
  file_path?: string;
  file_size?: number;
  uploaded_at?: string;
  value?: number;
  proposal_date?: string;
}

interface BudgetTabProps {
  projectId: string;
  projectName: string;
}

export function BudgetTab({ projectId, projectName }: BudgetTabProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [proposals, setProposals] = useState<SupplierProposal[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<SupplierProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newProposal, setNewProposal] = useState({
    supplier: "",
    status: "pending" as const,
    file: null as File | null,
    value: "",
    proposal_date: ""
  });

  useEffect(() => {
    if (projectId && user) {
      loadProposals();
    }
  }, [projectId, user]);

  const loadProposals = async () => {
    if (!projectId || !user) return;

    // Verificar se o ID é um UUID válido
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(projectId)) {
      setProposals([]);
      setLoading(false);
      return;
    }

    try {
      const { data: proposalsData, error } = await supabase
        .from('supplier_proposals')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        toast({
          title: "Erro",
          description: "Erro ao carregar propostas de fornecedores",
          variant: "destructive"
        });
        return;
      }

      if (proposalsData) {
        setProposals(proposalsData as SupplierProposal[]);
      }
    } catch (error) {
      console.error('Failed to load proposals:', error, {
        context: 'BudgetTab.loadProposals',
        projectId,
        userId: user?.id,
        operation: 'load supplier proposals'
      });
      toast({
        title: "Erro",
        description: "Erro inesperado ao carregar propostas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File): Promise<{ filePath: string, fileName: string } | null> => {
    if (!user) return null;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;
    
    const { error } = await supabase.storage
      .from('Orcamentos')
      .upload(filePath, file);
      
    if (error) {
      throw error;
    }
    
    return { filePath, fileName: file.name };
  };

  const validateProposal = () => {
    const newErrors: Record<string, string> = {};

    // Fornecedor: obrigatório
    if (!newProposal.supplier.trim()) {
      newErrors.supplier = 'Fornecedor é obrigatório';
    }

    // Valor: deve ser número positivo (> 0)
    if (newProposal.value) {
      const valueNum = parseFloat(newProposal.value);
      if (isNaN(valueNum) || valueNum <= 0) {
        newErrors.value = 'Valor deve ser maior que zero';
      }
    }

    // Data: não pode ser futura
    if (newProposal.proposal_date) {
      const proposalDate = new Date(newProposal.proposal_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (proposalDate > today) {
        newErrors.proposal_date = 'Data não pode ser no futuro';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateProposal = async () => {
    if (!validateProposal()) {
      toast({
        title: "Erro de validação",
        description: "Corrija os erros no formulário antes de continuar",
        variant: "destructive"
      });
      return;
    }

    if (!newProposal.file || !projectId || !user) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios e selecione um arquivo",
        variant: "destructive"
      });
      return;
    }

    // Verificar se o projeto precisa ser sincronizado primeiro
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuidRegex.test(projectId)) {
      toast({
        title: "Projeto não sincronizado",
        description: "Este projeto precisa ser sincronizado com o servidor antes de criar propostas. Acesse a página de projetos e clique em sincronizar.",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    
    try {
      // Upload do arquivo
      const uploadResult = await uploadFile(newProposal.file);
      
      if (!uploadResult) {
        throw new Error("Falha no upload do arquivo");
      }

      // Criar a proposta no banco
      const { data, error } = await supabase
        .from('supplier_proposals')
        .insert([{
          project_id: projectId,
          supplier: newProposal.supplier,
          status: newProposal.status,
          user_id: user.id,
          file_name: uploadResult.fileName,
          file_path: uploadResult.filePath,
          file_size: newProposal.file.size,
          value: newProposal.value ? parseFloat(newProposal.value) : null,
          proposal_date: newProposal.proposal_date || null
        }])
        .select()
        .single();

      if (error) {
        toast({
          title: "Erro ao criar proposta",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      if (data) {
        setProposals([data as SupplierProposal, ...proposals]);
        setNewProposal({ supplier: '', status: 'pending', file: null, value: '', proposal_date: '' });
        setErrors({});
        setIsCreateModalOpen(false);
        toast({
          title: "Proposta criada",
          description: `Proposta de ${newProposal.supplier} foi criada com sucesso.`,
        });
      }
    } catch (error: any) {
      console.error('Failed to create proposal:', error, {
        context: 'BudgetTab.handleCreateProposal',
        projectId,
        supplier: newProposal.supplier,
        fileName: newProposal.file?.name,
        fileSize: newProposal.file?.size,
        operation: 'create supplier proposal with file upload'
      });
      toast({
        title: "Erro",
        description: error.message || "Erro no upload do arquivo",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateProposal = async (proposal: SupplierProposal) => {
    if (!user) return;

    const { error } = await supabase
      .from('supplier_proposals')
      .update({
        supplier: proposal.supplier,
        status: proposal.status
      })
      .eq('id', proposal.id)
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar proposta",
        variant: "destructive"
      });
      return;
    }

    await loadProposals();
    setEditingProposal(null);
    
    toast({
      title: "Proposta atualizada",
      description: "Proposta foi atualizada com sucesso"
    });
  };

  const handleDeleteProposal = async (proposalId: string, filePath?: string) => {
    if (!user) return;

    try {
      // Deletar arquivo do storage se existir
      if (filePath) {
        await supabase.storage
          .from('Orcamentos')
          .remove([filePath]);
      }

      // Deletar registro do banco
      const { error } = await supabase
        .from('supplier_proposals')
        .delete()
        .eq('id', proposalId)
        .eq('user_id', user.id);

      if (error) {
        toast({
          title: "Erro",
          description: "Erro ao excluir proposta",
          variant: "destructive"
        });
        return;
      }

      await loadProposals();
      
      toast({
        title: "Proposta excluída",
        description: "Proposta foi excluída com sucesso"
      });
    } catch (error) {
      console.error('Failed to delete proposal:', error, {
        context: 'BudgetTab.handleDeleteProposal',
        projectId,
        proposalId,
        filePath,
        operation: 'delete supplier proposal and file'
      });
      toast({
        title: "Erro",
        description: "Erro ao excluir arquivo",
        variant: "destructive"
      });
    }
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

  const totalProposals = proposals.length;
  const approvedProposals = proposals.filter(p => p.status === 'approved').length;
  const pendingProposals = proposals.filter(p => p.status === 'pending').length;
  const rejectedProposals = proposals.filter(p => p.status === 'rejected').length;

  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('Orcamentos')
        .download(filePath);

      if (error) {
        toast({
          title: "Erro",
          description: "Erro ao baixar arquivo",
          variant: "destructive"
        });
        return;
      }

      // Criar link de download
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download proposal file:', error, {
        context: 'BudgetTab.downloadFile',
        filePath,
        fileName,
        operation: 'download supplier proposal file'
      });
      toast({
        title: "Erro",
        description: "Erro ao processar download",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando propostas de fornecedores...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold break-words">Orçamentos</h2>
          <p className="text-muted-foreground break-words">{projectName}</p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Proposta
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar Proposta de Fornecedor</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="supplier">Fornecedor *</Label>
                <Input 
                  id="supplier" 
                  value={newProposal.supplier} 
                  onChange={e => {
                    setNewProposal(prev => ({ ...prev, supplier: e.target.value }));
                    if (errors.supplier) setErrors(prev => ({ ...prev, supplier: '' }));
                  }} 
                  placeholder="Nome do fornecedor" 
                  className={errors.supplier ? 'border-destructive' : ''}
                />
                {errors.supplier && (
                  <p className="text-sm text-destructive mt-1">{errors.supplier}</p>
                )}
              </div>
              <div>
                <Label htmlFor="value">Valor (R$)</Label>
                <Input 
                  id="value" 
                  type="number"
                  step="0.01"
                  min="0"
                  value={newProposal.value} 
                  onChange={e => {
                    setNewProposal(prev => ({ ...prev, value: e.target.value }));
                    if (errors.value) setErrors(prev => ({ ...prev, value: '' }));
                  }} 
                  placeholder="0.00" 
                  className={errors.value ? 'border-destructive' : ''}
                />
                {errors.value && (
                  <p className="text-sm text-destructive mt-1">{errors.value}</p>
                )}
              </div>
              <div>
                <Label htmlFor="proposal_date">Data da Proposta</Label>
                <Input 
                  id="proposal_date" 
                  type="date"
                  value={newProposal.proposal_date} 
                  onChange={e => {
                    setNewProposal(prev => ({ ...prev, proposal_date: e.target.value }));
                    if (errors.proposal_date) setErrors(prev => ({ ...prev, proposal_date: '' }));
                  }} 
                  className={errors.proposal_date ? 'border-destructive' : ''}
                />
                {errors.proposal_date && (
                  <p className="text-sm text-destructive mt-1">{errors.proposal_date}</p>
                )}
              </div>
              <div>
                <Label htmlFor="file">Arquivo da Proposta *</Label>
                <Input 
                  id="file" 
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={e => {
                    const file = e.target.files?.[0] || null;
                    setNewProposal(prev => ({ ...prev, file }));
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Formatos aceitos: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG
                </p>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={newProposal.status} onValueChange={(value: any) => setNewProposal(prev => ({ ...prev, status: value }))}>
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
              <Button 
                onClick={handleCreateProposal} 
                disabled={uploading || Object.keys(errors).some(key => errors[key] !== '')} 
                className="w-full"
              >
                {uploading ? (
                  <>
                    <Upload className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Criar Proposta
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium break-words">Total de Propostas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProposals}</div>
            <p className="text-xs text-muted-foreground">fornecedores</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium break-words">Aprovadas</CardTitle>
            <Users className="h-4 w-4 text-green-600 shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{approvedProposals}</div>
            <p className="text-xs text-muted-foreground">aprovadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium break-words">Pendentes</CardTitle>
            <Users className="h-4 w-4 text-yellow-600 shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingProposals}</div>
            <p className="text-xs text-muted-foreground">em análise</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium break-words">Rejeitadas</CardTitle>
            <Users className="h-4 w-4 text-red-600 shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{rejectedProposals}</div>
            <p className="text-xs text-muted-foreground">rejeitadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Proposals List */}
      <div className="space-y-4">
        {proposals.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma proposta encontrada</h3>
              <p className="text-muted-foreground text-center mb-4">
                Comece adicionando sua primeira proposta de fornecedor
              </p>
              <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Adicionar Primeira Proposta
              </Button>
            </CardContent>
          </Card>
        ) : (
          proposals.map(proposal => (
            <Card key={proposal.id} className="w-full overflow-x-hidden">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <CardTitle className="text-lg break-words">{proposal.supplier}</CardTitle>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(proposal.status)} shrink-0`}>
                        {getStatusText(proposal.status)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {proposal.file_path && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => downloadFile(proposal.file_path!, proposal.file_name!)}
                        className="gap-1"
                      >
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">Download</span>
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setEditingProposal(proposal)}
                      className="gap-1"
                    >
                      <Edit className="h-4 w-4" />
                      <span className="hidden sm:inline">Editar</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDeleteProposal(proposal.id, proposal.file_path)}
                      className="gap-1"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Excluir</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {proposal.value && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="shrink-0">Valor:</span>
                      <span className="font-semibold text-foreground">
                        R$ {proposal.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  {proposal.proposal_date && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="shrink-0">Data da Proposta:</span>
                      <span>{new Date(proposal.proposal_date).toLocaleDateString('pt-BR')}</span>
                    </div>
                  )}
                  {proposal.file_name && (
                    <div className="flex items-center gap-2 break-all">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="break-words">{proposal.file_name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="shrink-0">Criado em:</span>
                    <span>{new Date(proposal.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  {proposal.file_size && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="shrink-0">Tamanho:</span>
                      <span>{(proposal.file_size / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Proposal Dialog */}
      {editingProposal && (
        <Dialog open={!!editingProposal} onOpenChange={() => setEditingProposal(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Proposta</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-supplier">Fornecedor *</Label>
                <Input 
                  id="edit-supplier" 
                  value={editingProposal.supplier} 
                  onChange={e => setEditingProposal({...editingProposal, supplier: e.target.value})} 
                  placeholder="Nome do fornecedor" 
                />
              </div>
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select value={editingProposal.status} onValueChange={(value: any) => setEditingProposal({...editingProposal, status: value})}>
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
              {editingProposal.file_name && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Arquivo atual:</p>
                  <p className="text-sm text-muted-foreground">{editingProposal.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Para alterar o arquivo, delete esta proposta e crie uma nova.
                  </p>
                </div>
              )}
              <Button onClick={() => handleUpdateProposal(editingProposal)} className="w-full">
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}