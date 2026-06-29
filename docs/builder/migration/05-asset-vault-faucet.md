---
sidebar_position: 5
title: "Assets, Vault & Faucet"
description: "AssetAmount newtype, AssetVaultKey balance lookups, the unified FungibleFaucet component, and AssetComposition changes in v0.15"
---

# Assets, Vault & Faucet

:::warning Breaking Change
Fungible amounts are now a validated `AssetAmount` newtype rather than a raw `u64`. The separate `BasicFungibleFaucet` and `NetworkFungibleFaucet` components are unified into a single `FungibleFaucet` (built with a `bon` builder) configured by a `TokenPolicyManager`. Vault balance lookups now take an `AssetVaultKey` instead of an `AccountId`.
:::

---

## `FungibleAsset::amount()` / `get_balance()` return `AssetAmount`

### Summary

A new validated `AssetAmount` newtype wraps fungible amounts. `FungibleAsset::amount()` now returns `AssetAmount` (was `u64`), and `AssetVault::get_balance()` returns `Result<AssetAmount, AssetError>` (was `Result<u64, AssetVaultError>`) **and takes an `AssetVaultKey` instead of an `AccountId`**. The vault key carries the asset's `AssetComposition`, so balance lookups are explicit about fungible‑vs‑non‑fungible.

### Affected Code

```rust
// 0.15 — new API:
use miden_protocol::asset::{AssetAmount, AssetCallbackFlag, AssetVaultKey};
let amt: AssetAmount = fungible_asset.amount();
let raw: u64 = amt.as_u64();                  // or: u64::from(amt)
let key = AssetVaultKey::new_fungible(faucet_id, AssetCallbackFlag::Disabled);
let bal: AssetAmount = vault.get_balance(key)?;
```
`AssetAmount` implements `From<u8/u16/u32>` and `TryFrom<u64>` (validating against the max fungible amount), plus `Add`/`Sub` and `Display`.

### Migration Steps

1. Wrap `u64` amounts you pass into faucet/asset constructors in `AssetAmount` (`AssetAmount::from(n)` for small ints, `AssetAmount::try_from(n)` for `u64`).
2. Unwrap `AssetAmount` back to `u64` with `.as_u64()` / `u64::from(_)` where a raw integer is needed.
3. Replace `vault.get_balance(faucet_id)` with `vault.get_balance(AssetVaultKey::new_fungible(faucet_id, callback_flag))`.
4. Update error handling from `AssetVaultError` to `AssetError` on `get_balance`.

---

## `FungibleFaucet` replaces `BasicFungibleFaucet` + `NetworkFungibleFaucet`

### Summary

The separate `BasicFungibleFaucet` and `NetworkFungibleFaucet` components were merged into a single **`FungibleFaucet`** component, and its old `FungibleFaucetBuilder` was replaced with a `bon`‑generated builder (`FungibleFaucet::builder()`). The constructor accepts a structured `TokenName` plus optional token‑metadata fields and an `AssetAmount` `max_supply`. A companion `FungibleTokenMetadata` component exposes the metadata via MASM getters. For the end‑to‑end client construction recipe (with `TokenPolicyManager`), see [(Rust) `FungibleFaucet` builder + `TokenPolicyManager`](./07-client-changes.md#rust-fungiblefaucet-builder--tokenpolicymanager-construction).

### Affected Code

```rust
// 0.15 — new API:
use miden_protocol::asset::{AssetAmount, TokenSymbol};
use miden_standards::account::faucets::{FungibleFaucet, TokenName};
let faucet = FungibleFaucet::builder()
    .name(TokenName::new("My Token")?)
    .symbol(TokenSymbol::new("MTK")?)
    .decimals(8)
    .max_supply(AssetAmount::from(1_000_000u32))
    .build()?;
```

### Migration Steps

1. Replace `BasicFungibleFaucet` / `NetworkFungibleFaucet` imports with `FungibleFaucet`.
2. Switch construction to `FungibleFaucet::builder()` with the required setters `name`, `symbol`, `decimals`, `max_supply`.
3. Convert `max_supply` from `Felt` to `AssetAmount`.

---

## `AssetComposition` and the `AssetVaultKey` composition byte

### Summary

A new **`AssetComposition`** enum (`None`, `Fungible`, `Custom`) discriminates assets, and the asset vault key's metadata byte now encodes the composition (plus the asset‑callback flag). `AssetVaultKey::new(asset_id, faucet_id, composition, callback_flag)` is the general constructor; `AssetVaultKey::new_fungible(faucet_id, callback_flag)` is the fungible shortcut. (`Custom` composition is reserved and currently rejected.)

**What composition means:** it describes how two instances of the same asset combine in a vault — `None` (non‑fungible: instances never merge), `Fungible` (instances merge by summing amounts), and `Custom` (reserved for faucet‑defined logic; rejected at construction today). Because composition is carried in the key's metadata byte rather than derived from the faucet ID, the vault key is self‑describing. Read it back with `AssetVaultKey::composition()` and the callback flag with `AssetVaultKey::callback_flag()`. See the [asset encoding reference](../../reference/protocol/asset#encoding) and [composition reference](../../reference/protocol/asset#composition) for the full layout, and [MASM Changes](./08-masm-changes.md#asset-vault-key-composition) for the procedure‑level effects.

### Migration Steps

1. Where you constructed a raw vault key word, use `AssetVaultKey::new_fungible` / `AssetVaultKey::new`.
2. Branch on `AssetComposition` (via `AssetVaultKey::composition()`) instead of inspecting raw bits.
