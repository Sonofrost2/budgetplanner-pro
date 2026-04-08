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
  DrawerClose,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

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
}

export function ResponsiveFormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  progress,
}: ResponsiveFormDialogProps) {
  const isMobile = useIsMobile();

  const progressBar = typeof progress === 'number' ? (
    <div className="px-4 pt-2">
      <Progress value={progress} className="h-1 rounded-full [&>div]:bg-primary" />
    </div>
  ) : null;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={cn("max-h-[92vh]", className)}>
          {progressBar}
          <DrawerHeader className="text-left pb-1">
            <DrawerTitle className="text-xl font-bold">{title}</DrawerTitle>
            {description && <DrawerDescription className="text-xs">{description}</DrawerDescription>}
          </DrawerHeader>
          <div className="px-4 pb-2 overflow-y-auto flex-1 form-animate">
            {children}
          </div>
          {footer && (
            <DrawerFooter className="pt-2 pb-4">
              {footer}
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-xl md:max-w-2xl max-h-[85vh] flex flex-col", className)}>
        {progressBar}
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          {description && <DialogDescription className="text-xs">{description}</DialogDescription>}
        </DialogHeader>
        <div className="overflow-y-auto flex-1 pr-1 form-animate">
          {children}
        </div>
        {footer && (
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
