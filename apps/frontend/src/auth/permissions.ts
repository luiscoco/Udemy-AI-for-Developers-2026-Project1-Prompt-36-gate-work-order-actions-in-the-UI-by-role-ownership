import type { User, WorkOrder, WorkOrderAction } from "@equipment-hub/contract";

// These mirror the authorization checks in apps/backend/src/routes/workOrders.ts so the UI
// only offers actions the backend will accept. The backend remains the source of truth:
// hiding a button is a convenience, and a stale UI can still receive a 403.

export function isSupervisorOrAdmin(user: User | null): boolean {
  return user?.role === "supervisor" || user?.role === "admin";
}

export function canAssignTechnician(user: User | null): boolean {
  return isSupervisorOrAdmin(user);
}

export function canPerformAction(user: User | null, action: WorkOrderAction, workOrder: WorkOrder): boolean {
  if (!user) {
    return false;
  }

  switch (action) {
    case "cancel":
      return isSupervisorOrAdmin(user);
    case "complete":
      return (
        isSupervisorOrAdmin(user) ||
        (user.role === "technician" && user.technicianId !== null && user.technicianId === workOrder.technicianId)
      );
    default:
      return true;
  }
}
