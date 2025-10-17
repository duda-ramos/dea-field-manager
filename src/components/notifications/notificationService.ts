import type { Notification } from './NotificationSystem.types';

// Notification service for managing notifications
class NotificationService {
  private notifications: Notification[] = [];
  private listeners: ((notifications: Notification[]) => void)[] = [];

  constructor() {
    // Load from localStorage
    const stored = localStorage.getItem('app-notifications');
    if (stored) {
      this.notifications = JSON.parse(stored);
    }
  }

  private save() {
    localStorage.setItem('app-notifications', JSON.stringify(this.notifications));
    this.listeners.forEach(listener => listener([...this.notifications]));
  }

  addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    this.notifications.unshift(newNotification);
    // Keep only last 50 notifications
    if (this.notifications.length > 50) {
      this.notifications = this.notifications.slice(0, 50);
    }
    
    this.save();
  }

  markAsRead(id: string) {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      this.save();
    }
  }

  markAllAsRead() {
    this.notifications.forEach(n => n.read = true);
    this.save();
  }

  deleteNotification(id: string) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.save();
  }

  clearAll() {
    this.notifications = [];
    this.save();
  }

  getNotifications() {
    return [...this.notifications];
  }

  getUnreadCount() {
    return this.notifications.filter(n => !n.read).length;
  }

  subscribe(listener: (notifications: Notification[]) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

export const notificationService = new NotificationService();

// Helper function to add common notifications
export const addNotification = {
  syncSuccess: (itemsCount: number) => {
    notificationService.addNotification({
      title: 'Sincronização concluída',
      message: `${itemsCount} itens foram sincronizados com sucesso.`,
      type: 'success',
      category: 'sync'
    });
  },
  
  syncError: (error: string) => {
    notificationService.addNotification({
      title: 'Erro na sincronização',
      message: `Falha ao sincronizar: ${error}`,
      type: 'error',
      category: 'sync'
    });
  },

  projectCreated: (projectName: string, projectId: string) => {
    notificationService.addNotification({
      title: 'Projeto criado',
      message: `O projeto "${projectName}" foi criado com sucesso.`,
      type: 'success',
      category: 'project',
      projectId
    });
  },

  budgetCreated: (budgetAmount: number, projectName: string) => {
    notificationService.addNotification({
      title: 'Orçamento criado',
      message: `Novo orçamento de R$ ${budgetAmount.toLocaleString('pt-BR')} criado para ${projectName}.`,
      type: 'success',
      category: 'budget'
    });
  },

  contactAdded: (contactName: string, projectName: string) => {
    notificationService.addNotification({
      title: 'Contato adicionado',
      message: `${contactName} foi adicionado ao projeto ${projectName}.`,
      type: 'info',
      category: 'contact'
    });
  },

  systemUpdate: (message: string) => {
    notificationService.addNotification({
      title: 'Atualização do sistema',
      message,
      type: 'info',
      category: 'system'
    });
  }
};
