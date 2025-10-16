import { Search, Moon, Sun, Wifi, WifiOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { UserMenu } from "@/components/auth/UserMenu"
import { Badge } from "@/components/ui/badge"
import { NotificationSystem } from "@/components/notifications/NotificationSystem"
import { useTheme } from "@/hooks/useThemeContext"
import { useState, useEffect } from "react"
import { syncStateManager, type SyncState } from "@/services/sync/syncState"
import { ConflictBadge } from "@/components/ConflictManager"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function AppHeader() {
  const { setTheme } = useTheme()
  const [syncState, setSyncState] = useState<SyncState>(syncStateManager.getState())
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const unsubscribe = syncStateManager.subscribe(setSyncState)
    
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      unsubscribe()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const getStatusBadge = () => {
    if (!isOnline) {
      return (
        <Badge variant="destructive" className="gap-1">
          <WifiOff className="h-3 w-3" />
          Offline {syncState.pendingPush > 0 && `- ${syncState.pendingPush} pendente${syncState.pendingPush > 1 ? 's' : ''}`}
        </Badge>
      )
    }

    if (syncState.status === 'syncing') {
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Sincronizando...
        </Badge>
      )
    }

    if (syncState.pendingPush > 0) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Wifi className="h-3 w-3" />
          {syncState.pendingPush} pendente{syncState.pendingPush > 1 ? 's' : ''}
        </Badge>
      )
    }

    return (
      <Badge variant="default" className="gap-1">
        <Wifi className="h-3 w-3" />
        Online
      </Badge>
    )
  }

  return (
    <header className="page-header sticky top-0 z-50 w-full h-14 px-4">
      <div className="flex h-full items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="h-7 w-7" />
          
          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar projetos, instalações..."
              className="w-64 pl-9 h-9"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getStatusBadge()}
          
          <ConflictBadge />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme("light")}>
                Claro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("dark")}>
                Escuro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme("system")}>
                Sistema
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <NotificationSystem />

          <UserMenu />
        </div>
      </div>
    </header>
  )
}