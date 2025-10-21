import React, { useState, useEffect } from 'react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Plus, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, parseISO, isSameDay, eachDayOfInterval, addDays, startOfWeek, endOfWeek, startOfDay, endOfDay, addWeeks, subWeeks, startOfYear, endOfYear, eachMonthOfInterval, addYears, subYears, isToday, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarEvent, CalendarBlock, CalendarView as ViewType } from '@/types/calendar';
import { calendarService } from '@/services/calendar';
import { useToast } from '@/hooks/use-toast';

const eventTypeOptions = [
  { value: 'task', label: 'Tarefa', icon: '📋' },
  { value: 'meeting', label: 'Reunião', icon: '👥' },
  { value: 'installation', label: 'Instalação', icon: '🔧' },
  { value: 'deadline', label: 'Prazo', icon: '⏰' },
  { value: 'reminder', label: 'Lembrete', icon: '🔔' },
] as const;

interface CalendarViewProps {
  view: ViewType;
  onCreateEvent: () => void;
  onEventClick: (event: CalendarEvent) => void;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export function CalendarView({ view, onCreateEvent, onEventClick, selectedDate, onDateSelect }: CalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { toast } = useToast();

  useEffect(() => {
    loadCalendarData();
  }, [currentMonth]);

  const loadCalendarData = async () => {
    try {
      setLoading(true);
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      
      const [eventsData, blocksData] = await Promise.all([
        calendarService.getEvents(monthStart, monthEnd),
        calendarService.getBlocks(currentMonth)
      ]);
      
      setEvents(eventsData);
      setBlocks(blocksData);
    } catch (error) {
      // Error já tratado pelo toast
      toast({
        title: 'Erro ao carregar agenda',
        description: 'Não foi possível carregar os dados da agenda.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventStart = parseISO(event.start_datetime);
      const eventEnd = parseISO(event.end_datetime);
      
      if (event.is_all_day) {
        return isSameDay(eventStart, date);
      }
      
      return date >= eventStart && date <= eventEnd;
    });
  };

  const getBlocksForDate = (date: Date) => {
    return blocks.filter(block => 
      isSameDay(parseISO(block.blocked_date + 'T00:00:00'), date)
    );
  };

  const getDatesWithEvents = () => {
    const dates: Date[] = [];
    events.forEach(event => {
      const eventDate = parseISO(event.start_datetime);
      if (!dates.some(d => isSameDay(d, eventDate))) {
        dates.push(eventDate);
      }
    });
    return dates;
  };

  const getDatesWithBlocks = () => {
    return blocks.map(block => parseISO(block.blocked_date + 'T00:00:00'));
  };


  const getStatusBadgeVariant = (status: CalendarEvent['status']) => {
    const variants = {
      pending: 'secondary' as const,
      'in-progress': 'default' as const,
      completed: 'outline' as const,
      cancelled: 'destructive' as const
    };
    return variants[status] || 'secondary';
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => 
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  const renderDayView = () => {
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);
    const dayEvents = events.filter(event => {
      const eventStart = parseISO(event.start_datetime);
      const eventEnd = parseISO(event.end_datetime);
      return isWithinInterval(eventStart, { start: dayStart, end: dayEnd }) ||
             isWithinInterval(eventEnd, { start: dayStart, end: dayEnd }) ||
             (eventStart <= dayStart && eventEnd >= dayEnd);
    }).sort((a, b) => parseISO(a.start_datetime).getTime() - parseISO(b.start_datetime).getTime());

    const blocksForDay = getBlocksForDate(selectedDate);
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => onDateSelect(addDays(selectedDate, -1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-lg md:text-xl">
                {format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => onDateSelect(addDays(selectedDate, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Day Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Timeline */}
            <div className="lg:col-span-3">
              {blocksForDay.length > 0 && (
                <div className="mb-4 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                  <div className="text-sm font-medium text-destructive mb-2">Data Bloqueada</div>
                  {blocksForDay.map(block => (
                    <div key={block.id} className="text-sm text-muted-foreground">
                      {block.reason || `Bloqueio: ${block.block_type}`}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1">
                {hours.map(hour => {
                  const hourEvents = dayEvents.filter(event => {
                    if (event.is_all_day) return hour === 0;
                    const eventStart = parseISO(event.start_datetime);
                    return eventStart.getHours() === hour;
                  });

                  return (
                    <div key={hour} className="flex border-b border-border min-h-[60px]">
                      <div className="w-16 text-sm text-muted-foreground p-3 border-r border-border bg-muted/20">
                        {hour === 0 && dayEvents.some(e => e.is_all_day) ? 'Todo dia' : 
                         hour.toString().padStart(2, '0') + ':00'}
                      </div>
                      <div className="flex-1 p-3">
                        {hourEvents.map(event => (
                          <div
                            key={event.id}
                            className="p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors mb-2 last:mb-0"
                            onClick={() => onEventClick(event)}
                            style={{ borderLeftColor: event.color, borderLeftWidth: '4px' }}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium text-sm">{event.title}</h4>
                              <Badge variant={getStatusBadgeVariant(event.status)}>
                                {event.status}
                              </Badge>
                            </div>
                            {event.description && (
                              <p className="text-sm text-muted-foreground mb-2">{event.description}</p>
                            )}
                            <div className="text-sm text-muted-foreground">
                              {event.is_all_day ? 'Dia inteiro' : 
                               `${format(parseISO(event.start_datetime), 'HH:mm')} - ${format(parseISO(event.end_datetime), 'HH:mm')}`}
                            </div>
                          </div>
                        ))}
                        {hourEvents.length === 0 && (
                          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                            {/* Empty hour slot */}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mini Calendar */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Navegação</CardTitle>
                </CardHeader>
                <CardContent>
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={onDateSelect}
                    locale={ptBR}
                    className="rounded-md border-0 w-full"
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    
    const weekEvents = events.filter(event => {
      const eventStart = parseISO(event.start_datetime);
      return isWithinInterval(eventStart, { start: weekStart, end: weekEnd });
    });

    return (
      <div className="space-y-6">
        {/* Week Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => onDateSelect(subWeeks(selectedDate, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg sm:text-xl font-semibold">
              {format(weekStart, "dd 'de' MMM", { locale: ptBR })} - {format(weekEnd, "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
            </h2>
            <Button variant="outline" size="sm" onClick={() => onDateSelect(addWeeks(selectedDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Week Grid */}
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="grid grid-cols-8 gap-1 md:gap-2">
              {/* Header with day names */}
              <div className="text-xs font-medium text-muted-foreground p-1 md:p-2"></div>
              {weekDays.map(day => (
                <div key={day.toISOString()} className="text-center p-1 md:p-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    {format(day, 'EEE', { locale: ptBR })}
                  </div>
                  <div className={`text-sm md:text-lg font-semibold ${isToday(day) ? 'text-primary' : ''} ${isSameDay(day, selectedDate) ? 'bg-primary text-primary-foreground rounded-full w-6 h-6 md:w-8 md:h-8 flex items-center justify-center mx-auto text-xs md:text-base' : ''}`}>
                    {format(day, 'd')}
                  </div>
                </div>
              ))}

              {/* Hours rows */}
              {Array.from({ length: 24 }, (_, hour) => (
                <React.Fragment key={hour}>
                  <div className="text-xs text-muted-foreground p-1 md:p-2 border-r">
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                  {weekDays.map(day => {
                    const dayEvents = weekEvents.filter(event => {
                      const eventStart = parseISO(event.start_datetime);
                      return isSameDay(eventStart, day) && 
                             (event.is_all_day ? hour === 0 : eventStart.getHours() === hour);
                    });

                    return (
                      <div key={`${day.toISOString()}-${hour}`} className="border border-border/20 min-h-[30px] md:min-h-[40px] p-1">
                        {dayEvents.map(event => (
                          <div
                            key={event.id}
                            className="text-xs p-1 rounded cursor-pointer hover:opacity-80 truncate"
                            style={{ backgroundColor: event.color, color: 'white' }}
                            onClick={() => onEventClick(event)}
                            title={event.title}
                          >
                            {event.title}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderYearView = () => {
    const yearStart = startOfYear(selectedDate);
    const yearEnd = endOfYear(selectedDate);
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });
    
    const yearEvents = events.filter(event => {
      const eventStart = parseISO(event.start_datetime);
      return isWithinInterval(eventStart, { start: yearStart, end: yearEnd });
    });

    return (
      <div className="space-y-6">
        {/* Year Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => onDateSelect(subYears(selectedDate, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg sm:text-xl font-semibold">
              {format(selectedDate, 'yyyy', { locale: ptBR })}
            </h2>
            <Button variant="outline" size="sm" onClick={() => onDateSelect(addYears(selectedDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Year Grid */}
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
              {months.map(month => {
                const monthEvents = yearEvents.filter(event => {
                  const eventStart = parseISO(event.start_datetime);
                  return eventStart.getMonth() === month.getMonth();
                });

                const monthBlocks = blocks.filter(block => {
                  const blockDate = parseISO(block.blocked_date + 'T00:00:00');
                  return blockDate.getMonth() === month.getMonth();
                });

                return (
                  <div key={month.toISOString()} className="border rounded-lg p-3 md:p-4">
                    <div className="text-center mb-3">
                      <h3 className="font-semibold text-sm md:text-base">
                        {format(month, 'MMMM', { locale: ptBR })}
                      </h3>
                    </div>
                    
                    <CalendarComponent
                      mode="single"
                      selected={isSameDay(selectedDate, month) ? selectedDate : undefined}
                      onSelect={(date) => date && onDateSelect(date)}
                      locale={ptBR}
                      month={month}
                      className="rounded-md text-xs w-full"
                      modifiers={{
                        hasEvent: monthEvents.map(e => parseISO(e.start_datetime)),
                        hasBlock: monthBlocks.map(b => parseISO(b.blocked_date + 'T00:00:00')),
                      }}
                      modifiersStyles={{
                        hasEvent: {
                          backgroundColor: 'hsl(var(--primary))',
                          color: 'hsl(var(--primary-foreground))',
                          fontSize: '10px'
                        },
                        hasBlock: {
                          backgroundColor: 'hsl(var(--destructive))',
                          color: 'hsl(var(--destructive-foreground))',
                          fontSize: '10px'
                        }
                      }}
                    />
                    
                    <div className="mt-2 text-center text-xs text-muted-foreground">
                      {monthEvents.length} eventos
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderAgendaView = () => {
    const upcomingEvents = events
      .filter(event => parseISO(event.start_datetime) >= new Date())
      .sort((a, b) => parseISO(a.start_datetime).getTime() - parseISO(b.start_datetime).getTime());

    const pastEvents = events
      .filter(event => parseISO(event.start_datetime) < new Date())
      .sort((a, b) => parseISO(b.start_datetime).getTime() - parseISO(a.start_datetime).getTime())
      .slice(0, 10);

    return (
      <div className="space-y-responsive">
        {/* Agenda Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg sm:text-xl font-semibold">Lista de Eventos</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Upcoming Events */}
          <Card className="mobile-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm md:text-base lg:text-lg">Próximos Eventos</CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {upcomingEvents.length} eventos programados
              </p>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3 max-h-[350px] md:max-h-[400px] lg:max-h-[500px] overflow-y-auto">
              {upcomingEvents.length === 0 ? (
                <p className="text-xs sm:text-sm text-muted-foreground text-center py-6 sm:py-8">
                  Nenhum evento futuro programado
                </p>
              ) : (
                upcomingEvents.map(event => (
                  <div
                    key={event.id}
                    className="p-2 md:p-3 lg:p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => onEventClick(event)}
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full mt-1 flex-shrink-0`} style={{ backgroundColor: event.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
                          <h4 className="text-sm sm:text-base font-medium truncate">{event.title}</h4>
                          <div className="flex items-center gap-1 sm:gap-2">
                            <Badge variant={getStatusBadgeVariant(event.status)} className="text-xs">
                              {event.status}
                            </Badge>
                            <Badge variant="outline" className="text-xs hidden md:inline-flex">
                              {eventTypeOptions.find(t => t.value === event.event_type)?.icon} {event.event_type}
                            </Badge>
                          </div>
                        </div>
                        
                        {event.description && (
                          <p className="text-xs sm:text-sm text-muted-foreground mb-2 line-clamp-2">
                            {event.description}
                          </p>
                        )}
                        
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            <span>
                              {format(parseISO(event.start_datetime), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </div>
                          
                          {!event.is_all_day && (
                            <div className="flex items-center gap-1">
                              <span>
                                {format(parseISO(event.start_datetime), 'HH:mm')} - {format(parseISO(event.end_datetime), 'HH:mm')}
                              </span>
                            </div>
                          )}
                          
                          {event.location && (
                            <div className="flex items-center gap-1 truncate">
                              <span>📍 {event.location}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Past Events */}
          <Card className="mobile-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm md:text-base lg:text-lg">Eventos Anteriores</CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Últimos {pastEvents.length} eventos
              </p>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3 max-h-[350px] md:max-h-[400px] lg:max-h-[500px] overflow-y-auto">
              {pastEvents.length === 0 ? (
                <p className="text-xs sm:text-sm text-muted-foreground text-center py-6 sm:py-8">
                  Nenhum evento anterior
                </p>
              ) : (
                pastEvents.map(event => (
                  <div
                    key={event.id}
                    className="p-2 md:p-3 lg:p-4 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors opacity-75"
                    onClick={() => onEventClick(event)}
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full mt-1 flex-shrink-0`} style={{ backgroundColor: event.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
                          <h4 className="text-sm sm:text-base font-medium truncate">{event.title}</h4>
                          <Badge variant={getStatusBadgeVariant(event.status)} className="text-xs">
                            {event.status}
                          </Badge>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            <span>
                              {format(parseISO(event.start_datetime), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          </div>
                          
                          {!event.is_all_day && (
                            <div className="flex items-center gap-1">
                              <span>
                                {format(parseISO(event.start_datetime), 'HH:mm')} - {format(parseISO(event.end_datetime), 'HH:mm')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando agenda...</div>
        </CardContent>
      </Card>
    );
  }

  if (view === 'month') {
    const eventsForSelectedDate = getEventsForDate(selectedDate);
    const blocksForSelectedDate = getBlocksForDate(selectedDate);
    const datesWithEvents = getDatesWithEvents();
    const datesWithBlocks = getDatesWithBlocks();

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-xl md:text-2xl">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar */}
            <div className="lg:col-span-2">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={onDateSelect}
                locale={ptBR}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                modifiers={{
                  hasEvent: datesWithEvents,
                  hasBlock: datesWithBlocks,
                }}
                modifiersStyles={{
                  hasEvent: {
                    backgroundColor: 'hsl(var(--primary))',
                    color: 'hsl(var(--primary-foreground))',
                    fontWeight: 'bold',
                    borderRadius: '6px'
                  },
                  hasBlock: {
                    backgroundColor: 'hsl(var(--destructive))',
                    color: 'hsl(var(--destructive-foreground))',
                    fontWeight: 'bold',
                    borderRadius: '6px'
                  }
                }}
                className="rounded-md border w-full"
              />
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-primary"></div>
                  <span>Com eventos</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm bg-destructive"></div>
                  <span>Data bloqueada</span>
                </div>
              </div>
            </div>

            {/* Selected Date Events */}
            <div className="lg:col-span-1">
              <div className="bg-muted/30 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4">
                  {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                </h3>
                
                <div className="space-y-3">
                  {blocksForSelectedDate.length > 0 && (
                    <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                      <div className="text-sm font-medium text-destructive mb-2">
                        Data Bloqueada
                      </div>
                      {blocksForSelectedDate.map(block => (
                        <div key={block.id} className="text-sm text-muted-foreground">
                          {block.reason || `Bloqueio: ${block.block_type}`}
                        </div>
                      ))}
                    </div>
                  )}

                  {eventsForSelectedDate.length === 0 && blocksForSelectedDate.length === 0 ? (
                    <div className="text-center py-8">
                      <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">
                        Nenhum evento programado para esta data
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={onCreateEvent}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Criar evento
                      </Button>
                    </div>
                  ) : (
                    eventsForSelectedDate.map((event) => (
                      <div
                        key={event.id}
                        className="p-3 rounded-lg border bg-card cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => onEventClick(event)}
                      >
                        <div className="flex items-start gap-3">
                          <div 
                            className="w-3 h-3 rounded-full mt-1 flex-shrink-0" 
                            style={{ backgroundColor: event.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-sm truncate">{event.title}</h4>
                              <Badge variant={getStatusBadgeVariant(event.status)} className="text-xs">
                                {event.status}
                              </Badge>
                            </div>
                            {event.description && (
                              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                {event.description}
                              </p>
                            )}
                            <div className="text-xs text-muted-foreground">
                              {event.is_all_day ? (
                                'Dia inteiro'
                              ) : (
                                <>
                                  {format(parseISO(event.start_datetime), 'HH:mm')} - {' '}
                                  {format(parseISO(event.end_datetime), 'HH:mm')}
                                </>
                              )}
                            </div>
                            {event.location && (
                              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {event.location}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Other views can be implemented later
  
  // Day View
  if (view === 'day') {
    return renderDayView();
  }

  // Week View  
  if (view === 'week') {
    return renderWeekView();
  }

  // Year View
  if (view === 'year') {
    return renderYearView();
  }

  // Agenda List View
  if (view === 'agenda') {
    return renderAgendaView();
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-center text-muted-foreground">
          Visualização {view} não implementada
        </div>
      </CardContent>
    </Card>
  );
}
