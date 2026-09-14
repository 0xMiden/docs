---
sidebar_position: 5
title: "Assets, Vault & Faucet Changes"
description: "AssetVaultKey becomes AssetId, the old AssetId becomes AssetClass, and faucet factories split by authentication scheme"
---

# Assets, Vault & Faucet Changes

:::warning Breaking Change
The asset model was renamed one level down. What was `AssetVaultKey` is now **`AssetId`**, and what was `AssetId` is now **`AssetClass`**. Because the name `AssetId` survives with a different meaning, a careless search-and-replace will compile and be wrong — do the `AssetId` → `AssetClass` rename first. Separately, the single `create_fungible_faucet` factory split into six auth-specific factories.
:::

## Quick Fix

```rust
// Before (0.15)
let key: AssetVaultKey = asset.vault_key();
let key = AssetVaultKey::new_fungible(faucet_id, callback_flag);

// After (0.16)
let id: AssetId = asset.id();
let id = AssetId::new_fungible(faucet_id);   // callback flag now lives on the AccountId
```

If you encounter errors, continue reading for detailed migration steps.

---

## Summary

The rename reflects a conceptual correction. The per-asset vault key is the thing that actually identifies an asset, so it took the name `AssetId`; the faucet-level identifier it used to share a name with describes a *class* of assets, so it became `AssetClass`.

This is the most dangerous rename in the release precisely because it is not a removal. `AssetId` still exists after the upgrade, so code referring to it keeps compiling while silently meaning something different. Rename in the right order and let the compiler find the rest.

:::note Several related types did not change
`AssetAmount`, `AssetComposition`, and `AssetCallbackFlag` all existed in 0.15 and are unchanged. `AssetVault::get_balance` already returned `AssetAmount` in 0.15 — only its parameter type was renamed. If you saw `AssetAmount` described as new, that applies to the [client surface](./client-changes), not the protocol.
:::

---

## `AssetVaultKey` → `AssetId`, and `AssetId` → `AssetClass`

### Summary

The vault key type was renamed to `AssetId`, the previous `AssetId` became `AssetClass`, and `Asset::vault_key()` became `Asset::id()`. `AssetIdHash` is the corresponding hash type.

### Affected Code

```rust
// Before (0.15)
let key: AssetVaultKey = asset.vault_key();
let balance: AssetAmount = vault.get_balance(vault_key)?;
let key = AssetVaultKey::new_fungible(faucet_id, callback_flag);
```

```rust
// After (0.16)
let id: AssetId = asset.id();
let balance: AssetAmount = vault.get_balance(asset_id)?;
let id = AssetId::new_fungible(faucet_id);
// or, fully explicit:
let id = AssetId::new(asset_class, faucet_id, composition);
```

Note that `AssetId::new_fungible` **no longer takes a callback flag**. Whether a faucet's assets trigger callbacks is encoded in the account ID itself, set at construction time via `AccountBuilder::with_asset_callbacks`.

`Asset` itself is unchanged in shape — still an enum with `Fungible` and `NonFungible` variants — and `FungibleAsset::new(faucet_id, amount)` keeps its signature.

### Migration Steps

1. Rename `AssetId` → `AssetClass` **first**, throughout your codebase.
2. Then rename `AssetVaultKey` → `AssetId`.
3. Replace `asset.vault_key()` with `asset.id()`.
4. Drop the callback-flag argument from `new_fungible` calls; set it on the account instead with `with_asset_callbacks`.
5. Re-index any persisted vault or asset data. Serialized asset identifiers are not compatible across the rename.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `cannot find type AssetVaultKey` | Renamed | Use `AssetId`. |
| `no method named vault_key` | Renamed | Use `id()`. |
| `this function takes 1 argument but 2 were supplied` on `new_fungible` | Callback flag removed | Drop it; set `with_asset_callbacks` on the account. |
| Type mismatch where `AssetId` used to work | `AssetId` now means the vault key | The old meaning is `AssetClass`. |

---

## Faucet factories split by authentication scheme

### Summary

`create_fungible_faucet` took an `AuthMethod` and an `AccessControl` argument and dispatched internally. Since `AuthMethod` was removed (see [Account Changes](./account-changes#approver-and-approverset-replace-raw-key-arguments)), the factory split into one function per authentication scheme, each taking a concrete auth component.

### Affected Code

```rust
// Before (0.15)
pub fn create_fungible_faucet(
    init_seed: [u8; 32],
    faucet: FungibleFaucet,
    account_type: AccountType,
    auth_method: AuthMethod,
    access_control: AccessControl,
    token_policy_manager: TokenPolicyManager,
) -> Result<Account, FungibleFaucetError>
```

```rust
// After (0.16)
pub fn create_singlesig_user_fungible_faucet(
    init_seed: [u8; 32],
    faucet: FungibleFaucet,
    auth_component: AuthSingleSig,
    token_policy_manager: TokenPolicyManager,
    account_type: AccountType,
) -> Result<Account, FungibleFaucetError>
```

Note that the parameter **order** changed as well as the parameter list — `account_type` moved to the end.

The full set of factories:

| Faucet kind | v0.16 factory |
| --- | --- |
| Fungible, single signature | `create_singlesig_user_fungible_faucet` |
| Fungible, multisig | `create_multisig_user_fungible_faucet` |
| Fungible, guarded multisig | `create_guarded_user_fungible_faucet` |
| Fungible, network account | `create_network_fungible_faucet` |
| Non-fungible, user account | `create_user_non_fungible_faucet` |
| Non-fungible, network account | `create_network_non_fungible_faucet` |

Non-fungible faucet factories are new in this release; 0.15 shipped only the fungible factory.

### Migration Steps

1. Choose the factory matching your authentication scheme and pass a concrete auth component instead of an `AuthMethod`.
2. Drop the `access_control` argument. The factories install `Authority::AuthControlled` and the pausable components for you.
3. Check the argument order — `account_type` is now last.
4. Expect a different account ID for a faucet rebuilt from the same seed, since the component set and names changed.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `cannot find function create_fungible_faucet` | Split into per-scheme factories | Use the matching factory from the table. |
| `cannot find type AuthMethod` | Removed | Pass a concrete auth component. |
| Arguments of the wrong type | Parameter order changed | `account_type` moved to the end. |

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `cannot find type AssetVaultKey` | Renamed to `AssetId` | Rename, after renaming old `AssetId` to `AssetClass`. |
| Silent behaviour change around asset identity | `AssetId` kept its name with a new meaning | Audit every `AssetId` reference. |
| Persisted vault lookups miss after upgrading | Asset identifier serialization changed | Re-index persisted vault data. |
| `cannot find function create_fungible_faucet` | Factories split | Use the auth-specific factory. |
