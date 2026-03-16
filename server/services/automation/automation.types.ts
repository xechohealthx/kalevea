export const AutomationRuleTypes = [
  "UNDERPAYMENT_ALERT",
  "PA_STUCK_ALERT",
  "PAYMENT_DELAY_ALERT",
  "DOCUMENTATION_MISSING",
] as const;

export const AutomationActionTypes = [
  "createOperationalAlert",
  "createTask",
  "notifyUser",
] as const;

export type AutomationRuleType = (typeof AutomationRuleTypes)[number];
export type AutomationActionType = (typeof AutomationActionTypes)[number];
