import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Installation } from "@/types";
import { storage } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { showToast } from "@/lib/toast";
import { Plus, Edit3, Loader2 } from "lucide-react";

interface AddInstallationModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  editingInstallation?: Installation | null;
}

export function AddInstallationModal({ 
  projectId, 
  isOpen, 
  onClose, 
  onUpdate,
  editingInstallation
}: AddInstallationModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    tipologia: "",
    codigo: "",
    descricao: "",
    quantidade: "",
    pavimento: "",
    diretriz_altura_cm: "",
    diretriz_dist_batente_cm: "",
    observacoes: "",
    comentarios_fornecedor: "",
    pendencia_tipo: "",
    pendencia_descricao: ""
  });
  
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [overwriteMotivo, setOverwriteMotivo] = useState<string>("");
  const [overwriteDescricao, setOverwriteDescricao] = useState("");
  const [existingInstallation, setExistingInstallation] = useState<Installation | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (editingInstallation) {
      setFormData({
        tipologia: editingInstallation.tipologia,
        codigo: String(editingInstallation.codigo),
        descricao: editingInstallation.descricao,
        quantidade: String(editingInstallation.quantidade),
        pavimento: editingInstallation.pavimento,
        diretriz_altura_cm: editingInstallation.diretriz_altura_cm ? String(editingInstallation.diretriz_altura_cm) : "",
        diretriz_dist_batente_cm: editingInstallation.diretriz_dist_batente_cm ? String(editingInstallation.diretriz_dist_batente_cm) : "",
        observacoes: editingInstallation.observacoes || "",
        comentarios_fornecedor: editingInstallation.comentarios_fornecedor || "",
        pendencia_tipo: editingInstallation.pendencia_tipo || "",
        pendencia_descricao: editingInstallation.pendencia_descricao || ""
      });
    } else {
      setFormData({
        tipologia: "",
        codigo: "",
        descricao: "",
        quantidade: "",
        pavimento: "",
        diretriz_altura_cm: "",
        diretriz_dist_batente_cm: "",
        observacoes: "",
        comentarios_fornecedor: "",
        pendencia_tipo: "",
        pendencia_descricao: ""
      });
    }
  }, [editingInstallation]);

  const resetForm = () => {
    setFormData({
      tipologia: "",
      codigo: "",
      descricao: "",
      quantidade: "",
      pavimento: "",
      diretriz_altura_cm: "",
      diretriz_dist_batente_cm: "",
      observacoes: "",
      comentarios_fornecedor: "",
      pendencia_tipo: "",
      pendencia_descricao: ""
    });
    setShowOverwriteConfirm(false);
    setOverwriteMotivo("");
    setOverwriteDescricao("");
    setExistingInstallation(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const checkForExistingInstallation = async () => {
    const installations = await storage.getInstallationsByProject(projectId);
    const codigo = parseInt(formData.codigo);
    
    if (isNaN(codigo)) return null;
    
    return installations.find(inst => 
      inst.codigo === codigo && 
      inst.tipologia === formData.tipologia && 
      inst.pavimento === formData.pavimento &&
      inst.id !== editingInstallation?.id // Exclude current item when editing
    );
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.tipologia || !formData.codigo || !formData.descricao || !formData.quantidade || !formData.pavimento) {
      toast({
        title: "Erro de validação",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      showToast.error("Erro de validação", "Preencha todos os campos obrigatórios");
      return;
    }

    // Validate pendency fields
    if (formData.pendencia_tipo && !formData.pendencia_descricao.trim()) {
      toast({
        title: "Erro de validação",
        description: "Se há uma pendência, descreva-a no campo de descrição",
        variant: "destructive"
      });
      showToast.error("Erro de validação", "Se há uma pendência, descreva-a no campo de descrição");
      return;
    }

    const codigo = parseInt(formData.codigo);
    const quantidade = parseInt(formData.quantidade);

    if (isNaN(codigo) || isNaN(quantidade)) {
      toast({
        title: "Erro de validação",
        description: "Código e quantidade devem ser números válidos",
        variant: "destructive"
      });
      showToast.error("Erro de validação", "Código e quantidade devem ser números válidos");
      return;
    }

    // Check for existing installation only when creating new (not editing)
    if (!editingInstallation) {
      const existing = await checkForExistingInstallation();
      if (existing) {
        setExistingInstallation(existing);
        setShowOverwriteConfirm(true);
        return;
      }
    }

    // Proceed with save
    saveInstallation();
  };

  const saveInstallation = async () => {
    const codigo = parseInt(formData.codigo);
    const quantidade = parseInt(formData.quantidade);
    const diretriz_altura_cm = formData.diretriz_altura_cm ? parseInt(formData.diretriz_altura_cm) : undefined;
    const diretriz_dist_batente_cm = formData.diretriz_dist_batente_cm ? parseInt(formData.diretriz_dist_batente_cm) : undefined;

    const installationData = {
      tipologia: formData.tipologia,
      codigo,
      descricao: formData.descricao,
      quantidade,
      pavimento: formData.pavimento,
      diretriz_altura_cm,
      diretriz_dist_batente_cm,
      observacoes: formData.observacoes || undefined,
      comentarios_fornecedor: formData.comentarios_fornecedor || undefined,
      ...(formData.pendencia_tipo && {
        pendencia_tipo: formData.pendencia_tipo as 'cliente' | 'fornecedor' | 'projetista',
        pendencia_descricao: formData.pendencia_descricao || undefined
      })
    };

    if (existingInstallation && showOverwriteConfirm && !editingInstallation) {
      if (!overwriteMotivo) {
        toast({
          title: "Erro",
          description: "Selecione um motivo para a revisão",
          variant: "destructive"
        });
        showToast.error("Erro", "Selecione um motivo para a revisão");
        return;
      }

      if (overwriteMotivo === 'outros' && !overwriteDescricao.trim()) {
        toast({
          title: "Erro",
          description: "Descreva o motivo da revisão",
          variant: "destructive"
        });
        showToast.error("Erro", "Descreva o motivo da revisão");
        return;
      }
    }

    setIsSaving(true);

    try {
      let savedInstallation: Installation;

      if (editingInstallation) {
        // Update existing installation
        savedInstallation = await storage.upsertInstallation({ ...editingInstallation, ...installationData });
        toast({
          title: "Peça atualizada",
          description: `${savedInstallation.codigo} ${savedInstallation.descricao} foi atualizada${savedInstallation.revisado ? ` (rev. ${savedInstallation.revisao})` : ""}`,
        });
        showToast.success(
          "Peça atualizada",
          `${savedInstallation.codigo} ${savedInstallation.descricao} foi atualizada${savedInstallation.revisado ? ` (rev. ${savedInstallation.revisao})` : ""}`
        );
      } else if (existingInstallation && showOverwriteConfirm) {
        // Overwrite existing installation
        savedInstallation = await storage.upsertInstallation({
          ...existingInstallation,
          ...installationData,
          revisado: true,
          revisao: (existingInstallation.revisao || 1) + 1
        });

        toast({
          title: "Peça atualizada",
          description: `${savedInstallation.codigo} ${savedInstallation.descricao} foi revisada (rev. ${savedInstallation.revisao})`,
        });
        showToast.success(
          "Peça atualizada",
          `${savedInstallation.codigo} ${savedInstallation.descricao} foi revisada (rev. ${savedInstallation.revisao})`
        );
      } else {
        // Create new installation
        savedInstallation = await storage.upsertInstallation({
          ...installationData,
          id: `installation_${Date.now()}`,
          project_id: projectId,
          installed: false,
          photos: [],
          revisado: false,
          revisao: 1,
          updated_at: new Date().toISOString()
        });

        toast({
          title: "Peça criada",
          description: `${savedInstallation.codigo} ${savedInstallation.descricao} foi criada com sucesso`,
        });
        showToast.success(
          "Peça criada",
          `${savedInstallation.codigo} ${savedInstallation.descricao} foi criada com sucesso`
        );
      }

      handleClose();
      onUpdate();
    } catch (error) {
      console.error("Error saving installation:", error);
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Não foi possível salvar a instalação. Tente novamente.",
        variant: "destructive"
      });
      showToast.error(
        "Erro ao salvar",
        error instanceof Error ? error.message : "Não foi possível salvar a instalação. Tente novamente."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const motivosOptions = [
    { value: 'problema-instalacao', label: 'Problema de instalação' },
    { value: 'revisao-conteudo', label: 'Revisão de conteúdo' },
    { value: 'desaprovado-cliente', label: 'Desaprovado pelo cliente' },
    { value: 'outros', label: 'Outros' },
  ];

  if (showOverwriteConfirm) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Revisão</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Já existe uma peça com código <strong>{formData.codigo}</strong>, tipologia <strong>{formData.tipologia}</strong> 
              e pavimento <strong>{formData.pavimento}</strong>. Deseja criar uma revisão?
            </p>

            <div>
              <Label>Motivo da revisão *</Label>
              <Select value={overwriteMotivo} onValueChange={setOverwriteMotivo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  {motivosOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {overwriteMotivo === 'outros' && (
              <div>
                <Label>Descrição do motivo *</Label>
                <Textarea
                  value={overwriteDescricao}
                  onChange={(e) => setOverwriteDescricao(e.target.value)}
                  placeholder="Descreva o motivo da revisão..."
                  className="min-h-[80px]"
                />
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowOverwriteConfirm(false)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button onClick={saveInstallation} disabled={isSaving}>
                {isSaving ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
                ) : (
                  'Confirmar Revisão'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editingInstallation ? (
              <>
                <Edit3 className="h-5 w-5" />
                Editar Peça
              </>
            ) : (
              <>
                <Plus className="h-5 w-5" />
                Adicionar Peça
              </>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Tipologia *</Label>
              <Input
                value={formData.tipologia}
                onChange={(e) => setFormData(prev => ({ ...prev, tipologia: e.target.value }))}
                placeholder="Ex: Escada, Sanitário"
              />
            </div>
            
            <div>
              <Label>Código *</Label>
              <Input
                type="number"
                value={formData.codigo}
                onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value }))}
                placeholder="Ex: 1, 2, 3"
              />
            </div>
          </div>

          <div>
            <Label>Descrição *</Label>
            <Textarea
              value={formData.descricao}
              onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              placeholder="Descrição detalhada da peça..."
              className="min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Quantidade *</Label>
              <Input
                type="number"
                value={formData.quantidade}
                onChange={(e) => setFormData(prev => ({ ...prev, quantidade: e.target.value }))}
                placeholder="Ex: 1, 2, 5"
              />
            </div>
            
            <div>
              <Label>Pavimento *</Label>
              <Input
                value={formData.pavimento}
                onChange={(e) => setFormData(prev => ({ ...prev, pavimento: e.target.value }))}
                placeholder="Ex: Térreo, 1º Andar"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Altura da Diretriz (cm)</Label>
              <Input
                type="number"
                value={formData.diretriz_altura_cm}
                onChange={(e) => setFormData(prev => ({ ...prev, diretriz_altura_cm: e.target.value }))}
                placeholder="Ex: 120, 180"
              />
            </div>
            
            <div>
              <Label>Distância do Batente (cm)</Label>
              <Input
                type="number"
                value={formData.diretriz_dist_batente_cm}
                onChange={(e) => setFormData(prev => ({ ...prev, diretriz_dist_batente_cm: e.target.value }))}
                placeholder="Ex: 15, 20"
              />
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
              placeholder="Observações adicionais sobre a instalação..."
              className="min-h-[80px]"
            />
          </div>

          <div>
            <Label>Comentários para o Fornecedor</Label>
            <Textarea
              value={formData.comentarios_fornecedor}
              onChange={(e) => setFormData(prev => ({ ...prev, comentarios_fornecedor: e.target.value }))}
              placeholder="Comentários específicos para o fornecedor..."
              className="min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Tipo de Pendência</Label>
              <Select 
                value={formData.pendencia_tipo} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, pendencia_tipo: value, pendencia_descricao: value ? prev.pendencia_descricao : "" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="fornecedor">Fornecedor</SelectItem>
                  <SelectItem value="projetista">Projetista</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formData.pendencia_tipo && (
            <div>
              <Label>Descrição da Pendência *</Label>
              <Textarea
                value={formData.pendencia_descricao}
                onChange={(e) => setFormData(prev => ({ ...prev, pendencia_descricao: e.target.value }))}
                placeholder="Descreva detalhadamente a pendência..."
                className="min-h-[100px]"
              />
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
              ) : (
                editingInstallation ? "Atualizar Peça" : "Salvar Peça"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}