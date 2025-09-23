import { supabase } from '@/integrations/supabase/client';
import { CalendarEvent, CalendarBlock, CreateCalendarEventData, CreateCalendarBlockData } from '@/types/calendar';

// Calendar Events
export const calendarService = {
  // Events
  async getEvents(startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> {
    let query = supabase
      .from('calendar_events')
      .select('*')
      .order('start_datetime');

    if (startDate && endDate) {
      query = query
        .gte('start_datetime', startDate.toISOString())
        .lte('end_datetime', endDate.toISOString());
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return (data || []) as CalendarEvent[];
  },

  async createEvent(eventData: CreateCalendarEventData): Promise<CalendarEvent> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        ...eventData,
        user_id: user.id,
        color: eventData.color || '#3b82f6',
        is_all_day: eventData.is_all_day || false,
        status: eventData.status || 'pending',
        priority: eventData.priority || 'medium'
      })
      .select()
      .single();

    if (error) throw error;
    return data as CalendarEvent;
  },

  async updateEvent(id: string, updates: Partial<CreateCalendarEventData>): Promise<CalendarEvent> {
    const { data, error } = await supabase
      .from('calendar_events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as CalendarEvent;
  },

  async deleteEvent(id: string): Promise<void> {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getEventsByProject(projectId: string): Promise<CalendarEvent[]> {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('project_id', projectId)
      .order('start_datetime');

    if (error) throw error;
    return (data || []) as CalendarEvent[];
  },

  // Blocks
  async getBlocks(month?: Date): Promise<CalendarBlock[]> {
    let query = supabase
      .from('calendar_blocks')
      .select('*')
      .order('blocked_date');

    if (month) {
      const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
      const endOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      
      query = query
        .gte('blocked_date', startOfMonth.toISOString().split('T')[0])
        .lte('blocked_date', endOfMonth.toISOString().split('T')[0]);
    }

    const { data, error } = await query;
    
    if (error) throw error;
    return (data || []) as CalendarBlock[];
  },

  async createBlock(blockData: CreateCalendarBlockData): Promise<CalendarBlock> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('calendar_blocks')
      .insert({
        ...blockData,
        user_id: user.id,
        block_type: blockData.block_type || 'unavailable'
      })
      .select()
      .single();

    if (error) throw error;
    return data as CalendarBlock;
  },

  async deleteBlock(id: string): Promise<void> {
    const { error } = await supabase
      .from('calendar_blocks')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Integration with projects
  async createInstallationEvents(projectId: string, startDate: Date, endDate: Date): Promise<CalendarEvent> {
    const project = await supabase
      .from('projects')
      .select('name, client')
      .eq('id', projectId)
      .single();

    if (project.error) throw project.error;

    return this.createEvent({
      title: `Instalação - ${project.data.name}`,
      description: `Instalação do projeto para ${project.data.client}`,
      start_datetime: startDate.toISOString(),
      end_datetime: endDate.toISOString(),
      event_type: 'installation',
      color: '#f59e0b',
      priority: 'high',
      project_id: projectId
    });
  }
};