import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  FolderPlus, 
  Users, 
  FileText, 
  RefreshCw, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  X,
  Lightbulb,
  Target,
  Zap
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  completed?: boolean;
}

interface OnboardingFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const ONBOARDING_STORAGE_KEY = 'dea-onboarding-completed';

export function OnboardingFlow({ isOpen, onClose, onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const { user } = useAuth();

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Bem-vindo ao DEA Manager!',
      description: 'Sua plataforma completa para gestão de projetos e instalações.',
      icon: Target,
      content: (
        <div className="space-y-4">
          <div className="text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Organize seus projetos como nunca antes</h3>
            <p className="text-muted-foreground">
              O DEA Manager foi criado para simplificar a gestão de projetos, contatos, orçamentos e muito mais.
            </p>
          </div>
          
          <div className="grid gap-3">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <FolderPlus className="h-5 w-5 text-primary" />
              <span className="text-sm">Gerencie projetos complexos</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-sm">Organize contatos por projeto</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <FileText className="h-5 w-5 text-primary" />
              <span className="text-sm">Controle orçamentos e relatórios</span>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'create-project',
      title: 'Crie seu primeiro projeto',
      description: 'Vamos começar criando um projeto para organizar suas instalações.',
      icon: FolderPlus,
      content: (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 rounded-lg border">
            <div className="flex items-center gap-3 mb-3">
              <FolderPlus className="h-6 w-6 text-primary" />
              <h4 className="font-medium">Criando seu primeiro projeto</h4>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Um projeto no DEA Manager é onde você organiza todas as informações relacionadas a uma obra ou instalação específica.
            </p>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>Nome e informações básicas</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>Cliente e localização</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>Fornecedores e responsáveis</span>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-info/10 rounded-lg border border-info/20">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-info mt-0.5" />
              <div>
                <h5 className="font-medium text-info mb-1">Dica</h5>
                <p className="text-sm text-info/80">
                  Use nomes descritivos para seus projetos, como "Shopping Center ABC - São Paulo".
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
      action: {
        label: 'Criar Projeto',
        onClick: () => {
          // This would trigger the project creation modal
          setCompletedSteps(prev => [...prev, 'create-project']);
        }
      }
    },
    {
      id: 'add-contacts',
      title: 'Adicione contatos',
      description: 'Organize os contatos dos seus projetos por categoria.',
      icon: Users,
      content: (
        <div className="space-y-4">
          <div className="grid gap-3">
            <div className="p-3 border rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h5 className="font-medium">Cliente</h5>
                  <p className="text-xs text-muted-foreground">Contatos do cliente final</p>
                </div>
              </div>
            </div>
            
            <div className="p-3 border rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h5 className="font-medium">Obra</h5>
                  <p className="text-xs text-muted-foreground">Responsáveis técnicos da obra</p>
                </div>
              </div>
            </div>
            
            <div className="p-3 border rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                  <Users className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h5 className="font-medium">Fornecedor</h5>
                  <p className="text-xs text-muted-foreground">Fornecedores e parceiros</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm text-center text-muted-foreground">
              💡 Você pode acessar todos os contatos na página "Contatos" do menu principal
            </p>
          </div>
        </div>
      ),
      action: {
        label: 'Entendi',
        onClick: () => {
          setCompletedSteps(prev => [...prev, 'add-contacts']);
        }
      }
    },
    {
      id: 'sync-data',
      title: 'Sincronização automática',
      description: 'Seus dados ficam seguros e sincronizados automaticamente.',
      icon: RefreshCw,
      content: (
        <div className="space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="h-8 w-8 text-primary animate-pulse" />
            </div>
            <h4 className="font-medium mb-2">Seus dados sempre seguros</h4>
            <p className="text-sm text-muted-foreground">
              O DEA Manager sincroniza automaticamente seus dados com a nuvem, 
              garantindo que você nunca perca informações importantes.
            </p>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-success/10 rounded-lg border border-success/20">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-medium">Backup automático</p>
                <p className="text-xs text-muted-foreground">Seus dados são salvos automaticamente</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-success/10 rounded-lg border border-success/20">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-medium">Acesso offline</p>
                <p className="text-xs text-muted-foreground">Continue trabalhando sem internet</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-success/10 rounded-lg border border-success/20">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-medium">Sincronização inteligente</p>
                <p className="text-xs text-muted-foreground">Apenas as mudanças são enviadas</p>
              </div>
            </div>
          </div>
        </div>
      ),
      action: {
        label: 'Perfeito',
        onClick: () => {
          setCompletedSteps(prev => [...prev, 'sync-data']);
        }
      }
    },
    {
      id: 'ready',
      title: 'Tudo pronto!',
      description: 'Você está pronto para começar a usar o DEA Manager.',
      icon: Zap,
      content: (
        <div className="space-y-4">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-r from-primary to-primary/60 rounded-full flex items-center justify-center mx-auto mb-4">
              <Zap className="h-10 w-10 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Parabéns! 🎉</h3>
            <p className="text-muted-foreground">
              Você concluiu a configuração inicial do DEA Manager.
            </p>
          </div>
          
          <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-4 rounded-lg border">
            <h4 className="font-medium mb-3">Próximos passos sugeridos:</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="w-5 h-5 p-0 flex items-center justify-center text-xs">1</Badge>
                <span>Crie seu primeiro projeto</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="w-5 h-5 p-0 flex items-center justify-center text-xs">2</Badge>
                <span>Adicione contatos ao projeto</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="w-5 h-5 p-0 flex items-center justify-center text-xs">3</Badge>
                <span>Explore os relatórios e orçamentos</span>
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Precisa de ajuda? Acesse a documentação no menu lateral.
            </p>
          </div>
        </div>
      ),
      action: {
        label: 'Começar a usar',
        onClick: () => {
          setCompletedSteps(prev => [...prev, 'ready']);
          onComplete();
        }
      }
    }
  ];

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const isStepCompleted = (stepId: string) => {
    return completedSteps.includes(stepId);
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                <currentStepData.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-left">{currentStepData.title}</DialogTitle>
                <p className="text-sm text-muted-foreground">{currentStepData.description}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">{currentStep + 1} de {steps.length}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step indicators */}
          <div className="flex justify-center">
            <div className="flex gap-2">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    index === currentStep 
                      ? "bg-primary" 
                      : index < currentStep || isStepCompleted(step.id)
                        ? "bg-primary/50"
                        : "bg-muted"
                  )}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <Card>
            <CardContent className="p-6">
              {currentStepData.content}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 0}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Anterior
            </Button>

            <div className="flex gap-2">
              {currentStepData.action && (
                <Button
                  variant="outline"
                  onClick={currentStepData.action.onClick}
                  className="gap-2"
                >
                  {currentStepData.action.label}
                  {isStepCompleted(currentStepData.id) && (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  )}
                </Button>
              )}
              
              {currentStep < steps.length - 1 ? (
                <Button onClick={nextStep} className="gap-2">
                  Próximo
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={() => onComplete()} className="gap-2">
                  Finalizar
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to manage onboarding state
export function useOnboarding() {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      const hasCompleted = completed === 'true';
      setHasCompletedOnboarding(hasCompleted);
      
      // Show onboarding for new users after a short delay
      if (!hasCompleted) {
        const timer = setTimeout(() => {
          setShowOnboarding(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  const markOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    setHasCompletedOnboarding(true);
    setShowOnboarding(false);
  };

  const resetOnboarding = () => {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    setHasCompletedOnboarding(false);
  };

  const startOnboarding = () => {
    setShowOnboarding(true);
  };

  return {
    hasCompletedOnboarding,
    showOnboarding,
    markOnboardingComplete,
    resetOnboarding,
    startOnboarding,
    closeOnboarding: () => setShowOnboarding(false)
  };
}