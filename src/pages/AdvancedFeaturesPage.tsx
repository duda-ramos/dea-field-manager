import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sparkles } from 'lucide-react';

export default function AdvancedFeaturesPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-4xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Recursos Avançados</h1>
                <p className="text-muted-foreground">
                  Funcionalidades premium integradas diretamente nos projetos
                </p>
              </div>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Colaboração em Tempo Real</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Trabalhe em equipe com sistema de permissões e sincronização em tempo real.
                  Disponível na página de informações de cada projeto.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Versionamento de Projetos</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Sistema completo de controle de versões com histórico de mudanças.
                  Acesse através da página de informações do projeto.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Backup Automático</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Sistema automático de backup com pontos de restauração.
                  Monitore o status na página de informações do projeto.
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {/* Instructions */}
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-2">Como Acessar</h3>
              <p className="text-muted-foreground">
                Todos os recursos avançados foram integrados diretamente nas páginas dos projetos. 
                Abra qualquer projeto e navegue até a aba "Informações" para acessar colaboração, 
                versionamento e backups.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}