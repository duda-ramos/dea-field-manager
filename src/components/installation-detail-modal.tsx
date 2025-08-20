import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PhotoGallery } from "@/components/photo-gallery";
import { Installation } from "@/types";
import { storage } from "@/lib/storage";
import { useToast } from "@/hooks/use-toast";
import { Save, X } from "lucide-react";

interface InstallationDetailModalProps {
  installation: Installation;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function InstallationDetailModal({ 
  installation, 
  isOpen, 
  onClose, 
  onUpdate 
}: InstallationDetailModalProps) {
  const [installed, setInstalled] = useState(installation.installed);
  const [observations, setObservations] = useState(installation.observations);
  const [photos, setPhotos] = useState(installation.photos);
  const { toast } = useToast();

  const handleSave = () => {
    const updated = storage.updateInstallation(installation.id, {
      installed,
      observations,
      photos
    });

    if (updated) {
      onUpdate();
      onClose();
      toast({
        title: "Instalação atualizada",
        description: "As informações foram salvas com sucesso",
      });
    }
  };

  const handleCancel = () => {
    setInstalled(installation.installed);
    setObservations(installation.observations);
    setPhotos(installation.photos);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da Instalação</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Descrição</Label>
              <p className="text-sm font-semibold">{installation.description}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Código</Label>
                <p className="text-sm">{installation.code}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Tipologia</Label>
                <p className="text-sm">{installation.typology}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Altura (cm)</Label>
                <p className="text-sm">{installation.height_guideline_cm}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Distância do Batente (cm)</Label>
                <p className="text-sm">{installation.distance_from_frame_cm}</p>
              </div>
            </div>
          </div>

          {/* Installation Status */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="installed" className="text-sm font-medium">
                Status da Instalação
              </Label>
              <div className="flex items-center space-x-2">
                <Switch
                  id="installed"
                  checked={installed}
                  onCheckedChange={setInstalled}
                />
                <Badge variant={installed ? "success" : "secondary"}>
                  {installed ? "Instalado" : "Pendente"}
                </Badge>
              </div>
            </div>
            
            {installation.installed_at && (
              <p className="text-xs text-muted-foreground">
                Instalado em: {new Date(installation.installed_at).toLocaleString('pt-BR')}
              </p>
            )}
          </div>

          {/* Observations */}
          <div className="space-y-3">
            <Label htmlFor="observations">Observações</Label>
            <Textarea
              id="observations"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Adicione observações sobre a instalação..."
              rows={3}
            />
          </div>

          {/* Photos */}
          <PhotoGallery
            photos={photos}
            onPhotosChange={setPhotos}
          />

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={handleCancel}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}