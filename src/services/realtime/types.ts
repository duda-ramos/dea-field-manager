export interface RealtimeEvent {
  id: string;
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  timestamp: number;
  clientId?: string;
}

export interface RealtimeMetrics {
  eventsReceived: number;
  eventsApplied: number;
  eventsIgnored: number;
  isActive: boolean;
  lastEventAt?: number;
}

export interface RealtimeChannel {
  name: string;
  subscription: any;
  isSubscribed: boolean;
}
