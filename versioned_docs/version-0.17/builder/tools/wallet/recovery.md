---
sidebar_position: 3
title: "Bread recovery and backup"
description: "Distinguish account keys, private state, notes, history, and Guardian provider recovery."
---

# Bread recovery and backup

Recovering a Miden wallet involves more than recovering a signing key. Private account state, unconsumed notes, and application history have different recovery sources and completeness limits. Choose backup material for the account type and import path you actually use.

The [Guardian overview](../../miden-guardian/index.md) explains the service's custody, privacy, and liveness boundaries. The [Guardian SDK reference](../../miden-guardian/reference/multisig-sdk.md) already documents state/history access and note-recovery strategies. This page explains Bread's wallet-level distinctions without redefining the SDK contract.

## Know what you are restoring

| Material or source | Role | Limit |
| --- | --- | --- |
| Recovery phrase or appropriate account key | Re-establish signing authority for supported derivation/import paths. | Key possession alone does not reconstruct arbitrary private state or all notes. |
| Encrypted wallet file | Carries wallet/client data and the supported account backup records. | File-format and SDK-artifact compatibility still apply; a file must decrypt and pass validation. |
| Guardian account state | Supplies private state retained by the selected operator under its authenticated access rules. | Requires an available operator, appropriate authorization, and verification against chain commitments. |
| Private-note transport | Can recover retained relayed note data. | Retention is bounded, and out-of-band private notes may never have been relayed. |
| Public-note backfill | Can discover relevant public note history. | Does not reconstruct unpublished private-note bodies. |
| Guardian canonical history | Can reconstruct retained transaction/note summaries. | Display history and spendable private state are different recovery products. |

Bread's encrypted backup format includes supported imported-account records as well as its phrase-derived wallet data. An imported account need not be derivable from the wallet's phrase. Do not discard its supported file/key backup on the assumption that the phrase covers every account in the wallet.

## Guardian lookup and account recovery

Bread's recovery flow can probe known providers and offer a custom provider URL. A negative lookup does not prove the account never existed: the selected network/operator, registration, service availability, or available credentials may differ.

The reviewed hot-key import path is restricted to Guardian accounts. It is not a generic way to reconstruct any public or private account from a device key. A recovery credential must match the account's supported key topology and intended recovery action.

After obtaining account state, verify it against the chain and resume note recovery. Bread's recovery code can perform private transport, public-note and history work over time; partial progress is not proof that the whole inbox or transaction history has been reconstructed.

Use the [existing SDK reference](../../miden-guardian/reference/multisig-sdk.md) for the precise `recoverNotes` reports, retained history, retry behavior and unsupported recovery sources. A successful account import does not establish that every spendable note or previous activity row is present.

## Device keys and provider rotation

Replacing a device hot key and changing the Guardian provider are distinct operations. Recovery-sensitive actions use account-appropriate authorization; an ordinary connected dApp session is not recovery authority.

Bread keeps recovery authorization bound to the intended transaction/action, rather than treating phrase entry as reusable authorization for unrelated requests. The wallet manages that material for the active flow. Applications should use the supported wallet flow rather than collecting recovery secrets themselves.

A submitted provider change is not necessarily a confirmed provider binding. Bread verifies pending rotation against onchain state and can keep the account in a pending-rotation state while confirmation is unresolved. Do not present a new provider as authoritative only because its URL was entered or an operation was queued.

The underlying Guardian SDK documents the loss of recovery sources that can accompany rotation. Follow those limits and preserve needed notes/backups; a new operator is not a guarantee that every old private recovery source remains available.

## Files, versions and ambiguous results

Validate the encrypted file and supported account records before importing them. A decryptable envelope can still contain unsupported or malformed data. Bread explicitly distinguishes newer unsupported backup formats and failures to restore particular imported accounts.

For the 0.16-to-0.17 upgrade, account/note exports and old serialized artifacts do not carry over. The default browser keystore shares the database that the 0.17 client resets. Back up supported signing material and handle private notes on the compatible old release before upgrading; an old file or phrase alone is not a promise of complete restoration.

Protocol upgrades can also invalidate client stores or serialized artifacts. See [Migration](../../migration/index.md) before restoring a file into a different release. Do not assume that changing the network endpoints makes an old private database compatible.

For a failed or interrupted restoration:

- Confirm the network, account identity, recovery material and intended provider.
- Keep successful partial recovery progress and reconcile pending onchain actions before resubmission.
- Distinguish account-state recovery from pending-note recovery and activity-history completeness.
- Retain private backups when a service's recovery coverage is unavailable or incomplete.

For an already admitted Mainnet account, recover ownership and required private state and reconcile the existing account. A consumed original invitation alone does not require creating a new account or redeeming another code. The [canonical migration policy](https://github.com/0xMiden/wallet/issues/876) leaves service access after revocation or unavailability to the admission/recovery contract; it does not authorize resetting an existing Mainnet wallet.

The reviewed wallet's total recovery dispatcher is explicitly shadow-only. Its classifier is diagnostic evidence, not a promise that every route it names currently drives the UI or repair behavior.

## Implementation references

- [Wallet backup validation](https://github.com/0xMiden/wallet/blob/main/src/lib/miden/backup-file.ts).
- [Guardian note recovery](https://github.com/0xMiden/wallet/blob/main/src/lib/miden/back/guardian-recovery.ts) and [history recovery](https://github.com/0xMiden/wallet/blob/main/src/lib/miden/back/guardian-history-recovery.ts).
- [Recovery authorization](https://github.com/0xMiden/wallet/blob/main/src/lib/miden/back/recovery-authorization.ts).
- [Shadow recovery dispatcher](https://github.com/0xMiden/wallet/blob/main/src/lib/miden/back/guardian-recovery-dispatcher.ts).
