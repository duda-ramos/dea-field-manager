import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Installation, ItemVersion } from "@/types";
import { storage } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { PhotoGallery } from "@/components/photo-gallery";
import { AddInstallationModal } from "@/components/add-installation-modal";
import { History, Edit3, Eye, Plus } from "lucide-react";

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
  const [currentObservation, setCurrentObservation] = useState("");
  const [observationHistory, setObservationHistory] = useState<string[]>([]);
  const [currentSupplierComment, setCurrentSupplierComment] = useState("");
  const [supplierCommentHistory, setSupplierCommentHistory] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>(installation.photos);
  const [versions, setVersions] = useState<ItemVersion[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<ItemVersion | null>(null);
  const [showAddRevisionModal, setShowAddRevisionModal] = useState(false);
  const [showRevisionMotiveModal, setShowRevisionMotiveModal] = useState(false);
  const [revisionMotivo, setRevisionMotivo] = useState<string>("");
  const [revisionDescricao, setRevisionDescricao] = useState("");

  useEffect(() => {
    setInstalled(installation.installed);
    setPhotos(installation.photos);
    const loadVersions = async () => {
      const versions = await storage.getItemVersions(installation.id);
      setVersions(versions);
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
      return;
    }

    if (revisionMotivo === 'outros' && !revisionDescricao.trim()) {
      toast({
        title: "Erro", 
        description: "Descreva o motivo da revisão",
        variant: "destructive"
      });
      return;
    }

    // Close motive modal and proceed with revision
    setShowRevisionMotiveModal(false);
    setShowAddRevisionModal(true);
  };

  const handleRevisionUpdate = async () => {
    // Apply the overwrite with motive
    if (revisionMotivo && installation) {
      const currentData = {
        tipologia: installation.tipologia,
        codigo: installation.codigo,
        descricao: installation.descricao,
        quantidade: installation.quantidade,
        pavimento: installation.pavimento,
        diretriz_altura_cm: installation.diretriz_altura_cm,
        diretriz_dist_batente_cm: installation.diretriz_dist_batente_cm,
        observacoes: installation.observacoes,
        comentarios_fornecedor: installation.comentarios_fornecedor
      };

      // Create a new revision - this is simplified, you may need to implement proper revision logic
      const newRevision = { ...installation, ...currentData, revisao: (installation.revisao || 0) + 1 };
      const updatedInstallation = await storage.upsertInstallation(newRevision);

      const updatedVersions = await storage.getItemVersions(installation.id);
      setVersions(updatedVersions);
      onUpdate();
      
      toast({
        title: "Revisão criada",
        description: `${updatedInstallation.codigo} ${updatedInstallation.descricao} - Revisão ${updatedInstallation.revisao} criada`,
      });

      // Reset revision state
      setRevisionMotivo("");
      setRevisionDescricao("");
    }
    
    setShowAddRevisionModal(false);
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
          
          <div className="space-y-6">
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

            {/* Installation Status */}
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

            {/* Photo Gallery */}
            <PhotoGallery
              photos={photos}
              onPhotosChange={setPhotos}
            />

            {/* Revision Actions */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleAddRevision}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Revisão
              </Button>
              {versions.length > 0 && (
                <Button variant="outline" onClick={() => setShowHistory(!showHistory)}>
                  <History className="h-4 w-4 mr-2" />
                  {showHistory ? "Ocultar Histórico" : "Ver Histórico"}
                </Button>
              )}
              <Button onClick={handleSave}>
                Salvar Alterações
              </Button>
            </div>

            {/* Version History */}
            {showHistory && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Histórico de Revisões
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {versions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      Nenhuma revisão anterior encontrada
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {versions.map((version) => (
                        <div key={version.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-semibold">Revisão {version.revisao}</span>
                              <span className="text-sm text-muted-foreground ml-2">
                                {new Date(version.criadoEm).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedVersion(version)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalhes
                            </Button>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Motivo:</span> {
                              version.motivo === 'problema-instalacao' ? 'Problema de instalação' :
                              version.motivo === 'revisao-conteudo' ? 'Revisão de conteúdo' :
                              version.motivo === 'desaprovado-cliente' ? 'Desaprovado pelo cliente' :
                              'Outros'
                            }
                            {version.descricao_motivo && (
                              <span className="block mt-1 text-muted-foreground">
                                {version.descricao_motivo}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Version Detail Modal */}
      {selectedVersion && (
        <Dialog open={!!selectedVersion} onOpenChange={() => setSelectedVersion(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Revisão {selectedVersion.revisao} - {selectedVersion.snapshot.codigo} {selectedVersion.snapshot.descricao}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Tipologia</Label>
                  <Input value={selectedVersion.snapshot.tipologia} readOnly className="bg-muted" />
                </div>
                <div>
                  <Label>Código</Label>
                  <Input value={String(selectedVersion.snapshot.codigo)} readOnly className="bg-muted" />
                </div>
                <div>
                  <Label>Quantidade</Label>
                  <Input value={String(selectedVersion.snapshot.quantidade)} readOnly className="bg-muted" />
                </div>
                <div>
                  <Label>Pavimento</Label>
                  <Input value={selectedVersion.snapshot.pavimento} readOnly className="bg-muted" />
                </div>
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea value={selectedVersion.snapshot.descricao} readOnly className="bg-muted min-h-[80px]" />
              </div>

              {(selectedVersion.snapshot.diretriz_altura_cm || selectedVersion.snapshot.diretriz_dist_batente_cm) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Altura da Diretriz (cm)</Label>
                    <Input 
                      value={selectedVersion.snapshot.diretriz_altura_cm ? String(selectedVersion.snapshot.diretriz_altura_cm) : "Não especificado"} 
                      readOnly 
                      className="bg-muted" 
                    />
                  </div>
                  <div>
                    <Label>Distância do Batente (cm)</Label>
                    <Input 
                      value={selectedVersion.snapshot.diretriz_dist_batente_cm ? String(selectedVersion.snapshot.diretriz_dist_batente_cm) : "Não especificado"} 
                      readOnly 
                      className="bg-muted" 
                    />
                  </div>
                </div>
              )}

              {selectedVersion.snapshot.observacoes && (
                <div>
                  <Label>Observações</Label>
                  <Textarea value={selectedVersion.snapshot.observacoes} readOnly className="bg-muted min-h-[80px]" />
                </div>
              )}

              {selectedVersion.snapshot.comentarios_fornecedor && (
                <div>
                  <Label>Comentários para o Fornecedor</Label>
                  <Textarea value={selectedVersion.snapshot.comentarios_fornecedor} readOnly className="bg-muted min-h-[80px]" />
                </div>
              )}

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setSelectedVersion(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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