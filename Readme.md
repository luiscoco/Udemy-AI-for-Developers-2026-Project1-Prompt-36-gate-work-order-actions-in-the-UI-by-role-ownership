# Prompt F: Showing work-order actions by role in the UI

This step makes the frontend follow the same permission rules the backend already enforces. A user now sees only the work-order actions they are allowed to perform.

| Action | Who sees it |
|---|---|
| Triage / Schedule / Start | Any signed-in user (unchanged) |
| Assign technician | Supervisor or admin |
| Cancel | Supervisor or admin |
| Complete | Supervisor, admin, or the technician assigned to that work order |

> **Key idea:** hiding a button is a convenience, not security. The backend still checks every request. The UI just avoids offering actions that would fail.

---

## Step 1: Read the existing code first

Before changing anything, I read the files involved to see how they fit together:

- `apps/frontend/src/components/WorkOrderPanel.tsx`: the action buttons and the "Assign" control are here. `WorkOrderBoard.tsx` is only the table, so it needed no changes.
- `apps/frontend/src/auth/AuthContext.tsx`: provides the current `user` (with `role` and `technicianId`) through `useAuth()`.
- `apps/frontend/src/App.tsx`: renders the panel and handles errors through `describeError()`.
- `apps/frontend/src/api/client.ts`: turns error responses into a `ClientApiError` that carries the backend's `message`.
- `apps/backend/src/routes/workOrders.ts`: holds the backend permission rules (`isSupervisorOrAdmin`, `transitionDenialReason`). The frontend should copy these rules, not invent new ones.

**Lesson:** read the backend rules before writing frontend rules, so the two match.

---

## Step 2: Put the permission rules in one small module

New file: `apps/frontend/src/auth/permissions.ts`

```ts
export function isSupervisorOrAdmin(user: User | null): boolean { ... }
export function canAssignTechnician(user: User | null): boolean { ... }
export function canPerformAction(user: User | null, action: WorkOrderAction, workOrder: WorkOrder): boolean { ... }
```

- `cancel`: supervisor or admin only.
- `complete`: supervisor or admin, **or** a technician whose `technicianId` equals the work order's `technicianId`.
- Any other action: allowed.

**Why a separate file?** The rules are plain functions with no React code. They are easy to read, easy to test, and easy to compare with the backend version. The components stay simple.

---

## Step 3: Hide actions in `WorkOrderPanel`

1. Added a new prop, `currentUser: User | null`.
2. The existing `actionsForState()` returns what the lifecycle allows. That list is now **filtered** by permissions:

   ```ts
   const actions = actionsForState(workOrder.state).filter((action) =>
     canPerformAction(currentUser, action, workOrder),
   );
   const showAssign = canAssignTechnician(currentUser);
   ```

3. The technician select and the "Assign" button render only when `showAssign` is true.
4. The button group renders only if at least one action is left.

**Why a prop instead of calling `useAuth()` inside the panel?** The panel already gets all its data through props (`workOrder`, `assets`, `technicians`, ...). Keeping that pattern lets the tests render the panel with any user, without setting up an `AuthProvider`.

---

## Step 4: Pass the current user from `App.tsx`

`WorkOrderWorkspace` reads the user from the auth context and passes it down:

```tsx
const { user: currentUser } = useAuth();
...
<WorkOrderPanel currentUser={currentUser} ... />
```

---

## Step 5: Show the backend's message on a 403

The UI can still send a forbidden request if its data is stale (for example, the work order was reassigned in another tab). The backend then answers `403` with a message like *"Only a supervisor or admin can cancel a work order."*

I checked the existing flow and found that nothing needed to change:

- `client.ts` reads `message` from the error response and throws a `ClientApiError`.
- `describeError()` in `App.tsx` shows `err.message` in the existing alert banner.

So instead of changing code, I added a **test** to make sure this keeps working.

**Lesson:** don't change code that already works. Add a test that proves it works.

---

## Step 6: Add tests

**New file: `apps/frontend/src/components/WorkOrderPanel.test.tsx`**

| Scenario | Expected |
|---|---|
| Technician viewing someone else's work order | No Complete, Cancel, or Assign (Start is still visible) |
| Technician viewing their own work order | Sees Complete; no Cancel or Assign |
| Supervisor | Sees Complete, Start, Cancel, and Assign |
| Technician on a reported work order | Still sees Triage |

The lifecycle only offers certain actions in certain states (Complete only in `in_progress`, Cancel in `triaged` or `scheduled`). So each role is tested on both an `in_progress` and a `scheduled` work order.

**Updated: `apps/frontend/src/App.test.tsx`**

- New test: when `transitionWorkOrder` fails with `ClientApiError(403, "...")`, the alert shows the backend's exact message and not the generic "Failed to update work order".

---

## Step 7: Verify

Run the frontend tests from the repository root:

```bash
npm install
npm test --workspace=@equipment-hub/frontend
```

> Note: dependencies were not installed in this environment when the changes were made, so the tests still need to be run after `npm install`.

---

## Summary of files

| File | Change |
|---|---|
| `apps/frontend/src/auth/permissions.ts` | **New**: permission helpers that copy the backend rules |
| `apps/frontend/src/components/WorkOrderPanel.tsx` | New `currentUser` prop; filters actions and hides Assign |
| `apps/frontend/src/App.tsx` | Passes the current user from `useAuth()` to the panel |
| `apps/frontend/src/components/WorkOrderPanel.test.tsx` | **New**: role and ownership tests |
| `apps/frontend/src/App.test.tsx` | New test for showing the 403 message |

## Running the app from the Windows terminal

Use **PowerShell** or **Windows Terminal**. You need Node.js 20.12 or later and a running local SQL Server. The backend stores its data in SQL Server through Prisma; see `apps/backend/README.md` for how to set that up.

### Quick start (after the first-time setup below)

```powershell
cd "C:\0. IMPORTANTE - atmira---Curso-AI-SDD-main\Curso Udemy 1 AI Para programadores\Project equipment_maintenance_hub_React_Vite_Fastify_TypeScrip\Prompt 36 -"
npm run dev
```

This starts both parts of the app at once:

- **Backend** (Fastify API): http://127.0.0.1:3001
- **Frontend** (Vite + React): **http://localhost:5173**. Open this one in your browser.

The frontend forwards every `/api` request to the backend, so both must be running. Press `Ctrl + C` to stop them.

### First-time setup

Run these once, from the project root (the folder that contains this README):

```powershell
# 1. Install dependencies for every workspace (backend, frontend, contract)
npm install

# 2. Make sure SQL Server is running (run PowerShell as Administrator)
net start MSSQLSERVER

# 3. Create the backend config file if it does not exist yet,
#    then edit DATABASE_URL and JWT_SECRET in it
if (-not (Test-Path apps\backend\.env)) { Copy-Item apps\backend\.env.example apps\backend\.env }
notepad apps\backend\.env

# 4. Create the database tables and load the demo data
npm run db:migrate --workspace=@equipment-hub/backend
npm run db:seed --workspace=@equipment-hub/backend

# 5. Start the app
npm run dev
```

Step 3 only creates `.env` when it is missing, so it never overwrites a config file you already have.

### Running the backend and frontend in separate terminals (optional)

Separate terminals make each server's logs easier to read:

```powershell
# Terminal 1: backend
npm run dev --workspace=@equipment-hub/backend

# Terminal 2: frontend
npm run dev --workspace=@equipment-hub/frontend
```

### Demo users (created by the seed)

Try each role to see this step's changes: which buttons appear depends on who is logged in.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@equipment-hub.test` | `Admin!2345` |
| Supervisor | `supervisor@equipment-hub.test` | `Super!2345` |
| Technician | `elena.vasquez@equipment-hub.test` | `Tech!2345` |
| Technician | `marcus.chen@equipment-hub.test` | `Tech!2345` |

For example, log in as Elena. Open a work order that is assigned to her and in progress: you see **Complete**, but not **Cancel** or **Assign**. Then log in as the supervisor: every action is visible.

### Common problems on Windows

- **"running scripts is disabled on this system"** when you run `npm`: allow local scripts for your user with
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, or use `npm.cmd` instead of `npm`.
- **"JWT_SECRET is not set"**: `apps\backend\.env` is missing or has no `JWT_SECRET`. Go back to step 3.
- **Prisma cannot connect to the database**: check that the SQL Server service is running and that `DATABASE_URL` in `.env` is correct.
- **Port 3001 or 5173 already in use**: another copy of the app is still running. Close it, or find its process with `netstat -ano | findstr :5173`.

---

## Takeaways for students

1. **Read before writing:** understand the existing code and backend rules first.
2. **One place for the rules:** keep permission logic in plain, testable functions.
3. **The frontend follows the backend:** the backend decides and the UI only mirrors it.
4. **Plan for failure:** stale UI state happens, so show clear server error messages.
5. **Tests describe behavior:** each role scenario in the prompt became a test case.
