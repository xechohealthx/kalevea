"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type RemsClinicFiltersProps = {
  providerQuery: string;
  providerEnrollment: string;
  activityQuery: string;
  activityType: string;
  activityTypes: string[];
};

export function RemsClinicFilters({
  providerQuery,
  providerEnrollment,
  activityQuery,
  activityType,
  activityTypes,
}: RemsClinicFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [providerQueryValue, setProviderQueryValue] = React.useState(providerQuery);
  const [activityQueryValue, setActivityQueryValue] = React.useState(activityQuery);

  React.useEffect(() => {
    setProviderQueryValue(providerQuery);
  }, [providerQuery]);

  React.useEffect(() => {
    setActivityQueryValue(activityQuery);
  }, [activityQuery]);

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
          <Label htmlFor="clinic-provider-query">Search providers</Label>
          <Input
            id="clinic-provider-query"
            placeholder="Provider name"
            value={providerQueryValue}
            onChange={(event) => setProviderQueryValue(event.target.value)}
            onBlur={() => applyFilter({ pq: providerQueryValue })}
            onKeyDown={(event) => {
              if (event.key === "Enter") applyFilter({ pq: providerQueryValue });
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Provider enrollment</Label>
          <Select value={providerEnrollment} onValueChange={(value) => applyFilter({ pe: value })}>
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
          <Label htmlFor="clinic-activity-query">Search activity</Label>
          <Input
            id="clinic-activity-query"
            placeholder="Title or description"
            value={activityQueryValue}
            onChange={(event) => setActivityQueryValue(event.target.value)}
            onBlur={() => applyFilter({ aq: activityQueryValue })}
            onKeyDown={(event) => {
              if (event.key === "Enter") applyFilter({ aq: activityQueryValue });
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Activity type</Label>
          <Select value={activityType} onValueChange={(value) => applyFilter({ at: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {activityTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
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
            setProviderQueryValue("");
            setActivityQueryValue("");
            router.replace(pathname);
          }}
        >
          Reset filters
        </Button>
      </div>
    </div>
  );
}
