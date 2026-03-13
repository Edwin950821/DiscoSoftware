interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs text-white/45">{label}</label>}
      <input
        className={`bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white
          placeholder:text-white/20 focus:outline-none focus:border-[#CDA52F]/50 ${className}`}
        {...props}
      />
    </div>
  )
}
