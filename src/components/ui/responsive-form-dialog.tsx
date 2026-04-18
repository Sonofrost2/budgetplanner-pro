import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Sparkles } from "lucide-react";

interface ResponsiveFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  /** Progress percentage (0-100) shown as a bar at the top */
  progress?: number;
  /** Optional emoji or short pill label rendered next to the title (e.g. "💰", "Coach") */
  badge?: React.ReactNode;
  /** Optional left icon rendered in a gradient bubble next to the title */
  icon?: React.ReactNode;
}

/**
 * Premium glassmorphism form dialog (Coach Financier design system).
 * - Glass surface with decorative gradient blob behind the header
 * - Brand pill (icon + title) for instant recognition
 * - Sticky elevated footer with hairline border
 * - Stagger animation on children via .form-animate
 * - Optional progress bar (0-100)
 */
export function ResponsiveFormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  progress,
  badge,
  icon,
}: ResponsiveFormDialogProps) {
  const isMobile = useIsMobile();

  const decorativeBlob = (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 w-64 h-64 rounded-full opacity-60 blur-3xl"
        style={{ background: "var(--gradient-primary)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-10 -left-10 w-40 h-40 rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--gradient-accent)" }}
      />
    </>
  );

  const titleBlock = (
    <div className="flex items-start gap-3">
      {icon ? (
        <div
          className="shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-white/20"
          style={{ background: "var(--gradient-primary)" }}
        >
          {icon}
        </div>
      ) : (
        <div
          className="shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 ring-1 ring-white/20"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Sparkles className="w-4 h-4" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg sm:text-xl font-bold font-display tracking-tight leading-tight">
            {title}
          </span>
          {badge && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {description}
          </p>
        )}
      </div>
    </div>
  );

  const progressBar =
    typeof progress === "number" ? (
      <div className="px-5 pt-3">
        <Progress
          value={progress}
          className="h-1 rounded-full bg-muted/50 [&>div]:bg-gradient-to-r [&>div]:from-primary [&>div]:to-secondary"
        />
      </div>
    ) : null;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className={cn(
            "max-h-[94vh] overflow-hidden border-t border-border/40 bg-background/95 backdrop-blur-2xl",
            className
          )}
        >
          <div className="relative">
            {decorativeBlob}
            {progressBar}
            <DrawerHeader className="text-left pb-2 relative">
              <DrawerTitle asChild>
                <div>{titleBlock}</div>
              </DrawerTitle>
              {description && (
                <DrawerDescription className="sr-only">
                  {description}
                </DrawerDescription>
              )}
            </DrawerHeader>
          </div>
          <div className="px-5 pb-3 overflow-y-auto flex-1 form-animate scroll-smooth-touch">
            {children}
          </div>
          {footer && (
            <DrawerFooter className="pt-3 pb-4 px-5 border-t border-border/40 bg-background/80 backdrop-blur-xl">
              <div className="flex items-center justify-end gap-2 w-full [&>*]:flex-1 sm:[&>*]:flex-none">
                {footer}
              </div>
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sm:max-w-xl md:max-w-2xl max-h-[88vh] flex flex-col p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-2xl shadow-2xl shadow-primary/10 rounded-3xl",
          className
        )}
      >
        <div className="relative">
          {decorativeBlob}
          {progressBar}
          <DialogHeader className="px-6 pt-5 pb-3 relative">
            <DialogTitle asChild>
              <div>{titleBlock}</div>
            </DialogTitle>
            {description && (
              <DialogDescription className="sr-only">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
        </div>
        <div className="overflow-y-auto flex-1 px-6 pb-2 form-animate">
          {children}
        </div>
        {footer && (
          <DialogFooter className="gap-2 sm:gap-2 px-6 py-4 border-t border-border/40 bg-background/80 backdrop-blur-xl">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
