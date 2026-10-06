# Evidence Run 0001 — Real Browser CI

Date: 2026-10-06
Repository: arsafiqri-aybi/personal-browser-operator
Source commit: `8f7bd4f657de10d48b450f1be0181d85a178532a`
GitHub Actions workflow: Verify Personal Browser Operator
Workflow run: `37410557580`
Job: `112097804980`
Conclusion: **SUCCESS**

## Passed gates

1. Checkout — PASS
2. Setup Node — PASS
3. Install dependencies — PASS
4. Architecture and deterministic verification — PASS
   - architecture chain validator
   - strict TypeScript typecheck
   - unit tests
   - MCP contract tests
5. Install Playwright Chromium — PASS
6. Real browser smoke test — PASS

## Real browser behavior proven

The browser smoke test launched a real Playwright Chromium process and exercised the actual browser kernel against a local controlled web fixture.

Evidence path:

```text
BrowserManager.open
-> Playwright launchPersistentContext
-> navigate to HTTP fixture
-> observe page
-> create semantic element refs
-> interact/click
-> invalidate old state
-> prove stale ref cannot be reused
-> re-observe changed state
-> verify visible postcondition + page title
-> PASS
```

Therefore the project may truthfully claim:

```text
REAL_BROWSER_VERIFIED
```

for the tested vertical slice.

It may NOT yet claim:

```text
DEPLOYED
REAL_ACCOUNT_VERIFIED
PRODUCTION_READY
```

## Regression history that led to PASS

Earlier CI runs found and forced correction of:
- invalid workflow-level runner context;
- setup-node cache requiring absent lockfile;
- strict TypeScript defects;
- bracketed IPv6 loopback normalization;
- browser-context callback serialization leaking the tsx `__name` helper.

These failures are preserved as useful regression knowledge rather than hidden.
