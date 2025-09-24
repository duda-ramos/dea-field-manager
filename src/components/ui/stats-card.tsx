import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}

export function StatsCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  variant = "default",
  className 
}: StatsCardProps) {
  const variantStyles = {
    default: "border-border",
    success: "border-success/20 bg-success-light/50",
    warning: "border-warning/20 bg-warning-light/50", 
    danger: "border-destructive/20 bg-destructive/5"
  };

  const iconStyles = {
    default: "text-muted-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive"
  };

  return (
    <Card className={cn(
      "mobile-card transition-all duration-300 hover:shadow-md",
      variantStyles[variant],
      className
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 sm:pb-2">
        <CardTitle className="text-xs sm:text-sm font-medium truncate pr-2">{title}</CardTitle>
        {Icon && (
          <Icon className={cn("h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0", iconStyles[variant])} />
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-lg sm:text-2xl font-bold truncate">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground truncate mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}