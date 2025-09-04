import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

export function LoadingSpinner({ size = "md", className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6", 
    lg: "h-8 w-8"
  }

  return (
    <Loader2 
      className={cn(
        "animate-spin text-muted-foreground",
        sizeClasses[size],
        className
      )} 
    />
  )
}

interface LoadingStateProps {
  message?: string
  size?: "sm" | "md" | "lg"
  className?: string
}

export function LoadingState({ 
  message = "Carregando...", 
  size = "md", 
  className 
}: LoadingStateProps) {
  return (
    <div className={cn(
      "flex items-center justify-center gap-2 text-muted-foreground",
      className
    )}>
      <LoadingSpinner size={size} />
      <span className="text-sm">{message}</span>
    </div>
  )
}

export function PageLoadingState({ message }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingState 
        message={message || "Carregando página..."} 
        size="lg" 
      />
    </div>
  )
}

export function CardLoadingState({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <LoadingState 
        message={message || "Carregando dados..."} 
        size="md" 
      />
    </div>
  )
}