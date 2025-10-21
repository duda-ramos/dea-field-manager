import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Ban, Save } from 'lucide-react';
import { format } from 'date-fns';
import { CreateCalendarBlockData } from '@/types/calendar';
import { calendarService } from '@/services/calendar';
import { useToast } from '@/hooks/use-toast';

interface BlockDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onBlockSaved: () => void;
}

const blockTypeOptions = [
  { value: 'unavailable', label: 'Indisponível', description: 'Data não disponível para agendamentos' },
  { value: 'vacation', label: 'Férias', description: 'Período de férias' },
  { value: 'maintenance', label: 'Manutenção', description: 'Período de manutenção' },
  { value: 'reserved', label: 'Reservado', description: 'Data reservada' },
];

export function BlockDateModal({ isOpen, onClose, selectedDate, onBlockSaved }: BlockDateModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateCalendarBlockData>({
    blocked_date: '',
    reason: '',
    block_type: 'unavailable'
  });
  const { toast } = useToast();

  useEffect(() => {
    if (selectedDate) {
      setFormData(prev => ({
        ...prev,
        blocked_date: format(selectedDate, 'yyyy-MM-dd')
      }));
    }
  }, [selectedDate]);

  const handleSave = async () => {
    if (!formData.blocked_date) {
      toast({
        title: 'Data obrigatória',
        description: 'Selecione uma data para bloquear',
        variant: 'destructive',
        duration: 4000
      });
      return;
    }

    try {
      setLoading(true);
      await calendarService.createBlock(formData);
      
      const formattedDate = new Date(formData.blocked_date).toLocaleDateString('pt-BR');
      const typeLabel = blockTypeOptions.find(opt => opt.value === formData.block_type)?.label || 'bloqueio';
      
      toast({
        title: 'Data bloqueada com sucesso',
        description: `${formattedDate} marcada como "${typeLabel}"`,
        duration: 3000
      });

      onBlockSaved();
      onClose();
      
      // Reset form
      setFormData({
        blocked_date: '',
        reason: '',
        block_type: 'unavailable'
      });
    } catch (error) {
      console.error('Erro ao bloquear data no calendário', error);
      // Error já tratado pelo toast
      toast({
        title: 'Erro ao bloquear data',
        description: 'Não foi possível salvar o bloqueio. Tente novamente',
        variant: 'destructive',
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-destructive" />
            Bloquear Data
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="blocked_date">Data a ser bloqueada</Label>
            <Input
              id="blocked_date"
              type="date"
              value={formData.blocked_date}
              onChange={(e) => setFormData(prev => ({ ...prev, blocked_date: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de bloqueio</Label>
            <Select
              value={formData.block_type}
              onValueChange={(value: CreateCalendarBlockData['block_type']) => 
                setFormData(prev => ({ ...prev, block_type: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {blockTypeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Motivo (opcional)</Label>
            <Textarea
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="Descreva o motivo do bloqueio"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Bloqueando...' : 'Bloquear Data'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}