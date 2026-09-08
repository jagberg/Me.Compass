# Quickstart: Validate Action Extraction Criteria

## Prerequisites

- Backend running with a valid Google OAuth connection already established (see
  `specs/001-personal-action-manager/quickstart.md` for initial setup)
- Local `claude` CLI installed and authenticated (existing requirement, unchanged)

## Setup

No new setup - this feature does not add configuration, environment variables, or
dependencies. Standard backend run:

```bash
cd backend
npm run build
npm run start
```

## Validation scenarios

### 1. Explicit ask of the user is captured (FR-001, SC-001)

- Prepare (or find in real data) an email/chat message/meeting note containing an explicit
  ask directed at the user, e.g. "Can you send the report by Friday?"
- Trigger a sync: `POST /sources/email/sync` (or `chat` / `drive`)
- **Expected**: An `Action` row is created referencing that item (`GET /sources` to confirm
  sync succeeded, then check the actions list)

### 2. User's own commitment is captured (FR-002, SC-001)

- Prepare an item where the user states they will do something, e.g. "I'll follow up with
  the vendor tomorrow"
- Trigger a sync
- **Expected**: An `Action` row is created for it

### 3. Item assigned to someone else is excluded (FR-003, SC-002)

- Prepare an item where an action is assigned solely to another named person, with no
  involvement from the user, e.g. "Sarah will update the deck"
- Trigger a sync
- **Expected**: No `Action` row is created for it

### 4. Ambiguous item involving the user is still captured (FR-004, SC-001)

- Prepare a vague possible commitment involving the user, e.g. "might be worth me looking
  into this at some point"
- Trigger a sync
- **Expected**: An `Action` row is created for it (recall-first - not silently dropped)

### 5. Mechanism unchanged (FR-005)

- Confirm no new environment variable, API key, or config was required to run the above
- Confirm sync still runs via the existing `POST /sources/:type/sync` endpoint with no new
  request/response shape

## Measuring success (SC-001, SC-002, SC-003)

Assemble a sample batch of real synced items with known commitments/asks and known
not-involving-the-user items (manually curated, since this is a single-user local tool with
no existing labeled dataset). Run a sync, then manually compare the resulting `Action` rows
against the known set:

- **SC-001**: ≥90% of known real commitments involving the user appear as actions
- **SC-002**: 0% of items assigned solely to others appear as actions
- **SC-003**: Each resulting action is self-explanatory as an ask of, or commitment by, the user
