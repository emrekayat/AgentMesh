import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-border-strong bg-card-elevated px-3 py-2 text-sm text-foreground placeholder:text-foreground-dim",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ens/40 focus-visible:border-ens/60",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-24 w-full rounded-md border border-border-strong bg-card-elevated px-3 py-2 text-sm text-foreground placeholder:text-foreground-dim",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ens/40 focus-visible:border-ens/60",
        "disabled:cursor-not-allowed disabled:opacity-50 resize-vertical",
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-xs font-medium uppercase tracking-wider text-foreground-muted",
      className
    )}
    {...props}
  />
));
Label.displayName = "Label";
