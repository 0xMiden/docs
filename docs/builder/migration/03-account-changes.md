---
sidebar_position: 3
title: "Account Changes"
description: "Auth components become ordinary components, Approver replaces raw key arguments, component names change, and account updates move to AccountPatch"
---

# Account Changes

:::warning Breaking Change
`AccountBuilder::with_auth_component` was removed — auth components are now passed through `with_component` like any other, and identified by their MASM `@auth_script` attribute. Auth components take an `Approver` instead of a raw key and scheme. Every standard component's `NAME` constant changed, and because component metadata feeds the storage schema commitment, **accounts rebuilt from the same seed will have different commitments**.
:::

## Quick Fix

```rust
// Before (0.15)
let account = AccountBuilder::new(init_seed)
    .account_type(AccountType::Public)
    .with_auth_component(AuthSingleSig::new(pub_key, auth_scheme))
    .with_component(BasicWallet)
    .build()?;

// After (0.16)
let account = AccountBuilder::new(init_seed)
    .account_type(AccountType::Public)
    .with_components([
        AuthSingleSig::new(Approver::new(pub_key, auth_scheme)).into(),
        BasicWallet.into(),
    ])
    .build()?;
```

If you encounter errors, continue reading for detailed migration steps.

---

## Summary

Three independent shifts land on accounts in this release.

**Auth stops being special.** In 0.15 the builder had a dedicated auth slot; in 0.16 the auth component is just a component, and the builder finds it by looking for the `@auth_script` attribute in its MASM. This is what makes the fee change possible — the auth procedure is now also where fees get paid, so it needed to compose with everything else.

**Keys are wrapped in an `Approver`.** `AuthSingleSig::new` took a public-key commitment and a scheme; it now takes a single `Approver` carrying both. Multi-signature components take an `ApproverSet` with a threshold. This is a mechanical rewrite, but it touches every account you construct.

**Component names were normalised**, which changes commitments. Every standard component's `NAME` dropped its `components::` segment. Since the name feeds component metadata, and metadata feeds the storage schema commitment, this silently changes account commitments even when nothing else about your account changed.

:::note `AccountType` did not change
`AccountType` has been `Private` / `Public` since 0.15, and there is no separate `AccountStorageMode`. If you are coming from an older release, that collapse is covered in the [0.15 guide](https://docs.miden.xyz/0.15/builder/migration/account-changes).
:::

---

## `AccountBuilder::with_auth_component` removed

### Summary

`AccountBuilder` now takes all components uniformly through `with_component` and `with_components`, and identifies the auth component by its `@auth_script` MASM attribute.

### Affected Code

```diff
  let account = AccountBuilder::new(init_seed)
      .account_type(AccountType::Public)
-     .with_auth_component(auth_component)
-     .with_component(BasicWallet)
+     .with_components([auth_component.into(), BasicWallet.into()])
      .build()?;
```

`AccountBuilder` also gained `with_asset_callbacks(AssetCallbackFlag)`. Whether a faucet's assets trigger callbacks is now encoded in the account ID rather than in separate storage, so this is set at construction time.

### Migration Steps

1. Drop `with_auth_component` and pass the auth component through `with_component` or `with_components`.
2. If you author a custom auth component, make sure its entry procedure carries the `@auth_script` attribute — that is how the builder recognises it.
3. If you build a faucet whose assets should trigger callbacks, set `with_asset_callbacks`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `no method named with_auth_component` | Method removed | Use `with_component` / `with_components`. |
| Build fails reporting no auth component | Custom component lacks the attribute | Annotate the entry procedure with `@auth_script`. |

---

## `Approver` and `ApproverSet` replace raw key arguments

### Summary

`Approver` bundles a public-key commitment with its signature scheme; `ApproverSet` bundles a list of approvers with a threshold. Both are new in 0.16. The `AuthMethod` enum was removed, and `AuthSingleSigAcl` / `AuthSingleSigAclConfig` were removed outright.

### Affected Code

```rust
// Before (0.15)
AuthSingleSig::new(pub_key: PublicKeyCommitment, auth_scheme: AuthScheme) -> Self
```

```rust
// After (0.16)
Approver::new(pub_key: PublicKeyCommitment, auth_scheme: AuthScheme) -> Approver
AuthSingleSig::new(approver: Approver) -> Self
ApproverSet::new(approvers: Vec<Approver>, threshold: u32) -> Result<Self, AccountError>
AuthMultisig::new(approver_set: ApproverSet) -> Self
```

The convenience constructors are unchanged and remain the shortest path when you have a concrete key:

```rust
// Identical in 0.15 and 0.16
AuthSingleSig::falcon512_poseidon2(pub_key)
AuthSingleSig::ecdsa_k256_keccak(pub_key)
AuthSingleSig::from_public_key(pub_key)
```

New accessors: `AuthSingleSig::approver()`, `ApproverSet::approvers()`, and `ApproverSet::threshold()`.

### Migration Steps

1. Wrap existing `AuthSingleSig::new(pub_key, scheme)` arguments in `Approver::new(pub_key, scheme)`.
2. Replace multi-signature construction with `ApproverSet::new(approvers, threshold)?` — note it is fallible.
3. Remove any use of `AuthMethod`; the scheme now travels inside the `Approver`.
4. If you used `AuthSingleSigAcl`, there is no drop-in replacement. Rebuild the access-control policy using the components under `miden::standards::access` (for example `RoleBasedAccessControl` or `Authority`).

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `this function takes 1 argument but 2 were supplied` on `AuthSingleSig::new` | Signature changed | Wrap the arguments in `Approver::new`. |
| `cannot find type AuthMethod` | Removed | Use `Approver` / `AuthScheme`. |
| `cannot find type AuthSingleSigAcl` | Removed | Rebuild with an access-control component. |

---

## Component names changed, and account commitments with them

### Summary

Every standard component's `NAME` constant was normalised by dropping the `components::` segment. Component metadata feeds the storage schema commitment, so **the commitment of an account built from the same seed and the same components differs between 0.15 and 0.16**.

### Affected Code

```diff
- "miden::standards::components::auth::singlesig"
+ "miden::standards::auth::singlesig"

- "miden::standards::components::wallets::basic_wallet"
+ "miden::standards::wallets::basic_wallet"

- "miden::standards::components::access::rbac"
+ "miden::standards::access::rbac"

- "miden::standards::components::faucets::fungible_faucet"
+ "miden::standards::faucets::fungible"
```

A few names already lacked the segment in 0.15 — `miden::standards::auth::network_account` and `miden::standards::access::ownable2step` are unchanged. Note that the fungible faucet also lost its `_faucet` suffix, so it is not a pure prefix change.

The `miden::standards::account::metadata` module was also renamed to `miden::standards::account::inspection`, both in MASM and in Rust.

### Migration Steps

1. Update any hard-coded component name strings.
2. Expect new account IDs and commitments for accounts rebuilt from the same seed. If you have persisted an account ID derived under 0.15, it will not be reproduced by 0.16 construction.
3. Update references to `account::metadata` to `account::inspection`.

---

## Component MASM must annotate exported procedures

### Summary

Account component MASM must annotate every exported procedure with `@account_procedure`. Un-annotated procedures are not exported. This attribute is new in 0.16 — the protocol's own MASM went from zero uses to 99.

`@auth_script` and `@note_script` already existed in 0.15 and are unchanged.

### Affected Code

```masm
# After (0.16)
@account_procedure
pub proc receive_asset(asset: word)
    # …
end

@auth_script
pub proc auth_tx(auth_args: word)
    # …
end
```

### Migration Steps

1. Add `@account_procedure` to every procedure your component intends to export.
2. Re-check the resulting `AccountCode` procedure list — a missing annotation shows up as a procedure that silently is not callable, not as a compile error.

---

## `AccountCode::from_parts` is now fallible

### Summary

`AccountCode::from_parts` validated its procedure count with `assert!` in 0.15 and now returns a `Result` instead of panicking.

### Affected Code

```rust
// Before (0.15)
pub fn from_parts(mast: Arc<MastForest>, procedures: Vec<AccountProcedureRoot>) -> Self

// After (0.16)
pub fn from_parts(
    mast: Arc<MastForest>,
    procedures: Vec<AccountProcedureRoot>,
) -> Result<Self, AccountError>
```

### Migration Steps

Add `?` or explicit error handling at every call site.

---

## `AccountId` no longer converts into `[Felt; 2]`

### Summary

The `impl From<AccountId> for [Felt; 2]` was removed. Use the `prefix()` and `suffix()` accessors instead. Conversions to `[u8; 15]` and `u128` are unchanged.

### Affected Code

```rust
// Before (0.15)
let felts: [Felt; 2] = account_id.into();
```

```rust
// After (0.16)
let prefix: AccountIdPrefix = account_id.prefix();
let suffix: Felt = account_id.suffix();
```

### Migration Steps

Replace the `into()` conversion with the two accessors. Note `prefix()` returns an `AccountIdPrefix`, not a bare `Felt`.

---

## Account updates move from `AccountDelta` to `AccountPatch`

### Summary

Account **updates** moved from the relative `AccountDelta` to the absolute `AccountPatch`. `ExecutedTransaction` and `AccountUpdateDetails` now carry a patch, and `Account::apply_delta` was replaced by applying a patch.

:::info `AccountDelta` still exists
This is not a wholesale removal. `AccountDelta` remains, and `TransactionSummary::account_delta()` deliberately still returns one — the signed transaction summary binds a *relative* delta. Only account update representation moved to the absolute patch model. The same split exists on the TypeScript side, where `TransactionSummary.accountDelta()` is unchanged while the result's `accountDelta()` became `accountPatch()`.
:::

### Affected Code

```rust
// Before (0.15)
let delta = executed_tx.account_delta();
account.apply_delta(&delta)?;
```

```rust
// After (0.16)
let patch = executed_tx.account_patch();
let account = Account::try_from(&patch)?;
```

### Migration Steps

1. Replace `account_delta()` with `account_patch()` on `ExecutedTransaction` and on client transaction results.
2. Replace `Account::apply_delta` with construction from the patch.
3. Leave `TransactionSummary::account_delta()` call sites alone — that one is intentionally still a delta.

---

## Network accounts require a fee policy

### Summary

`AuthNetworkAccount::new` now takes a `FeePolicyManager` alongside the allowed-note set. The manager carries the fee faucet and the active fee policy, and expands into the policy's components when the auth component is installed — so you do not install policy components separately.

:::note This applies to network accounts and faucets, not ordinary accounts
Fee *policies* describe how an account that sponsors or charges fees estimates them. An ordinary user account paying a fee does not install one; it supplies fee conversion info per transaction instead. See [Transaction Changes](./transaction-changes#transaction-fees-are-paid-by-the-auth-procedure).
:::

### Affected Code

```rust
// After (0.16)
let manager = FeePolicyManager::builder()
    .fee_faucet_id(fee_faucet_id)
    .active_fee_policy(FeePolicy::from(BasicConstantFeePolicy::new()))
    .build();

let auth = AuthNetworkAccount::new(allowed_notes, manager)?;
```

`AuthNetworkAccount` no longer converts into a single `AccountComponent` — it expands into several, so install it through `with_components`.

### Migration Steps

1. Build a `FeePolicyManager` with the fee faucet and an active fee policy, registering any alternatives with `allowed_fee_policy` for runtime switching.
2. Pass it to `AuthNetworkAccount::new`, which is fallible.
3. Install the auth component with `with_components`, not `with_component`, since it expands to several components.

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `no method named with_auth_component` | Removed | Use `with_component(s)`. |
| `this function takes 1 argument but 2 were supplied` | `AuthSingleSig::new` takes an `Approver` | Wrap in `Approver::new`. |
| `cannot find type AuthMethod` / `AuthSingleSigAcl` | Removed | See the auth section above. |
| `expected Result, found AccountCode` | `from_parts` is fallible | Add `?`. |
| `the trait From<AccountId> is not implemented for [Felt; 2]` | Conversion removed | Use `prefix()` / `suffix()`. |
| Account commitment differs from 0.15 for the same seed | Component names changed | Expected; re-record the new ID. |
| Component procedure is not callable but compiles | Missing `@account_procedure` | Annotate the procedure. |
