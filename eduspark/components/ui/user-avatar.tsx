import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name: string;
  size?: number;
  className?: string;
}

export function UserAvatar({ name, size = 36, className }: UserAvatarProps) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
    
  // توليد لون ثابت بناءً على الاسم
  const hue = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center text-white font-bold ring-2 ring-slate-700 shrink-0 shadow-sm",
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `hsl(${hue}, 50%, 38%)`,
      }}
      title={name}
    >
      {initials}
    </div>
  );
}