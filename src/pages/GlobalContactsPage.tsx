import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BulkOperationPanel } from '@/components/bulk-operations/BulkOperationPanel';
import { Users, Search, Mail, Phone, Building2, User, Truck, ChevronDown } from 'lucide-react';
import { storage } from '@/lib/storage';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';

interface GlobalContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'cliente' | 'obra' | 'fornecedor';
  project_name: string;
  project_id: string;
  created_at: string;
}

export default function GlobalContactsPage() {
  const [contacts, setContacts] = useState<GlobalContact[]>([]);
  const [_projects, setProjects] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [activeTab, setActiveTab] = useState<'all' | 'cliente' | 'obra' | 'fornecedor'>('all');
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadContacts();
    }
  }, [user]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      
      // Load both local and Supabase data
      const [localProjects, supabaseProjects, supabaseContacts] = await Promise.all([
        storage.getProjects(),
        supabase.from('projects').select('*').eq('user_id', user!.id),
        supabase.from('contacts').select('*').eq('user_id', user!.id)
      ]);

      // Combine projects data
      const allProjects = [
        ...localProjects,
        ...(supabaseProjects.data || [])
      ];
      setProjects(allProjects);

      // Load local contacts
      const localContacts = await storage.getContacts();
      
      // Combine and normalize contacts
      const allContacts: GlobalContact[] = [];

      // Process local contacts
      localContacts.forEach(contact => {
        const project = allProjects.find(p => p.id === contact.projetoId || p.id === contact.project_id);
        if (project) {
          allContacts.push({
            id: contact.id,
            name: contact.nome || contact.name,
            email: contact.email || '',
            phone: contact.telefone || contact.phone || '',
            role: contact.tipo || contact.role,
            project_name: project.name,
            project_id: project.id,
            created_at: contact.criadoEm || contact.created_at || new Date().toISOString()
          });
        }
      });

      // Process Supabase contacts
      if (supabaseContacts.data) {
        supabaseContacts.data.forEach(contact => {
          const project = allProjects.find(p => p.id === contact.project_id);
          if (project) {
            allContacts.push({
              id: contact.id,
              name: contact.name,
              email: contact.email || '',
              phone: contact.phone || '',
              role: contact.role as 'cliente' | 'obra' | 'fornecedor',
              project_name: project.name,
              project_id: project.id,
              created_at: contact.created_at
            });
          }
        });
      }

      // Remove duplicates and sort
      const uniqueContacts = Array.from(
        new Map(allContacts.map(c => [c.id, c])).values()
      ).sort((a, b) => a.name.localeCompare(b.name));

      setContacts(uniqueContacts);
    } catch (error) {
      console.error('Error loading contacts:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os contatos.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = 
      contact.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      contact.project_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
    
    const matchesTab = activeTab === 'all' || contact.role === activeTab;
    
    return matchesSearch && matchesTab;
  });

  const getContactCounts = () => {
    return {
      all: contacts.length,
      cliente: contacts.filter(c => c.role === 'cliente').length,
      obra: contacts.filter(c => c.role === 'obra').length,
      fornecedor: contacts.filter(c => c.role === 'fornecedor').length
    };
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'cliente': return <User className="h-4 w-4" />;
      case 'obra': return <Building2 className="h-4 w-4" />;
      case 'fornecedor': return <Truck className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'cliente': return 'default';
      case 'obra': return 'secondary';
      case 'fornecedor': return 'outline';
      default: return 'default';
    }
  };

  const counts = getContactCounts();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container-modern py-4 sm:py-6">
          <div className="space-y-4 sm:space-y-6">
            <div>
              <Skeleton className="h-6 sm:h-8 w-32 sm:w-48" />
              <Skeleton className="h-3 sm:h-4 w-64 sm:w-96 mt-2" />
            </div>
            <Skeleton className="h-8 sm:h-10 w-full max-w-md" />
            <Skeleton className="h-10 sm:h-12 w-full" />
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 sm:h-32" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container-modern py-4 sm:py-6">
        <div className="space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Contatos Globais</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Gerencie todos os seus contatos de projetos em um só lugar
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar contatos ou projetos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 mobile-input"
              />
            </div>
          </div>

          {/* Categoria Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
              <span>Todos ({counts.all})</span>
              <span>•</span>
              <span>Cliente ({counts.cliente})</span>
              <span>•</span>
              <span>Obra ({counts.obra})</span>
              <span>•</span>
              <span>Fornecedor ({counts.fornecedor})</span>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="mobile-button justify-between">
                  <span>
                    {activeTab === 'all' && `Todos (${counts.all})`}
                    {activeTab === 'cliente' && `Cliente (${counts.cliente})`}
                    {activeTab === 'obra' && `Obra (${counts.obra})`}
                    {activeTab === 'fornecedor' && `Fornecedor (${counts.fornecedor})`}
                  </span>
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setActiveTab('all')}>
                  <Users className="h-4 w-4 mr-2" />
                  Todos ({counts.all})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('cliente')}>
                  <User className="h-4 w-4 mr-2" />
                  Cliente ({counts.cliente})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('obra')}>
                  <Building2 className="h-4 w-4 mr-2" />
                  Obra ({counts.obra})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setActiveTab('fornecedor')}>
                  <Truck className="h-4 w-4 mr-2" />
                  Fornecedor ({counts.fornecedor})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Bulk Operations Panel */}
          {selectedContacts.length > 0 && (
            <BulkOperationPanel
              items={contacts.filter(c => selectedContacts.includes(c.id))}
              itemType="contacts"
              onItemsChange={(_updatedItems) => {
                loadContacts();
                setSelectedContacts([]);
              }}
            />
          )}

          {/* Content */}
          <div className="mt-4 sm:mt-6">
            {filteredContacts.length === 0 ? (
              <Card className="mobile-card">
                <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
                  <Users className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-4" />
                  <h3 className="text-base sm:text-lg font-semibold mb-2">Nenhum contato encontrado</h3>
                  <p className="text-sm sm:text-base text-muted-foreground text-center">
                    {debouncedSearchTerm 
                      ? 'Tente ajustar os filtros ou termos de busca.'
                      : 'Comece criando contatos em seus projetos.'
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                 {filteredContacts.map((contact) => (
                   <Card key={contact.id} className={`hover:shadow-md transition-shadow mobile-card ${selectedContacts.includes(contact.id) ? 'ring-2 ring-primary bg-primary/5' : ''}`}>
                     <CardHeader className="pb-2 sm:pb-3">
                       <div className="flex items-start justify-between gap-2">
                         <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                           <input
                             type="checkbox"
                             checked={selectedContacts.includes(contact.id)}
                             onChange={(e) => {
                               if (e.target.checked) {
                                 setSelectedContacts(prev => [...prev, contact.id]);
                               } else {
                                 setSelectedContacts(prev => prev.filter(id => id !== contact.id));
                               }
                             }}
                             className="h-4 w-4 rounded border-2 border-primary flex-shrink-0"
                           />
                          <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                            <AvatarFallback className="text-xs sm:text-sm">
                              {contact.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-sm sm:text-base lg:text-lg truncate">{contact.name}</CardTitle>
                            <CardDescription className="text-xs sm:text-sm truncate">
                              {contact.project_name}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant={getRoleBadgeVariant(contact.role)} className="gap-1 text-xs flex-shrink-0">
                          {getRoleIcon(contact.role)}
                          <span className="hidden sm:inline">
                            {contact.role.charAt(0).toUpperCase() + contact.role.slice(1)}
                          </span>
                          <span className="sm:hidden">
                            {contact.role === 'cliente' ? 'Cli' : contact.role === 'obra' ? 'Obra' : 'Forn'}
                          </span>
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-1 sm:space-y-2">
                        {contact.email && (
                          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                            <Mail className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span className="truncate">{contact.email}</span>
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                            <Phone className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span className="truncate">{contact.phone}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}