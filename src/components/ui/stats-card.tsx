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
      "transition-all duration-300 hover:shadow-md",
      variantStyles[variant],
      className
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:pb-2 sm:px-6 sm:pt-6">
        <div className="flex-1 min-w-0">
          <CardTitle className="text-xs sm:text-sm font-medium leading-tight mb-1 sm:mb-0 line-clamp-2">
            {title}
          </CardTitle>
          <div className="text-lg sm:text-2xl font-bold mt-1 sm:mt-2">
            {value}
          </div>
        </div>
        {Icon && (
          <Icon className={cn("h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 ml-2", iconStyles[variant])} />
        )}
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:px-6 sm:pb-6">
        {description && (
          <p className="text-xs text-muted-foreground truncate">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}