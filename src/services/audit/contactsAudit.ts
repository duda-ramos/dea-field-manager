import { logger } from '@/services/logger';
import { supabase } from '@/integrations/supabase/client';

interface ContactsAuditEvent {
  action: 'view' | 'create' | 'update' | 'delete' | 'export';
  contactId?: string;
  projectId?: string;
  userId: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

class ContactsAuditService {
  private events: ContactsAuditEvent[] = [];
  private readonly maxLocalEvents = 1000;

  private async logEvent(event: ContactsAuditEvent): Promise<void> {
    // Store locally for immediate access
    this.events.unshift(event);
    if (this.events.length > this.maxLocalEvents) {
      this.events = this.events.slice(0, this.maxLocalEvents);
    }

    // Log to application logger for monitoring
    logger.info(`📋 Contacts audit: ${event.action}`, {
      contactId: event.contactId,
      projectId: event.projectId,
      userId: event.userId,
      metadata: event.metadata
    });

    // In a production environment, you might want to store these in a dedicated audit table
    // For now, we'll use the application logger as the audit trail
  }

  async logContactView(contactId: string, projectId: string, userId: string): Promise<void> {
    await this.logEvent({
      action: 'view',
      contactId,
      projectId,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  async logContactCreate(contactId: string, projectId: string, userId: string, contactData: any): Promise<void> {
    await this.logEvent({
      action: 'create',
      contactId,
      projectId,
      userId,
      timestamp: new Date().toISOString(),
      metadata: {
        name: contactData.name,
        role: contactData.role
      }
    });
  }

  async logContactUpdate(contactId: string, projectId: string, userId: string, changes: Record<string, any>): Promise<void> {
    await this.logEvent({
      action: 'update',
      contactId,
      projectId,
      userId,
      timestamp: new Date().toISOString(),
      metadata: {
        fieldsChanged: Object.keys(changes)
      }
    });
  }

  async logContactDelete(contactId: string, projectId: string, userId: string): Promise<void> {
    await this.logEvent({
      action: 'delete',
      contactId,
      projectId,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  async logContactsExport(projectId: string, userId: string, contactCount: number): Promise<void> {
    await this.logEvent({
      action: 'export',
      projectId,
      userId,
      timestamp: new Date().toISOString(),
      metadata: {
        contactCount
      }
    });
  }

  getRecentEvents(limit: number = 100): ContactsAuditEvent[] {
    return this.events.slice(0, limit);
  }

  getEventsByContact(contactId: string): ContactsAuditEvent[] {
    return this.events.filter(event => event.contactId === contactId);
  }

  getEventsByProject(projectId: string): ContactsAuditEvent[] {
    return this.events.filter(event => event.projectId === projectId);
  }

  // Data classification helper
  classifyContactData(contactData: any): { 
    hasPersonalData: boolean; 
    dataTypes: string[]; 
    riskLevel: 'low' | 'medium' | 'high' 
  } {
    const dataTypes: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    
    if (contactData.email) {
      dataTypes.push('email');
      riskLevel = 'medium';
    }
    
    if (contactData.phone || contactData.telefone) {
      dataTypes.push('phone');
      riskLevel = 'medium';
    }
    
    if (contactData.name || contactData.nome) {
      dataTypes.push('name');
      if (riskLevel === 'low') riskLevel = 'medium';
    }

    // Third-party contact data increases risk
    const hasPersonalData = dataTypes.length > 0;
    if (hasPersonalData) {
      riskLevel = 'high'; // Third-party personal data is always high risk
    }

    return {
      hasPersonalData,
      dataTypes,
      riskLevel
    };
  }
}

export const contactsAuditService = new ContactsAuditService();