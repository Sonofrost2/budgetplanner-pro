import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      // Glass surface — Coach Financier style
      "relative inline-flex items-center justify-center gap-1 p-1.5 rounded-2xl",
      "bg-card/50 backdrop-blur-xl border border-border/40",
      "shadow-[0_4px_24px_-8px_hsl(var(--primary)/0.08)]",
      "text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      // Base
      "relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap",
      "rounded-xl px-3.5 py-1.5 text-sm font-semibold tracking-tight",
      "ring-offset-background transition-all duration-300 ease-out",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50",
      // Inactive
      "text-muted-foreground hover:text-foreground hover:bg-muted/40",
      // Active — premium gradient pill with glow
      "data-[state=active]:text-primary-foreground",
      "data-[state=active]:bg-[var(--gradient-primary,linear-gradient(135deg,hsl(var(--primary)),hsl(var(--primary)/0.85)))]",
      "data-[state=active]:shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.45)]",
      "data-[state=active]:scale-[1.02]",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      // Soft fade-in when activated
      "data-[state=active]:animate-in data-[state=active]:fade-in-50 data-[state=active]:slide-in-from-bottom-1 data-[state=active]:duration-300",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
