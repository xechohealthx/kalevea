import type {
  RemsEnrollmentStatus,
  RemsRequirementType,
  RemsAppliesToType,
} from "@prisma/client";

export const RemsParentTypes = {
  clinicEnrollment: "REMS_CLINIC_ENROLLMENT",
  providerEnrollment: "REMS_PROVIDER_ENROLLMENT",
} as const;

export type RemsReadinessSummary = {
  totalRequirements: number;
  attestableRequirements: number;
  attestedRequirements: number;
  expiredEnrollments: number;
  upcomingExpirations30d: number;
};

export type RemsRequirementRow = {
  id: string;
  appliesToType: RemsAppliesToType;
  requirementType: RemsRequirementType;
  title: string;
  description: string | null;
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
};

export type ClinicRemsRow = {
  clinicId: string;
  clinicName: string;
  organizationId: string;
  remsProgramId: string;
  enrollmentId: string | null;
  status: RemsEnrollmentStatus | null;
  expiresAt: Date | null;
  clinicAttestedCount: number;
  clinicAttestableCount: number;
  providerAttestedCount: number;
  providerAttestableCount: number;
};

