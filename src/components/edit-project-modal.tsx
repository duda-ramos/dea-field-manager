import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { showToast } from "@/lib/toast";
import { Project } from "@/types";
import { storage } from "@/lib/storage";
import { Plus, Trash2, Loader2 } from "lucide-react";

interface EditProjectModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdated: (project: Project) => void;
}

export function EditProjectModal({ project, isOpen, onClose, onProjectUpdated }: EditProjectModalProps) {
  const { toast } = useToast();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: project.name,
    client: project.client,
    city: project.city,
    code: project.code,
    owner: project.owner,
    status: project.status,
    installation_date: project.installation_date || '',
    inauguration_date: project.inauguration_date || '',
    project_files_link: project.project_files_link || '',
    suppliers: [...project.suppliers],
    installation_time_estimate_days: (project as any).installation_time_estimate_days || '',
    address: (project as any).address || '',
    access_notes: (project as any).access_notes || ''
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Nome do projeto: obrigatório, mínimo 3 caracteres
    if (!formData.name.trim()) {
      newErrors.name = 'Nome do projeto é obrigatório';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Nome do projeto deve ter no mínimo 3 caracteres';
    }

    // Cliente: obrigatório
    if (!formData.client.trim()) {
      newErrors.client = 'Cliente é obrigatório';
    }

    // Validação de datas: data início não pode ser maior que data fim
    if (formData.installation_date && formData.inauguration_date) {
      const startDate = new Date(formData.installation_date);
      const endDate = new Date(formData.inauguration_date);
      if (startDate > endDate) {
        newErrors.dates = 'Data de instalação não pode ser posterior à data de inauguração';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      toast({
        title: "Erro de validação",
        description: "Corrija os erros no formulário antes de continuar",
        variant: "destructive"
      });
      showToast.error("Erro", "Preencha todos os campos obrigatórios");
      return;
    }

    setIsSaving(true);
    try {
      const updatedProject = await storage.upsertProject({
        ...project,
        ...formData,
        suppliers: formData.suppliers.filter(s => s.trim() !== ''),
        installation_time_estimate_days: formData.installation_time_estimate_days ? 
          parseInt(formData.installation_time_estimate_days.toString()) : undefined
      });

      if (updatedProject) {
        onProjectUpdated(updatedProject);
        onClose();
        toast({
          title: "Projeto atualizado",
          description: "As informações do projeto foram atualizadas com sucesso"
        });
        showToast.success("Projeto atualizado", "As informações foram atualizadas com sucesso");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const addSupplierField = () => {
    setFormData(prev => ({
      ...prev,
      suppliers: [...prev.suppliers, ""]
    }));
  };

  const updateSupplier = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      suppliers: prev.suppliers.map((s, i) => i === index ? value : s)
    }));
  };

  const removeSupplier = (index: number) => {
    setFormData(prev => ({
      ...prev,
      suppliers: prev.suppliers.filter((_, i) => i !== index)
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Projeto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nome do Projeto *</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, name: e.target.value }));
                  if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                }}
                placeholder="Ex: Shopping Center ABC" 
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name}</p>
              )}
            </div>
            <div>
              <Label htmlFor="client">Cliente *</Label>
              <Input 
                id="client" 
                value={formData.client} 
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, client: e.target.value }));
                  if (errors.client) setErrors(prev => ({ ...prev, client: '' }));
                }}
                placeholder="Ex: Construtora XYZ" 
                className={errors.client ? 'border-destructive' : ''}
              />
              {errors.client && (
                <p className="text-sm text-destructive mt-1">{errors.client}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">Cidade *</Label>
              <Input 
                id="city" 
                value={formData.city} 
                onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                placeholder="Ex: São Paulo, SP" 
              />
            </div>
            <div>
              <Label htmlFor="code">Código do Projeto</Label>
              <Input 
                id="code" 
                value={formData.code} 
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                placeholder="Ex: DEA-2024-001" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="owner">Responsável</Label>
              <Input 
                id="owner" 
                value={formData.owner} 
                onChange={(e) => setFormData(prev => ({ ...prev, owner: e.target.value }))}
                placeholder="Ex: João Silva" 
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as Project['status'] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planejamento</SelectItem>
                  <SelectItem value="in-progress">Em Andamento</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="project_files_link">Link dos Arquivos do Projeto</Label>
            <Input 
              id="project_files_link" 
              value={formData.project_files_link} 
              onChange={(e) => setFormData(prev => ({ ...prev, project_files_link: e.target.value }))}
              placeholder="Ex: https://drive.google.com/folder/..." 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="installation_date">Data de Entrega (Finalização da Instalação)</Label>
              <Input 
                id="installation_date" 
                type="date"
                value={formData.installation_date} 
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, installation_date: e.target.value }));
                  if (errors.dates) setErrors(prev => ({ ...prev, dates: '' }));
                }}
                className={errors.dates ? 'border-destructive' : ''}
              />
            </div>
            <div>
              <Label htmlFor="inauguration_date">Data de Inauguração</Label>
              <Input 
                id="inauguration_date" 
                type="date"
                value={formData.inauguration_date} 
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, inauguration_date: e.target.value }));
                  if (errors.dates) setErrors(prev => ({ ...prev, dates: '' }));
                }}
                className={errors.dates ? 'border-destructive' : ''}
              />
            </div>
          </div>
          {errors.dates && (
            <p className="text-sm text-destructive mt-1">{errors.dates}</p>
          )}

          <div>
            <Label htmlFor="installation_time_estimate_days">Estimativa de Tempo de Instalação (dias úteis)</Label>
            <Input 
              id="installation_time_estimate_days" 
              type="number"
              min="1"
              value={formData.installation_time_estimate_days} 
              onChange={(e) => setFormData(prev => ({ ...prev, installation_time_estimate_days: e.target.value }))}
              placeholder="Ex: 15"
            />
          </div>

          <div>
            <Label htmlFor="address">Endereço do Projeto</Label>
            <Input 
              id="address" 
              value={formData.address} 
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Ex: Rua das Flores, 123 - Centro" 
            />
          </div>

          <div>
            <Label htmlFor="access_notes">Observações sobre Acesso ao Local</Label>
            <Input 
              id="access_notes" 
              value={formData.access_notes} 
              onChange={(e) => setFormData(prev => ({ ...prev, access_notes: e.target.value }))}
              placeholder="Ex: Entrada pela portaria lateral, solicitar crachá" 
            />
          </div>

          <div>
            <Label>Fornecedores</Label>
            <div className="space-y-2">
              {formData.suppliers.map((supplier, index) => (
                <div key={index} className="flex gap-2">
                  <Input 
                    value={supplier} 
                    onChange={(e) => updateSupplier(index, e.target.value)} 
                    placeholder={`Fornecedor ${index + 1}`} 
                  />
                  {formData.suppliers.length > 1 && (
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={() => removeSupplier(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addSupplierField}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Fornecedor
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSave}
              disabled={isSaving || Object.keys(errors).some(key => errors[key] !== '')}
            >
              {isSaving ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}