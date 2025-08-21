import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Project } from "@/types";
import { StorageManagerDexie as Storage } from "@/services/StorageManager";
import { Plus, Trash2 } from "lucide-react";

interface EditProjectModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdated: (project: Project) => void;
}

export function EditProjectModal({ project, isOpen, onClose, onProjectUpdated }: EditProjectModalProps) {
  const { toast } = useToast();
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
    suppliers: [...project.suppliers]
  });

  const handleSave = async () => {
    if (!formData.name || !formData.client || !formData.city) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    const updatedProject = await Storage.upsertProject({
      ...project,
      ...formData,
      suppliers: formData.suppliers.filter(s => s.trim() !== '')
    });

    onProjectUpdated(updatedProject);
    onClose();
    toast({
      title: "Projeto atualizado",
      description: "As informações do projeto foram atualizadas com sucesso"
    });
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
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Shopping Center ABC" 
              />
            </div>
            <div>
              <Label htmlFor="client">Cliente *</Label>
              <Input 
                id="client" 
                value={formData.client} 
                onChange={(e) => setFormData(prev => ({ ...prev, client: e.target.value }))}
                placeholder="Ex: Construtora XYZ" 
              />
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
              <Label htmlFor="installation_date">Data de Instalação</Label>
              <Input 
                id="installation_date" 
                type="date"
                value={formData.installation_date} 
                onChange={(e) => setFormData(prev => ({ ...prev, installation_date: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="inauguration_date">Data de Inauguração</Label>
              <Input 
                id="inauguration_date" 
                type="date"
                value={formData.inauguration_date} 
                onChange={(e) => setFormData(prev => ({ ...prev, inauguration_date: e.target.value }))}
              />
            </div>
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
            <Button variant="outline" onClick={onClose}>
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