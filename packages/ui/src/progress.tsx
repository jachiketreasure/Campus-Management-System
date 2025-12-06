import * as React from 'react';
import { cn } from './utils';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
}

export function Progress({ className, value = 0, max = 100, ...props }: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-[#e5ebff]',
        className
      )}
      {...props}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#142a5a] via-[#1b3978] to-[#254b9a] transition-all duration-500 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
