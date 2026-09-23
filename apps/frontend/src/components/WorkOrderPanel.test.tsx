import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Asset, Technician, User, WorkOrder, WorkOrderState } from "@equipment-hub/contract";
import WorkOrderPanel from "./WorkOrderPanel";

const assets: Asset[] = [{ id: "asset-1", tag: "PUMP-01", name: "Feed Pump", location: "Building A" }];

const technicians: Technician[] = [
  { id: "tech-1", name: "Jamie Rivera", specialty: "Mechanical" },
  { id: "tech-2", name: "Alex Chen", specialty: "Electrical" },
];

const supervisor: User = {
  id: "user-1",
  email: "sam@equipment-hub.test",
  name: "Sam Supervisor",
  role: "supervisor",
  technicianId: null,
};

const technicianUser: User = {
  id: "user-2",
  email: "jamie@equipment-hub.test",
  name: "Jamie Rivera",
  role: "technician",
  technicianId: "tech-1",
};

function workOrderIn(state: WorkOrderState, technicianId: string | null): WorkOrder {
  return {
    id: "wo-1",
    reference: "WO-2026-0001",
    assetId: "asset-1",
    title: "Pump leaking",
    description: "Visible leak near seal",
    priority: "high",
    state,
    technicianId,
    reportedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function renderPanel(workOrder: WorkOrder, currentUser: User) {
  return render(
    <WorkOrderPanel
      workOrder={workOrder}
      assets={assets}
      technicians={technicians}
      currentUser={currentUser}
      busy={false}
      onAssign={vi.fn()}
      onAction={vi.fn()}
    />,
  );
}

function queryButton(name: string) {
  return screen.queryByRole("button", { name });
}

describe("WorkOrderPanel authorization", () => {
  it("hides Complete, Cancel, and Assign from a technician viewing someone else's work order", () => {
    const { unmount } = renderPanel(workOrderIn("in_progress", "tech-2"), technicianUser);

    expect(queryButton("Complete")).not.toBeInTheDocument();
    expect(queryButton("Assign")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Technician")).not.toBeInTheDocument();
    unmount();

    renderPanel(workOrderIn("scheduled", "tech-2"), technicianUser);

    expect(queryButton("Start")).toBeInTheDocument();
    expect(queryButton("Cancel")).not.toBeInTheDocument();
    expect(queryButton("Assign")).not.toBeInTheDocument();
  });

  it("shows Complete but not Cancel or Assign to the technician assigned to the work order", () => {
    const { unmount } = renderPanel(workOrderIn("in_progress", "tech-1"), technicianUser);

    expect(queryButton("Complete")).toBeInTheDocument();
    expect(queryButton("Assign")).not.toBeInTheDocument();
    unmount();

    renderPanel(workOrderIn("scheduled", "tech-1"), technicianUser);

    expect(queryButton("Start")).toBeInTheDocument();
    expect(queryButton("Cancel")).not.toBeInTheDocument();
    expect(queryButton("Assign")).not.toBeInTheDocument();
  });

  it("shows every action available in the current state to a supervisor", () => {
    const { unmount } = renderPanel(workOrderIn("in_progress", "tech-2"), supervisor);

    expect(queryButton("Complete")).toBeInTheDocument();
    expect(queryButton("Assign")).toBeInTheDocument();
    unmount();

    renderPanel(workOrderIn("scheduled", "tech-2"), supervisor);

    expect(queryButton("Start")).toBeInTheDocument();
    expect(queryButton("Cancel")).toBeInTheDocument();
    expect(queryButton("Assign")).toBeInTheDocument();
    expect(screen.getByLabelText("Technician")).toBeInTheDocument();
  });

  it("leaves triage visible to a technician", () => {
    renderPanel(workOrderIn("reported", null), technicianUser);

    expect(queryButton("Triage")).toBeInTheDocument();
  });
});
