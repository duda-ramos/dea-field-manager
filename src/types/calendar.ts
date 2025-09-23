export interface CalendarEvent {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  description?: string;
  start_datetime: string;
  end_datetime: string;
  event_type: 'task' | 'meeting' | 'installation' | 'deadline' | 'reminder';
  color: string;
  is_all_day: boolean;
  recurrence_rule?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  location?: string;
  attendees: string[];
  created_at: string;
  updated_at: string;
}

export interface CalendarBlock {
  id: string;
  user_id: string;
  blocked_date: string;
  reason?: string;
  block_type: 'unavailable' | 'vacation' | 'maintenance' | 'reserved';
  created_at: string;
  updated_at: string;
}

export interface CreateCalendarEventData {
  title: string;
  description?: string;
  start_datetime: string;
  end_datetime: string;
  event_type: CalendarEvent['event_type'];
  color?: string;
  is_all_day?: boolean;
  status?: CalendarEvent['status'];
  priority?: CalendarEvent['priority'];
  location?: string;
  project_id?: string;
}

export interface CreateCalendarBlockData {
  blocked_date: string;
  reason?: string;
  block_type?: CalendarBlock['block_type'];
}

export type CalendarView = 'month' | 'week' | 'day' | 'year' | 'agenda';