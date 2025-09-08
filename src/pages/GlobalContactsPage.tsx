import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BulkOperationPanel } from '@/components/bulk-operations/BulkOperationPanel';
import { Users, Search, Mail, Phone, Building2, User, Truck } from 'lucide-react';
import { storage } from '@/lib/storage';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

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
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.project_name.toLowerCase().includes(searchTerm.toLowerCase());
    
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
      <div className="min-h-screen bg-background p-6">
        <div className="container mx-auto max-w-6xl">
          <div className="space-y-6">
            <div>
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-96 mt-2" />
            </div>
            <Skeleton className="h-10 w-full max-w-md" />
            <Skeleton className="h-12 w-full" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-6xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Contatos Globais</h1>
              <p className="text-muted-foreground">
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
                className="pl-10"
              />
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="grid w-full grid-cols-4 max-w-md">
              <TabsTrigger value="all">
                Todos ({counts.all})
              </TabsTrigger>
              <TabsTrigger value="cliente">
                Cliente ({counts.cliente})
              </TabsTrigger>
              <TabsTrigger value="obra">
                Obra ({counts.obra})
              </TabsTrigger>
              <TabsTrigger value="fornecedor">
                Fornecedor ({counts.fornecedor})
              </TabsTrigger>
            </TabsList>
            
            {/* Bulk Operations Panel */}
            {selectedContacts.length > 0 && (
              <BulkOperationPanel
                items={contacts.filter(c => selectedContacts.includes(c.id))}
                itemType="contacts"
                onItemsChange={(updatedItems) => {
                  loadContacts();
                  setSelectedContacts([]);
                }}
              />
            )}

            <TabsContent value={activeTab} className="mt-6">
              {filteredContacts.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhum contato encontrado</h3>
                    <p className="text-muted-foreground text-center">
                      {searchTerm 
                        ? 'Tente ajustar os filtros ou termos de busca.'
                        : 'Comece criando contatos em seus projetos.'
                      }
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                   {filteredContacts.map((contact) => (
                     <Card key={contact.id} className={`hover:shadow-md transition-shadow ${selectedContacts.includes(contact.id) ? 'ring-2 ring-primary bg-primary/5' : ''}`}>
                       <CardHeader className="pb-3">
                         <div className="flex items-start justify-between">
                           <div className="flex items-center gap-3">
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
                               className="h-4 w-4 rounded border-2 border-primary"
                             />
                            <Avatar>
                              <AvatarFallback>
                                {contact.name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <CardTitle className="text-lg truncate">{contact.name}</CardTitle>
                              <CardDescription className="truncate">
                                {contact.project_name}
                              </CardDescription>
                            </div>
                          </div>
                          <Badge variant={getRoleBadgeVariant(contact.role)} className="gap-1">
                            {getRoleIcon(contact.role)}
                            {contact.role.charAt(0).toUpperCase() + contact.role.slice(1)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {contact.email && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Mail className="h-4 w-4" />
                              <span className="truncate">{contact.email}</span>
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Phone className="h-4 w-4" />
                              <span>{contact.phone}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}