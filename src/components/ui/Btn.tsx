interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export function Btn({ variant = 'primary', size = 'md', className = '', ...props }: BtnProps) {
  const base = 'rounded-lg font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed'
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm' }
  const variants = {
    primary: 'bg-[#CDA52F] text-white hover:bg-[#CDA52F]/85 hover:shadow-[0_0_12px_rgba(205,165,47,0.35)]',
    ghost:   'border border-white/10 text-white/70 hover:bg-white/5',
    danger:  'bg-[#FF5050]/10 text-[#FF5050] border border-[#FF5050]/20 hover:bg-[#FF5050]/20',
  }
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />
}
