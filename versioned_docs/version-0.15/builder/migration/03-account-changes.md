---
sidebar_position: 3
title: "Account Changes"
description: "AccountType/AccountStorageMode rework, network-account allowlist, typed roots, and auth/policy renames in v0.15"
---

# Account Changes

:::warning Breaking Change
The v0.15 release simplifies the account ID so that its prefix no longer encodes whether the account is a faucet or regular account, whether its code is mutable, or whether it is a network account. The old `AccountType` enum is removed, `AccountStorageMode` is renamed to `AccountType` (`{ Private, Public }`), and the account ID version is renamed `0` → `1`. All of the changes below require code updates when migrating from v0.14.
:::

## `AccountType` removed; `AccountStorageMode` renamed to `AccountType`

### Summary

The account ID was simplified so its prefix no longer encodes whether the account is a faucet/regular account or whether its code is mutable. As a result:

- The old `AccountType` enum (`FungibleFaucet`, `NonFungibleFaucet`, `RegularAccountImmutableCode`, `RegularAccountUpdatableCode`) is **removed**.
- `AccountStorageMode` is **renamed to `AccountType`** and trimmed to `{ Private, Public }` (the `Network` variant is gone — see the next section).
- The `AccountId` accessors `is_faucet()`, `is_regular_account()`, `storage_mode()`, `is_network()`, and the old `account_type()` semantics no longer exist. `AccountId::account_type()` now returns the visibility‑style `AccountType` (`Private`/`Public`).
- The account ID **version is renamed 0 → 1**; encoded version `0` is now invalid.

Faucet‑vs‑regular is now a property of the account's *code/components*, not its ID.

### Affected Code

```rust
// 0.15 — new API:
use miden_protocol::account::AccountType;                      // formerly AccountStorageMode
let kind: AccountType = account_id.account_type();             // Private / Public
let is_pub = account_id.is_public();
// "is this a faucet?" now comes from the account's code/interface, not the id.
```
`AccountId::new(seed, version, ..)` keeps the same parameters, but `version` must be `AccountIdVersion::Version1` (`Version0` no longer exists).

### Migration Steps

1. Replace imports of `AccountStorageMode` with `AccountType`; the variants are `Private` / `Public`.
2. Delete the old `AccountType` import (`Regular*`/`*Faucet`); that enum is gone.
3. Replace `id.storage_mode()` with `id.account_type()` (or `id.is_public()` / `id.is_private()`).
4. Replace `id.is_faucet()` / `id.is_regular_account()` with checks on the account's code/components.
5. Replace `AccountIdVersion::Version0` with `Version1`; regenerate any persisted account IDs.

---

## `AccountStorageMode::Network` removed; network accounts via an allowlist

### Summary

The `Network` storage mode was removed (`AccountStorageMode` itself is now `AccountType`). An account is now recognised as a network account by the presence of a standardized **`NetworkAccountNoteAllowlist`** storage slot, with helpers `NetworkAccount` (a wrapper for identification) and the `AuthNetworkAccount` auth component. `AccountId::is_network()` is gone.

### Migration Steps

1. Remove any use of `AccountStorageMode::Network`; pick `Public` and add the network‑account components (`AuthNetworkAccount::with_allowed_notes(...)`).
2. Replace `id.is_network()` with `NetworkAccount::new(account)` / the `NetworkAccountNoteAllowlist` slot check.

---

## `AuthNetworkAccount` gains a tx‑script allowlist

### Summary

*(v0.15.2)* The `AuthNetworkAccount` auth component previously banned transaction scripts outright. It now gates them with a **root allowlist**, so approved tx scripts (e.g. setting the expiration delta) can run. The note‑allowlist constructor `with_allowlist` was renamed to **`with_allowed_notes`** to pair with the new **`with_allowed_tx_scripts`** setter.

### Migration Steps

1. Rename `AuthNetworkAccount::with_allowlist(...)` to `with_allowed_notes(...)`.
2. To permit specific transaction scripts, chain `.with_allowed_tx_scripts(roots)` (an empty set — the default — permits none).

---

## `procedure_digest!` → `procedure_root!`; new `NoteScriptRoot` / `AccountComponentName`

### Summary

Several root/identifier values gained dedicated newtypes:

- The `procedure_digest!` macro is renamed **`procedure_root!`**. It now returns an `AccountProcedureRoot` (instead of `Word`) and takes an `AccountComponentCode` (`Component::code()`) instead of a library‑producing closure.
- `NoteScript::root()` returns a new **`NoteScriptRoot`** newtype instead of `Word` (convert with `.into()`).
- A new **`AccountComponentName`** string wrapper validates component names.

### Migration Steps

1. Rename `procedure_digest!` → `procedure_root!` and pass `Component::code()` as the last argument; the static is now a `LazyLock<AccountProcedureRoot>`.
2. Update bindings of `note_script.root()` to `NoteScriptRoot` (convert with `.into()` / `Word::from(..)` where a `Word` is needed).
3. Use `AccountComponentName::new(...)` where a validated component name is required.

---

## `is_compatible_with` removed; auth/policy renames

### Summary

A handful of standards‑library APIs changed:

- `StandardNote::is_compatible_with` and `AccountInterfaceExt::is_compatible_with` were **removed** — perform compatibility checks via the account interface directly.
- The guarded‑multisig API was renamed `AuthMultisigGuardian` → `AuthGuardedMultisig` (the `guardian` auth namespace is retained).
- `OwnerControlledBlocklist` was renamed `BlocklistOwnerControlled`.
- New standard components were added: `Pausable`, `Authority`, allowlist/blocklist transfer policies, and `FungibleTokenMetadata`.
