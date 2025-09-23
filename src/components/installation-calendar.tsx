import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, Clock, AlertTriangle, List, MapPin } from "lucide-react";
import { Project } from "@/types";
import { format, parseISO, subBusinessDays, eachDayOfInterval, isWeekend, addDays, isSameDay, startOfMonth, endOfMonth, eachWeekOfInterval, startOfWeek, endOfWeek } from "date-fns";
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

type ViewMode = 'list' | 'calendar' | 'roadmap';

export function InstallationCalendar({ projects }: InstallationCalendarProps) {
  const [installationPeriods, setInstallationPeriods] = useState<InstallationPeriod[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

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

  // Get installations for a specific date
  const getInstallationsForDate = (date: Date) => {
    return installationPeriods.filter(period => {
      const dateRange = eachDayOfInterval({ start: period.startDate, end: period.endDate });
      return dateRange.some(d => isSameDay(d, date));
    });
  };

  // Get all dates that have installations
  const getDatesWithInstallations = () => {
    const dates: Date[] = [];
    installationPeriods.forEach(period => {
      const dateRange = eachDayOfInterval({ start: period.startDate, end: period.endDate });
      dates.push(...dateRange);
    });
    return dates;
  };

  const renderCalendarView = () => {
    const installationsForSelectedDate = getInstallationsForDate(selectedDate);
    const datesWithInstallations = getDatesWithInstallations();

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            locale={ptBR}
            modifiers={{
              hasInstallation: datesWithInstallations,
            }}
            modifiersStyles={{
              hasInstallation: { 
                backgroundColor: 'hsl(var(--primary))', 
                color: 'hsl(var(--primary-foreground))',
                fontWeight: 'bold'
              }
            }}
            className="rounded-md border"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Datas destacadas possuem instalações programadas
          </p>
        </div>
        
        <div>
          <h4 className="font-medium mb-3">
            {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </h4>
          {installationsForSelectedDate.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma instalação programada para esta data</p>
          ) : (
            <div className="space-y-3">
              {installationsForSelectedDate.map((period) => (
                <div 
                  key={period.project.id} 
                  className={`p-3 rounded-lg border ${
                    period.hasOverlap ? 'border-destructive bg-destructive/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <h5 className="font-medium">{period.project.name}</h5>
                    <Badge variant={getStatusColor(period.project.status, period.hasOverlap)} className="text-xs">
                      {getStatusIcon(period.hasOverlap)}
                      {period.hasOverlap ? 'Conflito' : 
                       period.project.status === 'planning' ? 'Planejamento' :
                       period.project.status === 'in-progress' ? 'Em Andamento' : 'Outro'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{period.project.client}</p>
                  <div className="text-xs space-y-1">
                    <div>
                      <span className="font-medium">Período: </span>
                      <span className="text-muted-foreground">
                        {format(period.startDate, "dd/MM", { locale: ptBR })} - {format(period.endDate, "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Duração: </span>
                      <span className="text-muted-foreground">{period.estimatedDays} dias úteis</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRoadmapView = () => {
    const sortedPeriods = installationPeriods.slice().sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    
    return (
      <div className="space-y-4">
        {sortedPeriods.map((period, index) => {
          const duration = Math.ceil((period.endDate.getTime() - period.startDate.getTime()) / (1000 * 60 * 60 * 24));
          const progress = period.project.status === 'completed' ? 100 : 
                          period.project.status === 'in-progress' ? 50 : 0;
          
          return (
            <div key={period.project.id} className="relative">
              {/* Timeline line */}
              {index < sortedPeriods.length - 1 && (
                <div className="absolute left-4 top-12 w-0.5 h-16 bg-border" />
              )}
              
              <div className={`flex items-start gap-4 p-4 rounded-lg border ${
                period.hasOverlap ? 'border-destructive bg-destructive/5' : 'border-border'
              }`}>
                {/* Timeline dot */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                  period.hasOverlap ? 'bg-destructive text-destructive-foreground' :
                  period.project.status === 'completed' ? 'bg-green-500 text-white' :
                  period.project.status === 'in-progress' ? 'bg-primary text-primary-foreground' :
                  'bg-secondary text-secondary-foreground'
                }`}>
                  {index + 1}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium">{period.project.name}</h4>
                    <Badge variant={getStatusColor(period.project.status, period.hasOverlap)} className="text-xs">
                      {getStatusIcon(period.hasOverlap)}
                      {period.hasOverlap ? 'Conflito' : 
                       period.project.status === 'planning' ? 'Planejamento' :
                       period.project.status === 'in-progress' ? 'Em Andamento' : 'Outro'}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-3">{period.project.client}</p>
                  
                  {/* Timeline bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span>{format(period.startDate, "dd/MM/yyyy", { locale: ptBR })}</span>
                      <span>{format(period.endDate, "dd/MM/yyyy", { locale: ptBR })}</span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          period.hasOverlap ? 'bg-destructive' :
                          period.project.status === 'completed' ? 'bg-green-500' :
                          period.project.status === 'in-progress' ? 'bg-primary' :
                          'bg-muted-foreground'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs mt-1 text-muted-foreground">
                      <span>{period.estimatedDays} dias úteis</span>
                      <span>{duration} dias corridos</span>
                    </div>
                  </div>
                  
                  {period.hasOverlap && (
                    <div className="p-2 bg-destructive/10 rounded text-xs text-destructive">
                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                      Este período pode conflitar com outras instalações
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Agenda de Instalações
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Cronograma reverso baseado nas datas de entrega e estimativas de tempo
            </p>
          </div>
          
          <div className="flex gap-1">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('calendar')}
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'roadmap' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('roadmap')}
            >
              <MapPin className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {installationPeriods.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma instalação programada</p>
            <p className="text-xs">Adicione datas de entrega e estimativas aos projetos</p>
          </div>
        ) : (
          <>
            {viewMode === 'calendar' && renderCalendarView()}
            {viewMode === 'roadmap' && renderRoadmapView()}
            {viewMode === 'list' && (
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
          </>
        )}
      </CardContent>
    </Card>
  );
}