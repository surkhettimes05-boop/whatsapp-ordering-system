# Transaction Guardrails & Developer Guide

This short guide explains the guardrails and documentation for using the centralized
transaction wrapper at `backend/transaction.js`.

Why a single integration point?
- Ensures `SERIALIZABLE` isolation consistently.
- Centralizes retry/backoff logic for deadlocks and serialization failures.
- Centralizes logging and observability for failures.

Developer checklist (quick):
- [ ] Use `runSerializableTransaction(prisma, callback, opts)` from `backend/transaction.js`.
- [ ] Provide `operation` and `entityId` in caller-level logs where possible.
- [ ] Keep transactions short; prefetch read-only data outside transactions.
- [ ] Use explicit row-level locks (e.g., `SELECT ... FOR UPDATE`) inside transactions if necessary.

Guard behavior
- A lightweight guard module (`src/utils/transaction-guard.js`) emits a warning when
  legacy adapters load to nudge developers to use `backend/transaction.js`.
- The guard is non-blocking and disabled in tests and when `DISABLE_TRANSACTION_GUARD=1`.

How to migrate an ad-hoc transaction
1. Identify `prisma.$transaction(...)` usage.
2. Replace with `withTransaction(async (tx) => { ... }, { operation: 'NAME', entityType: 'Order' })`.
3. If you need custom retry/backoff, pass options to the wrapper (consult `transaction.js`).

Operational notes
- Observe `logs/error.log` and `webhook_logs` for `TRANSACTION_FAILURE` events.
- If you need to temporarily bypass the guard during experiments, set `DISABLE_TRANSACTION_GUARD=1`.

Contact
- For questions about semantics or to change global retry/timeouts, edit `backend/transaction.js` and notify the team.
