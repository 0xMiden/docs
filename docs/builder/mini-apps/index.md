---
sidebar_position: 1
title: "Mini-apps"
description: "Build, integrate, test and publish web applications for Bread's app browser."
---

# Mini-apps

A Bread mini-app is a web application that can run inside the wallet's embedded app browser. It can use the injected wallet provider to request a connection, permission, signature or supported transaction. Your application still owns its frontend, hosted URL and business logic; provider injection does not create another mini-app SDK or an automatic listing API.

Start with a small, complete flow: open the app, detect the provider, connect with explicit permissions, request one supported operation and reconcile its result. Keep request acceptance, chain inclusion, note delivery and spendable recipient balance distinct. A good first integration can show those states without deploying a custom account or exposing private keys to the page.

## Choose the execution boundary

| Approach | Who owns client state and submission? | Use it when |
| --- | --- | --- |
| Wallet-managed operation | Bread builds/signs/submits a supported request and manages its account. | You need an existing user's wallet to send or consume notes. |
| Wallet as external signer | Your app manages an SDK client workflow; the connected wallet supplies supported signing. | Your application needs its own client synchronization and transaction construction. |
| App-owned client | Your application initializes its own client and supported signing/state workflow. | A public demo or application deliberately owns that account context. |

The public [frontend template](https://github.com/0xMiden/frontend-template) supplies a React/TypeScript/Vite starting point. Its counter demo uses an app-owned client even though the template also exposes a wallet connection control. Connecting that control does not turn the counter into a Bread-managed transaction. Choose the boundary deliberately before adapting it.

## Build the complete flow

1. [Set up a compatible project](./setup.md): packages, network, compiled artifacts and a fresh development environment.
2. [Build the application](./building.md): UI/state ownership, supported note/account behavior and explicit transaction stages.
3. [Integrate Bread](./bread-wallet-integration.md): provider detection, permission, a supported send and result reconciliation.
4. [Test and troubleshoot](./testing-and-troubleshooting.md): refusal, network mismatch, interrupted requests and recipient consumption on every claimed platform.
5. [Publish and prepare Explore review](./publishing-and-explore.md): hosted URL, catalog metadata, configuration review and activation checks.

Use [Standard notes](../smart-contracts/standards/standard-notes.md) and the [React SDK](../tools/clients/react-sdk/index.md) for the existing protocol/client interfaces. If you need a custom contract, use the [project template](https://github.com/0xMiden/project-template) and the [migration guide](../migration/index.md) rather than copying old serialized artifacts into a new release.

A hosted app, an accepted catalog entry and a working Mainnet route are separate deliverables. Listing grants no keys, private-state permission, signing authority, admission, liquidity or trust badge. Validate the actual wallet build and deployment before advertising those capabilities.
