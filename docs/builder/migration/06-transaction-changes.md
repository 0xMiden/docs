---
sidebar_position: 6
title: "Transaction Changes"
description: "Fees move into the auth procedure, transaction inputs are sealed before submission, and TransactionSummary binds the reference block and expiration"
---

# Transaction Changes

:::warning Breaking Change
Transaction fees moved out of the kernel epilogue and into the **authentication procedure**. On a chain with a non-zero `verification_base_fee`, transactions signed by `AuthSingleSig` or `AuthMultisig` must commit fee conversion info through the transaction's auth args, and the paying account must hold the fee asset. Separately, transaction inputs are now **sealed (encrypted)** before submission, so a 0.16 client cannot submit to a 0.15 node or vice versa.
:::

## Quick Fix

```rust
// After (0.16) — declare how the fee is paid
use miden_client::account::component::FeeConversionInfo;

let info = FeeConversionInfo::one_to_one(fee_faucet_id);
let request = TransactionRequestBuilder::new()
    .fee_conversion_info(info, salt)   // salt: Word
    .build()?;
```

If you encounter errors, continue reading for detailed migration steps.

---

## Summary

The fee change is the largest behavioural change in the release, and it is easy to under-estimate because it does not necessarily break your build. If you target a chain that charges no fee, nothing changes. If you target a chain that does, transactions that used to succeed now fail unless the request declares fee conversion info.

The reason for the move is visible in the standard auth component's own documentation: paying the fee *before* the transaction summary is created means the fee note and the vault withdrawal funding it are covered by the signature. Under the old model the kernel deducted the fee outside anything the user signed.

The sealing change is a hard compatibility boundary rather than an API change — it mostly costs you a coordinated upgrade rather than a code edit.

---

## Transaction fees are paid by the auth procedure

### Summary

In 0.15 the kernel computed and burned the fee from the native account's vault automatically. In 0.16 the auth procedure reads a `FeeConversionInfo` blob out of the auth args, computes the fee, and emits a `TX_FEE` note to the fee faucet.

The standard auth components already do this for you — `AuthSingleSig`'s MASM calls `fee::load_conversion_info` and `fee::pay_fee` before authenticating. What you must supply is the auth args.

### Affected Code

```rust
// Before (0.15)
// Nothing to declare: the kernel handled the fee.
let request = TransactionRequestBuilder::new().build()?;
let fee = executed_tx.fee();
```

```rust
// After (0.16)
use miden_client::account::component::FeeConversionInfo;

// Pay in the chain's native fee asset at rate 1/1:
let info = FeeConversionInfo::one_to_one(fee_faucet_id);
// or specify an explicit conversion rate:
let info = FeeConversionInfo::new(fee_faucet_id, rate_num, rate_den)?;

let request = TransactionRequestBuilder::new()
    .fee_conversion_info(info, salt)
    .build()?;
```

The exact signatures:

```rust
FeeConversionInfo::new(faucet_id: AccountId, rate_num: u64, rate_den: u64) -> Result<Self, NoteError>
FeeConversionInfo::one_to_one(faucet_id: AccountId) -> Self
commit_fee_conversion_info(conversion_info: FeeConversionInfo, salt: Word) -> (Word, Vec<Felt>)

// on the client builder:
pub fn fee_conversion_info(self, conversion_info: FeeConversionInfo, salt: Word) -> Self
```

:::caution The `salt` argument is mandatory and undocumented upstream
`fee_conversion_info` takes a second `salt: Word` parameter that the changelog does not mention. Code written from the changelog alone will not compile.
:::

`FeeConversionInfo` is reachable at `miden_client::account::component::FeeConversionInfo` — it is *not* exported from `miden_client::auth`, where you would naturally look first. Adding a direct `miden-standards` dependency also works.

### When it is required, and when it is rejected

Only auth components that actually read the auth args honour the conversion info. The client validates this **before execution** rather than silently paying in the native asset:

```rust
// miden_client::transaction::TransactionRequestError
FeeConversionInfoUnsupported(String)
// "the request declares fee conversion info but the account's auth component {0} does not read it"
```

The check passes only for `AuthSingleSig` and `AuthMultisig`. Declaring fee conversion info for any other auth component — `NoAuth`, for example — is rejected. If the request does not declare fee conversion info at all, the check is skipped, so existing code that never calls the builder method is unaffected by this validation.

Because `fee_conversion_info` consumes the auth arg, it **conflicts with a manually set `auth_arg`** — whichever is applied last wins.

### Migration Steps

1. On a chain with a non-zero `verification_base_fee`, call `fee_conversion_info(info, salt)` on every request signed by an `AuthSingleSig` or `AuthMultisig` account. Use `FeeConversionInfo::one_to_one(fee_faucet_id)` for the native fee asset.
2. Ensure the paying account holds a balance of the fee asset — the auth procedure debits it.
3. Do **not** call `fee_conversion_info` for accounts using any other auth component.
4. If you set `auth_arg` manually, pick one or the other.
5. Replace `executed_tx.fee()` with inspection of the `TX_FEE` output note. `ExecutedTransaction::compute_fee()` still exists but only under the `testing` feature — do not use it in production.
6. If you wrote a **custom auth component** in MASM, it must now call `miden::standards::fee::load_conversion_info` followed by `miden::standards::fee::pay_fee`, or the transaction will fail fee validation.
7. On a zero-fee chain, no change is required.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `this function takes 2 arguments but 1 was supplied` | The `salt` parameter | Pass a `Word` salt. |
| `FeeConversionInfoUnsupported` | Auth component does not read auth args | Only declare it for `AuthSingleSig` / `AuthMultisig`. |
| `cannot find FeeConversionInfo in miden_client::auth` | Exported elsewhere | Use `miden_client::account::component::FeeConversionInfo`. |
| Transaction aborts on a fee-charging chain | No fee conversion info declared, or no fee asset balance | Declare the info and fund the account. |
| Custom auth component transaction fails fee validation | MASM does not pay the fee | Call `fee::load_conversion_info` then `fee::pay_fee`. |

---

## Transaction inputs are sealed before submission

### Summary

Transaction inputs are encrypted ("sealed") before being submitted. `submit_proven_transaction` and `submit_proven_batch` take `SealedTransactionInputs`, and the RPC layer gained a `get_transaction_encryption_key` method plus a `miden_client::rpc::encryption` module.

**This is a hard compatibility boundary.** A 0.16 node rejects plaintext submissions and an older node rejects sealed ones, so the client and node must be upgraded together.

### Migration Steps

1. Upgrade your node and client together. There is no configuration that makes a 0.16 client talk to a 0.15 node.
2. Ensure the client has synced the genesis and chain-tip headers before submitting — sealing depends on them.
3. If you implement the RPC client trait yourself, add `get_transaction_encryption_key`.

:::note Key types are not re-exported from the encryption module
The changelog states that `miden_client::rpc::encryption` re-exports the validator DSA key types. It does not — that module contains no `pub use` statements. Reach them via `miden_client::crypto::{ecdsa_k256_keccak, eddsa_25519_sha512}`.
:::

---

## `TransactionSummary` binds the reference block, expiration, and user params

### Summary

`TransactionSummary::new` replaced its single `salt` parameter with a block commitment, an expiration delta, and a structured user-parameters value.

### Affected Code

```rust
// Before (0.15)
pub fn new(
    account_delta: AccountDelta,
    input_notes: InputNotes<InputNote>,
    output_notes: RawOutputNotes,
    salt: Word,
) -> Self
```

```rust
// After (0.16)
pub fn new(
    account_delta: AccountDelta,
    input_notes: InputNotes<InputNote>,
    output_notes: RawOutputNotes,
    block_commitment: Word,
    expiration_delta: u16,
    user_params: TransactionSummaryUserParams,
) -> Self
```

`TransactionSummaryUserParams` carries seven field elements. On the TypeScript side the corresponding accessor renamed from `TransactionSummary.salt()` to `TransactionSummary.userParams()`.

The reference block commitment is included because it determines the fee parameters, and therefore the fee amount deducted; the expiration delta is included so the signature covers it.

:::info `TransactionSummary` still uses `AccountDelta`
Note the first parameter. While account *updates* moved to the absolute `AccountPatch` model (see [Account Changes](./account-changes#account-updates-move-from-accountdelta-to-accountpatch)), the signed transaction summary deliberately still binds a relative `AccountDelta`. Do not rewrite these call sites.
:::

### Migration Steps

1. Replace the `salt` argument with the block commitment, expiration delta, and user params.
2. In TypeScript, replace `summary.salt()` with `summary.userParams()`.

---

## Other transaction changes

- **Proving is synchronous; execution stays asynchronous.** Adjust any code that awaited the proving step.
- **`ExecutedTransaction::account_delta()` became `account_patch()`**, matching the account update model. See [Account Changes](./account-changes#account-updates-move-from-accountdelta-to-accountpatch).
- **`ExecutedTransaction::compute_fee()` is gated behind the `testing` feature.** Production fee figures come from the `TX_FEE` note.

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| Node rejects a submitted transaction | Client and node versions mixed | Upgrade both to 0.16. |
| `this function takes 6 arguments but 4 were supplied` | `TransactionSummary::new` changed | Pass block commitment, expiration delta, and user params. |
| `no method named salt` on a summary | Renamed | Use `userParams()`. |
| `no method named fee` on an executed transaction | Fees now flow through the `TX_FEE` note | Inspect the output note. |
| `no method named account_delta` on an executed transaction | Renamed | Use `account_patch()`. |
