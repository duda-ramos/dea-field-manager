import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Contato } from '../index';

interface ContatoFormProps {
  isOpen: boolean;
  onClose: () => void;
  contato?: Contato | null;
  tipo: "cliente" | "obra" | "fornecedor";
  projetoId: string;
  onSave: (contato: Contato) => void;
}

export function ContatoForm({ 
  isOpen, 
  onClose, 
  contato, 
  tipo, 
  projetoId, 
  onSave 
}: ContatoFormProps) {
  const [nome, setNome] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Formatação de telefone
  const formatTelefone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 10) {
      return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else {
      return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
  };

  const handleTelefoneChange = (value: string) => {
    const formatted = formatTelefone(value);
    setTelefone(formatted);
  };

  useEffect(() => {
    if (contato) {
      setNome(contato.nome);
      setEmpresa(contato.empresa || '');
      setTelefone(contato.telefone || '');
      setEmail(contato.email || '');
    } else {
      setNome('');
      setEmpresa('');
      setTelefone('');
      setEmail('');
    }
    setErrors({});
  }, [contato, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!nome.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }

    if (!telefone.trim() && !email.trim()) {
      newErrors.contato = 'Pelo menos telefone ou email deve ser preenchido';
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Formato de email inválido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const now = new Date().toISOString();
    const novoContato: Contato = {
      id: contato?.id || `contato_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projetoId,
      tipo,
      nome: nome.trim(),
      empresa: empresa.trim() || undefined,
      telefone: telefone.trim() || undefined,
      email: email.trim() || undefined,
      criadoEm: contato?.criadoEm || now,
      atualizadoEm: now
    };

    onSave(novoContato);
    
    toast({
      title: "Contato salvo",
      description: `${nome} foi ${contato ? 'atualizado' : 'criado'} com sucesso.`
    });
    
    onClose();
  };

  const handleClose = () => {
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {contato ? 'Editar' : 'Novo'} Contato - {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
              className={errors.nome ? 'border-destructive' : ''}
            />
            {errors.nome && (
              <p className="text-sm text-destructive">{errors.nome}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="empresa">Empresa</Label>
            <Input
              id="empresa"
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              placeholder="Nome da empresa"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              value={telefone}
              onChange={(e) => handleTelefoneChange(e.target.value)}
              placeholder="(11) 99999-9999"
              className={errors.contato ? 'border-destructive' : ''}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className={errors.email || errors.contato ? 'border-destructive' : ''}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          {errors.contato && (
            <p className="text-sm text-destructive">{errors.contato}</p>
          )}

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              {contato ? 'Atualizar' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}