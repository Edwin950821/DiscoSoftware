interface CardProps { children: React.ReactNode; className?: string; onClick?: () => void }

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div className={`bg-[#141414] border border-white/[0.07] rounded-xl p-4 ${className}`} onClick={onClick}>
      {children}
    </div>
  )
}
