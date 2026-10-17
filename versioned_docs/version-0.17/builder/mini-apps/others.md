---
sidebar_position: 7
title: "Build learning and utility apps"
sidebar_label: "Others: learning and utilities"
description: "Create learning, NFT and non-financial utilities with a clear outcome and minimal wallet access."
---

import MiniAppIcon from '@site/src/components/MiniAppIcon';

import MiniAppCard from '@site/src/components/MiniAppCard';

# Build learning and utility apps

Teach one concept, answer a useful question or help someone use an NFT. Others is the category for learning, NFTs and non-financial utilities. Financial helpers belong in [Finance](./finance.md); games belong in [Arcade](./arcade.md).

<Badge tone="brand">category: others</Badge>

## Define a useful result

| Experience | A complete first task | Evidence to provide |
| --- | --- | --- |
| Learning | Finish a short exercise and understand its result | Clear learning outcome, restart and refusal paths |
| Public-data tool | Answer a question for the selected network | Source, freshness and unavailable/stale states |
| Private-data utility | Complete a task with a limited authorized read | Capability, permission refusal, account-switch clearing and retention behavior |
| NFT app | View or complete a supported collection action | Issuer/collection, network, ownership assumptions, fees and recovery |

A lesson or public-data preview can show value without a wallet connection. Explain any account, network or asset requirement early. Do not turn unrelated access or payment requests into prerequisites for a useful task.

## Add wallet access where it belongs

<Steps>

<div>

### Begin with public information

Render the useful task or preview first where possible. A public-data source does not require wallet connection just because the app is opened from Bread.

</div>
<div>

### Request a specific capability

Use [Bread's provider](./bread-wallet-integration.md) for supported reads or operations. Explain the requested private-data category, handle refusal and clear account-specific caches after an account switch.

</div>
<div>

### Complete and recover the task

For a transaction, follow the [shared request lifecycle](./building.md#model-the-request-lifecycle). For a read, identify stale/unavailable data. Keep a restart or return path understandable.

</div>
</Steps>

<Callout variant="info" title="Completion must mean what the app claims">
A completed lesson does not prove that a wallet is backed up or secured. A catalog category does not supply an NFT contract or name service. A local result or exported share card is not automatically an issued badge, referral credit or public post.
</Callout>

## Respect private data when sharing

Offer a deliberate preview of the selected result. Reading a balance or note does not authorize publishing it. Define storage, retention and deletion for data the app observes, and keep private keys and recovery words out of lessons, ownership checks and support logs.

## Test and register

Test the core task, missing provider, declined access, unsupported methods, account/network changes, stale data and interrupted work on each advertised build. Keep a responsive ordinary layout even when using optional [native fullscreen](./bread-wallet-integration.md#optional-native-fullscreen).

Register the reviewed live deployment using `others`, add its section references/icon and increase the catalog version. Keep learning, data-source, ownership or contract evidence in the candidate record; catalog validation only checks the catalog contract.

<CardGrid cols={2}>
  <MiniAppCard title="Test your app" page="testing-and-troubleshooting" eyebrow="Capabilities and recovery" icon={<MiniAppIcon name="test" />}>
    Exercise the useful task and every required wallet boundary.
  </MiniAppCard>
  <MiniAppCard title="Register in Explore" page="publishing-and-explore" eyebrow="wallet-config review" icon={<MiniAppIcon name="publish" />}>
    Prepare metadata, evidence and the reviewed catalog change.
  </MiniAppCard>
</CardGrid>
