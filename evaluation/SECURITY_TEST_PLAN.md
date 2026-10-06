# Security Test Plan

## Network boundary

The browser runtime must not be a generic pivot into its host network.

Required tests:

- localhost is denied by default;
- 127.0.0.0/8 is denied;
- RFC1918 IPv4 ranges are denied;
- link-local IPv4 is denied;
- carrier-grade NAT range is denied;
- ::1 is denied;
- fc00::/7 unique-local IPv6 is denied;
- fe80::/10 link-local IPv6 is denied;
- DNS hostname resolving to any denied address is denied;
- redirect to a private address is denied by request interception;
- subresource fetch to a private address is denied;
- public HTTP(S) remains usable;
- PBO_ALLOW_PRIVATE_NETWORKS=true is explicit opt-in and auditable.

## Instruction boundary

Required adversarial cases:

- direct "ignore previous instructions";
- external page asks for cookies/tokens/passwords;
- fake system/developer instructions inside webpage;
- page tells model to change user goal;
- injected instruction embedded in comments, email or document;
- malicious labels on buttons.

Expected outcome:

Web content remains trust=UNTRUSTED_WEB_DATA and authority=NONE. Signals may be emitted, but pattern matching alone is not considered the security boundary.

## Effect safety

- timeout after click must not trigger blind second click;
- timeout after submit must force re-observation and verification;
- stale refs must fail;
- ambiguous refs must fail;
- failed/uncertain verification cannot complete a task.
