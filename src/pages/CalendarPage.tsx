import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CalendarIcon, Plus, Ban, MoreVertical } from 'lucide-react';
import { CalendarView } from '@/components/calendar/CalendarView';
import { EventModal } from '@/components/calendar/EventModal';
import { BlockDateModal } from '@/components/calendar/BlockDateModal';
import { ProjectIntegrationPanel } from '@/components/calendar/ProjectIntegrationPanel';
import { CalendarEvent, CalendarView as ViewType } from '@/types/calendar';

export default function CalendarPage() {
  const [currentView, setCurrentView] = useState<ViewType>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [blockDateModalOpen, setBlockDateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreateEvent = () => {
    setSelectedEvent(null);
    setEventModalOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setEventModalOpen(true);
  };

  const handleEventSaved = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleBlockDate = () => {
    setBlockDateModalOpen(true);
  };

  const handleBlockSaved = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="w-full max-w-full px-3 sm:px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2 sm:gap-3">
              <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6 md:h-7 md:w-7 text-primary flex-shrink-0" />
              <span className="truncate">Agenda</span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Gerencie seus eventos, tarefas e compromissos
            </p>
          </div>

          <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
            {/* New Event Button */}
            <Button onClick={handleCreateEvent} className="w-full sm:w-auto whitespace-nowrap">
              <Plus className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate">Novo Evento</span>
            </Button>

            {/* View Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto">
                  <MoreVertical className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate">
                    {currentView === 'month' && 'Mês'}
                    {currentView === 'week' && 'Semana'}
                    {currentView === 'day' && 'Dia'}
                    {currentView === 'year' && 'Ano'}
                    {currentView === 'agenda' && 'Lista'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setCurrentView('month')}>
                  Visualização Mensal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCurrentView('week')}>
                  Visualização Semanal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCurrentView('day')}>
                  Visualização Diária
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCurrentView('year')}>
                  Visualização Anual
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCurrentView('agenda')}>
                  Lista de Eventos
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Block Date Button */}
            <Button 
              onClick={handleBlockDate} 
              variant="outline"
              className="w-full sm:w-auto whitespace-nowrap"
            >
              <Ban className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="truncate">Bloquear Data</span>
            </Button>
          </div>
        </div>

        {/* Calendar Content */}
        <div className="w-full max-w-full overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:gap-6">
            <div className="lg:col-span-3 min-w-0">
              <CalendarView
                key={refreshKey}
                view={currentView}
                onCreateEvent={handleCreateEvent}
                onEventClick={handleEventClick}
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
              />
            </div>
            
            <div className="lg:col-span-1 min-w-0">
              <ProjectIntegrationPanel />
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <EventModal
        isOpen={eventModalOpen}
        onClose={() => {
          setEventModalOpen(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
        selectedDate={selectedDate}
        onEventSaved={handleEventSaved}
      />

      <BlockDateModal
        isOpen={blockDateModalOpen}
        onClose={() => setBlockDateModalOpen(false)}
        selectedDate={selectedDate}
        onBlockSaved={handleBlockSaved}
      />
    </div>
  );
}