// eduspark/lib/marketplace/service-status.ts
//
// Service lifecycle (the review gate):
//
//   create ──▶ PENDING_REVIEW ──approve (admin)──▶ ACTIVE ──pause──▶ PAUSED ──submit──▶ PENDING_REVIEW
//                    │                                                  ▲
//                    └──withdraw──▶ PAUSED   ◀──reject (admin, with note)┘
//
// A creator can NEVER move a service to ACTIVE, and can never touch an ARCHIVED one
// (archiving is an admin moderation action). The UI hides those buttons, but the UI is not a
// security boundary — this table is enforced on the server (actions/marketplace/update-service-status.ts).

export type ServiceStatusName = "ACTIVE" | "PAUSED" | "PENDING_REVIEW" | "ARCHIVED";

export const CREATOR_SERVICE_TRANSITIONS: Record<ServiceStatusName, ServiceStatusName[]> = {
  ACTIVE: ["PAUSED"],
  PAUSED: ["PENDING_REVIEW", "ARCHIVED"],
  PENDING_REVIEW: ["PAUSED"], // withdraw the submission
  ARCHIVED: [],
};

export function creatorMayMoveService(from: string, to: string): boolean {
  return (CREATOR_SERVICE_TRANSITIONS[from as ServiceStatusName] ?? []).includes(to as ServiceStatusName);
}
