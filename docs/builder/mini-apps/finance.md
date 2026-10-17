---
sidebar_position: 6
title: "Build a Finance app"
sidebar_label: "Finance apps"
description: "Guide a financial task from preview and approval to settlement and recovery."
---

import MiniAppIcon from '@site/src/components/MiniAppIcon';

import MiniAppCard from '@site/src/components/MiniAppCard';

# Build a Finance app

Help someone complete a useful financial task with a clear preview and an understandable result. Finance includes financial applications and helpers such as faucets. Its catalog placement does not activate a route or grant funds.

<Badge tone="brand">category: finance</Badge>

## Start with one useful action

A small first build can prepare a transfer: choose the asset and recipient, review the amount and fees, connect Bread, then follow the result. Let someone understand the task before asking for account access.

Use [wallet-managed requests](./bread-wallet-integration.md) when supported operations cover the task. If the app needs a provider or custom contract, establish that contract's supported network, execution and recovery behavior before exposing the action.

## Design the financial flow

<Steps>

<div>

### Identify the asset and route

Record the network, issuing faucet/account and decimals. Identify any provider/API, contract version and operational owner. A symbol, quote or healthy endpoint alone does not establish an executable route.

</div>
<div>

### Show what the user will authorize

Present sender, destination, asset, amount, fees and expected effects. Request only the private-data categories the task needs. Keep wallet connection separate from the action's approval.

</div>
<div>

### Follow the result through settlement

Distinguish request acceptance, wallet result, chain inclusion and receiving state. For a send, the recipient must discover and consume the output note before its vault receives the asset.

</div>
<div>

### Make interruption recoverable

Save the original account, network, parameters and request ID. After a timeout, reload or account change, reconcile that operation before another submission. Expose any route-specific expiry, claim, reclaim or refund action.

</div>
</Steps>

<Callout variant="tip" title="Preview amounts, send base units">
Use the asset's decimals for display conversion. Adapter amounts must be positive safe integers in token base units. Validate the exact amount and issuer before dispatch; Bread still applies its own fee, balance and account policies.
</Callout>

## Verify the actual outcome

| Check | What to observe |
| --- | --- |
| Context | Wrong network, asset or sender stops the request; pending work keeps its original context. |
| Approval | Decline leaves a truthful state; a second tap does not create another operation. |
| Fees and funding | Insufficient balance or unavailable routes have actionable messages. |
| Completion | The UI distinguishes a wallet result from final settlement and spendable receiving balance. |
| Recovery | Reload, timeout and disabled new activity preserve the documented recovery path for existing work. |

Use supported disposable development accounts for authorized execution tests. Mock-provider tests and the catalog harness do not verify real balances, provider execution or settlement. Record the exact app deployment, Bread build, network and non-secret result identifiers.

## Register in Finance

Set `category` to `finance` and `isExchange` accurately; wallet/platform exchange gates still apply. Include route, settlement and recovery evidence in the registration PR. Fullscreen is optional; financial context and wallet approvals must remain readable.

A listing provides discovery. It grants no Mainnet admission, liquidity, payment authority or participation in Arcade GC/rewards. Avoid unrelated transactions or balance/volume incentives as onboarding steps.

<CardGrid cols={2}>
  <MiniAppCard title="Connect and reconcile" page="bread-wallet-integration" eyebrow="Wallet-managed requests" icon={<MiniAppIcon name="wallet" />}>
    Configure the provider and preserve uncertain request context.
  </MiniAppCard>
  <MiniAppCard title="Register your app" page="publishing-and-explore" eyebrow="wallet-config review" icon={<MiniAppIcon name="publish" />}>
    Add the reviewed origin and evidence to the Finance catalog.
  </MiniAppCard>
</CardGrid>
