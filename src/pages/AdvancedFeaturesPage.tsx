import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ProjectTemplateSelector } from '@/components/templates/ProjectTemplateSelector';
import { CollaborationPanel } from '@/components/collaboration/CollaborationPanel';
import { ExternalStorageIntegration } from '@/components/storage/ExternalStorageIntegration';
import { PublicApiManager } from '@/components/api/PublicApiManager';
import { 
  FileText, 
  Users, 
  Cloud, 
  Globe,
  Sparkles,
  Rocket,
  Star,
  Settings
} from 'lucide-react';

export default function AdvancedFeaturesPage() {
  const [activeTab, setActiveTab] = useState('templates');

  const features = [
    {
      id: 'templates',
      title: 'Templates de Projetos',
      description: 'Crie e reutilize templates para acelerar novos projetos',
      icon: FileText,
      status: 'ready',
      badge: 'Novo'
    },
    {
      id: 'collaboration',
      title: 'Colaboração Multiusuário',
      description: 'Trabalhe em equipe com sistema de permissões avançado',
      icon: Users,
      status: 'ready',
      badge: 'Novo'
    },
    {
      id: 'storage',
      title: 'Storage Externo',
      description: 'Integre com Google Drive, Dropbox e OneDrive',
      icon: Cloud,
      status: 'beta',
      badge: 'Beta'
    },
    {
      id: 'api',
      title: 'API Pública',
      description: 'Integre com sistemas externos via API REST',
      icon: Globe,
      status: 'ready',
      badge: 'Novo'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'default';
      case 'beta': return 'secondary';
      case 'coming-soon': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-6xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Recursos Avançados</h1>
                <p className="text-muted-foreground">
                  Funcionalidades premium para potencializar seus projetos
                </p>
              </div>
            </div>
          </div>

          {/* Feature Cards Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card 
                  key={feature.id} 
                  className={`cursor-pointer hover:shadow-md transition-all ${
                    activeTab === feature.id ? 'ring-2 ring-primary bg-primary/5' : ''
                  }`}
                  onClick={() => setActiveTab(feature.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <Icon className="h-6 w-6 text-primary" />
                      <Badge variant={getStatusColor(feature.status) as any}>
                        {feature.badge}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <TabsTrigger 
                    key={feature.id} 
                    value={feature.id}
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{feature.title}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <TabsContent value="templates" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Sistema de Templates
                  </CardTitle>
                  <CardDescription>
                    Crie templates reutilizáveis para acelerar a criação de novos projetos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">📋 Criar Templates</h4>
                      <p className="text-sm text-muted-foreground">
                        Salve qualquer projeto como template para reutilização
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">🏗️ Templates Públicos</h4>
                      <p className="text-sm text-muted-foreground">
                        Acesse templates compartilhados pela comunidade
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-2">⚡ Criação Rápida</h4>
                      <p className="text-sm text-muted-foreground">
                        Inicie novos projetos em segundos usando templates
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <strong>Como usar:</strong> Ao criar um novo projeto, você pode escolher 
                      partir de um template existente ou salvar projetos atuais como templates 
                      para uso futuro.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="collaboration" className="mt-6">
              <CollaborationPanel 
                projectId="demo-project" 
                isOwner={true}
              />
            </TabsContent>

            <TabsContent value="storage" className="mt-6">
              <ExternalStorageIntegration />
            </TabsContent>

            <TabsContent value="api" className="mt-6">
              <PublicApiManager />
            </TabsContent>
          </Tabs>

          {/* CTA Section */}
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Rocket className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Potencialize seus Projetos</h3>
                    <p className="text-muted-foreground">
                      Use estes recursos avançados para maximizar a eficiência da sua equipe
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span>Recursos Premium</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}