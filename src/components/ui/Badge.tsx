interface BadgeProps { children: React.ReactNode; color?: string }

export function Badge({ children, color = '#CDA52F' }: BadgeProps) {
  return (
    <span
      className="text-xs font-bold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: color + '22', color }}
    >
      {children}
    </span>
  )
}
