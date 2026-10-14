---
sidebar_position: 2
title: "Prerequisites and setup"
description: "Start from the existing templates and align packages, artifacts and wallet/network context."
---

# Prerequisites and setup

Use a browser frontend and a compatible Miden deployment. Keep the wallet, app SDK, RPC, prover and private-note transport on a compatible release line. A reachable endpoint alone does not prove that an account, artifact or route works on that deployment.

Prefer the [agentic template](https://github.com/0xMiden/agentic-template) for a workspace with contract and frontend submodules and matching agent guidance. Clone first, preserve its pins and lockfiles, then diagnose the environment:

```bash
git clone --recurse-submodules https://github.com/0xMiden/agentic-template.git my-mini-app
cd my-mini-app
# Read AGENTS.md and docs/agent-first-v017.md before running build stages.
bash scripts/journey.sh doctor
```

Read the root and submodule instructions before installation. `setup.sh` can install global prerequisites; inspect its effects and use the authorized environment. For custom contracts, follow the template's contract, MockChain and real local-node gates before frontend contract integration. Starting services and submitting testnet transactions are separate execution stages.

For a frontend-only, wallet-managed operation, the [frontend template](https://github.com/0xMiden/frontend-template) supplies React, TypeScript, Vite, the Miden Vite plugin and a separate mini-app entry. Read its current README, package manifest and lockfile together. Install a Node/Yarn version supported by that checkout; do not replace individual SDK pins without reviewing the corresponding migration.

```bash
git clone https://github.com/0xMiden/frontend-template.git my-mini-app
cd my-mini-app
yarn install
yarn dev
```

The development server is the starting point for the frontend. The counter requires a compatible deployed counter address: set `VITE_MIDEN_COUNTER_ADDRESS` as the template documents, then restart Vite. Its default configuration is Testnet. A missing or old address is not repaired by connecting Bread, because this demo's increment uses the app-owned client.

## Review the wallet-managed starter

[Frontend-template PR33](https://github.com/0xMiden/frontend-template/pull/33) merged and adds a separate `/mini-app.html` entry with reusable code in `src/mini-app/`. Follow the [maintained starter recipe](https://github.com/0xMiden/frontend-template/blob/main/docs/mini-app-starter.md) for setup, package pins and checks. A recursive agentic clone preserves its checked-in frontend revision, which may predate this entry; inspect it before adopting the starter. Do not silently advance all submodules.

This entry asks Bread to build, sign and submit requests; it needs no counter deployment or app-owned client/database. Controlled-provider browser tests exercise the starter and released adapter, while actual Bread extension/native approval and chain settlement remain separate acceptance checks.

## Keep contract artifacts compatible

For a custom account or note, use the [project template](https://github.com/0xMiden/project-template) and its matching toolchain. The frontend counter expects its compiled account and note packages under `public/packages/`. Rebuild and copy the artifacts described by the template after changing contracts or upgrading the protocol; old account IDs, script roots, request bytes and package formats do not carry over automatically.

Use the [Rust contract/compiler migration guidance](../migration/10-rust-sdk-compiler.md) for the released compiler and SDK compatibility. Keeping contract sources in the contract project makes their build/release boundary visible instead of hiding it in the frontend.

## Choose wallet-managed or app-owned setup

For a wallet-managed send, follow [Bread integration](./bread-wallet-integration.md). Initialize adapters on the client, explicitly choose the supported network and request only needed permission categories. The checked recipe uses adapter 0.17.0 with SDK/React SDK 0.17.3; that check is separate from the template checkout's own package pins.

For an app-owned client, keep private state, notes, synchronization and submission in that client workflow. For a wallet as signer, use the existing [external signer guide](../tools/clients/react-sdk/signers.md); a signature does not reconstruct arbitrary private account state.

## Use a deliberate development environment

A disposable development profile can avoid reusing incompatible client stores, but never treat deleting storage as a harmless upgrade instruction for an existing wallet. The 0.16-to-0.17 migration can remove the default browser keystore along with its database; account/note exports from 0.16 do not import into 0.17. Read [Client Changes](../migration/07-client-changes.md) and preserve supported keys/private state before upgrading.

Keep Testnet/Devnet examples separate from consumer Mainnet admission. A developer endpoint override, installed wallet, catalog listing or successful connection grants no Mainnet invitation or route access. Use the correct account, faucet and supported funding flow on the intended deployment.
