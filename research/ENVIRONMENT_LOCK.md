# WP-00 — Research & Environment Lock

Date: 2026-10-06
Status: LOCKED FOR INITIAL ARCHITECTURE

## Verified implementation facts

1. Playwright BrowserContext provides isolated browser sessions.
   Source: https://playwright.dev/docs/api/class-browsercontext

2. Playwright supports persistent Chromium state using `launchPersistentContext(userDataDir)`.
   A single user data directory cannot be launched by multiple simultaneous browser instances.
   Source: https://playwright.dev/docs/api/class-browsertype

3. Playwright recommends semantic locators such as role, text, and label.
   Locators are central to Playwright auto-waiting and retry behavior.
   Source: https://playwright.dev/docs/locators

4. Playwright performs actionability checks before actions such as click:
   visibility, stability, event reception, and enabled state.
   Source: https://playwright.dev/docs/actionability

5. Authenticated browser state may contain impersonation-capable cookies/headers and must not be committed to repositories, including private repositories.
   Source: https://playwright.dev/docs/auth

6. The MCP TypeScript server SDK v2 is the stable line implementing the 2026-07-28 MCP specification.
   Source: https://ts.sdk.modelcontextprotocol.io/v2/api/%40modelcontextprotocol/server/

7. ChatGPT plugins can include connected MCP apps. Local MCP apps are desktop-local; remote availability requires an externally reachable app/runtime path.
   Source: https://help.openai.com/en/articles/20001256-plugins-in-chatgpt

## Architecture consequence

The product will not reimplement browser mechanics and will not use the official Playwright MCP as its central runtime.

We own the custom MCP contract, policy, state, verification, recovery, identity isolation, and audit layers. Playwright remains the execution kernel.

## Research triggers

Re-open WP-00 only if a material assumption changes:
- MCP host requirements change;
- Playwright persistence semantics change;
- deployment environment cannot run persistent Chromium;
- authentication or browser-state assumptions fail;
- ChatGPT integration requirements materially change.
