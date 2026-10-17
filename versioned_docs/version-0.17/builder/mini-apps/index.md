---
sidebar_position: 1
title: "Mini-apps"
description: "Build, integrate, test and publish web applications for Bread's app browser."
---

# Mini-apps

A Bread mini-app is a web application used through Bread's supported app surfaces. Games, financial apps and financial utilities, learning content, NFTs and other tools share the same integration and registration boundaries. Native mobile launches use the embedded dApp browser; the extension's Explore opens an app in a browser tab. The injected wallet provider can request a connection, permission, signature or supported transaction. Your application still owns its frontend, hosted URL and business logic; provider injection does not create another mini-app SDK or an automatic listing API.

Explore has **All, Finance, Arcade, Others**: All aggregates apps, Finance contains financial apps/utilities, Arcade contains games and a custom native view, and Others contains remaining utilities, NFTs and learning. The catalog contract implemented in [wallet-config PR10](https://github.com/0xMiden/wallet-config/pull/10) and [wallet PR1512](https://github.com/0xMiden/wallet/pull/1512) uses `finance`, `arcade` and `others` directly. All is never a submitted category. Individual games continue to launch through the existing dApp browser; the earlier standalone Arcade-site proposal is superseded.

**Rollout status, 17 October 2026:** the catalog, matching reader and native Arcade flow have local verification, but the PRs are unmerged. Merge the config before releasing the reader and verify published snapshots and each claimed platform. Older wallets continue to read wallet-explore; legacy category conversion is confined to persisted cached data in the new reader. See [registration and rollout](./publishing-and-explore.md).

Native Bread 1.17.3 introduced optional [fullscreen presentation](./bread-wallet-integration.md#optional-native-fullscreen). Use it when it helps the app, while retaining a usable ordinary layout and explicit wallet approvals.

Design the first visit around a useful or enjoyable task that gives someone a reason to try Bread. Let visitors understand the value before requesting wallet access. A game practice round, financial preview or learning exercise can work without a transaction when its product allows it; state any account, asset or payment requirement clearly. Shared links and install/open-in-Bread routes need their own verified implementation.

For an operation that needs the wallet, detect the provider, connect with explicit permissions, request one supported operation and reconcile its result. Keep request acceptance, chain inclusion, note delivery and spendable recipient balance distinct. A good first integration can show those states without deploying a custom account or exposing private keys to the page.

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
4. Follow the behavior-specific guide: [Arcade games](./arcade.md), [Finance apps](./finance.md) or [Others](./others.md).
5. [Test and troubleshoot](./testing-and-troubleshooting.md): refusal, network mismatch, interrupted requests and recipient consumption on every claimed platform.
6. [Register and prepare Explore review](./publishing-and-explore.md): edit `explore/<network>.json` in wallet-config, validate the versioned catalog, obtain review and verify activation on a matching released reader.

Use [Standard notes](../smart-contracts/standards/standard-notes.md) and the [React SDK](../tools/clients/react-sdk/index.md) for the existing protocol/client interfaces. If you need a custom contract, use the [project template](https://github.com/0xMiden/project-template) and the [migration guide](../migration/index.md) rather than copying old serialized artifacts into a new release.

A hosted app, an accepted catalog entry and a working Mainnet route are separate deliverables. Listing grants no keys, private-state permission, signing authority, admission, liquidity or trust badge. Validate the actual wallet build and deployment before advertising those capabilities.
