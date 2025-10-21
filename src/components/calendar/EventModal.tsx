import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar, Trash2, Save } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { CalendarEvent, CreateCalendarEventData } from '@/types/calendar';
import { calendarService } from '@/services/calendar';
import { useToast } from '@/hooks/use-toast';
import { Project } from '@/types';
import { storage } from '@/lib/storage';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  selectedDate?: Date;
  onEventSaved: () => void;
}

const eventTypeOptions = [
  { value: 'task', label: 'Tarefa', icon: '📋' },
  { value: 'meeting', label: 'Reunião', icon: '👥' },
  { value: 'installation', label: 'Instalação', icon: '🔧' },
  { value: 'deadline', label: 'Prazo', icon: '⏰' },
  { value: 'reminder', label: 'Lembrete', icon: '🔔' },
];

const priorityOptions = [
  { value: 'low', label: 'Baixa', color: 'text-green-600' },
  { value: 'medium', label: 'Média', color: 'text-yellow-600' },
  { value: 'high', label: 'Alta', color: 'text-orange-600' },
  { value: 'urgent', label: 'Urgente', color: 'text-red-600' },
];

const statusOptions = [
  { value: 'pending', label: 'Pendente' },
  { value: 'in-progress', label: 'Em Andamento' },
  { value: 'completed', label: 'Concluído' },
  { value: 'cancelled', label: 'Cancelado' },
];

const colorOptions = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', 
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
];

export function EventModal({ isOpen, onClose, event, selectedDate, onEventSaved }: EventModalProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateCalendarEventData>({
    title: '',
    description: '',
    start_datetime: '',
    end_datetime: '',
    event_type: 'task',
    color: '#3b82f6',
    is_all_day: false,
    status: 'pending',
    priority: 'medium',
    location: '',
    project_id: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      loadProjects();
      if (event) {
        setFormData({
          title: event.title,
          description: event.description || '',
          start_datetime: event.start_datetime,
          end_datetime: event.end_datetime,
          event_type: event.event_type,
          color: event.color,
          is_all_day: event.is_all_day,
          status: event.status,
          priority: event.priority,
          location: event.location || '',
          project_id: event.project_id || ''
        });
      } else if (selectedDate) {
        const startTime = new Date(selectedDate);
        startTime.setHours(9, 0, 0, 0);
        const endTime = new Date(selectedDate);
        endTime.setHours(10, 0, 0, 0);
        
        setFormData(prev => ({
          ...prev,
          start_datetime: startTime.toISOString(),
          end_datetime: endTime.toISOString(),
        }));
      }
    } else {
      setFormData({
        title: '',
        description: '',
        start_datetime: '',
        end_datetime: '',
        event_type: 'task',
        color: '#3b82f6',
        is_all_day: false,
        status: 'pending',
        priority: 'medium',
        location: '',
        project_id: ''
      });
    }
  }, [isOpen, event, selectedDate]);

  const loadProjects = async () => {
    try {
      const projectsData = await storage.getProjects();
      setProjects(projectsData);
    } catch (_error) {
      // Error já tratado pelo toast
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Informe um título para o evento',
        variant: 'destructive',
        duration: 4000
      });
      return;
    }

    try {
      setLoading(true);
      
      const eventData = {
        ...formData,
        project_id: formData.project_id || null
      };

      if (event) {
        await calendarService.updateEvent(event.id, eventData);
        toast({
          title: 'Evento atualizado com sucesso',
          description: `"${formData.title}" foi salvo no calendário`,
          duration: 3000
        });
      } else {
        await calendarService.createEvent(eventData);
        toast({
          title: 'Evento criado com sucesso',
          description: `"${formData.title}" foi adicionado ao calendário`,
          duration: 3000
        });
      }

      onEventSaved();
      onClose();
    } catch (_error) {
      // Error já tratado pelo toast
      toast({
        title: 'Erro ao salvar evento',
        description: 'Não foi possível salvar as informações. Tente novamente',
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;

    try {
      setLoading(true);
      await calendarService.deleteEvent(event.id);
      toast({
        title: 'Evento excluído com sucesso',
        description: `"${event.title}" foi removido do calendário`,
        duration: 3000
      });
      onEventSaved();
      onClose();
    } catch (_error) {
      // Error já tratado pelo toast
      toast({
        title: 'Erro ao excluir evento',
        description: 'Não foi possível remover o evento. Tente novamente',
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  const updateDateTime = (field: 'start_datetime' | 'end_datetime', date: string, time: string) => {
    const dateTime = new Date(`${date}T${time}`);
    setFormData(prev => ({
      ...prev,
      [field]: dateTime.toISOString()
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {event ? 'Editar Evento' : 'Novo Evento'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Título do evento"
            />
          </div>

          {/* Type and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={formData.event_type}
                onValueChange={(value: CalendarEvent['event_type']) => 
                  setFormData(prev => ({ ...prev, event_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eventTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        <span>{option.icon}</span>
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select
                value={formData.priority}
                onValueChange={(value: CalendarEvent['priority']) => 
                  setFormData(prev => ({ ...prev, priority: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className={option.color}>{option.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Project */}
          <div className="space-y-2">
            <Label>Projeto (opcional)</Label>
            <Select
              value={formData.project_id || 'none'}
              onValueChange={(value) => 
                setFormData(prev => ({ ...prev, project_id: value === 'none' ? null : value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum projeto</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name} - {project.client}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="all-day"
              checked={formData.is_all_day}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, is_all_day: checked }))
              }
            />
            <Label htmlFor="all-day">Dia inteiro</Label>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data/Hora de Início</Label>
              <div className="space-y-2">
                <Input
                  type="date"
                  value={formData.start_datetime ? format(parseISO(formData.start_datetime), 'yyyy-MM-dd') : ''}
                  onChange={(e) => {
                    const time = formData.start_datetime ? format(parseISO(formData.start_datetime), 'HH:mm') : '09:00';
                    updateDateTime('start_datetime', e.target.value, time);
                  }}
                />
                {!formData.is_all_day && (
                  <Input
                    type="time"
                    value={formData.start_datetime ? format(parseISO(formData.start_datetime), 'HH:mm') : ''}
                    onChange={(e) => {
                      const date = formData.start_datetime ? format(parseISO(formData.start_datetime), 'yyyy-MM-dd') : '';
                      updateDateTime('start_datetime', date, e.target.value);
                    }}
                  />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Data/Hora de Término</Label>
              <div className="space-y-2">
                <Input
                  type="date"
                  value={formData.end_datetime ? format(parseISO(formData.end_datetime), 'yyyy-MM-dd') : ''}
                  onChange={(e) => {
                    const time = formData.end_datetime ? format(parseISO(formData.end_datetime), 'HH:mm') : '10:00';
                    updateDateTime('end_datetime', e.target.value, time);
                  }}
                />
                {!formData.is_all_day && (
                  <Input
                    type="time"
                    value={formData.end_datetime ? format(parseISO(formData.end_datetime), 'HH:mm') : ''}
                    onChange={(e) => {
                      const date = formData.end_datetime ? format(parseISO(formData.end_datetime), 'yyyy-MM-dd') : '';
                      updateDateTime('end_datetime', date, e.target.value);
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location">Local</Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              placeholder="Local do evento"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descrição do evento"
              rows={3}
            />
          </div>

          {/* Color and Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {colorOptions.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`w-6 h-6 rounded-full border-2 ${
                      formData.color === color ? 'border-foreground' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>

            {event && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: CalendarEvent['status']) => 
                    setFormData(prev => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4">
            <div>
              {event && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}