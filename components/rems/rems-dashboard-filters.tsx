"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type RemsDashboardFiltersProps = {
  query: string;
  enrollment: string;
  readiness: string;
  expiration: string;
};

export function RemsDashboardFilters({
  query,
  enrollment,
  readiness,
  expiration,
}: RemsDashboardFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [queryValue, setQueryValue] = React.useState(query);

  React.useEffect(() => {
    setQueryValue(query);
  }, [query]);

  const applyFilter = React.useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        const trimmed = value.trim();
        if (!trimmed || trimmed === "all") {
          params.delete(key);
        } else {
          params.set(key, trimmed);
        }
      }
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname);
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5">
        <Label htmlFor="rems-query">Search clinic/provider</Label>
        <Input
          id="rems-query"
          placeholder="Clinic or provider"
          value={queryValue}
          onChange={(event) => setQueryValue(event.target.value)}
          onBlur={() => applyFilter({ q: queryValue })}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              applyFilter({ q: queryValue });
            }
          }}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Enrollment</Label>
        <Select value={enrollment} onValueChange={(value) => applyFilter({ enrollment: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="ENROLLED">Enrolled</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
            <SelectItem value="NOT_ENROLLED">Not enrolled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Readiness</Label>
        <Select value={readiness} onValueChange={(value) => applyFilter({ readiness: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="complete">Complete (100%)</SelectItem>
            <SelectItem value="watch">Watch (60-99%)</SelectItem>
            <SelectItem value="at-risk">At risk (&lt;60%)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Expiration</Label>
        <Select value={expiration} onValueChange={(value) => applyFilter({ expiration: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="upcoming">Upcoming (30d)</SelectItem>
            <SelectItem value="expired">Expired only</SelectItem>
          </SelectContent>
        </Select>
      </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setQueryValue("");
            router.replace(pathname);
          }}
        >
          Reset filters
        </Button>
      </div>
    </div>
  );
}
