interface AvatarProps {
  src?: string | null
  username?: string
  alt?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string
}

const sizeClasses = {
  xs: 'w-5 h-5 text-xs',
  sm: 'w-6 h-6 text-sm',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-12 h-12 text-base',
  '2xl': 'w-16 h-16 text-lg',
}

export default function Avatar({
  src,
  username = 'User',
  alt = username,
  size = 'md',
  className = '',
}: AvatarProps) {
  const sizeClass = sizeClasses[size]

  // Get first letter of username for fallback
  const fallbackLetter = username?.charAt(0)?.toUpperCase() || 'U'

  // Generate gradient colors based on username (consistent for same username)
  const getGradientColors = (name: string) => {
    const colors = [
      'from-blue-500 to-indigo-600',
      'from-purple-500 to-pink-600',
      'from-green-500 to-teal-600',
      'from-orange-500 to-red-600',
      'from-cyan-500 to-blue-600',
      'from-pink-500 to-rose-600',
      'from-violet-500 to-purple-600',
      'from-emerald-500 to-green-600',
    ]
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }

  const gradientClass = getGradientColors(username || fallbackLetter)

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 border-2 border-white shadow-sm ${className}`}
        onError={(e) => {
          // Fallback to initial if image fails to load
          e.currentTarget.src = ''
          // Force re-render as fallback
          e.currentTarget.style.display = 'none'
          const parent = e.currentTarget.parentElement
          if (parent) {
            const fallback = document.createElement('div')
            fallback.className = `${sizeClass} rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white font-semibold flex-shrink-0 border-2 border-white shadow-sm ${className}`
            fallback.textContent = fallbackLetter
            parent.appendChild(fallback)
          }
        }}
      />
    )
  }

  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white font-semibold flex-shrink-0 border-2 border-white shadow-sm ${className}`}>
      {fallbackLetter}
    </div>
  )
}
