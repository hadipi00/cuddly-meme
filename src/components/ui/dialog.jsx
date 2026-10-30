import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef(({ className, ...props }, ref) => (
 <DialogPrimitive.Overlay
 ref={ref}
 className={cn(
 'fixed inset-0 z-[900] bg-[rgba(4,10,20,0.72)] backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
 className
 )}
 {...props}
 />
))
DialogOverlay.displayName = 'DialogOverlay'

const DialogContent = React.forwardRef(({ className, children, ...props }, ref) => (
 <DialogPortal>
 <DialogOverlay />
 <DialogPrimitive.Content
 ref={ref}
 className={cn(
 'fixed left-1/2 top-1/2 z-[901] grid w-[calc(100%-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl border border-border bg-surface p-6 shadow-[0_40px_90px_-20px_rgba(2,8,23,0.95)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
 className
 )}
 {...props}
 >
 {children}
 <DialogPrimitive.Close className="absolute left-4 top-4 rounded-lg p-1 opacity-70 transition-opacity hover:bg-secondary hover:opacity-100 focus:outline-none cursor-pointer">
 <X size={17} />
 <span className="sr-only">بستن</span>
 </DialogPrimitive.Close>
 </DialogPrimitive.Content>
 </DialogPortal>
))
DialogContent.displayName = 'DialogContent'

const DialogHeader = ({ className, ...props }) => (
 <div className={cn('flex flex-col gap-1.5 text-start', className)} {...props} />
)

const DialogTitle = React.forwardRef(({ className, ...props }, ref) => (
 <DialogPrimitive.Title ref={ref} className={cn('text-[16px] font-extrabold leading-relaxed', className)} {...props} />
))
DialogTitle.displayName = 'DialogTitle'

const DialogDescription = React.forwardRef(({ className, ...props }, ref) => (
 <DialogPrimitive.Description ref={ref} className={cn('text-[13px] text-muted-foreground', className)} {...props} />
))
DialogDescription.displayName = 'DialogDescription'

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogDescription }
