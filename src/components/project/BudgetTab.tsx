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
  const [newProposal, setNewProposal] = useState({
    supplier: "",
    status: "pending" as const,
    file: null as File | null
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

  const handleCreateProposal = async () => {
    if (!newProposal.supplier || !newProposal.file || !projectId || !user) {
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
          file_size: newProposal.file.size
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
        setNewProposal({ supplier: '', status: 'pending', file: null });
        setIsCreateModalOpen(false);
        toast({
          title: "Proposta criada",
          description: `Proposta de ${newProposal.supplier} foi criada com sucesso.`,
        });
      }
    } catch (error: any) {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Orçamentos</h2>
          <p className="text-muted-foreground">{projectName}</p>
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
                  onChange={e => setNewProposal(prev => ({ ...prev, supplier: e.target.value }))} 
                  placeholder="Nome do fornecedor" 
                />
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
              <Button onClick={handleCreateProposal} disabled={uploading} className="w-full">
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Propostas</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProposals}</div>
            <p className="text-xs text-muted-foreground">fornecedores</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovadas</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{approvedProposals}</div>
            <p className="text-xs text-muted-foreground">aprovadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Users className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingProposals}</div>
            <p className="text-xs text-muted-foreground">em análise</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejeitadas</CardTitle>
            <Users className="h-4 w-4 text-red-600" />
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
            <Card key={proposal.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">{proposal.supplier}</CardTitle>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(proposal.status)}`}>
                      {getStatusText(proposal.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {proposal.file_path && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => downloadFile(proposal.file_path!, proposal.file_name!)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setEditingProposal(proposal)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDeleteProposal(proposal.id, proposal.file_path)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    {proposal.file_name && (
                      <p className="text-sm font-medium">{proposal.file_name}</p>
                    )}
                    {proposal.file_size && (
                      <p className="text-xs text-muted-foreground">
                        {(proposal.file_size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {proposal.uploaded_at 
                      ? `Enviado em ${new Date(proposal.uploaded_at).toLocaleDateString('pt-BR')}`
                      : `Criado em ${new Date(proposal.created_at).toLocaleDateString('pt-BR')}`
                    }
                  </div>
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