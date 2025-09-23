import { useState, useEffect } from 'react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Plus, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, parseISO, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarEvent, CalendarBlock, CalendarView as ViewType } from '@/types/calendar';
import { calendarService } from '@/services/calendar';
import { useToast } from '@/hooks/use-toast';

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
      console.error('Error loading calendar data:', error);
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

  const getEventTypeColor = (type: CalendarEvent['event_type']) => {
    const colors = {
      task: 'bg-blue-500',
      meeting: 'bg-green-500',
      installation: 'bg-orange-500', 
      deadline: 'bg-red-500',
      reminder: 'bg-purple-500'
    };
    return colors[type] || 'bg-gray-500';
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-2xl font-semibold">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={onCreateEvent}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Evento
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-4">
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
                      fontWeight: 'bold'
                    },
                    hasBlock: {
                      backgroundColor: 'hsl(var(--destructive))',
                      color: 'hsl(var(--destructive-foreground))',
                      fontWeight: 'bold'
                    }
                  }}
                  className="rounded-md border w-full"
                />
                <div className="mt-4 flex flex-wrap gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-primary"></div>
                    <span>Com eventos</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm bg-destructive"></div>
                    <span>Data bloqueada</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Selected Date Events */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {blocksForSelectedDate.length > 0 && (
                  <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                    <div className="text-sm font-medium text-destructive mb-1">
                      Data Bloqueada
                    </div>
                    {blocksForSelectedDate.map(block => (
                      <div key={block.id} className="text-xs text-muted-foreground">
                        {block.reason || `Bloqueio: ${block.block_type}`}
                      </div>
                    ))}
                  </div>
                )}

                {eventsForSelectedDate.length === 0 && blocksForSelectedDate.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum evento programado para esta data
                  </p>
                ) : (
                  eventsForSelectedDate.map((event) => (
                    <div
                      key={event.id}
                      className="p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => onEventClick(event)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-3 h-3 rounded-full mt-1 ${getEventTypeColor(event.event_type)}`} />
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
                            <div className="text-xs text-muted-foreground mt-1">
                              📍 {event.location}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Other views can be implemented later
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-center text-muted-foreground">
          Visualização {view} em desenvolvimento
        </div>
      </CardContent>
    </Card>
  );
}
