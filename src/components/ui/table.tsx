import * as React from "react";
import { cn } from "@/lib/utils";

export function TableWrap({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("overflow-x-auto rounded-2xl border border-border bg-white shadow-soft", className)}>
      {children}
    </div>
  );
}

export function Table({
  className,
  children,
}: React.HTMLAttributes<HTMLTableElement>) {
  // border-separate + border-spacing-0: sticky TH bug'ını önler.
  // Borderlar TH/TD üzerindeki "border-b" sınıfları ile çiziliyor.
  return (
    <table className={cn("w-full border-separate border-spacing-0 text-sm", className)}>
      {children}
    </table>
  );
}

export function THead({ className, children }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn(className)}>{children}</thead>;
}

export function TH({
  className,
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "text-left px-4 py-3 text-text2 text-[11px] uppercase tracking-wider font-semibold whitespace-nowrap",
        "bg-bg2 border-b border-border",
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TBody({ className, children }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn(className)}>{children}</tbody>;
}

export function TR({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("hover:bg-bg2 transition-colors group last:[&_td]:border-b-0", className)}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TD({
  className,
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("px-4 py-3 border-b border-border text-text align-middle", className)}
      {...props}
    >
      {children}
    </td>
  );
}

export function Empty({ children, colSpan }: { children: React.ReactNode; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-12 text-center text-text3 text-sm">
        {children}
      </td>
    </tr>
  );
}
