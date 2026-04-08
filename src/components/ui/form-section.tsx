import * as React from "react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";

interface FormSectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

export function FormSection({
  title,
  icon,
  children,
  collapsible = false,
  defaultOpen = false,
  className,
}: FormSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  const headerContent = (
    <div className={cn(
      "flex items-center gap-2 py-2",
      collapsible && "cursor-pointer select-none hover:text-foreground transition-colors",
    )}>
      {collapsible && (
        <ChevronRight className={cn(
          "w-3.5 h-3.5 transition-transform duration-200 text-muted-foreground",
          open && "rotate-90"
        )} />
      )}
      {icon && <span className="text-primary">{icon}</span>}
      <span className="text-sm font-semibold text-muted-foreground">{title}</span>
    </div>
  );

  if (!collapsible) {
    return (
      <div className={cn("space-y-3", className)}>
        {headerContent}
        <div className="space-y-4 pl-1 border-l-2 border-primary/10 ml-1.5">
          <div className="pl-3 space-y-4">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger asChild>
        {headerContent}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-4 pl-1 border-l-2 border-primary/10 ml-1.5 pb-1 animate-in slide-in-from-top-1 duration-200">
          <div className="pl-3 space-y-4">{children}</div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
