import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type EntityTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
};

export type EntityTableProps<T> = {
  columns: Array<EntityTableColumn<T>>;
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  emptyState?: ReactNode;
  className?: string;
  dense?: boolean;
};

export function EntityTable<T>({
  columns,
  rows,
  getRowKey,
  emptyState = "No records available.",
  className,
  dense = false,
}: EntityTableProps<T>) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800", className)}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead
                key={column.id}
                className={cn(
                  "bg-zinc-50/80 text-xs font-medium uppercase tracking-wide dark:bg-zinc-900/50",
                  dense ? "h-9 px-3 py-2" : "h-10 px-3 py-2",
                  column.headerClassName,
                )}
              >
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            rows.map((row, index) => (
              <TableRow key={getRowKey(row, index)}>
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={cn(dense ? "px-3 py-2.5 text-sm" : "px-3 py-3 text-sm", column.cellClassName)}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="py-10 text-center text-sm text-zinc-500">
                {emptyState}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
