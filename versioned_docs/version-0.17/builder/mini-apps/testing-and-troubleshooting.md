---
sidebar_position: 8
title: "Testing and troubleshooting"
description: "Test provider readiness, permission refusal, result recovery and each supported platform."
---

# Testing and troubleshooting

Test the app's state handling separately from an actual injected Bread provider. TypeScript proves that a recipe matches its installed declarations; mock-provider tests prove application behavior. Neither proves that extension, mobile or desktop builds implement the same method or that a transaction reached its recipient.

The public [frontend template](https://github.com/0xMiden/frontend-template) supplies type, unit, lint and production-build checks. Run its current commands for the checkout you use. The [wallet adapter conformance suite](https://github.com/0xMiden/web-sdk/blob/main/packages/adapter/miden/conformance.ts) is a starting point for checking a real provider's supported surface.

## Minimum integration matrix

| Scenario | Expected observation |
| --- | --- |
| No injected provider | Truthful installation/open-in-wallet guidance; no successful connection state. |
| Client-only initialization | Adapter detects the browser provider after mounting rather than staying unsupported from server construction. |
| User refuses connection or private read | App stays usable and does not treat refusal as granted permission. |
| Unsupported method | Capability-specific explanation before attempting another action. |
| Wrong account/network/faucet | Request is stopped or rejected; pending work keeps its original context. |
| Accepted request then timeout/reload | Original ID/context is restored and reconciled before another submission. |
| Wallet result returned | App distinguishes result retrieval from chain inclusion and recipient consumption. |
| Parked app, lock or disconnect | Session/read caches refresh and stale approval is not reused. |
| Fullscreen absent or refused | Ordinary layout remains usable; extension injection is not native presentation support. |
| Manual-ready fullscreen | Notify readiness only after a correctly sized first frame; native timeout/refusal stays recoverable. |
| Rotation, safe areas and Back to Bread | Touch controls remain visible; leaving/reopening follows the actual build's close or park lifecycle. |
| Fullscreen wallet overlay or closure | Approval remains visible; interrupted requests reconcile without assuming submitted work was cancelled. |

Exercise the actual embedded browser on every platform you claim. An ordinary mobile browser opening the same URL is a different environment; it does not gain provider injection automatically. Include cancel, permission refusal and returning from a parked app alongside the successful path.

For the new Explore contract, verify `finance`, `arcade` and `others` isolation and the All aggregate, network selection, search, recents, platform gates and empty/loading/error states. Legacy names must fail publication validation; only persisted legacy cached data gets conversion in the matching wallet. Cover higher-version refresh, wrong-network and rollback rejection, changed same-version bodies, failed fetches and cached/bundled fallback. Test Home → Arcade after a retained search and confirm that Open uses the exact configured URL, including its query and fragment.

The companion wallet has a [reproducible catalog harness](https://github.com/0xMiden/wallet/blob/b09b93074a72c75d82d039a7ae52a821ce7e63c7/docs/explore-config-verification.md). From a matching wallet checkout, run `yarn test:explore-config --config-repo /path/to/wallet-config`. It serves actual local catalogs over HTTP and exercises the built UI in a disposable Chromium profile. Account readiness is mocked: the harness does not verify onboarding, Guardian authentication, live GC balances, submissions, chain settlement or native-device acceptance. Keep its E2E/mock build separate from release artifacts. Confirm that fictional previews cannot be enabled in production and real submission remains unavailable until integrated.

Games also need deterministic scoring vectors, invalid/duplicate attempts and any reviewed challenge claim/expiry paths. Financial apps need the actual asset/issuer and route, fee handling, chain settlement, recipient-note consumption where relevant and interrupted claim/recovery. A local game score, wallet result or provider health response is insufficient evidence for those outcomes.

## Diagnose by boundary

- **Unsupported immediately:** ensure the adapter is constructed once in a browser-only module. Recreating it during render can disconnect a previous instance.
- **Provider not detected:** confirm the page is running in a supported injected environment and wait for readiness. Do not label this as a chain failure.
- **SDK/client initialization stalled:** inspect the execution boundary and provider order. A wallet-signer ancestor can deliberately gate an app-owned client's initialization until connection; the template's local counter uses a different arrangement.
- **Serialization or artifact errors:** match SDK/protocol versions and rebuild packages; do not patch encoded bytes or discard old private state blindly.
- **Wallet result unresolved:** retain the original request and inspect supported wallet/chain evidence before another spend. A local error can occur after submission.
- **Recipient balance unchanged:** check discovery, note consumption, matching network and synchronization separately from the sender result.

## Record useful evidence

For a test run, record the app commit, package versions, wallet candidate/platform, network, public account/faucet identity and non-secret request/transaction/note identifiers. Keep recovery phrases, private keys, invitation codes and unnecessary private data out of logs and support exports.

Use disposable development accounts and supported test funding. Stop when a route, faucet or provider is not configured for that deployment. Successful mocks or endpoint health cannot replace actual request/result and recovery checks; a catalog entry is also not a platform conformance result.
