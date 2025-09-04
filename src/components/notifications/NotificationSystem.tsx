import { useState, useEffect } from 'react';
import { Bell, Check, X, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  projectId?: string;
  category: 'sync' | 'project' | 'system' | 'budget' | 'contact';
}

interface NotificationSystemProps {
  className?: string;
}

// Mock notifications service - in real app would come from API/realtime
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
      message: `O projeto \"${projectName}\" foi criado com sucesso.`,
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

export function NotificationSystem({ className }: NotificationSystemProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const unsubscribe = notificationService.subscribe(setNotifications);
    setNotifications(notificationService.getNotifications());
    return unsubscribe;
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'error': return <X className="h-4 w-4 text-destructive" />;
      default: return <Info className="h-4 w-4 text-info" />;
    }
  };

  const getTypeColor = (type: Notification['type']) => {
    switch (type) {
      case 'success': return 'border-l-success';
      case 'warning': return 'border-l-warning';
      case 'error': return 'border-l-destructive';
      default: return 'border-l-info';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Agora';
    if (diffInMinutes < 60) return `${diffInMinutes}m atrás`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  const handleMarkAsRead = (id: string) => {
    notificationService.markAsRead(id);
  };

  const handleMarkAllAsRead = () => {
    notificationService.markAllAsRead();
  };

  const handleDelete = (id: string) => {
    notificationService.deleteNotification(id);
  };

  if (!user) return null;

  return (
    <div className={cn("relative", className)}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {isOpen && (
        <Card className="absolute right-0 top-12 w-80 shadow-lg z-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Notificações</CardTitle>
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllAsRead}
                    className="text-xs h-7"
                  >
                    Marcar todas como lidas
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-7 w-7"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              <ScrollArea className="h-96">
                <div className="space-y-1">
                  {notifications.map((notification, index) => (
                    <div key={notification.id}>
                      <div
                        className={cn(
                          "p-3 border-l-2 hover:bg-muted/50 cursor-pointer transition-colors",
                          getTypeColor(notification.type),
                          !notification.read && "bg-muted/30"
                        )}
                        onClick={() => !notification.read && handleMarkAsRead(notification.id)}
                      >
                        <div className="flex items-start gap-3">
                          {getNotificationIcon(notification.type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className={cn(
                                "text-sm font-medium truncate",
                                !notification.read && "font-semibold"
                              )}>
                                {notification.title}
                              </h4>
                              <div className="flex gap-1 ml-2">
                                {!notification.read && (
                                  <div className="w-2 h-2 bg-primary rounded-full" />
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(notification.id);
                                  }}
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {formatTime(notification.timestamp)}
                              </span>
                              {notification.action && (
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    notification.action!.onClick();
                                  }}
                                >
                                  {notification.action.label}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      {index < notifications.length - 1 && <Separator />}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
