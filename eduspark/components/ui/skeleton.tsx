// eduspark/components/ui/skeleton.tsx
import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "circle" | "text";
}

export function Skeleton({
  className,
  variant = "default",
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-slate-800/60",
        variant === "default" && "rounded-lg",
        variant === "circle" && "rounded-full",
        variant === "text" && "rounded h-4",
        className
      )}
      {...props}
    />
  );
}