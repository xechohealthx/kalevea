"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type RemsProviderFiltersProps = {
  requirementQuery: string;
  requirementType: string;
  requiredFlag: string;
  activeFlag: string;
  activityQuery: string;
  activityType: string;
  requirementTypes: string[];
  activityTypes: string[];
};

export function RemsProviderFilters({
  requirementQuery,
  requirementType,
  requiredFlag,
  activeFlag,
  activityQuery,
  activityType,
  requirementTypes,
  activityTypes,
}: RemsProviderFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [requirementQueryValue, setRequirementQueryValue] = React.useState(requirementQuery);
  const [activityQueryValue, setActivityQueryValue] = React.useState(activityQuery);

  React.useEffect(() => {
    setRequirementQueryValue(requirementQuery);
  }, [requirementQuery]);

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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="provider-requirement-query">Search requirements</Label>
          <Input
            id="provider-requirement-query"
            placeholder="Requirement title"
            value={requirementQueryValue}
            onChange={(event) => setRequirementQueryValue(event.target.value)}
            onBlur={() => applyFilter({ rq: requirementQueryValue })}
            onKeyDown={(event) => {
              if (event.key === "Enter") applyFilter({ rq: requirementQueryValue });
            }}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Requirement type</Label>
          <Select value={requirementType} onValueChange={(value) => applyFilter({ rt: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {requirementTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Required</Label>
          <Select value={requiredFlag} onValueChange={(value) => applyFilter({ rr: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="required">Required</SelectItem>
              <SelectItem value="optional">Optional</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Active</Label>
          <Select value={activeFlag} onValueChange={(value) => applyFilter({ ra: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="provider-activity-query">Search activity</Label>
          <Input
            id="provider-activity-query"
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
            setRequirementQueryValue("");
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
