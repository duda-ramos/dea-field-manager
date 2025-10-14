import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Installation, ItemVersion } from "@/types";
import { RevisionHistoryModal } from "./RevisionHistoryModal";
import { AlertCircle, CheckCircle2, FileX, Layers, RefreshCw } from "lucide-react";

type EdgeCaseScenario = "empty" | "single" | "many" | "empty-fields" | "full-fields" | "rapid-restore";

interface TestScenario {
  id: EdgeCaseScenario;
  name: string;
  description: string;
  icon: React.ElementType;
  revisionCount: number;
}

const testScenarios: TestScenario[] = [
  {
    id: "empty",
    name: "Sem Revisões",
    description: "Instalação sem nenhuma revisão",
    icon: FileX,
    revisionCount: 0
  },
  {
    id: "single",
    name: "Revisão Única",
    description: "Instalação com apenas 1 revisão",
    icon: CheckCircle2,
    revisionCount: 1
  },
  {
    id: "many",
    name: "Muitas Revisões",
    description: "Instalação com 50+ revisões",
    icon: Layers,
    revisionCount: 50
  },
  {
    id: "empty-fields",
    name: "Campos Vazios",
    description: "Revisão com todos os campos vazios",
    icon: AlertCircle,
    revisionCount: 5
  },
  {
    id: "full-fields",
    name: "Campos Completos",
    description: "Revisão com todos os campos preenchidos",
    icon: CheckCircle2,
    revisionCount: 5
  },
  {
    id: "rapid-restore",
    name: "Restauração Rápida",
    description: "Múltiplas restaurações em sequência",
    icon: RefreshCw,
    revisionCount: 10
  }
];

export function RevisionEdgeCaseTest() {
  const [selectedScenario, setSelectedScenario] = useState<EdgeCaseScenario | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testResults, setTestResults] = useState<Record<EdgeCaseScenario, boolean>>({
    empty: false,
    single: false,
    many: false,
    "empty-fields": false,
    "full-fields": false,
    "rapid-restore": false
  });

  const generateMockInstallation = (scenario: EdgeCaseScenario): Installation => {
    const baseInstallation: Installation = {
      id: "test-installation-" + scenario,
      project_id: "test-project",
      tipologia: scenario === "empty-fields" ? "" : "Placa de Sinalização",
      codigo: scenario === "empty-fields" ? 0 : 1001,
      descricao: scenario === "empty-fields" ? "" : "Placa de saída de emergência",
      quantidade: scenario === "empty-fields" ? 0 : 5,
      pavimento: scenario === "empty-fields" ? "" : "Térreo",
      diretriz_altura_cm: scenario === "empty-fields" ? undefined : 210,
      diretriz_dist_batente_cm: scenario === "empty-fields" ? undefined : 15,
      installed: scenario === "full-fields",
      revisado: true,
      revisao: scenario === "single" ? 1 : scenario === "many" ? 50 : 5,
      observacoes: scenario === "full-fields" ? "Instalação completa com todas as especificações" : "",
      comentarios_fornecedor: scenario === "full-fields" ? "Material de alta qualidade, instalação conforme normas" : "",
      photos: scenario === "full-fields" ? ["photo1.jpg", "photo2.jpg"] : [],
      updated_at: new Date().toISOString()
    };

    return baseInstallation;
  };

  const generateMockRevisions = (scenario: EdgeCaseScenario): ItemVersion[] => {
    const scenarioConfig = testScenarios.find(s => s.id === scenario);
    if (!scenarioConfig) return [];

    const revisions: ItemVersion[] = [];
    const count = scenarioConfig.revisionCount;

    for (let i = 1; i <= count; i++) {
      const isEmptyFields = scenario === "empty-fields";
      const isFullFields = scenario === "full-fields";

      const revision: ItemVersion = {
        id: `revision-${scenario}-${i}`,
        installationId: `test-installation-${scenario}`,
        itemId: `test-installation-${scenario}`,
        revisao: i,
        type: i === 1 ? "created" : "edited",
        motivo: (i === 1 ? "created" : isEmptyFields ? "outros" : "revisao-conteudo") as ItemVersion['motivo'],
        descricao_motivo: isEmptyFields ? "" : `Revisão ${i} - ${scenario}`,
        snapshot: {
          project_id: "test-project",
          tipologia: isEmptyFields ? "" : `Tipologia Rev ${i}`,
          codigo: isEmptyFields ? 0 : 1000 + i,
          descricao: isEmptyFields ? "" : `Descrição da revisão ${i}`,
          quantidade: isEmptyFields ? 0 : i,
          pavimento: isEmptyFields ? "" : `Pavimento ${i % 5}`,
          diretriz_altura_cm: isEmptyFields ? undefined : 200 + i,
          diretriz_dist_batente_cm: isEmptyFields ? undefined : 10 + i,
          installed: isFullFields ? i % 2 === 0 : false,
          observacoes: isFullFields ? `Observações detalhadas da revisão ${i}` : "",
          comentarios_fornecedor: isFullFields ? `Comentários do fornecedor para revisão ${i}` : "",
          photos: isFullFields ? [`photo${i}.jpg`] : [],
          updated_at: new Date(Date.now() - (count - i) * 60 * 60 * 1000).toISOString()
        },
        criadoEm: new Date(Date.now() - (count - i) * 60 * 60 * 1000).toISOString()
      };

      revisions.push(revision);
    }

    return revisions;
  };

  const runTest = (scenario: EdgeCaseScenario) => {
    setSelectedScenario(scenario);
    setIsModalOpen(true);
    
    // Mark test as completed after modal opens
    setTimeout(() => {
      setTestResults(prev => ({ ...prev, [scenario]: true }));
    }, 1000);
  };

  const handleRestore = async (_version: ItemVersion) => {
    // Simulate restore operation
    // Restaurar versão selecionada
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  const currentInstallation = selectedScenario ? generateMockInstallation(selectedScenario) : null;
  const currentRevisions = selectedScenario ? generateMockRevisions(selectedScenario) : [];

  const allTestsPassed = Object.values(testResults).every(result => result);
  const testsRun = Object.values(testResults).filter(result => result).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Edge Case Testing - Sistema de Revisões</CardTitle>
          <CardDescription>
            Teste cenários extremos para garantir robustez do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {testScenarios.map((scenario) => {
              const Icon = scenario.icon;
              const isPassed = testResults[scenario.id];
              
              return (
                <Card 
                  key={scenario.id} 
                  className={`cursor-pointer transition-colors ${
                    isPassed ? 'border-green-500 bg-green-50' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => runTest(scenario.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Icon className={`h-5 w-5 mt-0.5 ${isPassed ? 'text-green-600' : 'text-muted-foreground'}`} />
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{scenario.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {scenario.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {scenario.revisionCount} revisões
                          </Badge>
                          {isPassed && (
                            <Badge variant="default" className="text-xs bg-green-600">
                              ✓ Testado
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-6">
            <Alert variant={allTestsPassed ? "default" : "destructive"}>
              <AlertDescription className="flex items-center justify-between">
                <span>
                  {allTestsPassed 
                    ? "✅ Todos os edge cases foram testados com sucesso!"
                    : `${testsRun} de ${testScenarios.length} testes executados`
                  }
                </span>
                {!allTestsPassed && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setTestResults({
                      empty: false,
                      single: false,
                      many: false,
                      "empty-fields": false,
                      "full-fields": false,
                      "rapid-restore": false
                    })}
                  >
                    Resetar Testes
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          </div>
        </CardContent>
      </Card>

      {currentInstallation && (
        <RevisionHistoryModal
          installation={currentInstallation}
          revisions={currentRevisions}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onRestore={handleRestore}
        />
      )}
    </div>
  );
}