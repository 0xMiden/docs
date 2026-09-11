---
sidebar_position: 6
title: "Transaction Changes"
description: "Fees move into the auth procedure, transaction inputs are sealed before submission, and TransactionSummary binds the reference block — so multi-party signing needs a ChainAnchor"
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

The summary change is the quiet one. Its constructor break is mechanical, but the binding it introduces silently invalidates any flow that collects signatures on one client and executes on another; that code still compiles and only fails once it runs.

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

Transaction inputs are encrypted ("sealed") before being submitted. The RPC layer gained a `get_transaction_encryption_key` method plus a `miden_client::rpc::encryption` module.

**This is a hard compatibility boundary.** A 0.16 node rejects plaintext submissions and an older node rejects sealed ones, so the client and node must be upgraded together.

:::note Most applications do not change any code here
`Client::submit_proven_transaction` keeps its 0.15 signature exactly — it still takes `impl Into<TransactionInputs>`, and sealing happens beneath it. Only the `NodeRpcClient` **trait** methods changed to take `SealedTransactionInputs`, so this is a source-breaking change solely for code that implements that trait.
:::

The requirement this does impose on every application is a **sync before submitting**: sealing resolves an encryption key against the chain state, so a client that has not synced the genesis and chain-tip headers fails with `ClientError::ChainValidationError`.

### Migration Steps

1. Upgrade your node and client together. There is no configuration that makes a 0.16 client talk to a 0.15 node.
2. Ensure the client has synced before submitting, or key resolution fails with `ChainValidationError`.
3. If you implement `NodeRpcClient` yourself, update `submit_proven_transaction` and `submit_proven_batch` to take `SealedTransactionInputs`, and add `get_transaction_encryption_key`.

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

## Collecting signatures across clients requires a `ChainAnchor`

### Summary

The binding above has a consequence that never surfaces as a compile error. Because the summary commits to the reference block, a summary derived at one block only authorizes an execution at *that* block. Clients execute at their own sync height by default, so in any flow that derives a summary, collects signatures, and executes later — a multisig proposal, offline co-signing — the proposer, each co-signer, and the executor sit at different heights and derive three different summaries. The collected signatures do not apply.

Code written for 0.15 compiles unchanged and fails at run time, which makes this the easiest change in the release to miss.

`ChainAnchor` is the remedy. It pins execution to a chosen reference block, so the same summary reproduces on a client at any height: the proposer captures one, ships it alongside the summary, and every party executes against it.

:::note Newer than the versions pinned in Quick Upgrade
`ChainAnchor` landed after the versions in [Quick Upgrade](./#quick-upgrade). It needs `miden-client` `0.16.0-rc.2` and `@miden-sdk/miden-sdk` / `@miden-sdk/react` `0.16.0-rc.3` or later.
:::

### Affected Code

```rust
// Before (0.15)
// The proposer and the executor each ran this at their own sync height,
// and the summary the co-signers signed still reproduced.
let result = client.execute_transaction(account_id, request).await?;
```

```rust
// After (0.16)
use miden_client::transaction::ChainAnchor;
use miden_client::{Deserializable, Serializable};

// Proposer: pin the reference block, and ship the anchor with the summary.
let anchor = client.chain_anchor_for_request(&request).await?;
let bytes = anchor.to_bytes();

// Co-signer and executor: rebuild it and execute at the same block.
let anchor = ChainAnchor::read_from_bytes(&bytes)?;
let result = client.execute_transaction_at(account_id, request, anchor).await?;
```

```typescript
// After (0.16) — Web SDK
const anchor = await client.transactions.captureAnchor(request);

const summary = await client.transactions.preview({
  operation: "custom", account, request, anchor,
});
// ... collect signatures over `summary`, shipping `anchor.serialize()` ...

await client.transactions.submit(account, request, { anchor });
```

```tsx
// After (0.16) — React
const { captureAnchor, anchoredRequest } = useChainAnchor();
const { preview } = usePreview();
const { execute } = useTransaction();

const anchor = await captureAnchor({ request: buildRequest });
const summary = await preview({ accountId, request: anchoredRequest, anchor });
// ... collect signatures ...
await execute({ accountId, request: anchoredRequest, anchor });
```

Single-client flows need no anchor. `execute_transaction` and an `anchor`-less `submit` keep their 0.15 behaviour of executing at the current sync height, which is correct whenever the client deriving the summary is also the one executing.

### Verify an anchor you did not capture

An anchor arrives from whoever proposed the transaction. Deserialization rejects malformed bytes, so the remaining risk is a well-formed anchor pinned to the wrong block. Compare its commitment against the one signed into the summary before executing:

```typescript
if (anchor.commitment().toHex() !== summary.blockCommitment().toHex()) {
  throw new Error("anchor does not match the signed summary");
}
```

The Rust accessor is `ChainAnchor::block_commitment`. Note what this check does and does not prove: it establishes that the anchor and the summary agree, not that either is what you meant to sign, since the proposer supplies both. Inspect the summary's effects separately.

### Migration Steps

1. Find every flow that derives a transaction summary on one client and executes on another — multisig proposals and offline co-signing are the common cases. Single-client flows are unaffected.
2. Capture an anchor at proposal time with `chain_anchor_for_request` (Rust), `transactions.captureAnchor` (Web), or `useChainAnchor` (React), and ship the serialized bytes alongside the summary.
3. Re-derive the summary at the anchor when verifying a proposal, rather than at the local sync height: `executeForSummaryAt` on the WASM client, or `preview({ …, anchor })` at the ergonomic layers. Deriving it locally produces a different summary and the comparison always fails.
4. Execute at the anchor: `execute_transaction_at`, or the `anchor` option on `executeRequest` / `submit` / `useTransaction().execute`.
5. Check a received anchor against `summary.blockCommitment()` before using it.
6. In React, preview and execute against the `anchoredRequest` the hook returns, not the value you passed in. Re-resolving a request factory builds a different transaction — anything creating an output note draws a fresh serial number — so the anchor would pin a request nobody executes.
7. Budget for expiry. The expiration delta counts from the anchored block, not from the executing client's height, so an anchor that sat too long during signature collection fails with `AnchoredTransactionExpired`.

:::caution Rust consumes the anchor; JavaScript does not
`execute_transaction_at` takes the `ChainAnchor` by value, so capture it again — or clone it — for a preview-then-execute sequence. The wasm bindings take it by reference, so one JS handle survives both calls. Because a JS anchor carries a partial blockchain, call `anchor.free()` when done rather than leaving it to the finalizer.
:::

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| Collected signatures are rejected, with no compile error | Each party derived the summary at its own sync height | Capture an anchor and derive and execute at it. |
| `TRANSACTION_ALREADY_AUTHORIZED` | The transaction needs no further signatures | Submit it with `execute` / `submit` instead of previewing. |
| `AnchoredTransactionExpired` | The anchor aged past the transaction's expiration during signature collection | Re-capture the anchor and re-collect. |
| `ChainAnchorError` on execution | An authenticated input note's creation block is not tracked by the anchor | Capture the anchor with `chain_anchor_for_request`, which tracks those blocks. |
| `INVALID_CHAIN_ANCHOR` | A sync landed mid-capture | Retry the capture. |
| `captureAnchor is not a function` | Web SDK older than `0.16.0-rc.3` | Bump `@miden-sdk/miden-sdk` and `@miden-sdk/react` together. |

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
