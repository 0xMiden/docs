---
sidebar_position: 3
title: "Build a mini-app"
sidebar_label: "Build a mini-app"
description: "Choose who executes transactions and design a complete, recoverable app flow."
---

import MiniAppCard from '@site/src/components/MiniAppCard';

# Build a mini-app

Start with one task a person can finish and understand. A game might offer one complete round; a financial app might preview and complete a transfer; a learning tool might teach one concept. Add wallet access at the point it serves that task.

## Choose the execution boundary

| Model | Your app owns | Bread owns | Use it for |
| --- | --- | --- | --- |
| **Wallet-managed** | UI, validated parameters and a request journal | Account, signing and supported submission | Standard sends and note consumption from the user's wallet |
| **Wallet as signer** | SDK client, state synchronization and transaction construction | Supported signing | Workflows needing an app-managed client |
| **App-owned client** | Account context, client state and execution | Only capabilities separately requested | Deliberate app-owned demos and custom workflows |

For a wallet-managed app, start with [Connect to Bread](./bread-wallet-integration.md). For an app-managed client with wallet signing, use [External signers](../tools/clients/react-sdk/signers.md). The template's counter is an app-owned example even when its wallet control is connected.

<Callout variant="tip" title="Start with a supported operation">
Use standard sends or note consumption when they cover the task. Add a custom account or note only when the application needs a different contract, then build and test it with the matching toolchain.
</Callout>

## Model the request lifecycle

A click on Send does not immediately make funds spendable. Keep the following states visible and attach them to the original account and network:

| State | What the app should do |
| --- | --- |
| Before dispatch | Validate the account, network, asset, amount and destination; save the intended operation. |
| Wallet approval | Show that the user can approve or decline. A previous connection is not approval. |
| Request accepted | Save the returned request ID before waiting for its result. |
| Wallet result | Preserve the separate `txHash`; check chain inclusion if completion requires it. |
| Interrupted or uncertain | Restore the saved context and reconcile existing work before another submission. |
| Recipient receiving | For a send, distinguish note discovery/consumption from the sender's result. |

Account or network changes must not retarget pending work. Clear account-specific read caches, but retain the request's original context until its outcome is known. The [wallet-managed starter](https://github.com/0xMiden/frontend-template/blob/main/docs/mini-app-starter.md) demonstrates persist-before-dispatch recovery.

## Validate assets and request data

Identify a token by its network and issuing faucet, with the correct decimals for display. A symbol alone does not identify the asset or establish backing. The adapter's amount fields use positive safe-integer `number` values in base units; validate range and convert display amounts exactly.

Keep request parameters consistent with the transaction's actual effects. Use compatible SDK encodings for custom requests and rebuild serialized artifacts after incompatible upgrades. The [Bread integration guide](./bread-wallet-integration.md#custom-execution-and-signing) covers the custom envelope.

## Request only the capabilities you use

Detect the provider before connecting. Request private-data categories only for a named task and handle refusal as a normal outcome. Probe optional methods on the deployed provider: a declared TypeScript method is not proof that Bread implements it.

Your frontend must not receive private keys. Private notes and balances returned to the page become data that the app can observe, so define storage and disclosure behavior before requesting them.

## Continue with your app's behavior

<CardGrid cols={3}>
  <MiniAppCard title="Arcade games" page="arcade" eyebrow="Gameplay and results">
    Design a round, score it and handle any reviewed challenge flow.
  </MiniAppCard>
  <MiniAppCard title="Finance apps" page="finance" eyebrow="Assets and settlement">
    Explain fees, approval, receiving and recovery.
  </MiniAppCard>
  <MiniAppCard title="Other apps" page="others" eyebrow="Learning and utilities">
    Define a useful outcome with minimal account access.
  </MiniAppCard>
</CardGrid>
