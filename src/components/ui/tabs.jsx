import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../../lib/utils'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
 <TabsPrimitive.List
 ref={ref}
 className={cn('inline-flex h-11 items-center justify-center rounded-xl border border-border bg-[rgba(148,163,184,0.05)] p-1 text-muted-foreground', className)}
 {...props}
 />
))
TabsList.displayName = 'TabsList'

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
 <TabsPrimitive.Trigger
 ref={ref}
 className={cn(
 'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-1.5 text-[13.5px] font-bold transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[rgba(45,212,191,0.14)] data-[state=active]:text-[var(--teal)] cursor-pointer',
 className
 )}
 {...props}
 />
))
TabsTrigger.displayName = 'TabsTrigger'

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
 <TabsPrimitive.Content
 ref={ref}
 className={cn('mt-4 focus-visible:outline-none', className)}
 {...props}
 />
))
TabsContent.displayName = 'TabsContent'

export { Tabs, TabsList, TabsTrigger, TabsContent }
