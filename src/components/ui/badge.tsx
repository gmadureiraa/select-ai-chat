import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // Status-specific colored badges
        idea: "border-transparent bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
        draft: "border-transparent bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
        review: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
        approved: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        scheduled: "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
        published: "border-transparent bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        failed: "border-transparent bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
        pending: "border-transparent bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
        active: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        inactive: "border-transparent bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
