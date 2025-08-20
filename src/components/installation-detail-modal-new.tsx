import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Installation } from "@/types";
import { storage } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { PhotoGallery } from "@/components/photo-gallery";

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
  const [photos, setPhotos] = useState<string[]>(installation.photos);

  useEffect(() => {
    setInstalled(installation.installed);
    setPhotos(installation.photos);
    
    // Parse existing observations as history
    if (installation.observacoes && installation.observacoes.trim() !== "") {
      setObservationHistory(installation.observacoes.split('\n---\n').filter(obs => obs.trim() !== ""));
    } else {
      setObservationHistory([]);
    }
  }, [installation]);

  const handleSave = () => {
    let newObservations = observationHistory.join('\n---\n');
    
    // Add new observation if provided
    if (currentObservation.trim() !== "") {
      const timestampedObservation = `[${new Date().toLocaleString('pt-BR')}] ${currentObservation.trim()}`;
      newObservations = newObservations ? `${newObservations}\n---\n${timestampedObservation}` : timestampedObservation;
    }

    const updated = storage.updateInstallation(installation.id, {
      installed,
      observacoes: newObservations || undefined,
      photos
    });

    if (updated) {
      onUpdate();
      onClose();
      toast({
        title: "Instalação atualizada",
        description: "As informações foram salvas com sucesso.",
      });
    }
  };

  const handleCancel = () => {
    setInstalled(installation.installed);
    setCurrentObservation("");
    setPhotos(installation.photos);
    onClose();
  };

  const addObservation = () => {
    if (currentObservation.trim() === "") return;
    
    const timestampedObservation = `[${new Date().toLocaleString('pt-BR')}] ${currentObservation.trim()}`;
    setObservationHistory([...observationHistory, timestampedObservation]);
    setCurrentObservation("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{installation.codigo} {installation.descricao}</DialogTitle>
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

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Salvar Alterações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}