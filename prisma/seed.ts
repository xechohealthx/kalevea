import "dotenv/config";

import { PrismaClient, RoleScope } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function upsertRole(key: string, name: string, scope: RoleScope) {
  return prisma.role.upsert({
    where: { key },
    update: { name, scope },
    create: { key, name, scope },
  });
}

async function main() {
  const roles = await Promise.all([
    // GLOBAL
    upsertRole("SUPER_ADMIN", "Super Admin", "GLOBAL"),
    upsertRole("MSO_EXECUTIVE", "MSO Executive", "GLOBAL"),
    // ORGANIZATION
    upsertRole("ORG_ADMIN", "Organization Admin", "ORGANIZATION"),
    upsertRole("IMPLEMENTATION_MANAGER", "Implementation Manager", "ORGANIZATION"),
    upsertRole("PA_SPECIALIST", "PA Specialist", "ORGANIZATION"),
    upsertRole("BILLING_SPECIALIST", "Billing Specialist", "ORGANIZATION"),
    upsertRole("COMPLIANCE_SPECIALIST", "Compliance Specialist", "ORGANIZATION"),
    upsertRole("SUPPORT_SPECIALIST", "Support Specialist", "ORGANIZATION"),
    upsertRole("ANALYST", "Analyst", "ORGANIZATION"),
    // CLINIC
    upsertRole("CLINIC_ADMIN", "Clinic Admin", "CLINIC"),
    upsertRole("PROVIDER", "Provider", "CLINIC"),
    upsertRole("BILLING_CONTACT", "Billing Contact", "CLINIC"),
    upsertRole("OPERATIONS_CONTACT", "Operations Contact", "CLINIC"),
    upsertRole("READ_ONLY", "Read Only", "CLINIC"),
  ]);

  const roleByKey = new Map(roles.map((r) => [r.key, r]));

  const kaleveaOrg = await prisma.organization.upsert({
    where: { slug: "kalevea" },
    update: { name: "Kalevea MSO", type: "MSO" },
    create: {
      name: "Kalevea MSO",
      slug: "kalevea",
      type: "MSO",
    },
  });

  const clinicsData = [
    {
      name: "Northside Primary Care",
      slug: slugify("northside-primary-care"),
      clinicType: "PRIMARY_CARE" as const,
      status: "ONBOARDING" as const,
      city: "Austin",
      state: "TX",
      timezone: "America/Chicago",
      email: "ops@northsideprimary.example",
      phone: "+1-512-555-0101",
    },
    {
      name: "Lakeshore Psychiatry",
      slug: slugify("lakeshore-psychiatry"),
      clinicType: "PSYCHIATRY" as const,
      status: "ACTIVE" as const,
      city: "Chicago",
      state: "IL",
      timezone: "America/Chicago",
      email: "admin@lakeshorepsych.example",
      phone: "+1-312-555-0131",
    },
    {
      name: "Riverside Hospital Outpatient",
      slug: slugify("riverside-hospital-outpatient"),
      clinicType: "HOSPITAL_OUTPATIENT" as const,
      status: "PROSPECT" as const,
      city: "Phoenix",
      state: "AZ",
      timezone: "America/Phoenix",
      email: "ops@riversideoutpatient.example",
      phone: "+1-602-555-0199",
    },
  ];

  const clinics = [];
  for (const c of clinicsData) {
    clinics.push(
      await prisma.clinic.upsert({
        where: {
          organizationId_slug: { organizationId: kaleveaOrg.id, slug: c.slug },
        },
        update: {
          name: c.name,
          clinicType: c.clinicType,
          status: c.status,
          city: c.city,
          state: c.state,
          timezone: c.timezone,
          email: c.email,
          phone: c.phone,
        },
        create: {
          organizationId: kaleveaOrg.id,
          name: c.name,
          slug: c.slug,
          clinicType: c.clinicType,
          status: c.status,
          city: c.city,
          state: c.state,
          timezone: c.timezone,
          email: c.email,
          phone: c.phone,
        },
      }),
    );
  }

  const [clinicPrimaryCare, clinicPsych, clinicHosp] = clinics;

  const demoPassword = "password";
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  const usersData = [
    {
      email: "superadmin@kalevea.local",
      firstName: "Kalevea",
      lastName: "SuperAdmin",
      globalRoles: ["SUPER_ADMIN"],
      orgRoles: ["ORG_ADMIN", "IMPLEMENTATION_MANAGER"],
    },
    {
      email: "exec@kalevea.local",
      firstName: "Morgan",
      lastName: "Executive",
      globalRoles: ["MSO_EXECUTIVE"],
      orgRoles: ["ANALYST"],
    },
    {
      email: "impl@kalevea.local",
      firstName: "Avery",
      lastName: "Implementation",
      globalRoles: [],
      orgRoles: ["IMPLEMENTATION_MANAGER"],
    },
    {
      email: "support@kalevea.local",
      firstName: "Casey",
      lastName: "Support",
      globalRoles: [],
      orgRoles: ["SUPPORT_SPECIALIST"],
    },
    {
      email: "billing@kalevea.local",
      firstName: "Jordan",
      lastName: "Billing",
      globalRoles: [],
      orgRoles: ["BILLING_SPECIALIST"],
    },
    {
      email: "compliance@kalevea.local",
      firstName: "Quinn",
      lastName: "Compliance",
      globalRoles: [],
      orgRoles: ["COMPLIANCE_SPECIALIST"],
    },
    {
      email: "clinicadmin@northside.local",
      firstName: "Taylor",
      lastName: "ClinicAdmin",
      clinicId: clinicPrimaryCare.id,
      clinicRoles: ["CLINIC_ADMIN", "OPERATIONS_CONTACT"],
    },
    {
      email: "provider@lakeshore.local",
      firstName: "Riley",
      lastName: "Provider",
      clinicId: clinicPsych.id,
      clinicRoles: ["PROVIDER"],
    },
    {
      email: "readonly@riverside.local",
      firstName: "Sam",
      lastName: "ReadOnly",
      clinicId: clinicHosp.id,
      clinicRoles: ["READ_ONLY"],
    },
  ] as const;

  const userByEmail = new Map<string, { id: string; email: string }>();

  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        firstName: u.firstName,
        lastName: u.lastName,
        isActive: true,
      },
      create: {
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        isActive: true,
      },
      select: { id: true, email: true },
    });

    userByEmail.set(user.email, user);

    await prisma.userCredential.upsert({
      where: { userId: user.id },
      update: { passwordHash },
      create: { userId: user.id, passwordHash },
    });

    const globalRoles = "globalRoles" in u ? u.globalRoles : [];
    const orgRoles = "orgRoles" in u ? u.orgRoles : [];
    const clinicRoles = "clinicRoles" in u ? u.clinicRoles : [];

    // GLOBAL roles are represented as org grants on Kalevea org for now,
    // and enforced at runtime by Role.scope === GLOBAL.
    // This keeps the schema minimal while enabling real RBAC checks.
    const allOrgRoleKeys = [...globalRoles, ...orgRoles];
    if (allOrgRoleKeys.length) {
      await prisma.userOrganizationRole.createMany({
        data: allOrgRoleKeys.map((key) => ({
          userId: user.id,
          organizationId: kaleveaOrg.id,
          roleId: roleByKey.get(key)!.id,
        })),
        skipDuplicates: true,
      });
    }

    if ("clinicId" in u && u.clinicId && clinicRoles.length) {
      await prisma.userClinicRole.createMany({
        data: clinicRoles.map((key) => ({
          userId: user.id,
          clinicId: u.clinicId!,
          roleId: roleByKey.get(key)!.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  // Providers
  const psychProvider = await prisma.provider.upsert({
    where: { id: "seed-provider-psych-1" },
    update: {},
    create: {
      id: "seed-provider-psych-1",
      clinicId: clinicPsych.id,
      firstName: "Alex",
      lastName: "Nguyen",
      credentials: "MD",
      specialty: "Psychiatry",
      npi: "1234567890",
      email: "alex.nguyen@lakeshorepsych.example",
      phone: "+1-312-555-0188",
      status: "ACTIVE",
    },
  });

  const primaryCareProvider = await prisma.provider.upsert({
    where: { id: "seed-provider-pcp-1" },
    update: {},
    create: {
      id: "seed-provider-pcp-1",
      clinicId: clinicPrimaryCare.id,
      firstName: "Jamie",
      lastName: "Patel",
      credentials: "NP",
      specialty: "Primary Care",
      npi: "9876543210",
      email: "jamie.patel@northsideprimary.example",
      phone: "+1-512-555-0112",
      status: "ACTIVE",
    },
  });

  // Staff profiles
  const northsideAdminUser = userByEmail.get("clinicadmin@northside.local")!;
  const northsideOps = await prisma.staffProfile.upsert({
    where: { id: "seed-staff-northside-1" },
    update: {},
    create: {
      id: "seed-staff-northside-1",
      clinicId: clinicPrimaryCare.id,
      userId: northsideAdminUser.id,
      firstName: "Taylor",
      lastName: "ClinicAdmin",
      title: "Clinic Operations Manager",
      email: "ops@northsideprimary.example",
      phone: "+1-512-555-0101",
      status: "ACTIVE",
    },
  });

  // Onboarding project + tasks for Northside (primary care)
  const implUser = userByEmail.get("impl@kalevea.local")!;
  const onboardingProject = await prisma.clinicOnboardingProject.upsert({
    where: { clinicId: clinicPrimaryCare.id },
    update: {
      status: "IN_PROGRESS",
      ownerUserId: implUser.id,
    },
    create: {
      clinicId: clinicPrimaryCare.id,
      status: "IN_PROGRESS",
      ownerUserId: implUser.id,
      targetGoLiveDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 21),
    },
  });

  const onboardingTasks = [
    {
      category: "LEGAL" as const,
      title: "Execute MSO services agreement",
      description: "Collect signatures and archive the executed agreement.",
      status: "IN_PROGRESS" as const,
      sortOrder: 10,
    },
    {
      category: "BILLING" as const,
      title: "Confirm buy & bill payer mix",
      description: "Gather payer list and billing contacts; validate claim submission expectations.",
      status: "TODO" as const,
      sortOrder: 20,
    },
    {
      category: "REMS" as const,
      title: "REMS enrollment checklist",
      description: "Ensure REMS training completion and documentation readiness.",
      status: "TODO" as const,
      sortOrder: 30,
    },
    {
      category: "TRAINING" as const,
      title: "Advanced therapy operations training (core)",
      description: "Assign initial training to clinic operations and providers.",
      status: "TODO" as const,
      sortOrder: 40,
    },
    {
      category: "TECHNICAL" as const,
      title: "Integrations readiness (EMR adjacencies)",
      description: "Confirm EMR points of contact, data exports, and secure comms pathways.",
      status: "BLOCKED" as const,
      sortOrder: 50,
    },
  ];

  await prisma.onboardingTask.deleteMany({ where: { projectId: onboardingProject.id } });
  await prisma.onboardingTask.createMany({
    data: onboardingTasks.map((t) => ({
      projectId: onboardingProject.id,
      category: t.category,
      title: t.title,
      description: t.description,
      status: t.status,
      assignedUserId: implUser.id,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * (t.sortOrder / 10)),
      sortOrder: t.sortOrder,
    })),
  });

  // Support tickets
  const supportUser = userByEmail.get("support@kalevea.local")!;
  const createdByUser = northsideAdminUser;

  const ticket1 = await prisma.supportTicket.create({
    data: {
      clinicId: clinicPrimaryCare.id,
      createdByUserId: createdByUser.id,
      category: "TRAINING",
      priority: "MEDIUM",
      status: "OPEN",
      subject: "Training access for new staff",
      description: "Need onboarding training assigned to newly hired MA and billing contact.",
      assignedToUserId: supportUser.id,
      comments: {
        create: [
          {
            userId: createdByUser.id,
            body: "Can we get our new staff assigned the core training modules?",
            isInternal: false,
          },
          {
            userId: supportUser.id,
            body: "Acknowledged. Please confirm staff names/emails; assigning now.",
            isInternal: true,
          },
        ],
      },
    },
  });

  await prisma.supportTicket.create({
    data: {
      clinicId: clinicPsych.id,
      createdByUserId: userByEmail.get("provider@lakeshore.local")!.id,
      category: "COMPLIANCE",
      priority: "HIGH",
      status: "IN_PROGRESS",
      subject: "REMS documentation template request",
      description: "Requesting standardized REMS documentation templates for clinic workflow.",
      assignedToUserId: supportUser.id,
      comments: {
        create: [
          {
            userId: supportUser.id,
            body: "Sharing the current templates and collecting feedback for iteration.",
            isInternal: false,
          },
        ],
      },
    },
  });

  // Training courses + lessons
  const courseOps = await prisma.trainingCourse.upsert({
    where: { slug: "spravato-ops-foundations" },
    update: {
      title: "Advanced Therapy Operations Foundations",
      isPublished: true,
      category: "Operations",
    },
    create: {
      title: "Advanced Therapy Operations Foundations",
      slug: "spravato-ops-foundations",
      description: "Core operating practices for advanced therapies service lines.",
      category: "Operations",
      isPublished: true,
      lessons: {
        create: [
          {
            title: "Program overview and responsibilities",
            sortOrder: 10,
            contentType: "TEXT",
            content:
              "This lesson outlines program roles, escalation paths, and operational accountability.",
          },
          {
            title: "Compliance posture: REMS + controlled inventory",
            sortOrder: 20,
            contentType: "TEXT",
            content:
              "Foundational compliance concepts. Do not store PHI in Kalevea; keep documents operational.",
          },
        ],
      },
    },
  });

  const courseBilling = await prisma.trainingCourse.upsert({
    where: { slug: "reimbursement-visibility-101" },
    update: { isPublished: true, category: "Billing" },
    create: {
      title: "Reimbursement Visibility 101",
      slug: "reimbursement-visibility-101",
      description: "Billing concepts that underpin reconciliation and underpayment detection.",
      category: "Billing",
      isPublished: true,
      lessons: {
        create: [
          {
            title: "Claim lifecycle and reconciliation mindset",
            sortOrder: 10,
            contentType: "TEXT",
            content:
              "A shared mental model for reimbursement workflows; future Claim Engine extension point.",
          },
        ],
      },
    },
  });

  // Assignments
  await prisma.trainingAssignment.createMany({
    data: [
      {
        clinicId: clinicPrimaryCare.id,
        staffProfileId: northsideOps.id,
        courseId: courseOps.id,
        status: "IN_PROGRESS",
        assignedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
      },
      {
        clinicId: clinicPrimaryCare.id,
        providerId: primaryCareProvider.id,
        courseId: courseOps.id,
        status: "NOT_STARTED",
      },
      {
        clinicId: clinicPsych.id,
        providerId: psychProvider.id,
        courseId: courseBilling.id,
        status: "COMPLETE",
        assignedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14),
        completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
      },
    ],
    skipDuplicates: true,
  });

  // Documents (metadata only; storageKey is a placeholder for future blob integration)
  await prisma.document.createMany({
    data: [
      {
        organizationId: kaleveaOrg.id,
        category: "CONTRACT",
        title: "MSO Master Services Agreement (Template)",
        storageKey: "seed/contracts/mso-master-services-agreement-template.pdf",
        mimeType: "application/pdf",
        fileSize: 245_120,
        uploadedByUserId: userByEmail.get("superadmin@kalevea.local")!.id,
      },
      {
        clinicId: clinicPrimaryCare.id,
        category: "ONBOARDING",
        title: "Northside onboarding checklist (v1)",
        storageKey: "seed/onboarding/northside-checklist-v1.pdf",
        mimeType: "application/pdf",
        fileSize: 128_000,
        uploadedByUserId: createdByUser.id,
      },
      {
        clinicId: clinicPsych.id,
        category: "TRAINING",
        title: "Staff training completion attestation",
        storageKey: "seed/training/lakeshore-attestation.pdf",
        mimeType: "application/pdf",
        fileSize: 64_000,
        uploadedByUserId: supportUser.id,
      },
      {
        clinicId: clinicPrimaryCare.id,
        category: "SUPPORT",
        title: `Ticket attachment - ${ticket1.subject}`,
        storageKey: `seed/support/${ticket1.id}/attachment.txt`,
        mimeType: "text/plain",
        fileSize: 2_048,
        uploadedByUserId: supportUser.id,
      },
    ],
    skipDuplicates: true,
  });

  const paCaseNorthside = await prisma.priorAuthorizationCase.upsert({
    where: { id: "seed-pa-case-1" },
    update: {
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      payerName: "BlueCross BlueShield",
      medicationName: "Esketamine",
      patientReferenceId: "PA-EXT-1001",
      status: "PENDING_PAYER",
      createdByUserId: implUser.id,
    },
    create: {
      id: "seed-pa-case-1",
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      payerName: "BlueCross BlueShield",
      medicationName: "Esketamine",
      patientReferenceId: "PA-EXT-1001",
      status: "PENDING_PAYER",
      createdByUserId: implUser.id,
    },
  });

  await prisma.priorAuthorizationCase.upsert({
    where: { id: "seed-pa-case-2" },
    update: {
      organizationId: kaleveaOrg.id,
      clinicId: clinicPsych.id,
      payerName: "UnitedHealthcare",
      medicationName: "Esketamine",
      patientReferenceId: "PA-EXT-1002",
      status: "APPROVED",
      createdByUserId: supportUser.id,
    },
    create: {
      id: "seed-pa-case-2",
      organizationId: kaleveaOrg.id,
      clinicId: clinicPsych.id,
      payerName: "UnitedHealthcare",
      medicationName: "Esketamine",
      patientReferenceId: "PA-EXT-1002",
      status: "APPROVED",
      createdByUserId: supportUser.id,
    },
  });

  await prisma.priorAuthorizationStatusEvent.upsert({
    where: { id: "seed-pa-status-1" },
    update: {
      fromStatus: null,
      toStatus: "DRAFT",
      note: "Case created",
      changedByUserId: implUser.id,
    },
    create: {
      id: "seed-pa-status-1",
      priorAuthorizationCaseId: paCaseNorthside.id,
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      fromStatus: null,
      toStatus: "DRAFT",
      note: "Case created",
      changedByUserId: implUser.id,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4),
    },
  });

  await prisma.priorAuthorizationStatusEvent.upsert({
    where: { id: "seed-pa-status-2" },
    update: {
      fromStatus: "DRAFT",
      toStatus: "SUBMITTED",
      note: "Submitted to payer",
      changedByUserId: implUser.id,
    },
    create: {
      id: "seed-pa-status-2",
      priorAuthorizationCaseId: paCaseNorthside.id,
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      fromStatus: "DRAFT",
      toStatus: "SUBMITTED",
      note: "Submitted to payer",
      changedByUserId: implUser.id,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    },
  });

  await prisma.priorAuthorizationStatusEvent.upsert({
    where: { id: "seed-pa-status-3" },
    update: {
      fromStatus: "SUBMITTED",
      toStatus: "PENDING_PAYER",
      note: "Awaiting payer review",
      changedByUserId: supportUser.id,
    },
    create: {
      id: "seed-pa-status-3",
      priorAuthorizationCaseId: paCaseNorthside.id,
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      fromStatus: "SUBMITTED",
      toStatus: "PENDING_PAYER",
      note: "Awaiting payer review",
      changedByUserId: supportUser.id,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    },
  });

  const seedOnboardingDoc = await prisma.document.findFirst({
    where: { clinicId: clinicPrimaryCare.id, category: "ONBOARDING" },
    select: { id: true },
  });
  if (seedOnboardingDoc) {
    await prisma.fileAttachment.upsert({
      where: { id: "seed-pa-attachment-1" },
      update: {
        organizationId: kaleveaOrg.id,
        clinicId: clinicPrimaryCare.id,
        parentType: "PRIOR_AUTH_CASE",
        parentId: paCaseNorthside.id,
        documentId: seedOnboardingDoc.id,
        createdById: implUser.id,
      },
      create: {
        id: "seed-pa-attachment-1",
        organizationId: kaleveaOrg.id,
        clinicId: clinicPrimaryCare.id,
        parentType: "PRIOR_AUTH_CASE",
        parentId: paCaseNorthside.id,
        documentId: seedOnboardingDoc.id,
        createdById: implUser.id,
      },
    });
  }

  const esketamineMedication = await prisma.medicationCatalogItem.upsert({
    where: { id: "seed-med-catalog-esketamine-1" },
    update: {
      organizationId: kaleveaOrg.id,
      name: "Esketamine 84mg Nasal Therapy Pack",
      brandName: "Spravato",
      genericName: "Esketamine",
      ndc: "50458-028-03",
      hcpcsCode: "J3490",
      isActive: true,
    },
    create: {
      id: "seed-med-catalog-esketamine-1",
      organizationId: kaleveaOrg.id,
      name: "Esketamine 84mg Nasal Therapy Pack",
      brandName: "Spravato",
      genericName: "Esketamine",
      ndc: "50458-028-03",
      hcpcsCode: "J3490",
      isActive: true,
    },
  });

  const northsideLot = await prisma.medicationLot.upsert({
    where: { id: "seed-med-lot-northside-1" },
    update: {
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      medicationCatalogItemId: esketamineMedication.id,
      lotNumber: "LOT-NORTH-0001",
      expirationDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180),
      quantityReceived: 24,
      quantityRemaining: 21,
      acquisitionDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12),
      supplierName: "Therapy Supply Partners",
      invoiceReference: "INV-NS-22041",
    },
    create: {
      id: "seed-med-lot-northside-1",
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      medicationCatalogItemId: esketamineMedication.id,
      lotNumber: "LOT-NORTH-0001",
      expirationDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 180),
      quantityReceived: 24,
      quantityRemaining: 21,
      acquisitionDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12),
      supplierName: "Therapy Supply Partners",
      invoiceReference: "INV-NS-22041",
    },
  });

  const buyAndBillCaseNorthside = await prisma.buyAndBillCase.upsert({
    where: { id: "seed-bnb-case-1" },
    update: {
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      patientReferenceId: "BNB-EXT-2001",
      medicationCatalogItemId: esketamineMedication.id,
      priorAuthorizationCaseId: paCaseNorthside.id,
      status: "ADMINISTERED",
      expectedReimbursementAmount: "1450.00",
      expectedPayerName: "BlueCross BlueShield",
      createdByUserId: implUser.id,
    },
    create: {
      id: "seed-bnb-case-1",
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      patientReferenceId: "BNB-EXT-2001",
      medicationCatalogItemId: esketamineMedication.id,
      priorAuthorizationCaseId: paCaseNorthside.id,
      status: "ADMINISTERED",
      expectedReimbursementAmount: "1450.00",
      expectedPayerName: "BlueCross BlueShield",
      createdByUserId: implUser.id,
    },
  });

  await prisma.buyAndBillStatusEvent.upsert({
    where: { id: "seed-bnb-status-1" },
    update: {
      toStatus: "DRAFT",
      note: "Case created",
      changedByUserId: implUser.id,
    },
    create: {
      id: "seed-bnb-status-1",
      buyAndBillCaseId: buyAndBillCaseNorthside.id,
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      fromStatus: null,
      toStatus: "DRAFT",
      changedByUserId: implUser.id,
      changedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6),
      note: "Case created",
    },
  });

  await prisma.buyAndBillStatusEvent.upsert({
    where: { id: "seed-bnb-status-2" },
    update: {
      fromStatus: "DRAFT",
      toStatus: "READY_FOR_ADMINISTRATION",
      note: "Ready after intake checks",
      changedByUserId: implUser.id,
    },
    create: {
      id: "seed-bnb-status-2",
      buyAndBillCaseId: buyAndBillCaseNorthside.id,
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      fromStatus: "DRAFT",
      toStatus: "READY_FOR_ADMINISTRATION",
      changedByUserId: implUser.id,
      changedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
      note: "Ready after intake checks",
    },
  });

  await prisma.buyAndBillStatusEvent.upsert({
    where: { id: "seed-bnb-status-3" },
    update: {
      fromStatus: "READY_FOR_ADMINISTRATION",
      toStatus: "ADMINISTERED",
      note: "Dose administration complete",
      changedByUserId: northsideAdminUser.id,
    },
    create: {
      id: "seed-bnb-status-3",
      buyAndBillCaseId: buyAndBillCaseNorthside.id,
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      fromStatus: "READY_FOR_ADMINISTRATION",
      toStatus: "ADMINISTERED",
      changedByUserId: northsideAdminUser.id,
      changedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4),
      note: "Dose administration complete",
    },
  });

  await prisma.medicationAdministrationEvent.upsert({
    where: { id: "seed-bnb-admin-1" },
    update: {
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      buyAndBillCaseId: buyAndBillCaseNorthside.id,
      medicationLotId: northsideLot.id,
      administeredAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4),
      administeredByUserId: northsideAdminUser.id,
      unitsAdministered: 3,
      notes: "Seed administration for buy-and-bill timeline.",
    },
    create: {
      id: "seed-bnb-admin-1",
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      buyAndBillCaseId: buyAndBillCaseNorthside.id,
      medicationLotId: northsideLot.id,
      administeredAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4),
      administeredByUserId: northsideAdminUser.id,
      unitsAdministered: 3,
      notes: "Seed administration for buy-and-bill timeline.",
    },
  });

  if (seedOnboardingDoc) {
    await prisma.fileAttachment.upsert({
      where: { id: "seed-bnb-attachment-case-1" },
      update: {
        organizationId: kaleveaOrg.id,
        clinicId: clinicPrimaryCare.id,
        parentType: "BUY_AND_BILL_CASE",
        parentId: buyAndBillCaseNorthside.id,
        documentId: seedOnboardingDoc.id,
        createdById: implUser.id,
      },
      create: {
        id: "seed-bnb-attachment-case-1",
        organizationId: kaleveaOrg.id,
        clinicId: clinicPrimaryCare.id,
        parentType: "BUY_AND_BILL_CASE",
        parentId: buyAndBillCaseNorthside.id,
        documentId: seedOnboardingDoc.id,
        createdById: implUser.id,
      },
    });
  }

  const reimbursementCaseNorthside = await prisma.reimbursementCase.upsert({
    where: { id: "seed-reimbursement-case-1" },
    update: {
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      buyAndBillCaseId: buyAndBillCaseNorthside.id,
      priorAuthorizationCaseId: paCaseNorthside.id,
      patientReferenceId: "RMB-EXT-3001",
      payerName: "BlueCross BlueShield",
      expectedAmount: "1450.00",
      expectedAllowedAmount: "1325.00",
      status: "PARTIALLY_PAID",
      createdByUserId: implUser.id,
    },
    create: {
      id: "seed-reimbursement-case-1",
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      buyAndBillCaseId: buyAndBillCaseNorthside.id,
      priorAuthorizationCaseId: paCaseNorthside.id,
      patientReferenceId: "RMB-EXT-3001",
      payerName: "BlueCross BlueShield",
      expectedAmount: "1450.00",
      expectedAllowedAmount: "1325.00",
      status: "PARTIALLY_PAID",
      createdByUserId: implUser.id,
    },
  });

  const reimbursementClaimNorthside = await prisma.claimRecord.upsert({
    where: { id: "seed-reimbursement-claim-1" },
    update: {
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      reimbursementCaseId: reimbursementCaseNorthside.id,
      externalClaimId: "EXT-CLM-3001",
      claimNumber: "CLM-3001",
      payerName: "BlueCross BlueShield",
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      status: "PENDING",
      billedAmount: "1450.00",
      statusChangedByUserId: supportUser.id,
      notes: "Seed claim record for reimbursement visibility demo.",
    },
    create: {
      id: "seed-reimbursement-claim-1",
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      reimbursementCaseId: reimbursementCaseNorthside.id,
      externalClaimId: "EXT-CLM-3001",
      claimNumber: "CLM-3001",
      payerName: "BlueCross BlueShield",
      submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      status: "PENDING",
      billedAmount: "1450.00",
      statusChangedByUserId: supportUser.id,
      notes: "Seed claim record for reimbursement visibility demo.",
    },
  });

  await prisma.paymentRecord.upsert({
    where: { id: "seed-reimbursement-payment-1" },
    update: {
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      reimbursementCaseId: reimbursementCaseNorthside.id,
      claimRecordId: reimbursementClaimNorthside.id,
      paidAmount: "1000.00",
      paidDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
      sourceType: "MANUAL",
      referenceNumber: "PMT-3001",
      notes: "Seed partial payment for variance starter surface.",
    },
    create: {
      id: "seed-reimbursement-payment-1",
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      reimbursementCaseId: reimbursementCaseNorthside.id,
      claimRecordId: reimbursementClaimNorthside.id,
      paidAmount: "1000.00",
      paidDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
      sourceType: "MANUAL",
      referenceNumber: "PMT-3001",
      notes: "Seed partial payment for variance starter surface.",
    },
  });

  await prisma.reimbursementStatusEvent.upsert({
    where: { id: "seed-reimbursement-status-1" },
    update: {
      fromStatus: null,
      toStatus: "EXPECTED",
      changedByUserId: implUser.id,
      note: "Reimbursement case created",
    },
    create: {
      id: "seed-reimbursement-status-1",
      reimbursementCaseId: reimbursementCaseNorthside.id,
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      fromStatus: null,
      toStatus: "EXPECTED",
      changedByUserId: implUser.id,
      changedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
      note: "Reimbursement case created",
    },
  });

  await prisma.reimbursementStatusEvent.upsert({
    where: { id: "seed-reimbursement-status-2" },
    update: {
      fromStatus: "EXPECTED",
      toStatus: "SUBMITTED",
      changedByUserId: supportUser.id,
      note: "Claim submitted",
    },
    create: {
      id: "seed-reimbursement-status-2",
      reimbursementCaseId: reimbursementCaseNorthside.id,
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      fromStatus: "EXPECTED",
      toStatus: "SUBMITTED",
      changedByUserId: supportUser.id,
      changedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      note: "Claim submitted",
    },
  });

  await prisma.reimbursementStatusEvent.upsert({
    where: { id: "seed-reimbursement-status-3" },
    update: {
      fromStatus: "SUBMITTED",
      toStatus: "PARTIALLY_PAID",
      changedByUserId: supportUser.id,
      note: "Partial payment posted",
    },
    create: {
      id: "seed-reimbursement-status-3",
      reimbursementCaseId: reimbursementCaseNorthside.id,
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      fromStatus: "SUBMITTED",
      toStatus: "PARTIALLY_PAID",
      changedByUserId: supportUser.id,
      changedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
      note: "Partial payment posted",
    },
  });

  if (seedOnboardingDoc) {
    await prisma.fileAttachment.upsert({
      where: { id: "seed-reimbursement-attachment-case-1" },
      update: {
        organizationId: kaleveaOrg.id,
        clinicId: clinicPrimaryCare.id,
        parentType: "REIMBURSEMENT_CASE",
        parentId: reimbursementCaseNorthside.id,
        documentId: seedOnboardingDoc.id,
        createdById: implUser.id,
      },
      create: {
        id: "seed-reimbursement-attachment-case-1",
        organizationId: kaleveaOrg.id,
        clinicId: clinicPrimaryCare.id,
        parentType: "REIMBURSEMENT_CASE",
        parentId: reimbursementCaseNorthside.id,
        documentId: seedOnboardingDoc.id,
        createdById: implUser.id,
      },
    });
  }

  // REMS MVP seed (engine module 1)
  const remsProgram = await prisma.remsProgram.upsert({
    where: { key: "esketamine" },
    update: {
      name: "Esketamine REMS",
      description: "Operational compliance scaffolding for the esketamine REMS program.",
      isActive: true,
    },
    create: {
      key: "esketamine",
      name: "Esketamine REMS",
      description: "Operational compliance scaffolding for the esketamine REMS program.",
      isActive: true,
    },
  });

  const clinicReqAttest = await prisma.remsRequirement.upsert({
    where: { id: "seed-rems-req-clinic-attest-1" },
    update: {
      title: "Clinic REMS enrollment verified",
      requirementType: "ATTESTATION",
      appliesToType: "CLINIC",
      isRequired: true,
      sortOrder: 10,
      isActive: true,
    },
    create: {
      id: "seed-rems-req-clinic-attest-1",
      organizationId: kaleveaOrg.id,
      clinicId: null,
      remsProgramId: remsProgram.id,
      appliesToType: "CLINIC",
      title: "Clinic REMS enrollment verified",
      description: "Clinic confirms enrollment completion and readiness to operate the program.",
      requirementType: "ATTESTATION",
      isRequired: true,
      sortOrder: 10,
      isActive: true,
    },
  });

  await prisma.remsRequirement.upsert({
    where: { id: "seed-rems-req-clinic-doc-1" },
    update: {
      title: "REMS enrollment documentation uploaded",
      requirementType: "DOCUMENT",
      appliesToType: "CLINIC",
      isRequired: true,
      sortOrder: 20,
      isActive: true,
    },
    create: {
      id: "seed-rems-req-clinic-doc-1",
      organizationId: kaleveaOrg.id,
      clinicId: null,
      remsProgramId: remsProgram.id,
      appliesToType: "CLINIC",
      title: "REMS enrollment documentation uploaded",
      description: "Operational documentation is uploaded to Kalevea (metadata + attachment in MVP).",
      requirementType: "DOCUMENT",
      isRequired: true,
      sortOrder: 20,
      isActive: true,
    },
  });

  const providerReqAttest = await prisma.remsRequirement.upsert({
    where: { id: "seed-rems-req-provider-attest-1" },
    update: {
      title: "Provider REMS training attested",
      requirementType: "ATTESTATION",
      appliesToType: "PROVIDER",
      isRequired: true,
      sortOrder: 10,
      isActive: true,
    },
    create: {
      id: "seed-rems-req-provider-attest-1",
      organizationId: kaleveaOrg.id,
      clinicId: null,
      remsProgramId: remsProgram.id,
      appliesToType: "PROVIDER",
      title: "Provider REMS training attested",
      description: "Provider acknowledges REMS training completion (operational attestation; no PHI).",
      requirementType: "ATTESTATION",
      isRequired: true,
      sortOrder: 10,
      isActive: true,
    },
  });

  const complianceUser = userByEmail.get("compliance@kalevea.local")!;

  const northsideClinicEnrollment = await prisma.clinicRemsEnrollment.upsert({
    where: { clinicId_remsProgramId: { clinicId: clinicPrimaryCare.id, remsProgramId: remsProgram.id } },
    update: {
      status: "ENROLLED",
      enrolledAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
      lastReviewedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
      notes: "Seeded enrollment for demo readiness views.",
      updatedById: complianceUser.id,
    },
    create: {
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      remsProgramId: remsProgram.id,
      status: "ENROLLED",
      enrolledAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
      lastReviewedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
      notes: "Seeded enrollment for demo readiness views.",
      createdById: complianceUser.id,
      updatedById: complianceUser.id,
    },
  });

  await prisma.clinicRemsEnrollment.upsert({
    where: { clinicId_remsProgramId: { clinicId: clinicPsych.id, remsProgramId: remsProgram.id } },
    update: {
      status: "ENROLLED",
      enrolledAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120),
      updatedById: complianceUser.id,
    },
    create: {
      organizationId: kaleveaOrg.id,
      clinicId: clinicPsych.id,
      remsProgramId: remsProgram.id,
      status: "ENROLLED",
      enrolledAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 120),
      createdById: complianceUser.id,
      updatedById: complianceUser.id,
    },
  });

  await prisma.clinicRemsEnrollment.upsert({
    where: { clinicId_remsProgramId: { clinicId: clinicHosp.id, remsProgramId: remsProgram.id } },
    update: {
      status: "PENDING",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      updatedById: complianceUser.id,
    },
    create: {
      organizationId: kaleveaOrg.id,
      clinicId: clinicHosp.id,
      remsProgramId: remsProgram.id,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      createdById: complianceUser.id,
      updatedById: complianceUser.id,
    },
  });

  const jamieEnrollment = await prisma.providerRemsEnrollment.upsert({
    where: { providerId_remsProgramId: { providerId: primaryCareProvider.id, remsProgramId: remsProgram.id } },
    update: {
      status: "ENROLLED",
      enrolledAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
      updatedById: complianceUser.id,
    },
    create: {
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      providerId: primaryCareProvider.id,
      remsProgramId: remsProgram.id,
      status: "ENROLLED",
      enrolledAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 10),
      createdById: complianceUser.id,
      updatedById: complianceUser.id,
    },
  });

  await prisma.providerRemsEnrollment.upsert({
    where: { providerId_remsProgramId: { providerId: psychProvider.id, remsProgramId: remsProgram.id } },
    update: {
      status: "ENROLLED",
      enrolledAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45),
      updatedById: complianceUser.id,
    },
    create: {
      organizationId: kaleveaOrg.id,
      clinicId: clinicPsych.id,
      providerId: psychProvider.id,
      remsProgramId: remsProgram.id,
      status: "ENROLLED",
      enrolledAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45),
      createdById: complianceUser.id,
      updatedById: complianceUser.id,
    },
  });

  await prisma.remsAttestation.upsert({
    where: { id: "seed-rems-attestation-clinic-1" },
    update: {},
    create: {
      id: "seed-rems-attestation-clinic-1",
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      remsProgramId: remsProgram.id,
      remsRequirementId: clinicReqAttest.id,
      clinicRemsEnrollmentId: northsideClinicEnrollment.id,
      title: "Clinic REMS enrollment verified",
      attestedById: implUser.id,
      attestedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
      notes: "Seeded attestation for demo readiness rollups.",
    },
  });

  await prisma.remsAttestation.upsert({
    where: { id: "seed-rems-attestation-provider-1" },
    update: {},
    create: {
      id: "seed-rems-attestation-provider-1",
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      remsProgramId: remsProgram.id,
      remsRequirementId: providerReqAttest.id,
      providerId: primaryCareProvider.id,
      providerRemsEnrollmentId: jamieEnrollment.id,
      title: "Provider REMS training attested",
      attestedById: northsideAdminUser.id,
      attestedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
      notes: "Seeded provider attestation for demo compliance snapshot.",
    },
  });

  await prisma.activityEvent.upsert({
    where: { id: "seed-activity-rems-clinic-enrollment-1" },
    update: {
      title: "Seeded REMS enrollment",
      description: "Initialized clinic REMS enrollment for demo.",
    },
    create: {
      id: "seed-activity-rems-clinic-enrollment-1",
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      parentType: "REMS_CLINIC_ENROLLMENT",
      parentId: northsideClinicEnrollment.id,
      type: "SEED",
      title: "Seeded REMS enrollment",
      description: "Initialized clinic REMS enrollment for demo.",
      createdById: complianceUser.id,
    },
  });

  await prisma.statusEvent.upsert({
    where: { id: "seed-status-rems-clinic-enrollment-1" },
    update: { toStatus: "ENROLLED" },
    create: {
      id: "seed-status-rems-clinic-enrollment-1",
      organizationId: kaleveaOrg.id,
      clinicId: clinicPrimaryCare.id,
      parentType: "REMS_CLINIC_ENROLLMENT",
      parentId: northsideClinicEnrollment.id,
      fromStatus: null,
      toStatus: "ENROLLED",
      note: "Seeded for demo.",
      changedById: complianceUser.id,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12),
    },
  });

  // Minimal audit entries to validate the pipeline
  await prisma.auditLog.createMany({
    data: [
      {
        organizationId: kaleveaOrg.id,
        actorUserId: userByEmail.get("superadmin@kalevea.local")!.id,
        action: "SEED",
        entityType: "Organization",
        entityId: kaleveaOrg.id,
        metadata: { note: "Seeded Kalevea MSO org" },
      },
      {
        clinicId: clinicPrimaryCare.id,
        actorUserId: implUser.id,
        action: "SEED",
        entityType: "ClinicOnboardingProject",
        entityId: onboardingProject.id,
        metadata: { note: "Seeded onboarding project and tasks" },
      },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

