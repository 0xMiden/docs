---
sidebar_position: 8
title: "Test in Bread"
sidebar_label: "Test in Bread"
description: "Verify the app, wallet, catalog and native presentation as separate parts of one journey."
---

import MiniAppIcon from '@site/src/components/MiniAppIcon';

import MiniAppCard from '@site/src/components/MiniAppCard';

# Test in Bread

Test the useful task from opening the app to its final result, including refusal and interruption. Record what passed on the actual wallet build and device. Type checks and controlled-provider tests are useful, but they do not establish live Bread or chain acceptance.

## Run the app's local checks

Use the commands and Node version documented by your checkout. For the current standalone [wallet-managed starter](https://github.com/0xMiden/frontend-template/blob/main/docs/mini-app-starter.md):

```bash
corepack yarn test
corepack yarn typecheck
corepack yarn lint
corepack yarn build
corepack yarn playwright install chromium
corepack yarn test:browser
```

These browser checks use the released adapter with a controlled injected provider. They cover app state and recovery, not actual Bread unlock/approval or live settlement.

## Verify the wallet journey

<Steps>

<div>

### Open without a provider

Confirm truthful connection/install guidance and a usable public preview where supported. An ordinary mobile browser does not gain wallet injection by opening the URL.

</div>
<div>

### Connect, decline and change accounts

Test provider detection, unlock, connection refusal and private-read refusal. Change account/network, lock the wallet and disconnect. Cached reads and prepared actions must not silently carry over.

</div>
<div>

### Complete and interrupt an operation

Exercise approval, rejection, repeated taps, accepted request IDs, timeouts and reloads. Restore the original request context and reconcile before retry. Verify wallet result, chain inclusion and recipient receiving separately where relevant.

</div>
<div>

### Return from the app

Test background/reopen, wallet overlays and Back to Bread. For optional fullscreen, check readiness failure, safe areas, both orientations and the actual build's close or park lifecycle.

</div>
</Steps>

## Add checks for your app

| App | Required behavior |
| --- | --- |
| [Arcade](./arcade.md) | Complete/restart a round, touch controls, truthful score persistence and reviewed challenge claim/expiry paths if used. |
| [Finance](./finance.md) | Correct asset/issuer/route, fees, actual settlement/receiving and claim or recovery. |
| [Others](./others.md) | Learning or utility outcome, source freshness, minimal private reads and any NFT ownership/contract action. |

Use disposable development accounts and supported test funding for authorized execution. If a route, faucet or capability is unavailable, record that path as not tested instead of substituting an endpoint health response.

## Check catalog discovery

Verify the intended network's `finance`, `arcade` and `others` views plus All. Follow the exact launch URL, including query and fragment. Cover search, recents, feature gates and empty/loading/error states. Home → Arcade must clear a retained search when entering explicitly.

For catalog-maintainer changes, also check higher-version replacement, wrong-network/rollback rejection, changed same-version bodies and failed-fetch fallback. New publication rejects legacy categories; the matching wallet converts only persisted legacy cached data.

<details>
<summary>Run the catalog browser harness</summary>

From the matching wallet checkout, with the config checkout alongside it:

```bash
yarn test:explore-config --config-repo /path/to/wallet-config
```

The [reproducible harness guide](https://github.com/0xMiden/wallet/blob/b09b93074a72c75d82d039a7ae52a821ce7e63c7/docs/explore-config-verification.md) describes real local catalog HTTP, parsing, storage, built UI and configured URL launch in disposable Chromium. Account readiness is mocked. It does not test onboarding, Guardian authentication, live GC balances/submission, chain operations or native-device acceptance. Its E2E/mock build is separate from release artifacts.

Check that fictional previews cannot be enabled in production and real GC submission remains disabled until integrated.

</details>

## Diagnose the failing boundary

| Symptom | Check next |
| --- | --- |
| Adapter is immediately unsupported | Construct it once in a browser-only module. |
| Provider is not detected | Verify the injected environment and wait for readiness. |
| Client initialization stalls | Inspect provider ordering and who owns the SDK client. |
| Artifacts or requests fail to decode | Match release/encoding and rebuild; do not patch serialized bytes. |
| A result is unresolved | Preserve the ID/context and inspect wallet/chain evidence before another submission. |
| Recipient balance has not changed | Check note discovery, consumption, network and synchronization. |
| Listing is missing | Check network, accepted catalog version, category, section references and the deployed reader. |

## Save review evidence

Record the app commit/deployment, package versions, wallet build/platform, network, scenario, expected result, observed result and relevant non-secret request/transaction/note IDs. Mark each scenario passed, failed or not run. Keep recovery phrases, keys, invitation codes and unnecessary private data out of logs and exports.

<MiniAppCard title="Register the tested deployment" page="publishing-and-explore" eyebrow="Next · Metadata and review" icon={<MiniAppIcon name="publish" />}>
  Attach this evidence to the candidate record and wallet-config registration PR.
</MiniAppCard>
