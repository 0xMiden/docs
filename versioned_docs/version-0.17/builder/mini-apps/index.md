---
sidebar_position: 1
title: "Mini-apps"
description: "Build, integrate, test and publish web applications for Bread's app browser."
---

# Mini-apps

A Bread mini-app is a web application used through Bread's supported app surfaces. Games, financial apps and financial utilities, learning content, NFTs and other tools share the same integration and registration boundaries. Native mobile launches use the embedded dApp browser; the extension's Explore opens an app in a browser tab. The injected wallet provider can request a connection, permission, signature or supported transaction. Your application still owns its frontend, hosted URL and business logic; provider injection does not create another mini-app SDK or an automatic listing API.

The confirmed Explore direction is **All, Finance, Arcade, Others**: All aggregates apps, Finance contains financial apps/utilities, Arcade contains games and a custom native view, and Others contains remaining utilities, NFTs and learning. [Wallet issue 1452](https://github.com/0xMiden/wallet/issues/1452) tracks implementation and compatibility with existing catalog categories. Individual games continue to launch through the existing dApp browser; the earlier standalone Arcade-site proposal is superseded. Do not treat these target groups as accepted configuration values before the schema/reader migration.

Native Bread 1.17.3 introduced optional [fullscreen presentation](./bread-wallet-integration.md#optional-native-fullscreen). Use it when it helps the app, while retaining a usable ordinary layout and explicit wallet approvals.

Start with a small, complete flow: open the app, detect the provider, connect with explicit permissions, request one supported operation and reconcile its result. Keep request acceptance, chain inclusion, note delivery and spendable recipient balance distinct. A good first integration can show those states without deploying a custom account or exposing private keys to the page.

## Choose the execution boundary

| Approach | Who owns client state and submission? | Use it when |
| --- | --- | --- |
| Wallet-managed operation | Bread builds/signs/submits a supported request and manages its account. | You need an existing user's wallet to send or consume notes. |
| Wallet as external signer | Your app manages an SDK client workflow; the connected wallet supplies supported signing. | Your application needs its own client synchronization and transaction construction. |
| App-owned client | Your application initializes its own client and supported signing/state workflow. | A public demo or application deliberately owns that account context. |

The public [frontend template](https://github.com/0xMiden/frontend-template) supplies a React/TypeScript/Vite starting point. Its counter demo uses an app-owned client even though the template also exposes a wallet connection control. Connecting that control does not turn the counter into a Bread-managed transaction. Choose the boundary deliberately before adapting it.

The wallet-managed starter merged in [frontend-template PR33](https://github.com/0xMiden/frontend-template/pull/33). Its [maintained recipe](https://github.com/0xMiden/frontend-template/blob/main/docs/mini-app-starter.md) covers the `/mini-app.html` entry and reusable `src/mini-app/` code. The agentic template can pin an earlier frontend revision; inspect the submodule and choose a compatible revision deliberately. The starter's controlled-provider tests do not establish real Bread extension/native acceptance or chain settlement.

## Build the complete flow

1. [Set up a compatible project](./setup.md): packages, network, compiled artifacts and a fresh development environment.
2. [Build the application](./building.md): UI/state ownership, supported note/account behavior and explicit transaction stages.
3. [Integrate Bread](./bread-wallet-integration.md): provider detection, permission, a supported send and result reconciliation.
4. [Test and troubleshoot](./testing-and-troubleshooting.md): refusal, network mismatch, interrupted requests and recipient consumption on every claimed platform.
5. [Register and prepare Explore review](./publishing-and-explore.md): hosted URL, wallet-config registration metadata, review and activation checks. The current released reader still uses wallet-explore; catalog consolidation is an explicit gate.

Use [Standard notes](../smart-contracts/standards/standard-notes.md) and the [React SDK](../tools/clients/react-sdk/index.md) for the existing protocol/client interfaces. If you need a custom contract, use the [project template](https://github.com/0xMiden/project-template) and the [migration guide](../migration/index.md) rather than copying old serialized artifacts into a new release.

A hosted app, an accepted catalog entry and a working Mainnet route are separate deliverables. Listing grants no keys, private-state permission, signing authority, admission, liquidity or trust badge. Validate the actual wallet build and deployment before advertising those capabilities.
