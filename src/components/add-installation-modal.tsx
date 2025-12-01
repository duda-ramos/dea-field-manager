import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Installation, ItemVersion } from "@/types";
import { storage } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { showToast, showUndoToast } from "@/lib/toast";
import { Plus, Edit3, Loader2 } from "lucide-react";
import { useUndo } from "@/hooks/useUndo";

interface AddInstallationModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  editingInstallation?: Installation | null;
  isRevision?: boolean; // Indica se é uma nova revisão
  currentRevision?: number; // Número da revisão atual
  revisionMotivo?: string; // Motivo da revisão
  revisionDescricao?: string; // Descrição do motivo
}

export function AddInstallationModal({ 
  projectId, 
  isOpen, 
  onClose, 
  onUpdate,
  editingInstallation,
  isRevision = false,
  revisionMotivo = "",
  revisionDescricao = ""
}: AddInstallationModalProps) {
  const { toast } = useToast();
  const { addAction, undo } = useUndo();
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
  
  const [errors, setErrors] = useState<Record<string, string>>({});
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
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Removed duplicate code check - codes can be duplicated

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};

    // Validate required fields
    if (!formData.tipologia.trim()) {
      newErrors.tipologia = 'Tipologia é obrigatória';
    }
    if (!formData.codigo.trim()) {
      newErrors.codigo = 'Código é obrigatório';
    }
    if (!formData.descricao.trim()) {
      newErrors.descricao = 'Descrição é obrigatória';
    }
    if (!formData.quantidade.trim()) {
      newErrors.quantidade = 'Quantidade é obrigatória';
    }
    if (!formData.pavimento.trim()) {
      newErrors.pavimento = 'Pavimento é obrigatório';
    }

    // Validate pendency fields
    if (formData.pendencia_tipo && !formData.pendencia_descricao.trim()) {
      newErrors.pendencia_descricao = 'Descrição da pendência é obrigatória quando há uma pendência selecionada';
    }

    // Validate numeric fields
    const quantidade = parseFloat(formData.quantidade);

    if (formData.quantidade && isNaN(quantidade)) {
      newErrors.quantidade = 'Quantidade deve ser um número válido';
    }

    if (formData.quantidade && quantidade > 0) {
      const decimalPlaces = (formData.quantidade.split('.')[1] || '').length;
      if (decimalPlaces > 2) {
        newErrors.quantidade = 'Quantidade pode ter no máximo 2 casas decimais';
      }
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      toast({
        title: "Campos obrigatórios faltando",
        description: "Preencha todos os campos obrigatórios corretamente",
        variant: "destructive",
        duration: 5000
      });
      showToast.error("Erro de validação", "Preencha todos os campos obrigatórios");
      return;
    }

    // Removed duplicate code check - codes can be duplicated
    // Proceed with save
    saveInstallation();
  };

  const saveInstallation = async () => {
    const codigo = formData.codigo.trim();
    const quantidade = parseFloat(formData.quantidade);
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

    setIsSaving(true);

    try {
      let savedInstallation: Installation;

      if (editingInstallation) {
        // Save previous state before updating
        const previousState = { ...editingInstallation };
        
        // Se for uma revisão, incrementar o número de revisão (começando do 1)
        const currentRevisionNum = editingInstallation.revisao ?? 0;
        const newRevisionNumber = isRevision ? currentRevisionNum + 1 : currentRevisionNum;
        
        // Update existing installation
        savedInstallation = await storage.upsertInstallation(
          {
            ...editingInstallation,
            ...installationData,
            revisao: newRevisionNumber,
            revisado: isRevision ? true : editingInstallation.revisado
          },
          isRevision
            ? {
                motivo: (revisionMotivo || 'edited') as ItemVersion['motivo'],
                descricaoMotivo: revisionDescricao || `Revisão ${newRevisionNumber}`,
                type: 'edited',
                actionType: 'updated',
                forceRevision: true,
              }
            : undefined
        );
        
        // Add undo action for edition
        addAction({
          type: 'UPDATE_INSTALLATION',
          description: `Editou instalação "${formData.descricao}"`,
          data: { 
            installationId: savedInstallation.id,
            previousState: previousState 
          },
          undo: async () => {
            // Restaurar estado anterior
            await storage.upsertInstallation(previousState);
            // Atualizar UI
            onUpdate();
          }
        });
        
        // Show undo toast
        showUndoToast(
          `Editou instalação "${formData.descricao}"`,
          async () => {
            await undo();
          }
        );
        
        toast({
          title: isRevision ? "Revisão criada com sucesso" : "Peça atualizada",
          description: isRevision 
            ? `Revisão ${savedInstallation.revisao} da peça ${savedInstallation.codigo} "${savedInstallation.descricao}" foi criada`
            : `Peça ${savedInstallation.codigo} "${savedInstallation.descricao}" foi salva${savedInstallation.revisado ? ` (rev. ${savedInstallation.revisao})` : ""}`,
          duration: 3000
        });
        showToast.success(
          isRevision ? "Revisão criada" : "Peça atualizada",
          isRevision 
            ? `Revisão ${savedInstallation.revisao} da peça ${savedInstallation.codigo} ${savedInstallation.descricao} criada com sucesso`
            : `${savedInstallation.codigo} ${savedInstallation.descricao} foi atualizada${savedInstallation.revisado ? ` (rev. ${savedInstallation.revisao})` : ""}`
        );
      } else {
        // Create new installation
        const now = new Date();
        const nowIso = now.toISOString();
        savedInstallation = await storage.upsertInstallation(
          {
            ...installationData,
            id: `installation_${Date.now()}`,
            project_id: projectId,
            installed: false,
            photos: [],
            revisado: false,
            revisao: 0,
            updated_at: nowIso
          },
          {
            actionType: 'created',
            motivo: 'created',
            descricaoMotivo: 'Versão inicial',
            type: 'created',
            forceRevision: true,
          }
        );

        // Add undo action for creation
        addAction({
          type: 'CREATE_INSTALLATION',
          description: `Criou instalação "${formData.descricao}"`,
          data: { 
            projectId,
            installation: savedInstallation 
          },
          undo: async () => {
            // Deletar instalação do storage
            await storage.deleteInstallation(savedInstallation.id);
            // Atualizar lista (callback para componente pai)
            onUpdate();
          }
        });
        
        // Show undo toast
        showUndoToast(
          `Criou instalação "${formData.descricao}"`,
          async () => {
            await undo();
          }
        );

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
      // Error já tratado pelo toast
      toast({
        title: "Erro ao salvar peça",
        description: "Não foi possível salvar as informações. Verifique os dados e tente novamente",
        variant: "destructive",
        duration: 5000
      });
      showToast.error(
        "Erro ao salvar",
        error instanceof Error ? error.message : "Não foi possível salvar a instalação. Tente novamente."
      );
    } finally {
      setIsSaving(false);
    }
  };

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
              <Label htmlFor="tipologia">Tipologia *</Label>
              <Input
                id="tipologia"
                value={formData.tipologia}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, tipologia: e.target.value }));
                  if (errors.tipologia) setErrors(prev => ({ ...prev, tipologia: '' }));
                }}
                placeholder="Ex: Escada, Sanitário"
                aria-required="true"
                aria-invalid={Boolean(errors.tipologia)}
                aria-describedby={errors.tipologia ? 'tipologia-error' : undefined}
                className={errors.tipologia ? 'border-destructive' : ''}
              />
              {errors.tipologia && (
                <p id="tipologia-error" className="text-sm text-destructive mt-1">{errors.tipologia}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="codigo">Código *</Label>
              <Input
                id="codigo"
                type="text"
                value={formData.codigo}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, codigo: e.target.value }));
                  if (errors.codigo) setErrors(prev => ({ ...prev, codigo: '' }));
                }}
                placeholder="Ex: 1, 2A, B-101"
                aria-required="true"
                aria-invalid={Boolean(errors.codigo)}
                aria-describedby={errors.codigo ? 'codigo-error' : undefined}
                className={errors.codigo ? 'border-destructive' : ''}
              />
              {errors.codigo && (
                <p id="codigo-error" className="text-sm text-destructive mt-1">{errors.codigo}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="descricao">Descrição *</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, descricao: e.target.value }));
                if (errors.descricao) setErrors(prev => ({ ...prev, descricao: '' }));
              }}
              placeholder="Descrição detalhada da peça..."
              className={`min-h-[80px] ${errors.descricao ? 'border-destructive' : ''}`}
              aria-required="true"
              aria-invalid={Boolean(errors.descricao)}
              aria-describedby={errors.descricao ? 'descricao-error' : undefined}
            />
            {errors.descricao && (
              <p id="descricao-error" className="text-sm text-destructive mt-1">{errors.descricao}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantidade">Quantidade *</Label>
              <Input
                id="quantidade"
                type="number"
                step="0.01"
                value={formData.quantidade}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, quantidade: e.target.value }));
                  if (errors.quantidade) setErrors(prev => ({ ...prev, quantidade: '' }));
                }}
                placeholder="Ex: 1, 2.5, 3.75"
                aria-required="true"
                aria-invalid={Boolean(errors.quantidade)}
                aria-describedby={errors.quantidade ? 'quantidade-error' : undefined}
                className={errors.quantidade ? 'border-destructive' : ''}
              />
              {errors.quantidade && (
                <p id="quantidade-error" className="text-sm text-destructive mt-1">{errors.quantidade}</p>
              )}
            </div>
            
            <div>
              <Label htmlFor="pavimento">Pavimento *</Label>
              <Input
                id="pavimento"
                value={formData.pavimento}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, pavimento: e.target.value }));
                  if (errors.pavimento) setErrors(prev => ({ ...prev, pavimento: '' }));
                }}
                placeholder="Ex: Térreo, 1º Andar"
                aria-required="true"
                aria-invalid={Boolean(errors.pavimento)}
                aria-describedby={errors.pavimento ? 'pavimento-error' : undefined}
                className={errors.pavimento ? 'border-destructive' : ''}
              />
              {errors.pavimento && (
                <p id="pavimento-error" className="text-sm text-destructive mt-1">{errors.pavimento}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="diretriz_altura_cm">Altura da Diretriz (cm)</Label>
              <Input
                id="diretriz_altura_cm"
                type="number"
                value={formData.diretriz_altura_cm}
                onChange={(e) => setFormData(prev => ({ ...prev, diretriz_altura_cm: e.target.value }))}
                placeholder="Ex: 120, 180"
              />
            </div>
            
            <div>
              <Label htmlFor="diretriz_dist_batente_cm">Distância do Batente (cm)</Label>
              <Input
                id="diretriz_dist_batente_cm"
                type="number"
                value={formData.diretriz_dist_batente_cm}
                onChange={(e) => setFormData(prev => ({ ...prev, diretriz_dist_batente_cm: e.target.value }))}
                placeholder="Ex: 15, 20"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
              placeholder="Observações adicionais sobre a instalação..."
              className="min-h-[80px]"
            />
          </div>

          <div>
            <Label htmlFor="comentarios_fornecedor">Comentários para o Fornecedor</Label>
            <Textarea
              id="comentarios_fornecedor"
              value={formData.comentarios_fornecedor}
              onChange={(e) => setFormData(prev => ({ ...prev, comentarios_fornecedor: e.target.value }))}
              placeholder="Comentários específicos para o fornecedor..."
              className="min-h-[80px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pendencia_tipo">Tipo de Pendência</Label>
              <Select 
                value={formData.pendencia_tipo} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, pendencia_tipo: value, pendencia_descricao: value ? prev.pendencia_descricao : "" }))}
              >
                <SelectTrigger id="pendencia_tipo">
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
              <Label htmlFor="pendencia_descricao">Descrição da Pendência *</Label>
              <Textarea
                id="pendencia_descricao"
                value={formData.pendencia_descricao}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, pendencia_descricao: e.target.value }));
                  if (errors.pendencia_descricao) setErrors(prev => ({ ...prev, pendencia_descricao: '' }));
                }}
                placeholder="Descreva detalhadamente a pendência..."
                className={`min-h-[100px] ${errors.pendencia_descricao ? 'border-destructive' : ''}`}
                aria-required="true"
                aria-invalid={Boolean(errors.pendencia_descricao)}
                aria-describedby={errors.pendencia_descricao ? 'pendencia_descricao-error' : undefined}
              />
              {errors.pendencia_descricao && (
                <p id="pendencia_descricao-error" className="text-sm text-destructive mt-1">{errors.pendencia_descricao}</p>
              )}
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