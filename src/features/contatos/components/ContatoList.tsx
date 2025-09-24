import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Search, Plus, Phone, Mail, Edit, Trash2, Download } from 'lucide-react';
import { Contato } from '../index';
import { useToast } from '@/hooks/use-toast';

interface ContatoListProps {
  contatos: Contato[];
  tipo: "cliente" | "obra" | "fornecedor";
  onEdit: (contato: Contato) => void;
  onDelete: (contato: Contato) => void;
  onAdd: () => void;
  selectedContacts?: string[];
  onSelectionChange?: (contactId: string, selected: boolean) => void;
}

export function ContatoList({ 
  contatos, 
  tipo, 
  onEdit, 
  onDelete, 
  onAdd,
  selectedContacts = [],
  onSelectionChange
}: ContatoListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteContato, setDeleteContato] = useState<Contato | null>(null);
  const { toast } = useToast();

  const tipoLabel = {
    cliente: 'Cliente',
    obra: 'Obra', 
    fornecedor: 'Fornecedor'
  };

  const filteredContatos = contatos.filter(contato =>
    contato.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (contato.empresa && contato.empresa.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (contato.email && contato.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (contato.telefone && contato.telefone.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleDelete = (contato: Contato) => {
    onDelete(contato);
    setDeleteContato(null);
    toast({
      title: "Contato excluído",
      description: `${contato.nome} foi removido com sucesso.`
    });
  };

  const exportCSV = () => {
    if (filteredContatos.length === 0) {
      toast({
        title: "Nenhum contato para exportar",
        variant: "destructive"
      });
      return;
    }

    const headers = ['Nome', 'Empresa', 'Telefone', 'Email'];
    const csvData = [
      headers.join(','),
      ...filteredContatos.map(contato => [
        `"${contato.nome}"`,
        `"${contato.empresa || ''}"`,
        `"${contato.telefone || ''}"`,
        `"${contato.email || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `contatos_${tipo}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "CSV exportado",
      description: `Lista de contatos ${tipoLabel[tipo]} exportada com sucesso.`
    });
  };

  return (
    <Card className="mobile-card">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <CardTitle className="flex items-center gap-2">
            {tipoLabel[tipo]}
            <Badge variant="secondary">{contatos.length}</Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              disabled={filteredContatos.length === 0}
              className="mobile-button"
            >
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            <Button onClick={onAdd} size="sm" className="mobile-button">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Novo contato</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, empresa, email ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 mobile-input"
          />
        </div>

        {/* Lista */}
        {filteredContatos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground">
              {searchTerm ? 'Nenhum contato encontrado' : `Nenhum contato ${tipoLabel[tipo].toLowerCase()} cadastrado`}
            </div>
            {!searchTerm && (
              <Button variant="outline" onClick={onAdd} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar primeiro contato
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header da tabela */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 bg-muted/50 rounded-lg text-sm font-medium">
              {onSelectionChange && <div className="col-span-1">Seleção</div>}
              <div className={onSelectionChange ? "col-span-3" : "col-span-3"}>Nome</div>
              <div className="col-span-3">Empresa</div>
              <div className="col-span-2">Telefone</div>
              <div className="col-span-2">Email</div>
              <div className="col-span-1">Ações</div>
            </div>

            {/* Linhas da tabela */}
            {filteredContatos.map((contato) => (
              <div
                key={contato.id}
                className={`grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors ${selectedContacts.includes(contato.id) ? 'ring-2 ring-primary bg-primary/5' : ''}`}
              >
                {/* Selection checkbox for desktop */}
                {onSelectionChange && (
                  <div className="hidden md:flex items-center col-span-1">
                    <input
                      type="checkbox"
                      checked={selectedContacts.includes(contato.id)}
                      onChange={(e) => onSelectionChange(contato.id, e.target.checked)}
                      className="h-4 w-4 rounded border-2 border-primary"
                    />
                  </div>
                )}
                {/* Mobile: Layout vertical */}
                <div className="md:hidden space-y-2">
                  <div className="font-medium">{contato.nome}</div>
                  {contato.empresa && (
                    <div className="text-sm text-muted-foreground">{contato.empresa}</div>
                  )}
                  <div className="flex flex-wrap gap-2 text-sm">
                    {contato.telefone && (
                      <a href={`tel:${contato.telefone}`} className="text-blue-600 hover:underline">
                        {contato.telefone}
                      </a>
                    )}
                    {contato.email && (
                      <a href={`mailto:${contato.email}`} className="text-blue-600 hover:underline">
                        {contato.email}
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2">
                    {contato.telefone && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={`tel:${contato.telefone}`} aria-label="Ligar">
                          <Phone className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {contato.email && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={`mailto:${contato.email}`} aria-label="Enviar email">
                          <Mail className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => onEdit(contato)} aria-label="Editar">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setDeleteContato(contato)}
                      className="text-destructive hover:text-destructive"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Desktop: Layout horizontal */}
                <div className="hidden md:contents">
                  <div className="col-span-3 font-medium">{contato.nome}</div>
                  <div className="col-span-3 text-muted-foreground">{contato.empresa || '-'}</div>
                  <div className="col-span-2">
                    {contato.telefone ? (
                      <a href={`tel:${contato.telefone}`} className="text-blue-600 hover:underline">
                        {contato.telefone}
                      </a>
                    ) : '-'}
                  </div>
                  <div className="col-span-3">
                    {contato.email ? (
                      <a href={`mailto:${contato.email}`} className="text-blue-600 hover:underline">
                        {contato.email}
                      </a>
                    ) : '-'}
                  </div>
                  <div className="col-span-1 flex gap-1">
                    {contato.telefone && (
                      <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                        <a href={`tel:${contato.telefone}`} aria-label="Ligar">
                          <Phone className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {contato.email && (
                      <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0">
                        <a href={`mailto:${contato.email}`} aria-label="Enviar email">
                          <Mail className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => onEdit(contato)} className="h-8 w-8 p-0" aria-label="Editar">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setDeleteContato(contato)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteContato} onOpenChange={() => setDeleteContato(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o contato <strong>{deleteContato?.nome}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteContato && handleDelete(deleteContato)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}