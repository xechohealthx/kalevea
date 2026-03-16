import { AppError } from "@/lib/utils";

type ParsedSegment = {
  tag: string;
  elements: string[];
};

export type ParsedEraPayment = {
  claimReference: string | null;
  payerClaimControlNumber: string | null;
  paidAmount: number;
  adjustmentAmount: number;
  cacCodes: string[];
};

export type ParsedEra835 = {
  payerName: string | null;
  paymentDate: Date | null;
  totalAmount: number;
  npi: string | null;
  taxId: string | null;
  payments: ParsedEraPayment[];
};

function parseNumber(input: string | undefined): number {
  if (!input) return 0;
  const normalized = input.trim();
  if (!normalized) return 0;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

function toDateYYYYMMDD(input: string | undefined): Date | null {
  if (!input || input.length !== 8) return null;
  const year = Number(input.slice(0, 4));
  const month = Number(input.slice(4, 6));
  const day = Number(input.slice(6, 8));
  if (!year || !month || !day) return null;
  const value = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(value.getTime()) ? null : value;
}

function splitSegments(content: string): ParsedSegment[] {
  return content
    .split("~")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((line) => {
      const fields = line.split("*");
      return { tag: fields[0] ?? "", elements: fields.slice(1) };
    });
}

export function parseEra835(content: string): ParsedEra835 {
  if (!content.trim()) {
    throw new AppError("ERA file content is empty", "VALIDATION_ERROR", 400);
  }

  const segments = splitSegments(content);
  const has835 = segments.some((s) => s.tag === "ST" && s.elements[0] === "835");
  if (!has835) {
    throw new AppError("Provided file is not a valid 835 transaction", "VALIDATION_ERROR", 400);
  }

  let payerName: string | null = null;
  let paymentDate: Date | null = null;
  let totalAmount = 0;
  let npi: string | null = null;
  let taxId: string | null = null;

  const payments: ParsedEraPayment[] = [];
  let currentPayment: ParsedEraPayment | null = null;

  for (const seg of segments) {
    if (seg.tag === "BPR") {
      totalAmount = parseNumber(seg.elements[1]);
      paymentDate = toDateYYYYMMDD(seg.elements[15]) ?? paymentDate;
      continue;
    }

    if (seg.tag === "N1" && seg.elements[0] === "PR") {
      payerName = seg.elements[1]?.trim() || payerName;
      continue;
    }

    if (seg.tag === "REF") {
      const qualifier = seg.elements[0];
      const value = seg.elements[1]?.trim() ?? "";
      if ((qualifier === "TJ" || qualifier === "EI") && !taxId) taxId = value || null;
      if ((qualifier === "0B" || qualifier === "XX") && !npi) npi = value || null;
      continue;
    }

    if (seg.tag === "CLP") {
      if (currentPayment) payments.push(currentPayment);
      const claimChargeAmount = parseNumber(seg.elements[2]);
      const claimPaidAmount = parseNumber(seg.elements[3]);
      currentPayment = {
        claimReference: seg.elements[0]?.trim() || null,
        payerClaimControlNumber: seg.elements[6]?.trim() || null,
        paidAmount: claimPaidAmount,
        adjustmentAmount: Math.max(0, claimChargeAmount - claimPaidAmount),
        cacCodes: [],
      };
      continue;
    }

    if (seg.tag === "CAS" && currentPayment) {
      // CAS format: CAS*<group>*<reason>*<amount>*...
      const reasonCode = seg.elements[1]?.trim();
      if (reasonCode) currentPayment.cacCodes.push(reasonCode);

      for (let i = 2; i < seg.elements.length; i += 3) {
        currentPayment.adjustmentAmount += parseNumber(seg.elements[i]);
      }
      continue;
    }
  }

  if (currentPayment) payments.push(currentPayment);

  return { payerName, paymentDate, totalAmount, npi, taxId, payments };
}
