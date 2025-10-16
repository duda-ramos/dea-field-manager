import { supabase } from '@/integrations/supabase/client';
import { calendarService } from './calendar';
import { storage } from '@/lib/storage';
import { Project } from '@/types';
import { format, parseISO, addBusinessDays, subBusinessDays } from 'date-fns';

export const calendarIntegration = {
  /**
   * Sincroniza automaticamente as instalações dos projetos com eventos do calendário
   */
  async syncProjectInstallations() {
    try {
      const projects = await storage.getProjects();
      const existingEvents = await calendarService.getEvents();
      
      // Encontrar eventos de instalação já existentes
      const installationEvents = existingEvents.filter(event => 
        event.event_type === 'installation' && event.project_id
      );

      for (const project of projects) {
        if (
          project.installation_date && 
          (project as any).installation_time_estimate_days &&
          project.status !== 'completed'
        ) {
          // Verificar se já existe um evento para este projeto
          const existingEvent = installationEvents.find(event => 
            event.project_id === project.id
          );

          const endDate = parseISO(project.installation_date);
          const estimatedDays = (project as any).installation_time_estimate_days;
          const startDate = this.calculateBusinessDays(endDate, estimatedDays);

          if (existingEvent) {
            // Atualizar evento existente se as datas mudaram
            const existingStart = parseISO(existingEvent.start_datetime);
            const existingEnd = parseISO(existingEvent.end_datetime);

            if (
              existingStart.getTime() !== startDate.getTime() ||
              existingEnd.getTime() !== endDate.getTime() ||
              existingEvent.title !== `Instalação - ${project.name}`
            ) {
              await calendarService.updateEvent(existingEvent.id, {
                title: `Instalação - ${project.name}`,
                description: `Instalação do projeto ${project.name} para ${project.client}`,
                start_datetime: startDate.toISOString(),
                end_datetime: endDate.toISOString(),
                location: `${project.city} - ${project.client}`,
              });
            }
          } else {
            // Criar novo evento de instalação
            await calendarService.createEvent({
              title: `Instalação - ${project.name}`,
              description: `Instalação do projeto ${project.name} para ${project.client}`,
              start_datetime: startDate.toISOString(),
              end_datetime: endDate.toISOString(),
              event_type: 'installation',
              color: '#f59e0b',
              priority: 'high',
              location: `${project.city} - ${project.client}`,
              project_id: project.id,
              is_all_day: true
            });
          }
        }
      }

      // Remover eventos de instalação para projetos que não existem mais ou foram concluídos
      const validProjectIds = projects
        .filter(p => p.installation_date && p.status !== 'completed')
        .map(p => p.id);

      for (const event of installationEvents) {
        if (event.project_id && !validProjectIds.includes(event.project_id)) {
          await calendarService.deleteEvent(event.id);
        }
      }

    } catch (error) {
      console.error('Error syncing project installations:', error);
      throw error;
    }
  },

  /**
   * Cria eventos de prazo para projetos
   */
  async createProjectDeadlines() {
    try {
      const projects = await storage.getProjects();
      const existingEvents = await calendarService.getEvents();
      
      const deadlineEvents = existingEvents.filter(event => 
        event.event_type === 'deadline' && event.project_id
      );

      for (const project of projects) {
        if (project.installation_date && project.status !== 'completed') {
          const existingDeadline = deadlineEvents.find(event => 
            event.project_id === project.id
          );

          if (!existingDeadline) {
            // Criar evento de prazo uma semana antes da instalação
            const installationDate = parseISO(project.installation_date);
            const deadlineDate = subBusinessDays(installationDate, 7);
            
            await calendarService.createEvent({
              title: `Prazo - ${project.name}`,
              description: `Prazo de entrega para o projeto ${project.name}`,
              start_datetime: deadlineDate.toISOString(),
              end_datetime: deadlineDate.toISOString(),
              event_type: 'deadline',
              color: '#ef4444',
              priority: 'urgent',
              project_id: project.id,
              is_all_day: true
            });
          }
        }
      }
    } catch (error) {
      console.error('Error creating project deadlines:', error);
      throw error;
    }
  },

  /**
   * Calcula dias úteis anteriores a uma data
   */
  calculateBusinessDays(endDate: Date, businessDays: number): Date {
    let currentDate = new Date(endDate);
    let remainingDays = businessDays - 1;
    
    while (remainingDays > 0) {
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() - 1);
      
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        remainingDays--;
      }
    }
    
    return currentDate;
  },

  /**
   * Cria lembrete para revisão de projeto
   */
  async createProjectReminders() {
    try {
      const projects = await storage.getProjects();
      
      for (const project of projects) {
        if (project.status === 'in-progress') {
          // Criar lembrete semanal para projetos em andamento
          const reminderDate = new Date();
          reminderDate.setDate(reminderDate.getDate() + 7);

          await calendarService.createEvent({
            title: `Revisão - ${project.name}`,
            description: `Revisão semanal do projeto ${project.name}`,
            start_datetime: reminderDate.toISOString(),
            end_datetime: reminderDate.toISOString(),
            event_type: 'reminder',
            color: '#8b5cf6',
            priority: 'medium',
            project_id: project.id,
            is_all_day: false
          });
        }
      }
    } catch (error) {
      console.error('Error creating project reminders:', error);
      throw error;
    }
  },

  /**
   * Obter próximos eventos de um projeto
   */
  async getProjectUpcomingEvents(projectId: string) {
    try {
      const events = await calendarService.getEventsByProject(projectId);
      const now = new Date();
      
      return events
        .filter(event => parseISO(event.start_datetime) >= now)
        .sort((a, b) => parseISO(a.start_datetime).getTime() - parseISO(b.start_datetime).getTime())
        .slice(0, 5);
    } catch (error) {
      console.error('Error getting project upcoming events:', error);
      return [];
    }
  }
};