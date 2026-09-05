# FinTrack — Savings Automations & Smart Goal Ideas Fixes

## Phase 1 — Savings Automations CREATE (DONE)
**Status: Complete & Verified**

### Root cause
`backend/models/Automation.js` had a `type` enum of only
`["savings-sweep", "budget-alert", "investment", "custom"]`. The UI sends
`savings-fixed-amount` (and `savings-income-arrival`, `savings-round-up`,
`savings-below-spending-limit`). Mongoose rejected the value → ValidationError →
500 "Failed to create automation".

### Change
- Extended `type` enum to include the four savings rule types.
- Set default to `savings-fixed-amount` (kept all legacy values).

---

## Phase 2 — Savings Automations EDIT & DELETE (DONE)
**Status: Complete & Verified**

### Root cause
`frontend/src/pages/Dashboard.jsx` loaded rules into state but dropped the Mongo
`_id` and the `type`/`amount`/`frequency`/`limit` fields, and did not pass
`onRulesChange={setRules}` to `<AutomationsPanel>`.

### Change
- `setRules(...)` now maps real `_id` + full fields.
- Wired `<AutomationsPanel rules={rules} onRulesChange={setRules} />`.

---

## Phase 3 — Smart Goal Ideas (DONE)
**Status: Complete & Verified (frontend build passes)**

### Root cause of stuck "In progress"
`getGoalSuggestions` cached computed suggestions into the `GoalSuggestions`
collection and returned that stale cache forever — a second source of truth that
could not refresh when data changed.

### Changes
1. **`backend/controllers/dashboardSummaryController.js`** — `getGoalSuggestions`
   now computes suggestions live from real transactions and goals (no caching).
   Generates up to 3 suggestions (emergency fund, savings target from real
   surplus, first-goal starter, top-category fund) with `title`, `description`,
   `targetAmount`, `currentAmount`, `category`, `eta`, `deadline`. Returns `[]`
   only when there is genuinely no data.
2. **`frontend/src/components/GoalSuggestionsCard.jsx`** — renders suggestion cards
   (target, eta) with a working "+ Add Goal" button that calls `onAddGoal(prefill)`.
3. **`frontend/src/components/GoalsPanel.jsx`** — wrapped in `forwardRef` +
   `useImperativeHandle` exposing `openCreateWithPrefill(prefill)` to open the
   existing Goal create flow pre-filled.
4. **`frontend/src/pages/Dashboard.jsx`** — added `goalsPanelRef`, preserved
   `targetAmount`/`currentAmount`/`category`/`deadline` in the `goalSuggestions`
   mapping, passed `ref={goalsPanelRef}` to `<GoalsPanel>` and
   `onAddGoal={(p) => goalsPanelRef.current?.openCreateWithPrefill(p)}` to
   `<GoalSuggestionsCard>`.

### Verification
- `npx vite build` completes successfully (dist generated).
- Suggestions derive from real data, change when data changes, and "Add Goal"
  opens the existing pre-filled Goal modal; created goals save via `POST /goals`.
- Existing Goals and Savings Automations (create/edit/delete) remain functional.

---

## Phase 4 — Goals CREATE/EDIT/DELETE persistence (DONE)
**Status: Complete & Verified (frontend build passes)**

### Root cause
The backend Goals CRUD (`createGoal`, `getGoals`, `updateGoal`, `deleteGoal`) was
correct and persisted to MongoDB (same DB as the working Savings Automations).
The bug was a **frontend state-shape mismatch** in
`frontend/src/pages/Dashboard.jsx`:

- `Dashboard.fetchData()` mapped DB goals into
  `{ id, _id, label, target, current, deadline, category, notes }`.
- But `GoalsPanel` renders via `internalGoals` which reads the **raw backend
  field names**: `g.title`, `g.targetAmount`, `g.currentAmount`, `g.description`.

So after a page refresh, `fetchData()` repopulated `goals` with the
`label`/`target` shape, and `GoalsPanel` read `g.title`/`g.targetAmount`/
`g.currentAmount` which were `undefined`. Every goal then rendered as a ₹0
target and the newly created goal appeared broken/lost — even though the record
was actually saved in MongoDB.

### Change
- **`frontend/src/pages/Dashboard.jsx`** — expanded the `setGoals(...)` mapping to
  include the raw backend field names alongside the UI names, and use the real
  Mongo `_id` string as the stable `id`:
  ```js
  setGoals(goalsDb.map((g, idx) => ({
    id: g._id?.toString?.() || idx + 1,
    _id: g._id,
    label: g.title,
    title: g.title,
    target: Number(g.targetAmount || 0),
    targetAmount: Number(g.targetAmount || 0),
    current: Number(g.currentAmount || 0),
    currentAmount: Number(g.currentAmount || 0),
    deadline: g.deadline,
    category: g.category,
    notes: g.description,
    description: g.description,
  })));
  ```
  This keeps both consumers working: `GoalsPanel` (reads `title`/
  `targetAmount`/`currentAmount`/`description`) and the dashboard/other UI
  (reads `label`/`target`/`current`).

### Verification
- `npx vite build` completes successfully.
- Creating a goal via the New Goal form persists to MongoDB and appears after a
  full page refresh with the correct target/current amounts.
- Editing and deleting goals persist correctly.
- No changes to the Goals UI design, Savings Automations, or unrelated modules.
