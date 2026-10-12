---
sidebar_position: 2
title: "Prerequisites and setup"
description: "Start from the existing templates and align packages, artifacts and wallet/network context."
---

# Prerequisites and setup

Use a browser frontend and a compatible Miden deployment. Keep the wallet, app SDK, RPC, prover and private-note transport on a compatible release line. A reachable endpoint alone does not prove that an account, artifact or route works on that deployment.

The [frontend template](https://github.com/0xMiden/frontend-template) already supplies React, TypeScript, Vite, the Miden Vite plugin, SDK hooks and a counter demo. Read its current README, package manifest and lockfile together. Install a Node/Yarn version supported by that checkout; do not replace individual SDK pins without reviewing the corresponding migration.

```bash
git clone https://github.com/0xMiden/frontend-template.git my-mini-app
cd my-mini-app
yarn install
yarn dev
```

The development server is the starting point for the frontend. The counter requires a compatible deployed counter address: set `VITE_MIDEN_COUNTER_ADDRESS` as the template documents, then restart Vite. Its default configuration is Testnet. A missing or old address is not repaired by connecting Bread, because this demo's increment uses the app-owned client.

## Keep contract artifacts compatible

For a custom account or note, use the [project template](https://github.com/0xMiden/project-template) and its matching toolchain. The frontend counter expects its compiled account and note packages under `public/packages/`. Rebuild and copy the artifacts described by the template after changing contracts or upgrading the protocol; old account IDs, script roots, request bytes and package formats do not carry over automatically.

Use the [Rust contract/compiler migration guidance](../migration/10-rust-sdk-compiler.md) for the released compiler and SDK compatibility. Keeping contract sources in the contract project makes their build/release boundary visible instead of hiding it in the frontend.

## Choose wallet-managed or app-owned setup

For a wallet-managed send, follow [Bread integration](./bread-wallet-integration.md). Initialize adapters on the client, explicitly choose the supported network and request only needed permission categories. The checked recipe uses adapter 0.17.0 with SDK/React SDK 0.17.3; that check is separate from the template checkout's own package pins.

For an app-owned client, keep private state, notes, synchronization and submission in that client workflow. For a wallet as signer, use the existing [external signer guide](../tools/clients/react-sdk/signers.md); a signature does not reconstruct arbitrary private account state.

## Use a deliberate development environment

A disposable development profile can avoid reusing incompatible client stores, but never treat deleting storage as a harmless upgrade instruction for an existing wallet. The 0.16-to-0.17 migration can remove the default browser keystore along with its database; account/note exports from 0.16 do not import into 0.17. Read [Client Changes](../migration/07-client-changes.md) and preserve supported keys/private state before upgrading.

Keep Testnet/Devnet examples separate from consumer Mainnet admission. A developer endpoint override, installed wallet, catalog listing or successful connection grants no Mainnet invitation or route access. Use the correct account, faucet and supported funding flow on the intended deployment.
