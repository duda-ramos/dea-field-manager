import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Project } from '@/types';

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onTemplateCreated?: () => void;
}

export function CreateTemplateModal({ 
  isOpen, 
  onClose, 
  project, 
  onTemplateCreated 
}: CreateTemplateModalProps) {
  const [templateData, setTemplateData] = useState({
    name: `Template: ${project.name}`,
    description: '',
    category: 'general',
    isPublic: false
  });
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const categories = [
    { value: 'general', label: 'Geral' },
    { value: 'commercial', label: 'Comercial' },
    { value: 'residential', label: 'Residencial' },
    { value: 'industrial', label: 'Industrial' },
    { value: 'renovation', label: 'Reforma' },
    { value: 'infrastructure', label: 'Infraestrutura' }
  ];

  const handleSave = async () => {
    if (!user) return;

    try {
      setSaving(true);

      // Prepare template data - exclude sensitive information
      const cleanTemplateData = {
        name: project.name,
        client: 'Cliente Template',
        city: project.city,
        code: '',
        status: 'planning' as const,
        installation_date: null,
        inauguration_date: null,
        owner: '',
        suppliers: project.suppliers || [],
        project_files_link: ''
      };

      const { error } = await supabase
        .from('project_templates')
        .insert([{
          name: templateData.name,
          description: templateData.description,
          category: templateData.category,
          template_data: cleanTemplateData,
          is_public: templateData.isPublic,
          created_by: user.id
        }]);

      if (error) throw error;

      toast({
        title: 'Template criado',
        description: 'Template de projeto criado com sucesso'
      });

      onTemplateCreated?.();
      onClose();
      
      // Reset form
      setTemplateData({
        name: `Template: ${project.name}`,
        description: '',
        category: 'general',
        isPublic: false
      });

    } catch (error) {
      console.error('Error creating template:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao criar template',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Criar Template de Projeto
          </DialogTitle>
          <DialogDescription>
            Salve este projeto como template para reutilização futura
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Nome do Template</Label>
            <Input
              id="name"
              value={templateData.name}
              onChange={(e) => setTemplateData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Nome do template"
            />
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={templateData.description}
              onChange={(e) => setTemplateData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descreva este template..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="category">Categoria</Label>
            <Select value={templateData.category} onValueChange={(value) => 
              setTemplateData(prev => ({ ...prev, category: value }))
            }>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="public">Template Público</Label>
              <p className="text-sm text-muted-foreground">
                Permitir que outros usuários usem este template
              </p>
            </div>
            <Switch
              id="public"
              checked={templateData.isPublic}
              onCheckedChange={(checked) => 
                setTemplateData(prev => ({ ...prev, isPublic: checked }))
              }
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving || !templateData.name.trim()}
              className="flex-1"
            >
              {saving ? (
                'Salvando...'
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Criar Template
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}