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
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <CalendarIcon className="h-8 w-8" />
            Agenda
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seus eventos, tarefas e compromissos
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={currentView === 'month' ? 'default' : 'outline'}
                size="sm"
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

          {/* Actions Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleCreateEvent}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Evento
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleBlockDate}>
                <Ban className="h-4 w-4 mr-2" />
                Bloquear Data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
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