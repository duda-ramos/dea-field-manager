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
    <div className="container-modern space-y-responsive">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 sm:gap-3">
            <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6" />
            Agenda
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie seus eventos, tarefas e compromissos
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* New Event Button */}
          <Button onClick={handleCreateEvent} className="mobile-button">
            <Plus className="h-4 w-4 mr-2" />
            Novo Evento
          </Button>

          {/* View Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="mobile-button"
              >
                {currentView === 'month' && 'Mês'}
                {currentView === 'week' && 'Semana'}
                {currentView === 'day' && 'Dia'}
                {currentView === 'year' && 'Ano'}
                {currentView === 'agenda' && 'Lista'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
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
            size="sm"
            className="mobile-button"
          >
            <Ban className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Bloquear Data</span>
            <span className="sm:hidden">Bloquear</span>
          </Button>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-responsive">
        <div className="xl:col-span-3">
          <CalendarView
            key={refreshKey}
            view={currentView}
            onCreateEvent={handleCreateEvent}
            onEventClick={handleEventClick}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
          />
        </div>
        
        <div className="xl:col-span-1">
          <ProjectIntegrationPanel />
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