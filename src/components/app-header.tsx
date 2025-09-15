import { Search, Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { UserMenu } from "@/components/auth/UserMenu"
import { SyncStatusIndicator } from "@/components/sync-status-indicator"
import { NotificationSystem } from "@/components/notifications/NotificationSystem"
import { useTheme } from "@/providers/theme-provider"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function AppHeader() {
  const { theme, setTheme } = useTheme()

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
          <SyncStatusIndicator />
          
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