import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, AlertTriangle } from "lucide-react";
import { Project } from "@/types";
import { format, parseISO, subBusinessDays, eachDayOfInterval, isWeekend, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InstallationCalendarProps {
  projects: Project[];
}

interface InstallationPeriod {
  project: Project;
  startDate: Date;
  endDate: Date;
  estimatedDays: number;
  hasOverlap: boolean;
}

export function InstallationCalendar({ projects }: InstallationCalendarProps) {
  const [installationPeriods, setInstallationPeriods] = useState<InstallationPeriod[]>([]);

  const calculateBusinessDays = (endDate: Date, businessDays: number): Date => {
    let currentDate = new Date(endDate);
    let remainingDays = businessDays - 1; // -1 porque a data final é incluída
    
    while (remainingDays > 0) {
      currentDate = addDays(currentDate, -1);
      if (!isWeekend(currentDate)) {
        remainingDays--;
      }
    }
    
    return currentDate;
  };

  const checkForOverlaps = (periods: InstallationPeriod[]): InstallationPeriod[] => {
    return periods.map(period => {
      const hasOverlap = periods.some(otherPeriod => {
        if (period.project.id === otherPeriod.project.id) return false;
        
        return (
          (period.startDate <= otherPeriod.endDate && period.endDate >= otherPeriod.startDate)
        );
      });
      
      return { ...period, hasOverlap };
    });
  };

  useEffect(() => {
    const periodsWithDates = projects
      .filter(project => 
        project.installation_date && 
        (project as any).installation_time_estimate_days &&
        project.status !== 'completed'
      )
      .map(project => {
        const endDate = parseISO(project.installation_date!);
        const estimatedDays = (project as any).installation_time_estimate_days;
        const startDate = calculateBusinessDays(endDate, estimatedDays);
        
        return {
          project,
          startDate,
          endDate,
          estimatedDays,
          hasOverlap: false
        };
      })
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    const periodsWithOverlaps = checkForOverlaps(periodsWithDates);
    setInstallationPeriods(periodsWithOverlaps);
  }, [projects]);

  const getStatusColor = (status: string, hasOverlap: boolean) => {
    if (hasOverlap) return "destructive";
    
    switch (status) {
      case 'planning':
        return "secondary";
      case 'in-progress':
        return "default";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (hasOverlap: boolean) => {
    if (hasOverlap) return <AlertTriangle className="h-3 w-3" />;
    return <Clock className="h-3 w-3" />;
  };

  const upcomingInstallations = installationPeriods.filter(period => 
    period.startDate >= new Date(new Date().setHours(0, 0, 0, 0))
  ).slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Agenda de Instalações
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Cronograma reverso baseado nas datas de entrega e estimativas de tempo
        </p>
      </CardHeader>
      <CardContent>
        {installationPeriods.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma instalação programada</p>
            <p className="text-xs">Adicione datas de entrega e estimativas aos projetos</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingInstallations.map((period) => (
              <div 
                key={period.project.id} 
                className={`p-3 rounded-lg border ${
                  period.hasOverlap ? 'border-destructive bg-destructive/5' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium truncate">{period.project.name}</h4>
                      <Badge variant={getStatusColor(period.project.status, period.hasOverlap)} className="text-xs">
                        {getStatusIcon(period.hasOverlap)}
                        {period.hasOverlap ? 'Conflito' : 
                         period.project.status === 'planning' ? 'Planejamento' :
                         period.project.status === 'in-progress' ? 'Em Andamento' : 'Outro'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{period.project.client}</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="font-medium">Início: </span>
                        <span className="text-muted-foreground">
                          {format(period.startDate, "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Entrega: </span>
                        <span className="text-muted-foreground">
                          {format(period.endDate, "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium">Duração: </span>
                        <span className="text-muted-foreground">{period.estimatedDays} dias úteis</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {period.hasOverlap && (
                  <div className="mt-2 p-2 bg-destructive/10 rounded text-xs text-destructive">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    Este período pode conflitar com outras instalações
                  </div>
                )}
              </div>
            ))}
            
            {installationPeriods.length > 10 && (
              <div className="text-center pt-2">
                <p className="text-xs text-muted-foreground">
                  +{installationPeriods.length - 10} instalações adicionais programadas
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}