---
sidebar_position: 2
title: "Bread developer endpoints"
description: "Configure compatible developer services before onboarding and understand Bread's endpoint-reset behavior."
---

# Bread developer endpoints

Bread's developer settings let a builder configure the wallet for a development or custom deployment. Use them with an account and services prepared for the same Miden protocol release. Endpoint reachability alone does not establish protocol compatibility or a working funding route.

For node setup, use [Local node testing](../clients/local-node-testing.md). For public service discovery, use [Network](../network.md). This page covers the wallet controls rather than repeating those service guides.

## Consumer access and temporary developer Testnet entry

The [canonical migration policy](https://github.com/0xMiden/wallet/issues/876) keeps ordinary consumers on invitation-gated Mainnet. A no-code consumer applies and waits; endpoint configuration does not grant admission.

The hidden seven-tap onboarding entry creates a developer Testnet wallet only while the installed client and Testnet remain compatible on the v0.17 line. It is not an existing Mainnet wallet's runtime network switch. The Mainnet announcement does not itself retire compatible Testnet access; the incompatible v0.18 Testnet migration ends this temporary path. Verify the actual onboarding control and release candidate before giving platform-specific instructions. Developer distribution after v0.18 remains undecided.

## Configure before onboarding

The reviewed wallet exposes the editable developer settings through a seven-tap logo unlock on the welcome screen, before a wallet is registered. It provides Testnet, Devnet, Localnet, and Custom preset choices.

1. Use a fresh development wallet/profile, with the signing material and private-state backup required by your intended account type.
2. Open developer settings before onboarding and choose the matching preset or Custom.
3. Set the network identity and endpoint URLs for your actual deployment. With Custom, a URL is not enough: the selected network identity must also match.
4. Check that the RPC, prover, and note transport use compatible services for the installed wallet SDK. Configure the relevant faucet, explorer, and Guardian as applicable.
5. Save, complete onboarding, sync, and verify the resulting account and configured fee asset on that deployment before funding or signing.

Custom network identity options also include Mainnet. That option is not evidence of Mainnet admission, a supported production provider route, or a safe transfer of an existing Testnet account's funds. Do not use endpoint overrides as a substitute for the network's supported access process.

## What each endpoint controls

| Endpoint | Responsibility |
| --- | --- |
| RPC | Query and submit to the selected Miden deployment. |
| Prover | Delegate proof generation when that workflow is enabled and supported. |
| Note transport | Deliver/discover relayed private notes. A successful RPC sync alone does not prove private-note delivery works. |
| Faucet page and API | Request or inspect development funding through the deployment's supported faucet flow. |
| Explorer | Inspect the intended network's public account, note, and transaction state. |
| Guardian | Use the operator compatible with the selected network and Guardian account workflow. |

Use deployment-owned configuration, not endpoint addresses copied from a different release. For Miden 0.17, RPC and note-transport compatibility changed together; consult [Migration](../../migration/index.md).

The form's health indicators are reachability checks, with a specific probe for the faucet API. A reachable service may still use the wrong release, asset, network, or account configuration. A failed probe may also be a browser/network-access problem; do not change system security settings merely to make it pass.

## Existing wallets and reset

After onboarding, the settings view for an active override is read-only. It offers a reset action rather than an editable network-switch form.

:::warning Destructive reset
The developer-settings reset clears local wallet data and vault/keys, removes the endpoint override, and reloads the wallet. The reviewed reset preserves the bridge-configuration and Explore-catalog version floors so a reset cannot make an older configuration acceptable. It does not migrate assets to another network or guarantee that private account state can be reconstructed. Keep the relevant account backups and recovery material before confirming it.
:::

The reset requires the wallet's destructive confirmation. Cancellation leaves it unstarted. If a wipe or reload reports failure, do not assume a complete reset or retry by deleting browser storage manually; inspect the reported state and use the supported recovery/reset flow.

The onchain account and balances do not become another network's account or funds because local storage was cleared. Likewise, an explorer URL change does not retarget a transaction already submitted. A migration involving protocol artifacts or private account state needs the matching release's [migration instructions](../../migration/index.md), not only new endpoints.

For private-state backup and restoration boundaries, see the [Guardian overview](../../miden-guardian/index.md) and the matching release's migration instructions.

## Testnet-to-Mainnet transition is a separate release choice

The developer-settings reset is not evidence that the consumer migration flow has shipped. Issue 876 leaves the final choice between an in-app confirmed reset and reinstall-and-start-fresh open. If the in-app option is selected, it starts fresh Mainnet onboarding, retains no Testnet archive, requires Guardian selection again and transfers no Testnet assets. Opening the upgrade entry or applying for access must not erase data. Cancel preserves local state and compatible v0.17 access without promising access beyond v0.18.

Existing Mainnet users unlock or restore their Mainnet wallet; invitation refusal, restoration and retry must never trigger the departing Testnet reset. Interrupted reset/setup needs release-candidate testing for repeated wipes, duplicate accounts and pending requests before consumer instructions are published.

## Verify a developer setup

- Confirm the active network label, effective RPC and account ID after reload.
- Sync and check the fee asset by faucet identity, rather than by a provisional symbol.
- Fund and execute only through a route supported on that deployment.
- Test private-note delivery separately from public RPC synchronization.
- For Guardian accounts, confirm the intended provider and freshness against the chain.
- Verify that extension, mobile, and desktop surfaces use the same intended configuration wherever you claim support.

The invitation and recovery contracts, reset scope, retirement timing and exact extension/iOS/Android candidate behavior require release-owner confirmation and execution checks.

## Implementation references

- [Developer settings](https://github.com/0xMiden/wallet/blob/main/src/screens/developer-settings/DeveloperSettings.tsx).
- [Preset and network options](https://github.com/0xMiden/wallet/blob/main/src/screens/developer-settings/preset.ts).
- [Effective endpoint configuration](https://github.com/0xMiden/wallet/blob/main/src/lib/miden-chain/effective-endpoints.ts).
- [Wallet reset implementation](https://github.com/0xMiden/wallet/blob/main/src/lib/miden/reset.ts).
