export const PayerRuleCategories = [
  "AUTHORIZATION",
  "REIMBURSEMENT",
  "DOCUMENTATION",
  "OPERATIONAL",
] as const;

export const PayerRuleConfidenceLevels = ["LOW", "MEDIUM", "HIGH"] as const;

export const PayerRuleSourceTypes = [
  "MANUAL",
  "AI_SUGGESTED",
  "POLICY_DOCUMENT",
  "CONTRACT",
] as const;

export const PayerRuleSuggestionStatuses = ["DRAFT", "APPROVED", "REJECTED"] as const;

export type PayerRuleCategory = (typeof PayerRuleCategories)[number];
export type PayerRuleConfidenceLevel = (typeof PayerRuleConfidenceLevels)[number];
export type PayerRuleSourceType = (typeof PayerRuleSourceTypes)[number];
export type PayerRuleSuggestionStatus = (typeof PayerRuleSuggestionStatuses)[number];
