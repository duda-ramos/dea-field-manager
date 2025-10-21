import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
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
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const computeErrors = (values: {
    nome: string;
    telefone: string;
    email: string;
  }) => {
    const { nome: nomeValue, telefone: telefoneValue, email: emailValue } = values;
    const newErrors: Record<string, string> = {};

    if (!nomeValue.trim()) {
      newErrors.nome = 'Nome é obrigatório';
    }

    // Validação de email com regex específico
    if (emailValue.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      newErrors.email = 'Email inválido. Use o formato: exemplo@email.com';
    }

    // Validação de telefone brasileiro com regex específico
    if (telefoneValue.trim() && !/^(\+55\s?)?(\(?\d{2}\)?[\s-]?)?(9?\d{4}[\s-]?\d{4})$/.test(telefoneValue)) {
      newErrors.telefone = 'Telefone inválido. Use o formato: (XX) XXXXX-XXXX';
    }

    if (!telefoneValue.trim() && !emailValue.trim()) {
      newErrors.contato = 'Pelo menos telefone ou email deve ser preenchido';
    }

    return newErrors;
  };

  const refreshErrors = (override?: Partial<{ nome: string; telefone: string; email: string }>) => {
    setErrors((prev) => {
      if (Object.keys(prev).length === 0) {
        return prev;
      }

      return computeErrors({
        nome: override?.nome ?? nome,
        telefone: override?.telefone ?? telefone,
        email: override?.email ?? email
      });
    });
  };

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
    refreshErrors({ telefone: formatted });
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
    const computedErrors = computeErrors({ nome, telefone, email });
    setErrors(computedErrors);
    return Object.keys(computedErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSaving(true);
    try {
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

      await onSave(novoContato);
      
      const action = contato ? 'atualizado' : 'adicionado';
      toast({
        title: `Contato ${action} com sucesso`,
        description: `"${nome}" foi ${action} aos seus contatos`,
        duration: 3000
      });
      
      onClose();
    } finally {
      setIsSaving(false);
    }
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
              onChange={(e) => {
                const value = e.target.value;
                setNome(value);
                refreshErrors({ nome: value });
              }}
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
              className={errors.contato || errors.telefone ? 'border-destructive' : ''}
            />
            {errors.telefone && (
              <p className="text-sm text-destructive">{errors.telefone}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                const value = e.target.value;
                setEmail(value);
                refreshErrors({ email: value });
              }}
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
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1" disabled={isSaving}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1"
              disabled={isSaving || Object.keys(errors).some(key => errors[key] !== '')}
            >
              {isSaving ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
              ) : (
                contato ? 'Atualizar' : 'Salvar'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}