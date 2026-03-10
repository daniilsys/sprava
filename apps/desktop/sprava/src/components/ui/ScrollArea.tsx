interface ScrollAreaProps {
  children: React.ReactNode;
  className?: string;
}

export function ScrollArea({ children, className = "" }: ScrollAreaProps) {
  return (
    <div className={`overflow-y-auto overflow-x-hidden ${className}`}>
      {children}
    </div>
  );
}
