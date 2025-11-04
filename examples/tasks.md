# Tasks Export

*Generated: November 4, 2025 at 02:30:45 PM*

---

## Today

*3 tasks*

### Implement OAuth2 authentication with Google and GitHub providers

- **ID:** `t_a1b2c3d4`
- **State:** 📥 inbox
- **Priority:** 🔴 high
- **Due:** Nov 10, 2025
- **Source:** github
- **Created:** Nov 4, 2025 at 09:15 AM

**Context:**

Add OAuth2 support with Google and GitHub providers. Need to handle token refresh, user session management, and secure storage of credentials. The auth flow should redirect properly after login and maintain state across requests.

**💡 Suggested Prompts:**

- 🔍 Investigate: Find likely root causes and quick diagnostics for "Implement OAuth2 authentication with Google and GitHub providers".
- 📝 Summarize: Summarize prior context and links for "Implement OAuth2 authentication with Google and GitHub providers" in 5 bullets.
- 📋 Plan: Propose a step-by-step plan to complete "Implement OAuth2 authentication with Google and GitHub providers".
- 🧪 Test: List test cases and edge conditions for "Implement OAuth2 authentication with Google and GitHub providers".

---

### Write comprehensive API documentation for all REST endpoints

- **ID:** `t_e5f6g7h8`
- **State:** 🔄 open
- **Priority:** 🟡 med
- **Source:** notion
- **Created:** Nov 4, 2025 at 10:20 AM

**Context:**

Document all REST endpoints with request/response examples, authentication requirements, error codes, and rate limits. Include OpenAPI spec generation and interactive docs with Swagger UI.

**💡 Suggested Prompts:**

- 🔍 Investigate: Find likely root causes and quick diagnostics for "Write comprehensive API documentation for all REST endpoints".
- 📝 Summarize: Summarize prior context and links for "Write comprehensive API documentation for all REST endpoints" in 5 bullets.
- 📋 Plan: Propose a step-by-step plan to complete "Write comprehensive API documentation for all REST endpoints".
- 🧪 Test: List test cases and edge conditions for "Write comprehensive API documentation for all REST endpoints".

---

### Optimize database query performance for user dashboard

- **ID:** `t_m9n0p1q2`
- **State:** 🔄 open
- **Priority:** 🔴 high
- **Due:** Nov 6, 2025
- **Source:** slack
- **Created:** Nov 4, 2025 at 11:45 AM

**Context:**

User dashboard is taking 3-5 seconds to load. Need to add database indexes, optimize N+1 queries, and implement query result caching. Current query count: 47 per page load. Target: under 500ms with <10 queries.

**💡 Suggested Prompts:**

- 🔍 Investigate: Find likely root causes and quick diagnostics for "Optimize database query performance for user dashboard".
- 📝 Summarize: Summarize prior context and links for "Optimize database query performance for user dashboard" in 5 bullets.
- 📋 Plan: Propose a step-by-step plan to complete "Optimize database query performance for user dashboard".
- 🧪 Test: List test cases and edge conditions for "Optimize database query performance for user dashboard".

---

## Yesterday

*2 tasks*

### Fix login redirect bug causing 404 errors

- **ID:** `t_i9j0k1l2`
- **State:** ✅ done
- **Priority:** 🔴 high
- **Source:** slack
- **Created:** Nov 3, 2025 at 03:45 PM

**Context:**

Users redirected to 404 page after successful login. Root cause: redirect URL in auth callback was using relative path instead of absolute. Fixed by using req.protocol and req.hostname to build proper redirect URL.

**💡 Suggested Prompts:**

- 🔍 Investigate: Find likely root causes and quick diagnostics for "Fix login redirect bug causing 404 errors".
- 📝 Summarize: Summarize prior context and links for "Fix login redirect bug causing 404 errors" in 5 bullets.
- 📋 Plan: Propose a step-by-step plan to complete "Fix login redirect bug causing 404 errors".
- 🧪 Test: List test cases and edge conditions for "Fix login redirect bug causing 404 errors".

---

### Add unit tests for payment processing module

- **ID:** `t_r3s4t5u6`
- **State:** ✅ done
- **Priority:** 🟡 med
- **Source:** github
- **Created:** Nov 3, 2025 at 10:30 AM

**Context:**

Added comprehensive unit tests for payment processing: successful payments, failed transactions, refunds, webhooks, idempotency checks, and edge cases. Test coverage now at 95% for payment module.

**💡 Suggested Prompts:**

- 🔍 Investigate: Find likely root causes and quick diagnostics for "Add unit tests for payment processing module".
- 📝 Summarize: Summarize prior context and links for "Add unit tests for payment processing module" in 5 bullets.
- 📋 Plan: Propose a step-by-step plan to complete "Add unit tests for payment processing module".
- 🧪 Test: List test cases and edge conditions for "Add unit tests for payment processing module".

---

## Friday, November 1, 2025

*2 tasks*

### Implement real-time notifications using WebSockets

- **ID:** `t_v7w8x9y0`
- **State:** 🔄 open
- **Priority:** 🟡 med
- **Due:** Nov 15, 2025
- **Source:** notion
- **Created:** Nov 1, 2025 at 02:00 PM

**Context:**

Add WebSocket support for real-time notifications: new messages, task updates, system alerts. Need to handle connection management, reconnection logic, and message queuing for offline clients.

**💡 Suggested Prompts:**

- 🔍 Investigate: Find likely root causes and quick diagnostics for "Implement real-time notifications using WebSockets".
- 📝 Summarize: Summarize prior context and links for "Implement real-time notifications using WebSockets" in 5 bullets.
- 📋 Plan: Propose a step-by-step plan to complete "Implement real-time notifications using WebSockets".
- 🧪 Test: List test cases and edge conditions for "Implement real-time notifications using WebSockets".

---

### Refactor user settings component to use hooks

- **ID:** `t_z1a2b3c4`
- **State:** 📥 inbox
- **Priority:** 🟢 low
- **Source:** local
- **Created:** Nov 1, 2025 at 09:30 AM

**Context:**

Migrate user settings component from class-based to functional component using React hooks. Extract reusable logic into custom hooks. Simplify state management and improve code readability.

**💡 Suggested Prompts:**

- 🔍 Investigate: Find likely root causes and quick diagnostics for "Refactor user settings component to use hooks".
- 📝 Summarize: Summarize prior context and links for "Refactor user settings component to use hooks" in 5 bullets.
- 📋 Plan: Propose a step-by-step plan to complete "Refactor user settings component to use hooks".
- 🧪 Test: List test cases and edge conditions for "Refactor user settings component to use hooks".

---

## Thursday, October 31, 2025

*1 task*

### Investigate production memory leak in background worker

- **ID:** `t_d5e6f7g8`
- **State:** ✅ done
- **Priority:** 🔴 high
- **Source:** slack
- **Created:** Oct 31, 2025 at 04:15 PM

**Context:**

Memory usage growing 50MB/hour in production worker process. Root cause: event listeners not being removed after job completion. Fixed by implementing proper cleanup in finally blocks and using WeakMap for temporary references.

**💡 Suggested Prompts:**

- 🔍 Investigate: Find likely root causes and quick diagnostics for "Investigate production memory leak in background worker".
- 📝 Summarize: Summarize prior context and links for "Investigate production memory leak in background worker" in 5 bullets.
- 📋 Plan: Propose a step-by-step plan to complete "Investigate production memory leak in background worker".
- 🧪 Test: List test cases and edge conditions for "Investigate production memory leak in background worker".

---
