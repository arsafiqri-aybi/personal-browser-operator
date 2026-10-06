# RUN-0003 — ChatGPT Integration Source CI

## Evidence class

Private ChatGPT plugin source validation plus full regression preservation.

## GitHub Actions

- Workflow run: `37417847128`
- Job: `112120345288`
- Commit under test: `52706256ee6ab4e3216f3d74323cc56e896f3329`
- Conclusion: **PASS**
- Date: 2026-10-06

## Source under test

```text
integrations/chatgpt/personal-browser-operator/
├── plugin.json
├── mcp.json.template
└── skills/browser-operator/SKILL.md

scripts/render-chatgpt-plugin.mjs
scripts/validate-chatgpt-integration.mjs
```

## Deterministic properties proven

- portable Agent Plugins manifest parses;
- plugin identity is `personal-browser-operator`;
- semantic version is valid;
- OpenAI interface metadata exists;
- listing short description stays within the 30-character package limit;
- default prompts are bounded and non-empty;
- MCP template contains exactly one endpoint placeholder;
- rendered MCP transport is `streamable-http`;
- renderer accepts a public HTTPS `/mcp` URL;
- renderer rejects an insecure/private HTTP endpoint;
- operator skill contains guidance for durable task/session/observe/action/verify/recover/takeover flow;
- operator skill preserves untrusted-web-data and unknown-effect boundaries;
- canonical integration source contains no embedded bearer credential.

## Regression evidence

The same run also passed:

- architecture validation;
- strict TypeScript;
- unit tests;
- MCP contract tests;
- Chromium installation;
- real browser smoke;
- full container gateway/remote-MCP/persistence smoke.

## Not proven

This evidence does not prove:

- a public MCP deployment;
- an installed/connected Personal Browser Operator plugin;
- OAuth or another final ChatGPT connection mechanism;
- live same-browser takeover;
- authenticated real-account use.

WP-20 is therefore `SOURCE_VERIFIED_AWAITING_PUBLIC_MCP`, not connected or complete.
