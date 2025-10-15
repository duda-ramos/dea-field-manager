import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Installation, ItemVersion, InstallationRevision, InstallationRevisionData } from "@/types";
import { storage } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { showToast } from "@/lib/toast";
import { PhotoGallery } from "@/components/photo-gallery";
import { AddInstallationModal } from "@/components/add-installation-modal";
import { LazyRevisionHistoryModal } from "@/components/LazyRevisionHistoryModal";
import { Plus, Info, Image as ImageIcon, Clock } from "lucide-react";

interface InstallationDetailModalNewProps {
  installation: Installation;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function InstallationDetailModalNew({ 
  installation, 
  isOpen, 
  onClose, 
  onUpdate 
}: InstallationDetailModalNewProps) {
  const { toast } = useToast();
  const [installed, setInstalled] = useState(installation.installed);
  const [status, setStatus] = useState(installation.status || 'ativo');
  const [pendenciaTipo, setPendenciaTipo] = useState(installation.pendencia_tipo || '');
  const [pendenciaDescricao, setPendenciaDescricao] = useState(installation.pendencia_descricao || '');
  const [currentObservation, setCurrentObservation] = useState("");
  const [observationHistory, setObservationHistory] = useState<string[]>([]);
  const [currentSupplierComment, setCurrentSupplierComment] = useState("");
  const [supplierCommentHistory, setSupplierCommentHistory] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>(installation.photos);
  const [versions, setVersions] = useState<ItemVersion[]>([]);
  const [showAddRevisionModal, setShowAddRevisionModal] = useState(false);
  const [showRevisionMotiveModal, setShowRevisionMotiveModal] = useState(false);
  const [revisionMotivo, setRevisionMotivo] = useState<string>("");
  const [revisionDescricao, setRevisionDescricao] = useState("");
  const [showRevisionHistoryModal, setShowRevisionHistoryModal] = useState(false);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setInstalled(installation.installed);
    setPhotos(installation.photos);
    setPendenciaTipo(installation.pendencia_tipo || '');
    setPendenciaDescricao(installation.pendencia_descricao || '');
    
    // Auto-set status based on pendency
    if (installation.pendencia_tipo) {
      setStatus('pendente');
    } else {
      setStatus(installation.status || 'ativo');
    }
    
    const loadVersions = async () => {
      setIsLoadingVersions(true);
      try {
        const versions = await storage.getItemVersions(installation.id);
        setVersions(versions);
      } catch (_error) {
        // Erro já é tratado com toast
        toast({
          title: "Erro ao carregar histórico",
          description: "Não foi possível carregar o histórico de revisões.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingVersions(false);
      }
    };
    loadVersions();
    
    // Parse existing observations as history
    if (installation.observacoes && installation.observacoes.trim() !== "") {
      setObservationHistory(installation.observacoes.split('\n---\n').filter(obs => obs.trim() !== ""));
    } else {
      setObservationHistory([]);
    }
    
    // Parse existing supplier comments as history
    if (installation.comentarios_fornecedor && installation.comentarios_fornecedor.trim() !== "") {
      setSupplierCommentHistory(installation.comentarios_fornecedor.split('\n---\n').filter(comment => comment.trim() !== ""));
    } else {
      setSupplierCommentHistory([]);
    }
  }, [installation]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    
    try {
      let newObservations = observationHistory.join('\n---\n');
      let newSupplierComments = supplierCommentHistory.join('\n---\n');
      
      // Add new observation if provided
      if (currentObservation.trim() !== "") {
        const timestampedObservation = `[${new Date().toLocaleString('pt-BR')}] ${currentObservation.trim()}`;
        newObservations = newObservations ? `${newObservations}\n---\n${timestampedObservation}` : timestampedObservation;
      }
      
      // Add new supplier comment if provided
      if (currentSupplierComment.trim() !== "") {
        const timestampedComment = `[${new Date().toLocaleString('pt-BR')}] ${currentSupplierComment.trim()}`;
        newSupplierComments = newSupplierComments ? `${newSupplierComments}\n---\n${timestampedComment}` : timestampedComment;
      }

      const updatedInstallation = { 
        ...installation, 
        installed,
        status,
        pendencia_tipo: pendenciaTipo as 'cliente' | 'fornecedor' | 'projetista' | undefined,
        pendencia_descricao: pendenciaDescricao || undefined, 
        observacoes: newObservations || undefined, 
        comentarios_fornecedor: newSupplierComments || undefined,
        photos 
      };
      const updated = await storage.upsertInstallation(updatedInstallation);

      if (updated) {
        onUpdate();
        onClose();
        toast({
          title: "Instalação atualizada",
          description: "As informações foram salvas com sucesso.",
        });
        showToast.success("Instalação atualizada", "As informações foram salvas com sucesso.");
      }
    } catch (error) {
      // Erro já é tratado com toast
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as alterações. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const addObservation = () => {
    if (currentObservation.trim() === "") return;
    
    const timestampedObservation = `[${new Date().toLocaleString('pt-BR')}] ${currentObservation.trim()}`;
    setObservationHistory([...observationHistory, timestampedObservation]);
    setCurrentObservation("");
  };

  const addSupplierComment = () => {
    if (currentSupplierComment.trim() === "") return;
    
    const timestampedComment = `[${new Date().toLocaleString('pt-BR')}] ${currentSupplierComment.trim()}`;
    setSupplierCommentHistory([...supplierCommentHistory, timestampedComment]);
    setCurrentSupplierComment("");
  };

  const handleAddRevision = () => {
    setShowRevisionMotiveModal(true);
  };

  const handleRevisionMotiveConfirm = () => {
    if (!revisionMotivo) {
      toast({
        title: "Erro",
        description: "Selecione um motivo para a revisão",
        variant: "destructive"
      });
      showToast.error("Erro", "Selecione um motivo para a revisão");
      return;
    }

    if (revisionMotivo === 'outros' && !revisionDescricao.trim()) {
      toast({
        title: "Erro", 
        description: "Descreva o motivo da revisão",
        variant: "destructive"
      });
      showToast.error("Erro", "Descreva o motivo da revisão");
      return;
    }

    // Close motive modal and proceed with revision
    setShowRevisionMotiveModal(false);
    setShowAddRevisionModal(true);
  };

  const handleRevisionUpdate = async () => {
    // Fecha o modal após o salvamento (que é feito pelo AddInstallationModal)
    setShowAddRevisionModal(false);
    
    // Atualiza a lista de instalações
    await onUpdate();
    
    // Reset dos estados de revisão
    setRevisionMotivo("");
    setRevisionDescricao("");
  };

  const handleRestoreVersion = async (version: ItemVersion) => {
    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const nowTimestamp = now.getTime();
      const newRevisionNumber = (installation.revisao || 0) + 1;

      const projectId = (installation as any)?.projectId ?? installation.project_id;
      const baseSnapshot = {
        ...version.snapshot,
      };

      const mergedInstallation = {
        ...installation,
        ...baseSnapshot,
        id: installation.id,
        project_id: installation.project_id,
        projectId,
        revisado: true,
        revisao: newRevisionNumber,
        updated_at: nowIso,
        updatedAt: nowTimestamp,
        photos: baseSnapshot.photos ?? installation.photos ?? [],
      } as Installation;

      const existingRevisions: InstallationRevision[] = Array.isArray(installation.revisions)
        ? (installation.revisions as InstallationRevision[])
        : [];
      const { revisions: _ignoreRevisions, ...installationWithoutRevisions } = mergedInstallation;
      const revisionEntryData: InstallationRevisionData = {
        ...installationWithoutRevisions,
        updated_at: nowIso,
        updatedAt: nowTimestamp,
        revisao: newRevisionNumber,
        revisado: true,
      };

      const restoredInstallation: Installation = {
        ...installationWithoutRevisions,
        revisions: [
          ...existingRevisions,
          {
            timestamp: nowIso,
            type: "restored",
            data: revisionEntryData,
          },
        ],
      };

      const updated = await storage.upsertInstallation(restoredInstallation);

      if (updated) {
        const {
          id: _id,
          revisado: _revisado,
          revisao: _revisao,
          revisions: _revisions,
          ...snapshot
        } = updated;

        const itemId =
          (installation as any)?.itemId ??
          (installation as any)?.item_id ??
          installation.id;

        const restoredVersion: ItemVersion = {
          id: crypto.randomUUID(),
          installationId: installation.id,
          itemId,
          snapshot,
          revisao: newRevisionNumber,
          motivo: "restored",
          type: "restored",
          descricao_motivo: `Restaurado a partir da revisão ${version.revisao}`,
          criadoEm: nowIso,
          createdAt: nowTimestamp,
        };

        await storage.upsertItemVersion(restoredVersion);

        const updatedVersions = await storage.getItemVersions(installation.id);
        setVersions(updatedVersions);

        setInstalled(restoredInstallation.installed);
        setStatus(restoredInstallation.status || 'ativo');
        setPendenciaTipo(restoredInstallation.pendencia_tipo || '');
        setPendenciaDescricao(restoredInstallation.pendencia_descricao || '');
        setPhotos(restoredInstallation.photos);

        if (restoredInstallation.observacoes && restoredInstallation.observacoes.trim() !== "") {
          setObservationHistory(restoredInstallation.observacoes.split('\n---\n').filter(obs => obs.trim() !== ""));
        } else {
          setObservationHistory([]);
        }

        if (restoredInstallation.comentarios_fornecedor && restoredInstallation.comentarios_fornecedor.trim() !== "") {
          setSupplierCommentHistory(restoredInstallation.comentarios_fornecedor.split('\n---\n').filter(comment => comment.trim() !== ""));
        } else {
          setSupplierCommentHistory([]);
        }

        onUpdate();

        // Pequeno delay para garantir que o toast aparece após o modal fechar
        setTimeout(() => {
          toast({
            title: "Versão restaurada",
            description: `Revisão ${version.revisao} restaurada com sucesso`,
            variant: "default",
          });
          showToast.success(
            "Versão restaurada",
            `Revisão ${version.revisao} restaurada com sucesso`
          );
        }, 300);
      }
    } catch (error) {
      // Erro já é tratado com toast
      toast({
        title: "Erro ao restaurar",
        description: "Não foi possível restaurar a versão. Tente novamente.",
        variant: "destructive",
      });
      showToast.error(
        "Erro ao restaurar",
        "Não foi possível restaurar a versão. Tente novamente."
      );
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {installation.codigo} {installation.descricao}
              {installation.revisado && (
                <Badge variant="secondary" className="ml-2">
                  Revisado (rev. {installation.revisao})
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info" className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                Informações
              </TabsTrigger>
              <TabsTrigger value="photos" className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Fotos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-6 mt-6">
            {/* Installation Status Toggle - Moved to top */}
            <div className="flex items-center space-x-2">
              <Switch
                id="installed"
                checked={installed}
                onCheckedChange={setInstalled}
              />
              <Label htmlFor="installed">
                Marcar como instalado
                {installed && installation.installed_at && (
                  <span className="text-sm text-muted-foreground ml-2">
                    (Instalado em: {new Date(installation.installed_at).toLocaleDateString('pt-BR')})
                  </span>
                )}
              </Label>
            </div>

            {/* Status Dropdown */}
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => {
                // Prevent manual change to 'pendente' if there's no pendency
                if (value === 'pendente' && !pendenciaTipo) {
                  return;
                }
                // Prevent changing from 'pendente' if there's a pendency
                if (pendenciaTipo && value !== 'pendente') {
                  return;
                }
                setStatus(value as 'ativo' | 'on hold' | 'cancelado' | 'pendente');
              }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  {!pendenciaTipo && <SelectItem value="ativo">Ativo</SelectItem>}
                  {pendenciaTipo && <SelectItem value="pendente">Pendente</SelectItem>}
                  {!pendenciaTipo && <SelectItem value="on hold">On Hold</SelectItem>}
                  {!pendenciaTipo && <SelectItem value="cancelado">Cancelado</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Descrição</Label>
                <Input value={installation.descricao} readOnly className="bg-muted" />
              </div>
              <div>
                <Label>Código</Label>
                <Input value={String(installation.codigo)} readOnly className="bg-muted" />
              </div>
              <div>
                <Label>Tipologia</Label>
                <Input value={installation.tipologia} readOnly className="bg-muted" />
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input value={String(installation.quantidade)} readOnly className="bg-muted" />
              </div>
              <div>
                <Label>Pavimento</Label>
                <Input value={installation.pavimento} readOnly className="bg-muted" />
              </div>
              <div>
                <Label>Altura da Diretriz (cm)</Label>
                <Input 
                  value={installation.diretriz_altura_cm ? String(installation.diretriz_altura_cm) : "Não especificado"} 
                  readOnly 
                  className="bg-muted" 
                />
              </div>
              <div>
                <Label>Distância do Batente (cm)</Label>
                <Input 
                  value={installation.diretriz_dist_batente_cm ? String(installation.diretriz_dist_batente_cm) : "Não especificado"} 
                  readOnly 
                  className="bg-muted" 
                />
              </div>
            </div>

            {/* Pendency Input Fields - Editable fields for pendency management */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Tipo de Pendência</Label>
                  <Select 
                    value={pendenciaTipo || "none"} 
                    onValueChange={(value) => {
                      const newPendenciaTipo = value === "none" ? "" : value;
                      setPendenciaTipo(newPendenciaTipo);
                      
                      // Auto-update status based on pendency
                      if (newPendenciaTipo) {
                        setStatus('pendente');
                      } else {
                        setStatus('ativo');
                        setPendenciaDescricao('');
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma pendência</SelectItem>
                      <SelectItem value="cliente">Cliente</SelectItem>
                      <SelectItem value="fornecedor">Fornecedor</SelectItem>
                      <SelectItem value="projetista">Projetista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {pendenciaTipo && (
                <div>
                  <Label>Descrição da Pendência *</Label>
                  <Textarea
                    value={pendenciaDescricao}
                    onChange={(e) => setPendenciaDescricao(e.target.value)}
                    placeholder="Descreva detalhadamente a pendência..."
                    className="min-h-[100px]"
                  />
                </div>
              )}
            </div>

            {/* Pendency Information Display - Show existing pendency as card if present */}
            {installation.pendencia_tipo && (
              <Card className="border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 shadow-md">
                <CardHeader className="pb-3 bg-gradient-to-r from-amber-100 to-orange-100 rounded-t-lg">
                  <CardTitle className="flex items-center gap-3 text-amber-900">
                    <div className="h-3 w-3 bg-amber-500 rounded-full animate-pulse"></div>
                    <span className="text-lg font-semibold">Pendência Atual</span>
                    <Badge 
                      variant="outline" 
                      className={
                        installation.pendencia_tipo === 'cliente' 
                          ? "bg-red-100 text-red-800 border-red-300"
                          : installation.pendencia_tipo === 'fornecedor'
                          ? "bg-yellow-100 text-yellow-800 border-yellow-300" 
                          : "bg-blue-100 text-blue-800 border-blue-300"
                      }
                    >
                      {installation.pendencia_tipo.charAt(0).toUpperCase() + installation.pendencia_tipo.slice(1)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="bg-white/70 rounded-lg p-4 border border-amber-200">
                    <Label className="text-sm font-semibold text-amber-900 mb-2 block">
                      Descrição da Pendência:
                    </Label>
                    <p className="text-sm text-amber-800 whitespace-pre-wrap leading-relaxed">
                      {installation.pendencia_descricao}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Comments for supplier */}
            <div className="space-y-4">
              <Label>Comentários para o Fornecedor</Label>
              
              {/* Add new supplier comment */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Adicionar novo comentário para o fornecedor..."
                  value={currentSupplierComment}
                  onChange={(e) => setCurrentSupplierComment(e.target.value)}
                  className="flex-1"
                  rows={3}
                />
                <Button 
                  onClick={addSupplierComment}
                  disabled={currentSupplierComment.trim() === ""}
                  className="self-start"
                >
                  Adicionar
                </Button>
              </div>
              
              {/* Supplier comment history */}
              {supplierCommentHistory.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Histórico de Comentários:</Label>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {supplierCommentHistory.map((comment, index) => (
                      <div key={index} className="p-3 bg-muted rounded-md text-sm">
                        {comment}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>


            {/* Observations */}
            <div className="space-y-4">
              <Label>Observações</Label>
              
              {/* Add new observation */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Adicionar nova observação..."
                  value={currentObservation}
                  onChange={(e) => setCurrentObservation(e.target.value)}
                  className="flex-1"
                  rows={3}
                />
                <Button 
                  onClick={addObservation}
                  disabled={currentObservation.trim() === ""}
                  className="self-start"
                >
                  Adicionar
                </Button>
              </div>
              
              {/* Observation history */}
              {observationHistory.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Histórico de Observações:</Label>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {observationHistory.map((obs, index) => (
                      <div key={index} className="p-3 bg-muted rounded-md text-sm">
                        {obs}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Revision Actions */}
            <div className="flex gap-2 justify-between">
              <Button 
                variant="outline" 
                onClick={() => setShowRevisionHistoryModal(true)}
                className="flex items-center gap-2"
                disabled={isLoadingVersions}
              >
                <Clock className="h-4 w-4" />
                {isLoadingVersions ? "Carregando..." : "Histórico de Revisões"}
                {!isLoadingVersions && versions.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {versions.length}
                  </Badge>
                )}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleAddRevision}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Revisão
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </div>
            </TabsContent>

            <TabsContent value="photos" className="space-y-6 mt-6">
              {/* Photo Gallery */}
              <PhotoGallery
                photos={photos}
                onPhotosChange={setPhotos}
                projectId={installation.project_id}
                installationId={installation.id}
                installationCode={String(installation.codigo)}
              />
              
              {/* Save button for photos tab */}
              <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Revision History Modal - Lazy loaded */}
      {showRevisionHistoryModal && (
        <LazyRevisionHistoryModal
          installation={installation}
          revisions={versions}
          isOpen={showRevisionHistoryModal}
          onClose={() => setShowRevisionHistoryModal(false)}
          onRestore={handleRestoreVersion}
        />
      )}

      {/* Add Revision Modal */}
      <AddInstallationModal
        projectId={installation.project_id}
        isOpen={showAddRevisionModal}
        onClose={() => {
          setShowAddRevisionModal(false);
          setRevisionMotivo("");
          setRevisionDescricao("");
        }}
        onUpdate={handleRevisionUpdate}
        editingInstallation={installation}
        isRevision={true}
        currentRevision={installation.revisao || 1}
        revisionMotivo={revisionMotivo}
        revisionDescricao={revisionDescricao}
      />

      {/* Revision Motive Selection Modal */}
      <Dialog open={showRevisionMotiveModal} onOpenChange={() => setShowRevisionMotiveModal(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Motivo da Revisão</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Selecione o motivo para criar uma nova revisão desta peça:
            </p>

            <div>
              <Label>Motivo da revisão *</Label>
              <select
                value={revisionMotivo}
                onChange={(e) => setRevisionMotivo(e.target.value)}
                className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="">Selecione o motivo</option>
                <option value="problema-instalacao">Problema de instalação</option>
                <option value="revisao-conteudo">Revisão de conteúdo</option>
                <option value="desaprovado-cliente">Desaprovado pelo cliente</option>
                <option value="outros">Outros</option>
              </select>
            </div>

            {revisionMotivo === 'outros' && (
              <div>
                <Label>Descrição do motivo *</Label>
                <Textarea
                  value={revisionDescricao}
                  onChange={(e) => setRevisionDescricao(e.target.value)}
                  placeholder="Descreva o motivo da revisão..."
                  className="min-h-[80px]"
                />
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRevisionMotiveModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleRevisionMotiveConfirm}>
                Continuar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}