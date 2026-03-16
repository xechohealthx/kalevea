import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      activeOrganizationId?: string | null;
      activeClinicId?: string | null;
      roleSummary: {
        globalRoles: string[];
        organizationRoleCount: number;
        clinicRoleCount: number;
      };
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    email?: string;
    name?: string;
    activeOrganizationId?: string;
    activeClinicId?: string;
    roleSummary?: {
      globalRoles: string[];
      organizationRoleCount: number;
      clinicRoleCount: number;
    };
  }
}

