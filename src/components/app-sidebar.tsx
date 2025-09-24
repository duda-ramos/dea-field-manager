import { NavLink, useLocation } from "react-router-dom"
import {
  Home,
  FolderOpen,
  Users,
  Settings,
  BarChart3,
  Plus,
  Calendar,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navigationItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Projetos",
    url: "/projetos",
    icon: FolderOpen,
  },
  {
    title: "Agenda",
    url: "/agenda",
    icon: Calendar,
  },
  {
    title: "Contatos",
    url: "/contatos",
    icon: Users,
  },
  {
    title: "Relatórios",
    url: "/relatorios",
    icon: BarChart3,
  },
]

const supportItems = [
  {
    title: "Configurações",
    url: "/configuracoes",
    icon: Settings,
  },
]

export function AppSidebar() {
  const { open } = useSidebar()
  const location = useLocation()
  const currentPath = location.pathname

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/"
    }
    return currentPath.startsWith(path)
  }

  const getNavClasses = (path: string) => {
    return cn(
      "w-full justify-start transition-colors",
      isActive(path)
        ? "bg-accent text-accent-foreground font-medium"
        : "text-foreground hover:bg-accent hover:text-accent-foreground"
    )
  }

  return (
    <Sidebar className="border-r bg-background">
      <SidebarHeader className="border-b border-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FolderOpen className="h-4 w-4" />
          </div>
          {open && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold">DEA Manager</span>
              <span className="text-xs text-muted-foreground">Gestão de Projetos</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-xs font-medium text-muted-foreground">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-9">
                    <NavLink
                      to={item.url}
                      className={getNavClasses(item.url)}
                    >
                      <item.icon className="h-4 w-4" />
                      {open && <span className="ml-2">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-xs font-medium text-muted-foreground">
            Suporte
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {supportItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-9">
                    <NavLink
                      to={item.url}
                      className={getNavClasses(item.url)}
                    >
                      <item.icon className="h-4 w-4" />
                      {open && <span className="ml-2">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-2">
        {open && (
          <Button variant="outline" size="sm" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Novo Projeto
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}