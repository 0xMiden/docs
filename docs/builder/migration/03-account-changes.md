---
sidebar_position: 3
title: "Account Changes"
description: "Accounts, asset IDs and note metadata carry versions, account procedures are sorted, AccountComponent::from_package takes the package by value, and network accounts install BasicWallet and need a real deploy transaction"
---

# Account Changes

:::warning Breaking Change
Accounts and asset IDs now carry a version, the note metadata version field widened, moving the note type, and `AccountCode` sorts its procedures after the auth procedure. Every account commitment changes, most multi-component accounts get a new code commitment and account ID from the same seed, and bytes serialized by 0.16 no longer load. None of this fails to compile. Separately, `AccountComponent::from_package` takes the `Package` by value, and a network account can no longer be deployed by an empty transaction.
:::

## Quick Fix

```rust
// Before (0.16)
let component = AccountComponent::from_package(&package, &init_storage_data)?;
let header: AccountHeader = account.into();

// After (0.17)
let component = AccountComponent::from_package(package, &init_storage_data)?;
let header = account.to_header();
```

Then discard every account, account header and delta you serialized with 0.16, and re-record every account ID or commitment you hard-coded. Neither shows up as a compile error.

If you encounter errors, continue reading for detailed migration steps.

---

## Summary

Most of what changes for accounts in 0.17 does not show up at compile time. Accounts and asset IDs gained a version, the note metadata version field widened, moving the note type, and account procedures are now sorted, so account commitments and serialized bytes differ from 0.16 for the same inputs, and so do the code commitments and account IDs of most multi-component accounts.

The compile breaks are small and mechanical: `from_package` takes the package by value, `with_asset_callbacks` became `enable_asset_callbacks`, `AccountHeader` converts only from a reference, `NoteCreator` moved, `AccountComponentInterface` gained two variants, the AggLayer builders changed, and a few error variants were renamed.

Network accounts change at run time. `AuthNetworkAccount::new` installs `BasicWallet` and allowlists P2ID, an empty deploy transaction aborts, and a 0.17 node silently never consumes notes for a network account built with a fee asset other than the chain's.

---

## Accounts, asset IDs and note metadata carry versions

### Summary

Nothing fails to compile, but almost every value derived from these objects changes:

- **Account commitment.** The header's first word is now `[version, nonce, id_suffix, id_prefix]` (it was `[nonce, 0, id_suffix, id_prefix]`), so every account commitment differs from 0.16 for the same state. Only version 1 exists, and `AccountHeader::new` sets it implicitly.
- **Asset ID word.** The metadata byte in the third element is now `[reserved(2) | composition(2) | version(4)]`, with version 1. A fungible asset ID's low byte goes `0x01` → `0x11`, a non-fungible one `0x00` → `0x01`. Asset vault keys (`AssetIdHash`), vault roots, note asset commitments, and therefore the IDs of notes carrying assets, all change. A word with version 0, such as an all-zero word, no longer decodes as an `AssetId`. The asset side is covered in [Assets, Vault & Faucet](./asset-vault-faucet).
- **Note metadata.** The version field widened from 4 to 6 bits and the note type moved from bit 4 to bit 6, so the metadata word and note commitment of every **public** note change. Private notes keep the same low byte. The transaction kernel now rejects input notes whose metadata version is not 1 or whose reserved bit is set.
- **Account delta and patch commitments.** The domain separators moved into the hasher capacity and gained a version, so `AccountDelta::to_commitment()`, which a `TransactionSummary` signs, differs for identical deltas.
- **Serialized bytes.** `Account`, `AccountHeader`, `AssetId`, `FungibleAsset`, `Asset` and `PartialNoteMetadata` (and so `Note`, `NoteHeader` and output notes) now lead with a version byte, `NoteHeader` writes the metadata first, and `AccountVaultDelta` has a new byte layout. A standalone `NonFungibleAsset` keeps its 0.16 byte layout. Do not load bytes written by 0.16: they are not guaranteed to fail with the version error, because a 0.16 fungible asset or public note starts with `0x01`, passes the version check, and fails, or misparses, further in. For anything you store or send, move to the Protobuf encodings in [`miden-objects`](./imports-dependencies#new-crates-and-the-miden-objects-name-trap) and use the `Serializable` / `Deserializable` byte formats as little as possible: they are to be removed before public mainnet.

MASM code that assembles asset ID words or note metadata by hand must use the new bit positions; see [MASM Changes](./masm-changes).

### Affected Code

```rust
// A 0.16 layout assumption that silently breaks in 0.17
let fungible_id_low_byte = asset_id.to_word()[2].as_canonical_u64() & 0xff; // 0x01 in 0.16, 0x11 in 0.17
```

### Migration Steps

1. Discard every stored 0.16 serialization of accounts, headers, assets, notes, note headers and deltas. Re-fetch or rebuild them with 0.17.
2. Recompute every hard-coded account commitment, asset ID word, vault key, asset commitment, note ID and note commitment: test vectors, fixtures, off-chain indexers, and bridge contracts that mirror Miden encodings.
3. Never build asset IDs or note metadata words by hand. Use `AssetId::new` / `AssetId::new_fungible` and `NoteMetadata` / `PartialNoteMetadata`.
4. Do not reuse signatures over 0.16 transaction summaries: the delta commitment they bind changed. See [Transaction Changes](./transaction-changes).

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `account version is {n} but only version 1 is supported` | Deserializing 0.16 `Account` or `AccountHeader` bytes; `{n}` is the first byte of the 0.16 bytes, not a version | Re-fetch with 0.17. |
| `asset version is 0 but only version 1 is supported` (non-fungible) or `unknown asset composition encoding: {n}` (fungible) | Deserializing 0.16 `AssetId`, `Asset` or `FungibleAsset` bytes | Re-fetch with 0.17. |
| `note version is {n} but only version 1 is supported` (`{n}` is 0 for a private note) or `discriminant {n} is not a valid NoteType` (public notes) | Deserializing 0.16 note or metadata bytes | Re-fetch with 0.17. |
| `unknown asset ID version: 0` (`AssetError::UnknownAssetIdVersion`) | Decoding a hand-built or empty asset ID word | Build IDs with `AssetId::new*`. |
| `account has an unsupported version {0}` | Header elements with a version other than 1 | Rebuild the header with 0.17. |
| `note metadata has an unsupported version` / `note metadata has a non-zero reserved bit` | Kernel check on an input note built from raw metadata words | Build metadata with the Rust types. |

---

## Account procedures are sorted: code commitments and account IDs change

### Summary

`AccountCode` keeps the auth procedure at index 0 and sorts every other procedure root in ascending order. The code commitment no longer depends on the order in which components were added, which also means it differs from 0.16 for most multi-component accounts, and so does the account ID ground from it. `AccountCode::from_parts` and deserialization reject unsorted or duplicate procedure lists, and the transaction kernel re-checks this for new accounts.

### Migration Steps

1. Do not rely on `account.code().procedures()[i]` following component order; look procedures up by root. In MASM, the indices of `active_account::get_procedure_root` follow the sorted order too.
2. If you call `AccountCode::from_parts` yourself, keep the auth procedure first and sort `procedures[1..]` ascending by `AccountProcedureRoot` ordering.
3. Recompute every hard-coded code commitment or account ID derived from a 0.16 build.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `account code procedures following the authentication procedure are not sorted in ascending order` | `AccountCode::from_parts` with unsorted procedures, or deserializing 0.16 code | Sort them, or rebuild with `AccountBuilder`. |
| `account procedures following the authentication procedure must be unique and sorted in ascending order` | Kernel check on a new account | Same. |

---

## Network accounts: `BasicWallet`, P2ID, a real deploy, and the chain's fee asset

### Summary

Four things change for network accounts, and only the first can fail to compile:

- **`AuthNetworkAccount::new` installs `BasicWallet` and allowlists P2ID.** Its component set now includes `BasicWallet`, and its default note allowlist gains the P2ID script root, so a network account can be funded, and deployed, by a P2ID note. `AuthNetworkAccount::custom` installs neither. `NetworkAccount::builder` and the network faucet factories go through `new`, so they inherit both.
- **An empty transaction no longer deploys a network account.** The network-account auth procedure now asserts, before it pays the fee, that the transaction consumed an input note, created an output note, or changed account state. A new account is not exempt. Expiration and other transaction metadata do not count, and a zero base fee does not help: the check sits outside the fee branch.
- **The account must be built with the chain's fee asset.** The protocol side is unchanged: `FeePolicyManager` writes its fee asset into the slot `FeePolicyManager::fee_asset_id_slot()`. What is new is the 0.17 node's network transaction builder, which refuses to execute for a network account whose slot differs from `ProtocolConfig::fee_asset_id()`. Notes sent to such an account are committed but never consumed, and the client sees no error.
- **(Web) P2ID is always allowlisted.** Every account built from `createNetworkAuthComponents` allowlists the P2ID script and prices it at zero unless you list the P2ID root with your own fee, so it consumes P2ID notes sent to it whether or not you listed that root.

### Affected Code

**Rust**

```rust
// Before (0.16)
let account = AccountBuilder::new(seed)
    .account_type(AccountType::Public) // the builder defaults to Private
    .with_components(AuthNetworkAccount::new(allowed_notes, fee_policy_manager)?)
    .with_component(BasicWallet)
    .build()?;
let [config_root, sponsorship_root] = AuthNetworkAccount::default_allowed_note_scripts();
```

```rust
// After (0.17)
let account = AccountBuilder::new(seed)
    .account_type(AccountType::Public)
    .with_components(AuthNetworkAccount::new(allowed_notes, fee_policy_manager)?) // includes BasicWallet
    .build()?;
// or: NetworkAccount::builder(seed, allowed_notes, fee_policy_manager)?.build()?
let [config_root, sponsorship_root, p2id_root] = AuthNetworkAccount::default_allowed_note_scripts();
```

Build `fee_policy_manager` with the chain's fee faucet, `protocol_config.fee_asset_id().faucet_id()`, never with a faucet minted for the purpose. Where the `ProtocolConfig` comes from is covered in [Transaction Changes](./transaction-changes) and [Client Changes](./client-changes).

**Web**

```typescript
// Before (0.16): any fee faucet, and a scriptless deploy
const components = AccountComponent.createNetworkAuthComponents([new NoteScriptFee(root, 0n)], myFaucet.id());
await client.transactions.submit(account.id(), new TransactionRequestBuilder().build());
```

```typescript
// After (0.17): the chain's fee faucet, and a deploy that consumes an allowlisted note
const components = AccountComponent.createNetworkAuthComponents(
  [new NoteScriptFee(root, 0n)],
  await client.feeFaucetId(),
);
await client.transactions.consume({ account: account.id(), notes: [allowlistedNoteId] });
```

:::caution The 0.17 docs sample has the wrong signature
The Web SDK's own 0.17.0 docs deploy a network account with `client.transactions.consume(account.id(), [allowlistedNoteId])`. The shipped signature is `consume({ account, notes })`, as above.
:::

### Migration Steps

**Rust**

1. Drop the explicit `.with_component(BasicWallet)` after `AuthNetworkAccount::new`. Leaving it in is redundant rather than fatal, because procedures are de-duplicated when components are merged.
2. Destructure `default_allowed_note_scripts()` as three roots: it returns `[NoteScriptRoot; 3]`.
3. If a network account must not accept P2ID deposits, build it with `AuthNetworkAccount::custom` and add only the roots you want.
4. Deploy a network account by consuming an allowlisted note in its first transaction. With `AuthNetworkAccount::new`, a P2ID note carrying the fee asset works.
5. Consuming a P2ID note on a network account still needs a fee schedule entry for P2ID. Unless that fee is zero, a `FeeSponsorshipNote` bound to the deposit must cover it.
6. Build the account's `FeePolicyManager` with the chain's fee faucet. The fee asset slot is written at creation, so an account built with the wrong faucet must be rebuilt.

**Web**

1. Pass `await client.feeFaucetId()`, after a sync, as the fee faucet of `createNetworkAuthComponents`. An account built with another faucet must be rebuilt: the fee asset is fixed at creation.
2. Deploy by consuming an allowlisted note (P2ID is allowlisted by default), or by an allowlisted transaction script that changes state; pass the script's root as the third argument of `createNetworkAuthComponents`. Output notes alone do not help, because the generated script is not allowlisted.
3. Expect network accounts to consume P2ID notes sent to them.

Emitting a note to a network account also caps the emitting transaction at 20 blocks; see [Transaction Changes](./transaction-changes).

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `network account transactions must have an effect before fee payment by consuming an input note, creating an output note, or changing account state` (in the Web SDK it may appear as `assertion failed with error code: <N>`) | Empty transaction against a network account | Consume an allowlisted note in the deploying transaction. |
| `error[E0527]: pattern requires 2 elements but array has 3` | Destructuring `default_allowed_note_scripts()` | Add the third (P2ID) element. |
| `network account fee asset does not match the protocol configuration` (node `ntx-builder` log only) | The account's fee asset slot differs from the chain's | Rebuild the account with the chain's fee faucet. |

---

## `AccountComponent::from_package` takes the `Package` by value

### Summary

The package is moved into the component instead of being cloned internally.

### Affected Code

```rust
// Before (0.16)
let component = AccountComponent::from_package(&package, &init_storage_data)?;
```

```rust
// After (0.17)
let component = AccountComponent::from_package(package, &init_storage_data)?;

// If you still need `package` afterwards:
let component = AccountComponent::from_package(package.clone(), &init_storage_data)?;

// From an Arc<Package>:
let component = AccountComponent::from_package(Arc::unwrap_or_clone(package), &init_storage_data)?;
```

### Migration Steps

Drop the `&` on the first argument, and clone first if you reuse the package.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `error[E0308]: mismatched types` (expected `Package`, found `&Package`) | Signature changed | Pass the package by value. |

---

## `AccountBuilder::with_asset_callbacks` replaced by `enable_asset_callbacks`

### Summary

The builder now derives the account's `AssetCallbackFlag` from its storage: installing either protocol-reserved asset-callback slot turns the flag on automatically. `enable_asset_callbacks()` only forces the flag on for an account that has no callback slot yet, so that it can add one by upgrade later. There is no way to force it off.

The flag is part of the account ID, so a faucet whose send or receive policy installs the callback slots gets a different ID than a 0.16 build that did not enable the flag. In 0.16.1 the single-sig and network fungible faucet factories already enabled the flag for a transfer policy; the multisig and guarded fungible factories, the non-fungible factories and hand-built accounts did not, so those are the ones whose ID changes for this reason. Independently of the flag, every standard faucet gets a new ID from the same seed in 0.17, because its code and storage commitments changed (sorted procedures, changed faucet MASM). See [Assets, Vault & Faucet](./asset-vault-faucet#faucets-with-a-transfer-policy-get-the-asset-callback-flag-automatically).

### Affected Code

```rust
// Before (0.16)
use miden_protocol::account::{AccountBuilder, AssetCallbackFlag};

let builder = AccountBuilder::new(seed).with_asset_callbacks(AssetCallbackFlag::Enabled);
```

```rust
// After (0.17)
use miden_protocol::account::AccountBuilder;

let builder = AccountBuilder::new(seed).enable_asset_callbacks();
```

### Migration Steps

1. Replace `.with_asset_callbacks(AssetCallbackFlag::Enabled)` with `.enable_asset_callbacks()`, or delete it if a component already installs a callback slot (for example a `TokenPolicyManager` with a send or receive policy).
2. Delete `.with_asset_callbacks(AssetCallbackFlag::Disabled)`. Disabled is the default, and it cannot be forced when a callback slot is installed.
3. If you construct an `Account` directly (`Account::new`, deserialization, genesis), an account whose storage holds a callback slot but whose ID has callbacks disabled is now rejected.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `no method named with_asset_callbacks found for struct AccountBuilder` | Method replaced | Use `enable_asset_callbacks()`. |
| `storage of account {0} contains an asset callback slot but its asset callback flag is disabled, so the callback would never be invoked` | `Account::new` with a callback slot and a disabled flag | Rebuild the account with the builder, which derives the flag. |
| `an account whose storage contains an asset callback slot must have the asset callback flag enabled` | The same, caught by the transaction kernel prologue for a new account | Same. |

---

## `AccountHeader` converts only from a reference; `to_header()` added

### Summary

`From<Account>` and `From<PartialAccount>` for `AccountHeader` were removed; the `&` implementations remain. Build a header from a reference, or with the new `to_header()`. `AccountHeader::new` is unchanged: the version is implicit, and only version 1 exists.

### Affected Code

```rust
// Before (0.16)
let header: AccountHeader = account.into();
let header = AccountHeader::from(partial_account);
```

```rust
// After (0.17)
let header = account.to_header();            // or AccountHeader::from(&account)
let header = partial_account.to_header();    // or AccountHeader::from(&partial_account)
```

### Migration Steps

1. Replace a by-value `into()` or `from(x)` with `x.to_header()` or `AccountHeader::from(&x)`.
2. For the renamed and re-typed `AccountError` variants, see [Error variants renamed or re-typed](#error-variants-renamed-or-re-typed).

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `the trait bound AccountHeader: From<Account> is not satisfied` | By-value conversion removed | Use `account.to_header()`. |

---

## `NoteCreator` moved to `account::note_creator`

### Summary

The `NoteCreator` component moved out of `account::wallets`. `NoteCreator::NAME` is unchanged (`"miden::standards::note::note_creator"`), so component metadata and storage schema commitments are unaffected. Its MASM package namespace moved from `miden::standards::components::wallets::note_creator` to `miden::standards::components::note::note_creator`; see [MASM Changes](./masm-changes).

### Affected Code

```rust
// Before (0.16)
use miden_standards::account::wallets::NoteCreator;
```

```rust
// After (0.17)
use miden_standards::account::note_creator::NoteCreator;
```

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `unresolved import miden_standards::account::wallets::NoteCreator` | Moved | Import `miden_standards::account::note_creator::NoteCreator`. |

---

## `AccountComponentInterface` gained two variants, and `AccountInterface` drops an empty `Custom`

### Summary

`AccountComponentInterface` is not `#[non_exhaustive]`, so two new variants break exhaustive matches:

- `AuthTxFeeCollector`, the new standard auth component that collects TX_FEE notes.
- `CustomAuth(AccountProcedureRoot)`, reported for an account whose auth procedure is not a standard one. In 0.16, `AccountInterface::from_account` and `from_code` panicked on such accounts (`account interface must contain exactly one auth component, found 0`).

`AccountInterface::components()` also changed shape. It used to always end with a `Custom(vec)` entry, empty when every procedure belonged to a standard component. It now omits `Custom` when nothing is left over, and a custom auth procedure appears as `CustomAuth(root)` instead of inside `Custom`.

:::info What the changelog leaves out
The changelog describes this as a fix for `AccountInterface::from_account` and `from_code` panicking on accounts with a custom auth component. It does not mention the new public `CustomAuth` variant, nor `AuthTxFeeCollector`, and both break exhaustive matches.
:::

### Affected Code

```rust
// After (0.17): add the two arms
match component {
    AccountComponentInterface::AuthSingleSig => { /* ... */ },
    // ... existing arms ...
    AccountComponentInterface::AuthTxFeeCollector => { /* new standard auth component */ },
    AccountComponentInterface::CustomAuth(auth_procedure_root) => { /* non-standard auth */ },
    AccountComponentInterface::Custom(procedure_roots) => { /* ... */ },
}
```

### Migration Steps

1. Add arms for `AuthTxFeeCollector` and `CustomAuth(_)` wherever you match `AccountComponentInterface`. Both return `true` from `is_auth_component()`.
2. Remove any workaround that caught the old panic for custom-auth accounts.
3. Do not index `components().last()` expecting `Custom`; search for it with `iter().find(..)`, and treat a missing `Custom` entry as "no custom procedures".

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `error[E0004]: non-exhaustive patterns` naming `AccountComponentInterface::AuthTxFeeCollector` or `CustomAuth(_)` | New variants | Add the arms. |

---

## `StorageMap` drops empty values

### Summary

`StorageMap::with_entries` and deserialization now drop every entry whose value is `Word::empty()`, so `entries()` and `num_entries()` agree with the sparse Merkle tree, which already treats an empty value as absent. `StorageMap::with_entries([(k, Word::empty())])` now yields a map with `num_entries() == 0` and no `k` in `entries()`. As a side effect, a removed RBAC role no longer breaks `Authority::try_from_storage`.

A leaf with too many entries now returns `StorageMapError::MaxLeafEntriesExceeded` instead of panicking.

### Affected Code

```rust
// Before (0.16)
match err {
    StorageMapError::DuplicateKey { .. } => {},
    StorageMapError::MissingKey { .. } => {},
}
```

```rust
// After (0.17)
match err {
    StorageMapError::DuplicateKey { .. } => {},
    StorageMapError::MissingKey { .. } => {},
    StorageMapError::MaxLeafEntriesExceeded(_) => {},
}
```

### Migration Steps

1. Add the new variant to exhaustive matches on `StorageMapError`, which is not `#[non_exhaustive]`.
2. Do not rely on `entries()` returning keys you inserted with an empty value: writing `Word::empty()` removes the key.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `error[E0004]: non-exhaustive patterns: StorageMapError::MaxLeafEntriesExceeded(_) not covered` | New variant | Add an arm. |
| `maximum number of storage map leaf entries exceeded` | Overfull sparse Merkle tree leaf | Reduce colliding keys. |

---

## `ApproverSet` is capped at 64 approvers

### Summary

`ApproverSet::new` rejects more than `ApproverSet::MAX_APPROVERS` (64) approvers, and the MASM `update_signers_and_threshold` procedures of `multisig`, `guarded_multisig` and `multisig_smart` enforce the same limit when signers are rotated.

### Migration Steps

Keep approver sets at 64 approvers or fewer, both at account creation and in signer rotations.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `number of approvers cannot be greater than 64` | `ApproverSet::new` with more than 64 approvers | Reduce the set. |
| `number of approvers exceeds the maximum supported signer set size` | Rotating to more than 64 signers in the VM | Reduce the set. |

---

## RBAC: role symbols are validated, and `ADMIN` can repair delegation

### Summary

- **Role symbols are validated.** `rbac::set_role_admin`, `grant_role`, `revoke_role`, `renounce_role` and `authority::assert_authorized` (in RBAC mode) now require canonical role-symbol encodings, checked by the new `access::role_symbol::validate_encoding`. The Rust `RoleSymbol` API is unchanged.
- **Admin delegation to a memberless role is accepted when `ADMIN` has members.** The `RoleBasedAccessControl` builder used to reject any role whose admin chain did not reach a populated role (`RoleBasedAccessControlError::UnmanageableRole`). It now skips that check when the built-in `ADMIN` role has members, since `ADMIN` can always repair role management.

The RBAC MASM changed with both, so the code commitment of the RBAC component differs from 0.16.

### Migration Steps

1. Encode role symbols with the Rust `RoleSymbol` type instead of building the felt by hand.
2. Recompute every hard-coded code commitment or account ID of an account that uses the RBAC component.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `role symbol is not a valid encoding` | Non-canonical role symbol felt | Encode with the Rust `RoleSymbol`. |
| `role symbol is zero` (message unchanged from 0.16) | Zero role symbol | Use a real role. |

---

## AggLayer bridge and faucet builders changed

### Summary

The AggLayer faucet is now the standard `FungibleFaucet`. `AggLayerFaucet` is a unit struct used as a namespace, and `AgglayerFaucetError` and the `miden-agglayer-faucet` MASM package are gone. Both builders take a fee faucet ID and a `BasicConstantFeePolicy` instead of a prebuilt `FeePolicyManager`, and the new `FEE_MNGR` role (both builders) and `PAUSER` role (bridge only) must be populated. This affects AggLayer integrators only.

### Affected Code

```rust
// Before (0.16)
let roles = BridgeRoles::new(faucet_managers, ger_injectors, ger_removers)?;
let bridge = AggLayerBridge::account_builder(seed, admin, roles, network_id, fee_policy_manager);
let faucet = AggLayerFaucet::account_builder(
    seed, "USDC", 6, max_supply, initial_supply, faucet_admin, bridge_id, fee_policy_manager,
);
```

```rust
// After (0.17)
use miden_protocol::asset::{AssetAmount, TokenSymbol};
use miden_standards::account::faucets::TokenName;
use miden_standards::account::fees::BasicConstantFeePolicy;

let roles = BridgeRoles::new(faucet_managers, ger_injectors, ger_removers, fee_managers, pausers)?;
let bridge = AggLayerBridge::account_builder(seed, admin, roles, network_id, fee_faucet_id, fee_policy);
let faucet = AggLayerFaucet::account_builder(
    seed, token_name, token_symbol, 6, max_supply, initial_supply,
    faucet_admin, fee_manager, bridge_id, fee_faucet_id, fee_policy,
);
// token_name: TokenName, token_symbol: TokenSymbol, max_supply / initial_supply: AssetAmount
```

In the testing helpers, `create_existing_bridge_account_with_roles` gained `fee_manager` and `pauser`, and `create_existing_agglayer_faucet` gained `token_name: &str` (second argument) and `fee_manager`.

### Migration Steps

1. Pass fee manager and pauser member sets to `BridgeRoles::new`. Each set must be non-empty (`AgglayerBridgeError::EmptyBridgeRole`).
2. Replace the `FeePolicyManager` argument with `fee_faucet_id: AccountId` and `fee_policy: BasicConstantFeePolicy`.
3. For the faucet, pass `TokenName`, `TokenSymbol` and `AssetAmount` instead of `&str` and `Felt`, plus a `fee_manager` account.
4. Remove uses of `AgglayerFaucetError`, `AggLayerFaucet::new`, `with_token_supply`, `try_faucet_from_account`, `owner_account_id`, `token_config_slot` and `owner_config_slot`.
5. Note the role changes: repricing is now gated by `FEE_MNGR` (it was `ADMIN`), and the bridge's emergency pause by `PAUSER`, while unpause stays with `ADMIN`.
6. Expect new AggLayer faucet IDs and code commitments. The faucet now uses the standard `FungibleFaucet` and no longer installs send and receive transfer policies, so it has no asset-callback slots (the flag stays disabled, as in 0.16.1); the IDs change because the component set changed.

---

## Error variants renamed or re-typed

### Summary

A few variants that callers match on changed name or payload; the two renames and the payload change are missing from the changelog. Variants tied to the asset, vault-delta and script refactors are covered on the pages for those changes.

### Affected Code

```diff
- AccountError::HeaderDataIncorrectLength { actual, expected }
+ AccountError::UnexpectedHeaderLength { actual }            // the expected length (16) is no longer a field
- AccountError::AccountCodeDuplicateProcedureRoot(Word)
+ AccountError::AccountCodeDuplicateProcedureRoot(AccountProcedureRoot)
- TransactionSummaryError::ExpirationDeltaTooLarge(Felt)
+ TransactionSummaryError::MetadataOutOfRange(Felt)
```

New variants also land in exhaustive enums you might match:

- `AccountError::{AccountCodeProceduresUnsorted, AssetCallbackSlotWithDisabledFlag, StorageSlotReservedElementNotZero, UnsupportedAccountVersion}`
- `TransactionSummaryError::UnsupportedVersion`
- `TransactionProverError::TransactionProofGenerationFailed`
- `TransactionKernelError::TransactionSummaryUnknownBlockNumber`
- `TransactionEventId::TxBeforeBlockWitnessLoad`
- `StandardAccountComponent::AuthTxFeeCollector`
- `FungibleFaucetError::OwnerOnlyPolicyWithoutOwnable2Step` and `NonFungibleFaucetError::OwnerOnlyPolicyWithoutOwnable2Step`

### Migration Steps

1. Update `match` arms for the two renamed variants, and treat the `AccountCodeDuplicateProcedureRoot` payload as an `AccountProcedureRoot`.
2. Add wildcard or explicit arms for the new variants wherever you match exhaustively.

---

## Other account changes

- **`AccountVaultDelta` tracks whole assets.** In Rust, `fungible()`, `non_fungible()`, `FungibleAssetDelta`, `NonFungibleAssetDelta` and `NonFungibleDeltaAction` were removed; in the Web SDK, `AccountVaultDelta.fungible()`, `FungibleAssetDelta` and `FungibleAssetDeltaItem`. See [Assets, Vault & Faucet](./asset-vault-faucet).
- **New accounts may need an invitation code.** A 0.17 node creates a new, non-network account on chain only if the account is on the node's allowlist, unless the operator disabled the allowlist. Register the account with an invitation code before its first transaction. Existing on-chain accounts and network accounts are never gated. See [Client Changes](./client-changes).
- **(Web) `AccountType` is the visibility enum, and faucets are selected with `FaucetType`.** See [Client Changes](./client-changes).

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `account version is {n} but only version 1 is supported` | 0.16 account or header bytes | Re-fetch or rebuild with 0.17. |
| `asset version is 0 but only version 1 is supported` or `unknown asset composition encoding: {n}` / `note version is {n} but only version 1 is supported` or `discriminant {n} is not a valid NoteType` | 0.16 asset or note bytes (the second form of each is a 0.16 fungible asset or public note) | Re-fetch or rebuild with 0.17. |
| `account code procedures following the authentication procedure are not sorted in ascending order` | Unsorted `AccountCode::from_parts` input, or 0.16 code bytes | Sort, or rebuild with `AccountBuilder`. |
| Account commitment, code commitment or account ID differs from 0.16 | Versioned header and sorted procedures | Expected; re-record the new values. |
| `network account transactions must have an effect before fee payment by consuming an input note, creating an output note, or changing account state` | Empty deploy transaction for a network account | Consume an allowlisted note, such as P2ID, in the deploying transaction. |
| Notes sent to a network account are never consumed, with no client error | The account's fee asset is not the chain's | Rebuild the account with the chain's fee faucet. |
| `error[E0308]: mismatched types` (expected `Package`, found `&Package`) | `from_package` takes the package by value | Drop the `&`. |
| `no method named with_asset_callbacks found for struct AccountBuilder` | Method replaced | Use `enable_asset_callbacks()`, or rely on the derived flag. |
| `the trait bound AccountHeader: From<Account> is not satisfied` | By-value conversion removed | Use `to_header()`. |
| `unresolved import miden_standards::account::wallets::NoteCreator` | Moved | Use `miden_standards::account::note_creator::NoteCreator`. |
| `error[E0004]: non-exhaustive patterns` on `AccountComponentInterface`, `StorageMapError` or `AccountError` | New variants | Add the arms. |
| `number of approvers cannot be greater than 64` | Approver set too large | Keep 64 approvers or fewer. |
