import { useEffect, useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode, MouseEvent } from 'react'
import { X, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from './Button'

interface DialogProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  draggable?: boolean
}

export function Dialog({ open, onClose, children, draggable = false }: DialogProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const contentRef = useRef<HTMLDivElement>(null)

  // Reset position when dialog opens
  useEffect(() => {
    if (open) {
      setPosition({ x: 0, y: 0 })
    }
  }, [open])

  const handleMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!draggable) return
    // Only allow dragging from the header
    const target = e.target as HTMLElement
    if (!target.closest('.drag-handle')) return

    setIsDragging(true)
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
    e.preventDefault()
  }, [draggable, position])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return

    const newX = e.clientX - dragStart.x
    const newY = e.clientY - dragStart.y

    setPosition({ x: newX, y: newY })
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove as any)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove as any)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    if (open) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
      // Prevent body scroll when dialog is open
      document.body.style.paddingRight = '0px'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      // Reset to empty string (reverts to CSS default)
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [open, onClose])

  if (!open) return null

  const contentStyle = draggable && (position.x !== 0 || position.y !== 0)
    ? { transform: `translate(${position.x}px, ${position.y}px)` }
    : undefined

  // Use Portal to render outside the sidebar/component hierarchy
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog content */}
      <div
        ref={contentRef}
        className="relative z-[99999] w-full max-w-lg mx-4"
        style={contentStyle}
        onMouseDown={handleMouseDown}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

interface DialogContentProps {
  children: ReactNode
  className?: string
}

export function DialogContent({ children, className }: DialogContentProps) {
  return (
    <div
      className={cn(
        'bg-card border border-border rounded-lg shadow-lg',
        className
      )}
      style={{ isolation: 'isolate' as any }}
    >
      {children}
    </div>
  )
}

interface DialogHeaderProps {
  children: ReactNode
  onClose?: () => void
  draggable?: boolean
}

export function DialogHeader({ children, onClose, draggable = false }: DialogHeaderProps) {
  return (
    <div className={cn(
      "flex items-center p-6 border-b border-border",
      draggable ? "justify-between cursor-move drag-handle" : "justify-between"
    )}>
      <div className="flex items-center gap-2 flex-1">
        {draggable && <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />}
        <div className="flex-1">
          {children}
        </div>
      </div>
      {onClose && (
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  )
}

interface DialogTitleProps {
  children: ReactNode
}

export function DialogTitle({ children }: DialogTitleProps) {
  return <h2 className="text-lg font-semibold text-gray-900 dark:text-[#e4e6eb]">{children}</h2>
}

interface DialogBodyProps {
  children: ReactNode
  className?: string
}

export function DialogBody({ children, className }: DialogBodyProps) {
  return <div className={cn('p-6', className)}>{children}</div>
}

interface DialogFooterProps {
  children: ReactNode
}

export function DialogFooter({ children }: DialogFooterProps) {
  return (
    <div className="flex items-center justify-end gap-2 p-6 border-t border-border">
      {children}
    </div>
  )
}
