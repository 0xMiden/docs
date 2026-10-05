---
sidebar_position: 6
title: "Transaction Changes"
description: "The fee asset moves into ProtocolConfig, multisig binds a caller-chosen block and executes at the tip instead of at a ChainAnchor, fees are paid only in the native asset at 1/1, and network-note transactions expire within 20 blocks"
---

# Transaction Changes

:::warning Breaking Change
The block header no longer names the fee faucet: it commits to a new **`ProtocolConfig`**, which every `DataStore` and every `TransactionInputs::new` call must now supply. Multisig accounts need a **`MultisigAuthArgs`** preimage on every chain, fee-free ones included, and bind a caller-chosen block, so the 0.16 `ChainAnchor` pattern for multisig is replaced by executing at the tip. Multisig code written for 0.16 compiles unchanged and fails at run time. Fees must be paid in the native fee asset at rate 1/1.
:::

## Quick Fix

```rust
// Before (0.16)
let fee_faucet_id = block_header.fee_parameters().fee_faucet_id();
let tx_inputs = TransactionInputs::new(account, block_header, partial_blockchain, input_notes)?;
```

```rust
// After (0.17): the fee asset lives in the ProtocolConfig the header commits to
let fee_faucet_id = protocol_config.fee_asset_id().faucet_id();
let tx_inputs = TransactionInputs::new(
    account,
    block_header,
    protocol_config,
    partial_blockchain,
    input_notes,
)?;
```

For multisig accounts, build the auth args yourself on every chain:

```rust
// After (0.17)
let auth_args = MultisigAuthArgs::new(bound_block, salt)
    .with_conversion_info(FeeConversionInfo::one_to_one(fee_faucet_id));
```

If you encounter errors, continue reading for detailed migration steps.

---

## Summary

This page holds four groups of change. **Fees:** the fee asset moved from the block header into `ProtocolConfig` (compile errors wherever you assemble transaction inputs), fees must be paid in the native fee asset at 1/1, and several fee features from the 0.16.x releases are absent (neither shows up as a Rust compile error). **Multisig:** the auth args became a mandatory three-word `MultisigAuthArgs` preimage, and signing binds a caller-chosen block so every party executes at its own tip. Nothing about this fails to compile, which makes it the easiest change in the release to miss. **Building, proving and verifying transactions:** `TransactionSummary`, the script constructors and the script byte format, the prover, the verifier, the note consumption checker, the pricer, the program executor, the transaction hosts and `miden-testing` changed shape, mostly with compile errors; the exceptions are deferred precompile claims and the 20-block expiration cap, which change behaviour silently, and a custom `DataStore` that does not serve the standards library, which now fails at execution. **Node operators and block producers** get a compact section of their own at the end.

:::note Changelog heading
The protocol CHANGELOG files several transaction changes on this page (the 20-block cap for policy-gated transfers, the foreign-procedure check, the `TransactionMeasurements` fix) under a heading `v0.16.0 (2026-08-06)`. None of them is in 0.16.1: they ship in 0.17.
:::

---

## The fee asset moved from the block header into `ProtocolConfig`

### Summary

A block header no longer names the fee faucet or the transaction kernel. It carries `protocol_config_commitment()`, a commitment to a new `ProtocolConfig` (fee asset ID, transaction, batch and block kernel configs, and the proof verification policy). You must supply that config alongside the header wherever transaction inputs are assembled: `DataStore::get_transaction_inputs` returns it, and `TransactionInputs::new` takes it. `FeeParameters::new` lost its faucet argument, and `FeeParameters::fee_faucet_id()` and `BlockHeader::tx_kernel_commitment()` were removed.

### Affected Code

```rust
// Before (0.16)
use miden_protocol::account::AccountId;
use miden_protocol::block::FeeParameters;

let fee_faucet_id: AccountId = block_header.fee_parameters().fee_faucet_id();
let kernel_commitment = block_header.tx_kernel_commitment();
let fee_parameters = FeeParameters::new(fee_faucet_id, 500);

let tx_inputs = TransactionInputs::new(account, block_header, partial_blockchain, input_notes)?;

impl DataStore for MyStore {
    fn get_transaction_inputs(
        &self,
        account_id: AccountId,
        ref_blocks: BTreeSet<BlockNumber>,
    ) -> impl FutureMaybeSend<Result<(PartialAccount, BlockHeader, PartialBlockchain), DataStoreError>> {
        async move { Ok((account, header, partial_blockchain)) }
    }
    // ...
}
```

```rust
// After (0.17)
use miden_protocol::account::AccountId;
use miden_protocol::asset::AssetId;
use miden_protocol::block::FeeParameters;
use miden_protocol::protocol_config::ProtocolConfig;

// Build (or load) the chain's protocol config; it must match the header's commitment.
// `chain_fee_faucet_id` comes from the chain's genesis or node configuration.
let protocol_config = ProtocolConfig::current(AssetId::new_fungible(chain_fee_faucet_id))?;
assert_eq!(protocol_config.to_commitment(), block_header.protocol_config_commitment());

let fee_faucet_id: AccountId = protocol_config.fee_asset_id().faucet_id();
let fee_parameters = FeeParameters::new(500); // verification base fee only

let tx_inputs = TransactionInputs::new(
    account,
    block_header,
    protocol_config,
    partial_blockchain,
    input_notes,
)?;

impl DataStore for MyStore {
    fn get_transaction_inputs(
        &self,
        account_id: AccountId,
        ref_blocks: BTreeSet<BlockNumber>,
    ) -> impl FutureMaybeSend<
        Result<(PartialAccount, BlockHeader, ProtocolConfig, PartialBlockchain), DataStoreError>,
    > {
        async move { Ok((account, header, protocol_config, partial_blockchain)) }
    }
    // ...
}
```

Other `BlockHeader` accessor changes ride along: `validator_keys()` became `validator_config()` (see [the node operator section](#for-node-operators-and-block-producers)), `version()` returns `u8` instead of `u32`, and `protocol_config_commitment()`, `next_protocol_config()` and `next_protocol_config_commitment()` are new. `fee_parameters()` stays; the `FeeParameters` it returns now carries only `verification_base_fee()`. `TransactionInputs` gained a `protocol_config()` accessor; its `into_parts()` tuple is unchanged and does not include the config.

**Clients:** the Rust client and the Web SDK receive the config from the node when they sync. The Rust client exposes it through `Client::get_protocol_config`, and the Web SDK exposes the fee faucet through `client.feeFaucetId()`. See [Client Changes](./client-changes). **MASM:** `tx::get_fee_faucet_id` was replaced by `tx::get_fee_asset_id`, which returns the fee `AssetId`; see [MASM Changes](./masm-changes).

:::caution A `ProtocolConfig` is tied to the exact protocol build
`ProtocolConfig::current(fee_asset_id)` hashes the transaction kernel's main procedure, every kernel procedure root and the batch kernel's main procedure into the commitment the block header carries. A `DataStore` or client that builds its config with a different protocol release than the node computes a different commitment, and execution fails with a config mismatch even when the fee faucet is right. The block kernel and proof-verification entries are placeholders today, so expect the commitment to change again when they are filled in. Treat every protocol upgrade as a config change.
:::

### Migration Steps

1. Replace `header.fee_parameters().fee_faucet_id()` with `protocol_config.fee_asset_id().faucet_id()`, or keep the `AssetId` from `fee_asset_id()` if you pass it on.
2. Replace `FeeParameters::new(faucet_id, base_fee)` with `FeeParameters::new(base_fee)`.
3. Replace `header.tx_kernel_commitment()` checks with a comparison of `header.protocol_config_commitment()` against `your_protocol_config.to_commitment()`. There is no kernel-only commitment on the header any more.
4. In every `DataStore` implementation, return the `ProtocolConfig` as the third tuple element of `get_transaction_inputs`. It must be the config the returned header commits to. For a multisig transaction, the returned `PartialBlockchain` must also track the `MultisigAuthArgs` bound block, unless it is the reference block itself. The executor does not put that block into `ref_blocks` (it passes only the reference block and the input notes' inclusion blocks), so your store has to add it: hand the bound block to the store before you call `execute_transaction` and include it in the blocks the returned `PartialBlockchain` tracks. The Rust client's own store does this with the request's `block_numbers`.
5. Add the `ProtocolConfig` argument, in third position, to every `TransactionInputs::new` call (the new `try_from_parts` takes it in the same position).
6. Construct the config with `ProtocolConfig::current(AssetId::new_fungible(fee_faucet_id))?` (fallible: the fee asset must be fungible), or with `ProtocolConfig::new(fee_asset_id, tx_kernel, batch_kernel, block_kernel, proof_verification)?` from `KernelConfig`, `ProofVerificationConfig` and `ProofSecurityPolicy` (all in `miden_protocol::protocol_config`). Build it with the same `miden-protocol` version the node runs. In tests, `MockChain::protocol_config()` returns the one a mock chain uses.
7. Validate early: compare `ProtocolConfig::to_commitment()` with `header.protocol_config_commitment()` before executing, so a mismatch surfaces with a clear message instead of a transaction failure.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0599]: no method named `fee_faucet_id` found `` (on `&FeeParameters`) | The faucet moved to `ProtocolConfig` | `protocol_config.fee_asset_id().faucet_id()` |
| `` error[E0599]: no method named `tx_kernel_commitment` found `` (on `BlockHeader`) | Replaced by the protocol config commitment | Compare `protocol_config_commitment()` with `ProtocolConfig::to_commitment()`. |
| `error[E0061]: this function takes 1 argument but 2 arguments were supplied` (`FeeParameters::new`) | Faucet argument removed | Pass only the verification base fee. |
| `error[E0061]: this function takes 5 arguments but 4 arguments were supplied` (`TransactionInputs::new`) | New `ProtocolConfig` parameter | Pass the config third. |
| `failed to create transaction inputs` (source: `protocol config has commitment {actual} which does not match the block header's protocol config commitment {expected}`) | The config was built with another protocol release or another fee asset | Match the node's protocol version and fee asset. |
| `fee asset composition {0:?} is not supported, it must be fungible` | `ProtocolConfig::new` / `current` given a non-fungible `AssetId` | Use `AssetId::new_fungible(faucet_id)`. |

---

## Multisig auth args are a `MultisigAuthArgs` preimage, required on every chain

### Summary

`AuthMultisig`, `AuthGuardedMultisig` and `AuthMultisigSmart` no longer read `hash(CONVERSION_INFO || SALT)`. Their auth args are the commitment to a new **`MultisigAuthArgs`** (in `miden_standards::account::auth`, re-exported by the client as `miden_client::account::component::MultisigAuthArgs`), whose three-word preimage must be in the advice map:

```text
[bound_block_num, approval_expiration_block_num, 0, 0], SALT, CONVERSION_INFO
```

In 0.16.1 a multisig on a zero-fee chain could run with any salt word as auth args and no advice-map entry. In 0.17 the component asserts that the preimage is present **at any base fee** and reads exactly three words from it. The two-word preimage from `commit_fee_conversion_info` compiles and fails at execution, and so does the client's `fee_conversion_salt`, which still commits that two-word preimage for a multisig account. The client does not build `MultisigAuthArgs` for you.

`AuthSingleSig` is unaffected: its auth args did not change, so `commit_fee_conversion_info` keeps working for it.

### Affected Code (Rust client)

```rust
// Before (0.16)
let request = TransactionRequestBuilder::new()
    .fee_conversion_salt(salt)
    .build()?;
```

```rust
// After (0.17)
use miden_client::account::component::{FeeConversionInfo, MultisigAuthArgs};
use miden_protocol::crypto::SequentialCommit; // not re-exported by miden-client

let bound_block = client.get_sync_height().await?;
let header = client.get_latest_block_header().await?;
let fee_faucet_id = client
    .get_protocol_config(header.protocol_config_commitment())
    .await?
    .fee_asset_id()
    .faucet_id();

let auth_args = MultisigAuthArgs::new(bound_block, salt) // a fresh random salt per proposal
    .with_conversion_info(FeeConversionInfo::one_to_one(fee_faucet_id));
let auth_arg = auth_args.to_commitment();

let request = TransactionRequestBuilder::new()
    .block_numbers([bound_block])
    .auth_arg(auth_arg)
    .extend_advice_map([(auth_arg, auth_args.to_elements())])
    .build()?;
```

:::note `fee_conversion_salt`, not `fee_conversion_info`
The 0.16 guide showed `TransactionRequestBuilder::fee_conversion_info(info, salt)`; 0.16.0 and 0.16.1 have `fee_conversion_salt(salt)`, and the client builds the native `FeeConversionInfo` itself. 0.17 keeps `fee_conversion_salt`; for a multisig account it now commits a preimage the component cannot read.
:::

### Affected Code (Rust, `miden-tx`)

For code that builds `TransactionArgs` directly:

```rust
// Before (0.16)
use miden_protocol::transaction::TransactionArgs;
use miden_standards::account::auth::{FeeConversionInfo, commit_fee_conversion_info};

let info = FeeConversionInfo::one_to_one(block_header.fee_parameters().fee_faucet_id());
let (auth_args, preimage) = commit_fee_conversion_info(info, salt);

let mut tx_args = TransactionArgs::default().with_auth_args(auth_args);
tx_args.extend_advice_map([(auth_args, preimage)]);
// On a zero-fee chain the preimage could be omitted and `auth_args` was just a salt.
```

```rust
// After (0.17)
use core::num::NonZeroU32;
use miden_protocol::crypto::SequentialCommit;
use miden_protocol::transaction::TransactionArgs;
use miden_standards::account::auth::{FeeConversionInfo, MultisigAuthArgs};

let fee_faucet = protocol_config.fee_asset_id().faucet_id();
let auth = MultisigAuthArgs::new(bound_block_num, salt) // bound_block_num: BlockNumber, <= reference block
    .with_approval_expiration_delta(NonZeroU32::new(100).expect("non-zero"))? // optional
    .with_conversion_info(FeeConversionInfo::one_to_one(fee_faucet));

let commitment = auth.to_commitment();
let mut tx_args = TransactionArgs::default().with_auth_args(commitment);
tx_args.extend_advice_map([(commitment, auth.to_elements())]);
// The transaction's partial blockchain must also track `auth.bound_block_num()`.
```

The `MultisigAuthArgs` API:

```rust
MultisigAuthArgs::new(bound_block_num: BlockNumber, salt: Word) -> Self
MultisigAuthArgs::with_approval_expiration_delta(self, delta: NonZeroU32) -> Result<Self, AccountError>
MultisigAuthArgs::with_conversion_info(self, conversion_info: FeeConversionInfo) -> Self
bound_block_num() -> BlockNumber
approval_expiration_block_num() -> Option<BlockNumber>
salt() -> Word
conversion_info() -> Option<FeeConversionInfo>
impl SequentialCommit for MultisigAuthArgs   // to_elements() = 12 felts, to_commitment() = Poseidon2 sequential hash
```

### Affected Code (Web)

`feeAwareTransactionRequestBuilder` builds the three-word shape for a multisig and declares the bound block. A multisig request built with `withFeeConversionSalt` now aborts in the VM. One built from a bare builder now aborts on fee-free chains too; on a fee-charging chain it still fails before execution with `FeeConversionInfoRequired`.

```typescript
// Before (0.16): a hand-declared salt worked for a multisig on a fee-charging chain
const request = new TransactionRequestBuilder()
  .withFeeConversionSalt(salt)
  .withCustomScript(script)
  .build();
```

```typescript
// After (0.17)
const request = (
  await client.feeAwareTransactionRequestBuilder(multisig, {
    feeConversionSalt: salt,        // optional; consumed by the call
    boundBlockNum: agreedBlock,     // optional; default: this client's sync height
    approvalExpirationDelta: 100,   // optional; >= 1; omitted = never expires
  })
)
  .withCustomScript(script)
  .build();
```

For any account that is not a multisig, `feeAwareTransactionRequestBuilder` still returns an untouched builder. The convenience methods (`send`, `mint`, `consume`, ...) already start from it.

### Migration Steps

1. **Rust client:** for every request a multisig account executes, stop calling `fee_conversion_salt`. Build `MultisigAuthArgs::new(bound_block, salt)` with a fresh random `salt` per proposal (it is the replay guard), add `.with_conversion_info(FeeConversionInfo::one_to_one(fee_faucet_id))` on a fee-charging chain, and optionally `.with_approval_expiration_delta(delta)`.
2. **Rust client:** set it with `.auth_arg(auth_args.to_commitment())` and `.extend_advice_map([(auth_args.to_commitment(), auth_args.to_elements())])`, and add the bound block with `.block_numbers([bound_block])`. Setting any non-empty auth arg makes the client skip its own fee commitment. Do this on a fee-free chain too.
3. **Rust:** `SequentialCommit` (for `to_commitment` / `to_elements`) needs a direct `miden-protocol` dependency. Take the fee faucet from the synced protocol config, not from the block header.
4. **`miden-tx`:** replace `commit_fee_conversion_info(info, salt)` for multisig accounts with `MultisigAuthArgs`, and always put the preimage in the advice map: `tx_args.extend_advice_map([(auth.to_commitment(), auth.to_elements())])`, even on a zero-fee chain. Keep `commit_fee_conversion_info` for `AuthSingleSig`.
5. **Web:** build every request a multisig (guarded multisig included) executes from `await client.feeAwareTransactionRequestBuilder(account)`, on fee-free chains too.
6. **Web:** do not call `withFeeConversionSalt` or `withAuthArg` on the builder it returns for a multisig: each clears the other and discards the three-word auth args. Pass `feeConversionSalt` in the options instead.
7. **Web:** `feeConversionSalt` consumes the `Word` (it moves across the WASM boundary). Build a fresh `Word` per call; a spent handle is not rejected, it arrives as "no salt" and a random one is drawn.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `the advice map holds no preimage for the multisig auth args` | No advice-map entry for the auth args: the 0.16 zero-fee pattern, a bare Web builder on a fee-free chain, or an `auth_arg` / `withAuthArg` with no matching advice-map entry (for example `withAuthArg` on the builder `feeAwareTransactionRequestBuilder` returns) | Build `MultisigAuthArgs` and add its preimage (Web: `feeAwareTransactionRequestBuilder`). |
| `advice stack read failed` | A two-word preimage from `fee_conversion_salt` / `commit_fee_conversion_info` (Rust), or from `withFeeConversionSalt` or `withAuthArg` with a hand-committed two-word preimage (Web), where three words are read | Use `MultisigAuthArgs` / the builder's `feeConversionSalt` option. |
| An unlabelled `assert_eqw` failure inside `miden::core::mem::pipe_preimage_to_memory` | Same two-word preimage | Same. |
| ``account's `<component>` component reuses the fee conversion salt as a replay guard, so the caller must declare a fresh one with `TransactionRequestBuilder::fee_conversion_salt` `` (Rust: `FeeConversionInfoRequired`, the source of `invalid transaction request`) | Multisig on a fee-charging chain with neither an auth arg nor a salt: a Rust request without `MultisigAuthArgs`, or a bare Web builder (unchanged from 0.16) | Rust: build `MultisigAuthArgs`. Web: use `feeAwareTransactionRequestBuilder`. Do not follow the message's advice (see below). |
| `approvalExpirationDelta must be at least 1 block; omit it for an approval that does not expire` | `approvalExpirationDelta: 0` | Omit it or pass 1 or more. |

Production Web SDK builds strip MASM debug info, so the first message may surface only as `assertion failed with error code: <N>`.

:::caution The `FeeConversionInfoRequired` message points to the wrong fix
The client raises this error only for the multisig components, and its text still tells you to call `TransactionRequestBuilder::fee_conversion_salt`. For a multisig that makes the client commit the two-word conversion-info preimage, which the 0.17 components cannot read, so execution then fails with the two-word-preimage errors above. Build `MultisigAuthArgs` instead (Web: `feeAwareTransactionRequestBuilder`).
:::

---

## Multi-party multisig signing executes at the tip, not at a `ChainAnchor`

### Summary

0.16 bound the transaction summary to the reference block, so the 0.16 guide had every party (proposer, co-signers, executor) execute at a shared `ChainAnchor`. In 0.17 a multisig summary binds `MultisigAuthArgs::bound_block_num` instead. Any later execution, the final submit included, runs at the executing client's **current tip** with the bound block added to its partial blockchain, and reproduces the summary the approvers signed. **For multisig, the bound block replaces the anchor.** The TX_FEE note's serial number is derived from the bound block too (for `AuthMultisig` and `AuthGuardedMultisig`), so it stays stable across reference blocks while the nonce is unchanged.

Re-executing a multisig at an old anchor is now a dead end. Every foreign account the transaction reads (the fee faucet when its asset callbacks are enabled, a network note's target, any declared foreign account) is loaded at the reference block, and the node serves account state for only the last 50 blocks. An anchor that aged during signature collection fails with `block N has been pruned`.

`ChainAnchor` still exists. `chain_anchor_for_request` and `execute_transaction_at` (Rust) and the `anchor` options (Web, React) remain for single-signature co-signing, where the summary still binds the reference block. `chain_anchor_for_request` now also tracks the blocks listed in `block_numbers`.

### Affected Code (Rust)

```rust
// Before (0.16): every party executed at the proposer's anchor
let anchor = client.chain_anchor_for_request(&request).await?;
let result = client.execute_transaction_at(account_id, request, anchor).await?;
```

```rust
// After (0.17): every party executes the same request at its own current tip.
// The request carries the bound block in `block_numbers` (see the previous section).
let result = client.execute_transaction(account_id, request).await?;
```

With `miden-tx` directly, your `DataStore` must include the bound block in the `PartialBlockchain` it returns: the executor asks it only for the reference block and the note inclusion blocks.

### Affected Code (Web)

```typescript
// Before (0.16): capture an anchor and pass it everywhere
const anchor = await client.transactions.captureAnchor(request);
const summary = await client.transactions.preview({ operation: "custom", account: multisig, request, anchor });
await client.transactions.submit(multisig, request, { anchor });
```

```typescript
// After (0.17)
// Proposer
const request = (await client.feeAwareTransactionRequestBuilder(multisig)).withCustomScript(script).build();
const summary = await client.transactions.preview({ operation: "custom", account: multisig, request });
ship(request.serialize(), summary.serialize());

// Co-signer / executor: sync to at least the bound block, then re-derive from the proposer's bytes
await client.sync();
const proposed = TransactionRequest.deserialize(requestBytes);
const derived = await client.transactions.preview({ operation: "custom", account: multisig, request: proposed });
await client.transactions.submit(multisig, proposed);
```

A multisig request whose auth args you assemble by hand must add the bound block itself with `new TransactionRequestBuilder().withBlockNumbers([boundBlock])`.

### Affected Code (React)

Drop `useChainAnchor` and the `anchor` option for a multisig request from `feeAwareTransactionRequestBuilder`. `usePreview` does not sync, so sync and check the sync height against the bound block first:

```tsx
// After (0.17): multisig co-signer
const { client, sync } = useMiden();
const { preview } = usePreview();

async function reviewProposal(requestBytes: Uint8Array) {
  if (!client) throw new Error("Miden client is not ready");
  const request = TransactionRequest.deserialize(requestBytes);
  await sync();
  if ((await client.getSyncHeight()) < Math.max(0, ...request.blockNumbers())) throw new Error("not synced yet");
  return preview({ accountId, request }); // no anchor
}
```

Execute through `useTransaction` without an `anchor` as well.

`useMiden().client` is the raw `WebClient`, not `MidenClient`: its `client.feeAwareTransactionRequestBuilder(accountId, approvalExpirationDelta?, feeConversionSalt?, boundBlockNum?)` takes positional arguments, not the options object shown above.

### Approval expiration moved into the auth args

In 0.16 the transaction expiration delta was the only way to bound how long collected approvals stayed usable. It is now measured from each execution's reference block, so it no longer caps the approval window. Use `MultisigAuthArgs::with_approval_expiration_delta` (Rust) or the `approvalExpirationDelta` option (Web) instead. The approval expires at an absolute block, `bound_block_num + delta`, which the summary binds; executing at or after it fails.

### Verify the bound block

The bound block arrives from the proposer. To check that it is a real block, compare `summary.blockCommitment()` with the header a trusted node returns for that block number. In Rust, `TransactionSummary::block_number()` and `block_commitment()` give the bound block and its commitment.

### Migration Steps

1. Stop pinning multisig execution to the proposal block. Drop `chain_anchor_for_request` / `execute_transaction_at` (Rust), `captureAnchor` and the `anchor` option on `preview`, `executeRequest` and `submit` (Web), and `useChainAnchor` and the `anchor` option on `usePreview` / `useTransaction` (React) for multisig requests. Keep them for single-signature co-signing.
2. Fix the bound block at proposal time, at a block the proposer has synced. Give the same `MultisigAuthArgs` (bound block, salt, approval expiration, conversion info) to every signer and to the executor. Ship the proposer's request bytes rather than rebuilding the request: the salt is drawn per build. A co-signer who rebuilds must pin `feeConversionSalt` and `boundBlockNum`, and pass the same `approvalExpirationDelta` if the proposer set one (Web).
3. Sync each party to at least the bound block (`Math.max(...request.blockNumbers())` in the Web SDK) before preview or submit.
4. Make sure every execution's partial blockchain tracks the bound block: `block_numbers([bound_block])` (Rust client), `withBlockNumbers([boundBlock])` (Web, hand-built requests), or a `DataStore` that includes it (`miden-tx`).
5. If you used the transaction expiration delta to bound approvals, switch to the approval expiration delta.
6. Re-serialize stored requests. `TransactionRequest` bytes now start with the block numbers and end with an optional account code upgrade, so bytes from 0.16, or from a 0.17.0 release candidate up to rc.4, do not deserialize. A dApp and its wallet exchanging a `CustomTransaction` through the wallet adapter must both be on 0.17.
7. Signing flows that reconstruct the summary (co-signers, guardians) must use the same bound block, salt, approval expiration and conversion info the proposer used.
8. If you precompute the TX_FEE note of a multisig transaction, pass the bound block to `TxFeeNote::derive_serial_number(sender, initial_nonce, serial_number_block)` (the parameter was `ref_block_num`).

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `requested block N is after transaction reference block M` | The client is synced below the bound block | Sync, then retry. |
| `block N has been pruned` | Re-executing a multisig at an old anchor (often naming the fee faucet) | Drop the anchor and execute at the tip. |
| `failed to lookup value in Merkle store` (Rust: after `failed to execute transaction kernel program:`) | The bound block is not tracked by the transaction's partial blockchain: a Rust request without `block_numbers([bound_block])`, a hand-built Web request without `withBlockNumbers`, or a `DataStore` that omits it | Add the bound block, or build the Web request with `feeAwareTransactionRequestBuilder`. |
| `transaction summary binds block {0}, which the transaction does not authenticate` | Custom auth components only: the component hashes a summary that binds an untracked block without reading that block's commitment. The standard multisig components read it and fail with the Merkle store error above instead. | Track the bound block, as above. |
| `the block number must not exceed the transaction reference block number` | `bound_block_num` is after the execution's reference block | Bind a block at or before it. |
| `the multisig approval expired at or before the transaction reference block` | Executed at or after `approval_expiration_block_num` | Collect fresh approvals with a new `MultisigAuthArgs`. |

---

## Fees are paid only in the native fee asset at rate 1/1

### Summary

`FeeConversionInfo::new(faucet_id, rate_num, rate_den)` still compiles and still validates only that the rates are non-zero field elements, but `fee::pay_fee` now aborts unless the committed conversion info is the native fee asset at 1/1, whenever the computed fee is non-zero. In 0.16.1 `AuthSingleSig` accepted any asset and rate. Every standard fee-paying auth component goes through `pay_fee`. The fee faucet no longer comes from the block header: build the info from `ProtocolConfig::fee_asset_id().faucet_id()`.

In MASM, `fee::pay_fee` enforces the rule and also takes a new `serial_number_block` argument; see [MASM Changes](./masm-changes).

### Affected Code

```rust
// Before (0.16): pay the fee in another asset at 3/2
let info = FeeConversionInfo::new(stablecoin_faucet_id, 3, 2)?;
```

```rust
// After (0.17): only this is accepted on a fee-charging chain
let info = FeeConversionInfo::one_to_one(protocol_config.fee_asset_id().faucet_id());
```

### Migration Steps

1. Replace every `FeeConversionInfo::new(..)` with `FeeConversionInfo::one_to_one(<native fee faucet>)`.
2. Fund paying accounts with the native fee asset.
3. On a zero-fee chain the conversion info is not checked, and single-signature accounts may omit it. Multisig accounts still need the `MultisigAuthArgs` preimage (see above).

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `the transaction fee must be paid in the native fee asset at rate 1/1` | Non-native faucet or a rate other than 1/1 | `FeeConversionInfo::one_to_one` with the chain's fee faucet. |
| `paying a non-zero fee requires conversion info committed via the auth args` | No conversion info on a fee-charging chain | Commit the conversion info. |
| `transaction {transaction_id} must use only the native asset {fee_asset_id} in each TX_FEE output note` (node) | A TX_FEE note in another asset | Pay in the native fee asset. |

---

## Fee features from 0.16.x are not in 0.17

:::caution Not in 0.17
The 0.16 line gained these fee features after 0.17 branched, and 0.17 deliberately did not take them over. It pins every standard fee payment to the native fee asset at 1/1 inside `fee::pay_fee`, which makes a separate estimate and bound unnecessary. A 0.16.x user loses the procedures on upgrade.
:::

| 0.16.1 feature | In 0.17 |
| --- | --- |
| `fee::estimate_fee`, `fee::pay_network_note_sponsorships`, `fee::resolve_payment_info`, `fee::pay_estimated_fee`, `fees::estimate_network_note_sponsorships` | Absent. `fee::pay_fee` does sponsorship, fee computation and payment in one procedure; `fee::apply_cycle_margins` takes one argument instead of two. |
| `fee::assert_fee_bound` | Absent. Superseded: `pay_fee` itself asserts the native fee asset at 1/1, which is tighter than any bound. |
| `AuthMultisig` pays through `multisig::pay_bounded_fee`, capped at 2x | `pay_bounded_fee` is absent. `AuthMultisig` calls `fee::pay_fee` directly under the 1/1 rule. |
| `AuthGuardedMultisig` pays the fee, 2x-bounded | Pays through `fee::pay_fee` under the 1/1 rule. |
| `AuthMultisigSmart` pays the fee, 2x-bounded | Pays under the 1/1 rule, like `AuthMultisig` and `AuthGuardedMultisig`. |

No Rust public item was removed by these; the break is in the MASM procedures and in runtime behaviour. The MASM replacements for each removed procedure are in [MASM Changes](./masm-changes).

### Migration Steps

1. Replace MASM calls to `fee::estimate_fee`, `fee::assert_fee_bound` and `multisig::pay_bounded_fee` with `fee::pay_fee`, which now also takes `serial_number_block`.
2. Build every fee conversion info with `FeeConversionInfo::one_to_one(<chain fee faucet>)`.

---

## `TransactionSummary` gains a version and the bound block number

### Summary

`TransactionSummary::new` takes the bound block number before its commitment, `TransactionSummaryUserParams` holds 6 elements instead of 7, and the commitment preimage and the byte serialization now start with a version. `block_commitment()` is now the commitment of the **bound** block: the reference block for single-signature components, `MultisigAuthArgs::bound_block_num` for the multisig ones.

### Affected Code

```rust
// Before (0.16)
let summary = TransactionSummary::new(
    account_delta,
    input_notes,
    output_notes,
    block_commitment,
    expiration_delta,
    TransactionSummaryUserParams::new([p0, p1, p2, p3, p4, p5, p6]),
);
let (expiration_delta, user_params) = TransactionSummary::try_params_from_elements(&elements)?;
```

```rust
// After (0.17)
use miden_protocol::transaction::{TransactionSummary, TransactionSummaryMetadata, TransactionSummaryUserParams};

let summary = TransactionSummary::new(
    account_delta,
    input_notes,
    output_notes,
    block_number,        // new: the BlockNumber the summary binds
    block_commitment,    // commitment of `block_number`
    expiration_delta,
    TransactionSummaryUserParams::new([p0, p1, p2, p3, p4, p5]),
);
let (metadata, user_params): (TransactionSummaryMetadata, _) =
    TransactionSummary::try_params_from_elements(&elements)?;
let expiration_delta = metadata.expiration_delta();
let bound_block = metadata.block_number(); // also summary.block_number()
```

The preimage layout moved from `[DELTA, INPUT_NOTES, OUTPUT_NOTES, BLOCK, [exp, u0, u1, u2], [u3..u6]]` to `[[version, metadata, u0, u1], [u2..u5], DELTA, INPUT_NOTES, OUTPUT_NOTES, BLOCK]`, where `metadata` packs `expiration_delta << 32 | block_number`. `NUM_ELEMENTS` stays 24.

The account delta commitment a summary signs changed as well (see [Account Changes](./account-changes)), so signatures collected over 0.16 summaries cannot be reused. On the MASM side, `auth::create_tx_summary` takes 6 user params, `create_tx_summary_with_block` is new, and `tx::get_block_commitment` takes a block number; see [MASM Changes](./masm-changes).

### Migration Steps

1. Add the bound block number argument to `TransactionSummary::new`.
2. Shrink `TransactionSummaryUserParams::new` arrays from 7 to 6 elements.
3. Replace the `u16` returned by `try_params_from_elements` with `TransactionSummaryMetadata::expiration_delta()`.
4. Rename `TransactionSummaryError::ExpirationDeltaTooLarge` to `MetadataOutOfRange` in `match` arms, and handle the new `UnsupportedVersion` variant.
5. Discard any `TransactionSummary` bytes serialized by 0.16; they no longer deserialize.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `error[E0061]: this function takes 7 arguments but 6 arguments were supplied` | Missing `block_number` in `TransactionSummary::new` | Pass the bound block number. |
| `error[E0308]: mismatched types` on `TransactionSummaryUserParams::new` | 7-element array | Use 6 elements. |
| `transaction summary version is {version} but only version 1 is supported` | Deserializing 0.16 summary bytes | Rebuild the summary. |
| `transaction summary layout version is {actual} but only version {expected} is supported` | A preimage in the old layout passed to `try_params_from_elements` | Rebuild the preimage. |

---

## Emitting a network note or moving a policy-gated asset caps the transaction at 20 blocks

### Summary

The new MASM procedure `miden::standards::expiration::apply_default` lowers the transaction expiration delta to at most `DEFAULT_EXPIRATION_BLOCK_DELTA = 20` blocks after the reference block. It is not a universal kernel default. It runs in `fee_manager::estimate_note_fee`, and in `policy_manager::invoke_transfer_policy` whenever a transfer policy is set. As a result:

- **Emitting a network note.** Every fee-paying standard auth component prices each network output note by a foreign procedure call to the target's `estimate_note_fee`. Any transaction whose auth component pays through `fee::pay_fee` and that emits a note carrying a `NetworkAccountTarget` attachment therefore expires at most 20 blocks after its reference block, on fee-free chains too: the sponsorship step runs before the fee is computed. The foreign call itself is not new (0.16.1 made it too); the expiration it applies is.
- **Moving a policy-gated asset.** Any transfer of an asset whose faucet has a transfer policy gets the same cap.

The expiration delta only ever decreases, so the smallest delta wins, and a larger `expiration_delta` on such a transaction has no effect. The expiration block itself is still the last block the transaction may be included in. At 3-second blocks, 20 blocks is about one minute.

:::note The changelog splits the cap across two entries
The 0.17.0 entry says the 20-block default applies to "the standard allowlist and blocklist transfer policies and the fee manager's `estimate_note_fee`". The cap in `policy_manager::invoke_transfer_policy`, which covers every configured transfer policy and so every transfer of a policy-gated asset, is a separate entry, "Bounded transfer policy dispatch to the reference block", filed under the `v0.16.0 (2026-08-06)` heading (see the note at the top of this page). That entry does not mention the 20-block figure.
:::

### Web SDK and React

`transactions.createNetworkNote` and `useCreateNetworkNote` now also declare the target as a foreign account, which pins its state at the reference block. Their transaction must land within 20 blocks. `createNetworkNote` does not sync, so a bare retry after an expiry reuses the same reference block and expires again.

If you build the emitting request yourself, declaring the target is recommended, not required, for a public target: the SDK resolves a public foreign account lazily.

```typescript
const targets = new ForeignAccountArray();
targets.push(ForeignAccount.public(targetId, new AccountStorageRequirements()));
builder.withOwnOutputNotes(notes).withForeignAccounts(targets).build();
```

### Migration Steps

1. Budget proving and submission for these transactions to fit in 20 blocks, and reference a recent block.
2. Do not expect a larger `expiration_delta` on such a transaction to take effect.
3. **Web:** on an expiry rejection, call `sync()` first, then call `createNetworkNote` again.
4. Treat a successful submit as provisional until the transaction commits: the node drops an expired transaction after admitting it. How the client handles the dropped transaction, including input notes left in `Processing`, is covered in [Client Changes](./client-changes).
5. **MASM:** if your own procedure is called through FPI and reads mutable state, call `expiration::apply_default` (or `tx::update_expiration_block_delta`) on that path. See [MASM Changes](./masm-changes).

---

## `NoteScript` / `TransactionScript`: `from_parts` is fallible and `from_package` rejects executables

### Summary

Both script types now wrap a shared `MastForestScript`. `from_parts` returns a `Result` instead of panicking on a bad entrypoint. `from_package` accepts only **library** packages and finds the entrypoint by its `@note_script` / `@transaction_script` attribute. An executable package (one with a `begin .. end` program) is rejected with `MastForestScriptError::ExecutablePackage`; in 0.16 `TransactionScript::from_package` accepted executables. `miden_protocol::errors::TransactionScriptError` was removed. `CodeBuilder::compile_tx_script` and `compile_note_script` are unaffected: they already assemble a library.

The byte format changed as well: both types serialize their MAST forest without node hashes, and a note script's `Vec<Felt>` encoding was replaced. See [Hashless serialization and the note script element encoding](#hashless-serialization-and-the-note-script-element-encoding).

### Affected Code

```rust
// Before (0.16)
use miden_protocol::errors::TransactionScriptError;
use miden_protocol::note::NoteScript;
use miden_protocol::transaction::TransactionScript;

let note_script = NoteScript::from_parts(mast.clone(), entrypoint);          // panics on a bad node
let tx_script = TransactionScript::from_parts(mast, entrypoint);             // panics on a bad node
let tx_script: Result<_, TransactionScriptError> = TransactionScript::from_package(&package);
```

```rust
// After (0.17)
use miden_protocol::MastForestScriptError;
use miden_protocol::note::NoteScript;
use miden_protocol::transaction::TransactionScript;

let note_script = NoteScript::from_parts(mast.clone(), entrypoint)?;         // Result<_, NoteError>
let tx_script = TransactionScript::from_parts(mast, entrypoint)?;            // Result<_, MastForestScriptError>
let tx_script: Result<_, MastForestScriptError> = TransactionScript::from_package(&package);
```

:::note The public path of `TransactionScript` did not change
The changelog describes "moving `TransactionScript` into `transaction::script`". That module is private: `miden_protocol::transaction::TransactionScript` is still the public path. The changelog also does not mention that `TransactionScriptError` was deleted.
:::

### Hashless serialization and the note script element encoding

`NoteScript`, `TransactionScript` and `AccountCode` now write their MAST forest in the hashless form and read it back with `UntrustedMastForest`, which recomputes the node hashes. Script roots, code commitments and note IDs do not change. A reader that parses the forest inside these bytes with the trusted `MastForest::read_from`, which is what 0.16 does, rejects them. `AccountCode` is covered in [Account Changes](./account-changes).

When a transaction creates a note and the advice map holds its recipient, the host reads the note script from the advice map under the script root. `From<&NoteScript> for Vec<Felt>` and `TryFrom<&[Felt]> for NoteScript` (and their owned forms) are gone: `NoteScript::to_elements()` packs the script's full serialization at 7 bytes per element, and `NoteScript::try_from_elements` decodes it.

```rust
// Before (0.16): [entrypoint, len, 4 bytes per element]
let elements = <Vec<Felt>>::from(&note_script);
let decoded = NoteScript::try_from(elements.as_slice())?;
tx_args.extend_advice_map([(Word::from(note_script.root()), elements)]);
```

```rust
// After (0.17): the serialized script, 7 bytes per element
let elements = note_script.to_elements();
let decoded = NoteScript::try_from_elements(&elements)?;
tx_args.extend_advice_map([(Word::from(note_script.root()), elements)]);
```

### Migration Steps

1. Add `?` (or handle the error) to every `NoteScript::from_parts` and `TransactionScript::from_parts` call.
2. Replace `miden_protocol::errors::TransactionScriptError` with `miden_protocol::MastForestScriptError` (at the crate root, not under `errors`). Its variants are `EntrypointNotInForest`, `NoProcedureWithAttribute`, `MultipleProceduresWithAttribute`, `ProcedureNotFound`, `ProcedureMissingAttribute` and `ExecutablePackage`.
3. Replace matches on `NoteError::NoteScriptNoProcedureWithAttribute`, `NoteScriptMultipleProceduresWithAttribute`, `NoteScriptProcedureNotFound` and `NoteScriptProcedureMissingAttribute` with `NoteError::MastForestScript(inner)`.
4. If you ship transaction or note scripts as executable packages, rebuild them as library packages whose entry procedure carries `@transaction_script` / `@note_script`.
5. Replace `Vec::<Felt>::from(&note_script)` with `note_script.to_elements()` and `NoteScript::try_from(elements)` with `NoteScript::try_from_elements(&elements)`. Where you only need the advice entries of an output note, let `TransactionArgs::add_output_note_recipient` or `NoteRecipient::to_advice_map_entries()` build them.
6. In matches on `TransactionKernelError::MalformedNoteScript`, rename the `data` field to `script_elements`.
7. Deserialize stored scripts and account code through their own types (`NoteScript::read_from_bytes`, `TransactionScript::read_from_bytes`, `AccountCode::read_from_bytes`). To read a bare hashless forest, use `UntrustedMastForest::read_from_bytes(&bytes)?.validate()?` (`miden_protocol::assembly::mast::UntrustedMastForest`). Every component that reads bytes written by 0.17 must itself run 0.17.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `invalid value: HASHLESS flag is set; use UntrustedMastForest for untrusted input` | 0.17 `NoteScript`, `TransactionScript` or `AccountCode` bytes, or the forest inside them, read with the trusted `MastForest::read_from` (or by a 0.16 build) | Deserialize the 0.17 type itself, or use `UntrustedMastForest`; upgrade the reader to 0.17. |
| ``note script elements `{script_elements:?}` extracted from the advice map by the event handler are not well formed`` | An advice-map entry built with the 0.16 note script encoding | Build it with `note_script.to_elements()`. |
| `error[E0277]` on `Vec::<Felt>::from(&note_script)` or `NoteScript::try_from(elements)` | The conversions were removed | `to_elements()` / `try_from_elements()` |
| `expected a library package, but the provided package is an executable` | `from_package` on an executable package | Build a library package with an attributed entry procedure. |
| `error while creating note script: expected a library package, but the provided package is an executable` | Same, through `NoteScript::from_package` | Same. |
| `package does not contain a procedure with '@transaction_script' attribute` | A library without the attribute | Add `@transaction_script` to the entry procedure. |
| `` error[E0432]: unresolved import `miden_protocol::errors::TransactionScriptError` `` | Type removed | `miden_protocol::MastForestScriptError`. |
| `error[E0308]: mismatched types` on `let s: NoteScript = NoteScript::from_parts(..)` | Now returns `Result` | Add `?`. |

---

## `LocalTransactionProver::new` takes a `Prover`; `ProvingOptions` is gone

### Summary

The prover is configured with a `miden_prover::Prover` (hash function, memory budget) instead of `ProvingOptions`, and can take the same `ExecutionOptions` you executed with. The `miden_tx::ProvingOptions` re-export was removed; `miden_tx` re-exports `Prover` instead. `LocalTransactionProver::default()` is unaffected.

### Affected Code

```rust
// Before (0.16)
use miden_prover::HashFunction;
use miden_tx::{LocalTransactionProver, ProvingOptions};

let prover = LocalTransactionProver::new(ProvingOptions::new(HashFunction::Poseidon2));
let proven_tx = prover.prove(executed_tx)?;
```

```rust
// After (0.17)
use miden_prover::HashFunction;
use miden_tx::{ExecutionOptions, LocalTransactionProver, Prover};

let prover = LocalTransactionProver::new(Prover::new().with_hash_fn(HashFunction::Poseidon2))
    .with_execution_options(execution_options); // optional: match the options you executed with
let proven_tx = prover.prove(executed_tx)?;

// Or, for the default configuration (Poseidon2):
let prover = LocalTransactionProver::default();
```

:::caution Check the hash function when you build a `Prover`
`Prover::new()` selects `Blake3_256`, as `ProvingOptions::default()` did. `LocalTransactionProver::default()` uses Poseidon2. Name the hash function explicitly with `with_hash_fn` rather than assuming `Prover::new()` matches the default transaction prover.
:::

### Migration Steps

1. Replace `ProvingOptions::new(hash_fn)` with `Prover::new().with_hash_fn(hash_fn)`, and `ProvingOptions::default()` with `Prover::new()`.
2. Import `Prover` from `miden_tx` (re-exported) or from `miden_prover`.
3. If you execute with non-default `ExecutionOptions`, pass the same options through `with_execution_options`. In 0.16 proving always used `ExecutionOptions::default()`.
4. If you call `TransactionProverHost::new` directly (rare), its third argument is now the map of authenticated block commitments (`tx_inputs.collect_block_commitments()`), not the reference block commitment, and it returns `Result<Self, TransactionKernelError>` instead of `Self`.
5. If you match exhaustively on `TransactionProverError` or `TransactionExecutorError`, handle the new `TransactionHostCreationFailed` variant. A new account whose partial storage lacks one of its storage maps now fails host creation with an error; 0.16 panicked with `storage map should be present in partial storage`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0432]: unresolved import `miden_tx::ProvingOptions` `` | Re-export removed | Use `miden_tx::Prover`. |
| `` error[E0432]: unresolved import `miden_prover::ProvingOptions` `` | Removed from `miden-prover` | `Prover::new().with_hash_fn(..)` |
| `failed to create transaction host` (source: `partial storage of a new account is missing the storage map of slot {0}`) | The `PartialAccount` of a new account omits a storage map | Return the new account's full storage, maps included, from your `DataStore`. |

---

## Transaction proofs defer precompile claims; `verify` returns a `VerificationOutcome`

### Summary

`LocalTransactionProver` now proves only the VM execution and leaves precompile claims (the ECDSA signature check is one) for the batch prover to settle with a single precompile proof. To report that, `TransactionVerifier::verify` returns `Result<VerificationOutcome, TransactionVerifierError>` instead of `Result<(), _>`. For such a proof `verify` returns `Ok`, but `outcome.is_complete()` is `false` and `outstanding_precompile_root()` is `Some`. A Falcon-authenticated transaction uses no precompile and verifies complete. Conversely, a proof whose precompiles were already settled is now rejected by the transaction verifier.

### Affected Code

```rust
// Before (0.16)
use miden_protocol::transaction::TransactionVerifier;

TransactionVerifier::new(96).verify(&proven_tx)?; // Result<(), TransactionVerifierError>
```

```rust
// After (0.17)
use miden_protocol::MIN_PROOF_SECURITY_LEVEL;
use miden_protocol::transaction::TransactionVerifier;

let outcome = TransactionVerifier::new(MIN_PROOF_SECURITY_LEVEL).verify(&proven_tx)?;
if !outcome.is_complete() {
    // The VM proof is valid, but precompile claims (e.g. ECDSA signature checks) are still
    // outstanding; they are settled when the transaction is proven in a batch.
    let _pending = outcome.outstanding_precompile_root();
}
```

`VerificationOutcome` is re-exported as `miden_protocol::vm::VerificationOutcome`.

### Migration Steps

1. Bind the returned `VerificationOutcome` (it is `#[must_use]`) and decide what an incomplete outcome means for you. If you treated `verify(..)?` as "fully verified", check `outcome.is_complete()`.
2. A function that returned `verifier.verify(&tx)` as its `Result<(), _>` tail must now map or discard the outcome.
3. Do not feed fully settled proofs (for example from a VM-level `prove_full`) to `TransactionVerifier`: it rejects them. Prove with `LocalTransactionProver::prove`.
4. If you match exhaustively on `TransactionVerifierError`, handle the new `TransactionProofContainsPrecompiles` variant. The enum is not `#[non_exhaustive]`, so an exhaustive `match` stops compiling (`error[E0004]`).

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `error[E0308]: mismatched types` (expected `Result<(), _>`, found `Result<VerificationOutcome, _>`) | Return type changed | Map the outcome. |
| ``warning: unused `VerificationOutcome` that must be used`` | `verify(&tx)?;` still compiles but discards the outcome | Bind it and check `is_complete()`. |
| `transaction proof contains settled precompile work` | The proof was produced with settled (non-deferred) precompiles | Prove with `LocalTransactionProver::prove`, which defers them. |
| `transaction proof security level is {actual} but must be at least {expected_minimum}` | Unchanged message | Unchanged. |

---

## `FailedNote` reports a `NoteFailure`, and the checker tests notes in bundles

### Summary

`NoteConsumptionChecker` now tests a feature note together with the FEE_SPONSORSHIP notes bound to it. A note that fails only because its bundle failed is reported as `NoteFailure::Collateral { blamed_by }`, so `FailedNote::error()` became optional. `check_notes_consumability` and `can_consume` keep their signatures.

### Affected Code

```rust
// Before (0.16)
for failed in info.failed() {
    let error: &TransactionExecutorError = failed.error();
    println!("{} failed: {error}", failed.note().id());
}
let failed = FailedNote::new(note, error, None);
```

```rust
// After (0.17)
use miden_tx::{FailedNote, NoteFailure};

for failed in info.failed() {
    match failed.failure() {
        NoteFailure::Blamed { error, .. } => println!("{} failed: {error}", failed.note().id()),
        NoteFailure::Collateral { blamed_by } => {
            println!("{} dropped with its bundle (blamed: {blamed_by})", failed.note().id())
        },
        _ => {}, // NoteFailure is #[non_exhaustive]
    }
}
let failed = FailedNote::new(note, NoteFailure::Blamed { error, num_cycles: None });
```

### Migration Steps

1. Treat `FailedNote::error()` as `Option<&TransactionExecutorError>`. `None` means the note was collateral and may be consumable in a different set.
2. Use `is_blamed()` / `is_collateral()`, or match `failure()` with a wildcard arm.
3. Build a `FailedNote` with `FailedNote::new(note, NoteFailure::...)`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `error[E0061]: this function takes 2 arguments but 3 arguments were supplied` | Old `FailedNote::new(note, error, num_cycles)` | Wrap the error in `NoteFailure::Blamed`. |
| `error[E0308]: mismatched types` (expected `&TransactionExecutorError`, found `Option<&TransactionExecutorError>`) | `error()` is now optional | Handle `None`. |

---

## `NetworkNotePricer` takes the fee asset explicitly

### Summary

`FeeParameters` no longer knows the fee faucet, so the pricer's builder gained a required `fee_asset_id`. `basic_constant_fee_policy` is new: it returns the bare `BasicConstantFeePolicy` for installing into a manager you build yourself. `basic_constant_fee_policy_manager` still returns the manager. FEE_SPONSORSHIP notes are priced at zero unless you supply a cost.

### Affected Code

```rust
// Before (0.16)
let pricer = NetworkNotePricer::builder()
    .fee_parameters(FeeParameters::new(fee_faucet_id, verification_base_fee))
    .build();
let manager = pricer.basic_constant_fee_policy_manager(note_script_roots)?;
```

```rust
// After (0.17)
use miden_protocol::asset::AssetId;

let pricer = NetworkNotePricer::builder()
    .fee_parameters(FeeParameters::new(verification_base_fee))
    .fee_asset_id(AssetId::new_fungible(fee_faucet_id)) // the chain's ProtocolConfig::fee_asset_id()
    .build();
let manager = pricer.basic_constant_fee_policy_manager(note_script_roots)?;
```

```rust
// After (0.17): or build only the policy, to install it into a manager you build yourself
let policy = pricer.basic_constant_fee_policy(note_script_roots)?;
```

### Migration Steps

1. Drop the faucet ID from `FeeParameters::new` and pass the chain's fee asset through `.fee_asset_id(..)`.
2. Replace `pricer.fee_parameters().fee_faucet_id()` with `pricer.fee_asset_id().faucet_id()`, or use the `AssetId` directly.
3. If you relied on a non-zero default price for FEE_SPONSORSHIP notes, supply it with `.note_cost(..)`.

---

## `ProgramExecutor` moved to `miden-processor` and changed shape

### Summary

`miden_tx::ProgramExecutor` is now a re-export of `miden_processor::ProgramExecutor`. Its constructor is fallible, the debug-info execution method was replaced by two builder methods, and `execute` is the only execution entry point. This only affects custom executors plugged into `TransactionExecutor<_, _, EXEC>`, such as debuggers. The VM side of the trait is covered in [VM & Assembler Changes](./vm-assembler).

### Affected Code

```rust
// Before (0.16): miden_tx::ProgramExecutor, defined in miden-tx
fn new(stack_inputs: StackInputs, advice_inputs: AdviceInputs, options: ExecutionOptions) -> Self;
fn execute<H: Host + Send>(self, program: &Program, host: &mut H)
    -> impl FutureMaybeSend<Result<ExecutionOutput, ExecutionError>>;
fn execute_with_package_debug_info<H: Host + Send>(
    self, program: &Program, package_debug_info: &PackageDebugInfo,
    entrypoint_source_node: Option<DebugSourceNodeId>, host: &mut H,
) -> impl FutureMaybeSend<Result<ExecutionOutput, ExecutionError>>; // had a default body
```

```rust
// After (0.17): miden_processor::ProgramExecutor (still re-exported as miden_tx::ProgramExecutor)
use miden_processor::advice::AdviceError;

fn new(stack_inputs: StackInputs, advice_inputs: AdviceInputs, options: ExecutionOptions)
    -> Result<Self, AdviceError>;
fn with_debug_info(self, package_debug_info: PackageDebugInfo) -> Self;
fn with_entrypoint_source_node(self, entrypoint_source_node: Option<DebugSourceNodeId>) -> Self;
fn execute<H: Host + Send>(self, program: &Program, host: &mut H)
    -> impl FutureMaybeSend<Result<ExecutionOutput, ExecutionError>>;
```

### Migration Steps

1. Return `Result<Self, AdviceError>` from `new`. For a `FastProcessor` wrapper, forward `FastProcessor::new_with_options`, which already returns that.
2. Replace `execute_with_package_debug_info` with `with_debug_info` + `with_entrypoint_source_node`, store the values, and use them in `execute`.
3. If you construct `TransactionExecutorHost` directly, its `ref_block_commitment: Word` parameter became `block_commitments: BTreeMap<BlockNumber, Word>`: pass a map of every authenticated block number to its commitment. `new` now returns `Result<Self, TransactionKernelError>` instead of `Self`; it fails for a new account whose partial storage lacks one of its storage maps.

---

## (Testing) `MockChain` and the test helpers follow the protocol renames

### Summary

`miden-testing` follows the `ValidatorConfig` and `ProtocolConfig` changes. `MockChain::get_transaction_inputs_at` takes the extra blocks to authenticate, and the dummy-proof and validator test helpers moved. The common `MockChain::builder()` to `build_transaction` path is unaffected.

### Affected Code

```rust
// Before (0.16)
use miden_protocol::testing::validator_keys::{random_validator_set, sign_all};

let keys = mock_chain.validator_keys();
mock_chain.prove_next_block_with_validator_keys_rotation(new_signing_keys)?;
let tx_inputs = mock_chain.get_transaction_inputs_at(block_num, account, &note_ids, &[])?;
let header = BlockHeader::mock(3, None, None, &[], Word::empty());
let (signers, keys) = random_validator_set(3);
let signatures = sign_all(&keys, &signers, commitment);
let proof = ExecutionProof::new_dummy();
let block_proof = BlockProof::new_dummy();
```

```rust
// After (0.17)
use miden_protocol::block::ValidatorConfig;

let config = mock_chain.validator_config();
mock_chain.prove_next_block_with_validator_config_rotation(new_signing_keys)?;
let tx_inputs = mock_chain.get_transaction_inputs_at(block_num, account, &note_ids, &[], [])?;
let header = BlockHeader::mock(3, None, None, &[]);
let (signers, config) = ValidatorConfig::random_with_signers(3);
let signatures = config.sign_all(&signers, commitment);
let proof = miden_protocol::testing::dummy_execution_proof(); // replaces both dummies
let protocol_config = mock_chain.protocol_config();          // new
```

New and additive: `MockChainBuilder::validator_signing_keys(Vec<SigningKey>)` (the default stays three random validators), `MockTransactionBuilder::required_block(BlockNumber)` and `MockChain::protocol_config()`. `MockChain::fee_faucet_id()` still exists. A multisig test wires its auth args through the transaction builder:

```rust
use miden_protocol::crypto::SequentialCommit; // to_commitment / to_elements

let commitment = multisig_auth_args.to_commitment();
builder
    .auth_args(commitment)
    .add_advice_map_entry(commitment, multisig_auth_args.to_elements())
    .required_block(multisig_auth_args.bound_block_num())
```

### Migration Steps

1. Rename `validator_keys()` to `validator_config()`, and `prove_next_block_with_validator_keys_rotation` to `prove_next_block_with_validator_config_rotation`.
2. Add the fifth argument (`required_blocks: impl IntoIterator<Item = BlockNumber>`) to `get_transaction_inputs_at`; pass `[]` for the old behaviour.
3. Drop the last argument (`tx_kernel_commitment`) of `BlockHeader::mock`.
4. Replace `testing::validator_keys::{random_validator_set, sign_all}` with `ValidatorConfig::random_with_signers`, `ValidatorConfig::from_signers` and `ValidatorConfig::sign_all` (all under the `testing` feature).
5. Replace `ExecutionProof::new_dummy()` / `BlockProof::new_dummy()` with `miden_protocol::testing::dummy_execution_proof()`.
6. A private account added through `MockChainBuilder` at genesis is no longer retained: `mock_chain.committed_account(id)` now errors for it. Keep the `Account` you built and pass it to `build_transaction` or `get_foreign_account_inputs` (which now accepts an `Account` as well as an `AccountId`).

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0599]: no method named `validator_keys` found for struct `MockChain` `` | Renamed | `validator_config()` |
| `error[E0061]: this method takes 5 arguments but 4 arguments were supplied` (`get_transaction_inputs_at`) | New `required_blocks` | Pass `[]`. |
| `error[E0061]: this function takes 4 arguments but 5 arguments were supplied` (`BlockHeader::mock`) | Kernel commitment removed | Drop the last argument. |
| `` error[E0432]: unresolved import `miden_protocol::testing::validator_keys` `` | Module replaced by `ValidatorConfig` methods | `ValidatorConfig::random_with_signers` |
| `account {account_id} not found in committed accounts` | Private genesis account no longer retained | Pass the `Account` itself. |
| `mock transactions for private accounts should be created with MockTransactionInput::Account` | `get_foreign_account_inputs` given a private account's ID | Pass the `Account` itself. |

---

## For node operators and block producers

Most applications can skip this section. It covers the types a block producer, a batch producer or genesis tooling constructs directly.

### `ValidatorKeys` is now `ValidatorConfig`, and `BlockHeader::new` changed

The validator set type is renamed and takes a `quorum` that must equal the key count. `BlockHeader::new` no longer takes a version or a kernel commitment; it takes a `ValidatorConfig`, a fee-less `FeeParameters`, the protocol config commitment and an optional scheduled `NextProtocolConfig`. The header version is always `1` (8 bits).

```rust
// Before (0.16)
use miden_protocol::block::{BlockHeader, FeeParameters, ValidatorKeys, ValidatorKeysError};

let keys = ValidatorKeys::new(public_keys)?;
let first = keys.as_keys()[0].clone();
let commitment = keys.commitment();
let proposed = proposed.with_next_validator_keys(keys.clone());

let header = BlockHeader::new(
    0, // version: u32
    prev_block_commitment, block_num, chain_commitment, account_root, nullifier_root,
    note_root, tx_commitment,
    tx_kernel_commitment,
    keys,
    FeeParameters::new(fee_faucet_id, 500),
    timestamp,
);
```

```rust
// After (0.17)
use miden_protocol::block::{BlockHeader, FeeParameters, ValidatorConfig};
use miden_protocol::errors::ValidatorConfigError;

let quorum = u16::try_from(public_keys.len()).expect("validator count fits in u16");
let config = ValidatorConfig::new(public_keys, quorum)?; // quorum must equal the key count
let first = config.keys()[0].clone();
let commitment = config.to_commitment();
let proposed = proposed.with_next_validator_config(config.clone());

let header = BlockHeader::new(
    prev_block_commitment, block_num, chain_commitment, account_root, nullifier_root,
    note_root, tx_commitment,
    config,
    FeeParameters::new(500),
    protocol_config.to_commitment(),
    None, // next_protocol_config: Option<NextProtocolConfig>
    timestamp,
);
```

1. Rename `ValidatorKeys` to `ValidatorConfig`, and import `ValidatorConfigError` from `miden_protocol::errors` (`ValidatorKeysError` was exported from `miden_protocol::block`).
2. Pass a `quorum` equal to the number of keys; anything else is rejected.
3. Rename `as_keys()` to `keys()`, `commitment()` to `to_commitment()`, and `ValidatorKeys::MAX` to `ValidatorConfig::MAX_VALIDATORS`.
4. Rename `ProposedBlock::with_next_validator_keys` / `next_validator_keys` to `with_next_validator_config` / `next_validator_config`.
5. Rewrite `BlockHeader::new` calls: drop the leading `version` and the `tx_kernel_commitment`, and add the protocol config commitment and `next_protocol_config` after `fee_parameters`.

### Block proving: `BlockProof` is removed, and `LocalBlockProver` proves an `ExecutedBlock`

`ProvenBlock` carries an `ExecutionProof`. A block is first run through the new block kernel with `BlockExecutor`, then proved. `LocalBlockProver::new(u32)` became `LocalBlockProver::new(Prover)`, and `LocalBlockProver::prove_dummy` (feature `testing`) now takes no arguments and returns an `ExecutionProof` directly instead of a `Result<BlockProof, _>`.

```rust
// Before (0.16)
use miden_block_prover::LocalBlockProver;
use miden_protocol::block::{BlockProof, ProvenBlock};

let proof: BlockProof = LocalBlockProver::new(0).prove(tx_batches, &header, block_inputs)?;
let block = ProvenBlock::new(header, body, signatures, proof)?;
```

```rust
// After (0.17)
use miden_block_prover::{BlockExecutor, LocalBlockProver};
use miden_protocol::block::ProvenBlock;
use miden_protocol::vm::ExecutionProof;

let executed = BlockExecutor::new().execute(proposed_block)?;
let proof: ExecutionProof = LocalBlockProver::default().prove(executed)?;
let block = ProvenBlock::new(header, body, signatures, proof)?;
```

1. Replace `BlockProof` with `miden_protocol::vm::ExecutionProof` in `ProvenBlock::new`, `new_unchecked`, `proof()` and `into_parts()`.
2. Execute the `ProposedBlock` with `BlockExecutor` (optionally `with_execution_options`), then call `LocalBlockProver::prove(executed)`.
3. Construct the prover with `LocalBlockProver::default()` or `LocalBlockProver::new(Prover)`.
4. `ProvenBlock::new` and deserialization now reject a proof that contains precompiles.

### Batch proving: `LocalBatchProver::new(Prover)`, and `ProposedBatch` lost its native serialization

`LocalBatchProver::new` takes a `Prover`, `BatchExecutor` is a regular struct (build it with `new()` / `default()`), and `ProposedBatch` no longer implements `Serializable` / `Deserializable`. Transport it with the `miden-objects` Protobuf message. Plain decoding does not check proofs: converting the message back into a `ProposedBatch` with `decode_and_verify_with(proof_security_level)` (from `DecodeMessageExt`) re-verifies every transaction proof.

```rust
// Before (0.16)
use miden_tx_batch::{BatchExecutor, LocalBatchProver};

let bytes = proposed_batch.to_bytes();
let executed = BatchExecutor.execute(proposed_batch)?;
let proven = LocalBatchProver::new().prove(executed)?;
```

```rust
// After (0.17)
use miden_objects::proto;
use miden_tx_batch::{BatchExecutor, LocalBatchProver};

let message = proto::transaction::ProposedBatch::from(&proposed_batch); // Protobuf transport
let executed = BatchExecutor::new().execute(proposed_batch)?;
let proven = LocalBatchProver::default().prove(executed)?;
```

1. Replace `LocalBatchProver::new()` with `LocalBatchProver::default()` or `LocalBatchProver::new(Prover)`. `LocalBatchProver::default()` proves with Poseidon2, while 0.16's `new()` used Blake3_256; `LocalBatchProver::new(Prover::new())` keeps Blake3_256.
2. Replace the unit-struct literal `BatchExecutor` with `BatchExecutor::new()` / `BatchExecutor::default()`. `BatchExecutor::with_execution_options` is new.
3. Replace `ProposedBatch` byte serialization with the `miden-objects` `proto::transaction::ProposedBatch` message.

### Validating constructors for transaction headers, batch and block data

`TransactionHeader::new` and `BlockAccountUpdate::new` now validate and return a `Result`, and `TransactionHeader::new_unchecked` is no longer public (it became crate-private). `BatchAccountUpdate::new`, `ProvenBatch::new` and `BlockBody::new` are new validating constructors next to the unchanged `new_unchecked` ones.

```rust
// Before (0.16)
let header = TransactionHeader::new(account_id, init, fin, input_notes, output_notes);
let header = TransactionHeader::new_unchecked(id, account_id, init, fin, input_notes, output_notes);
let update = BlockAccountUpdate::new(account_id, final_commitment, details);
```

```rust
// After (0.17)
let header = TransactionHeader::new(account_id, init, fin, input_notes, output_notes)?;
// new_unchecked is no longer public; use TransactionHeader::from(&proven_tx) / from(&executed_tx)
let update = BlockAccountUpdate::new(account_id, final_commitment, details)?;
```

1. Add `?` (or handle `TransactionHeaderError` / `BlockAccountUpdateError`) at `TransactionHeader::new` and `BlockAccountUpdate::new`.
2. Replace `TransactionHeader::new_unchecked` with `TransactionHeader::new(..)?` or the `From<&ProvenTransaction>` / `From<&ExecutedTransaction>` impls.

:::note The changelog lists only the new constructors
The changelog lists validating constructors for `BatchAccountUpdate`, `ProvenBatch`, `BlockAccountUpdate` and `BlockBody`. `BlockAccountUpdate::new` is not a new constructor: the existing infallible `const fn new` became fallible. The same change made `TransactionHeader::new` fallible and made `TransactionHeader::new_unchecked` crate-private, which the changelog does not mention.
:::

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0432]: unresolved import `miden_protocol::block::ValidatorKeys` `` | Renamed | `ValidatorConfig` |
| `error[E0061]: this function takes 2 arguments but 1 argument was supplied` (`ValidatorConfig::new`) | New `quorum` | Pass the key count. |
| `quorum is {quorum} but must equal the validator count of {count}` | Quorum below or above the key count | Use the number of keys. |
| `validator set contains duplicate public keys` / `validator set must contain at least one key` | Same validation as before, new error type | Deduplicate or supply keys. |
| `block proof contains precompiles` | The block proof carries precompile work | Block kernel proofs must be precompile-free. |
| `error[E0061]: this method takes 0 arguments but 3 arguments were supplied` (`LocalBlockProver::prove_dummy`) | Takes no arguments now | Call `prove_dummy()`; it returns the `ExecutionProof` directly. |
| `` error[E0599]: no method named `to_bytes` found for struct `ProposedBatch` `` | `Serializable` removed | Use the Protobuf message. |
| `error[E0061]: this function takes 1 argument but 0 arguments were supplied` (`LocalBatchProver::new`) | Takes a `Prover` | `LocalBatchProver::default()` |
| `` error[E0624]: associated function `new_unchecked` is private `` (`TransactionHeader`) | No longer public | `new(..)?` or `From` |
| `input note with nullifier {0} appears twice in the transaction header` | Duplicate input | Fix the header data. |
| `note with id {0} is both created and consumed by the transaction header` | Overlapping notes | Fix the header data. |

---

## Other transaction changes

- **A foreign procedure must belong to the foreign account's code.** `tx::execute_foreign_procedure` now fails when the procedure root is not one the foreign account exports, for example a library procedure that reads its storage. With the standard host the error is `account procedure with procedure root <root> is not in the account procedure index map`: the procedure-index lookup rejects the root before the kernel's own assertion runs. Transaction scripts that relied on this must call a procedure the foreign account exports. See [MASM Changes](./masm-changes#kernel-entry-points-syscall-and-foreign-procedure-roots).
- **`TransactionMeasurements::note_execution` reports real note IDs.** In 0.16 the `NoteId` in each `(NoteId, usize)` pair was actually the note's details commitment. Lookups by `note.id()` now match, and workarounds keyed by the details commitment stop matching.
- **EIP-712 approvals for multisig (additive).** An ECDSA approver of the multisig components may also sign `MidenTransaction(bytes32 txSummaryHash)` under the EIP-712 domain `{ name: "Miden Transaction", version: "1" }`, with no `chainId` and no `verifyingContract` (helpers `Eip712TransactionSummary` and `Eip712Digest`). Raw signatures over the summary commitment are unchanged, but the multisig components' code commitments change.
- **`expiration_delta` now applies to consume-only and bare client requests**, so such requests can now expire. See [Client Changes](./client-changes).
- **`TransactionArgs` can carry an account code upgrade.** `TransactionArgs::default().with_tx_script(script).with_account_code_upgrade(AccountCodeUpgrade::new(new_code))` supplies the new code for a transaction that upgrades the native account's code: the executor puts it in the advice map, and the host loads it when the kernel emits the new `TransactionEventId::AccountBeforeCodeUpgrade` event. `TransactionEventId` is not `#[non_exhaustive]`, so an exhaustive `match` needs an arm for it. `TransactionArgs::from_parts`, which 0.16 did not have, takes six arguments, the last an `Option<AccountCodeUpgrade>` (release candidates before rc.8 took five). `TransactionArgs` bytes gained that field too. Code upgrades themselves are covered in [Account Changes](./account-changes).
- **A custom `DataStore` must serve the standards library.** The standard account components now link `miden-standards` dynamically (and the AggLayer components link `miden-agglayer` dynamically), so the library procedures they call are no longer inside the account's code. During execution the host looks such a procedure up in your `DataStore`, through its `MastForestStore::get`. `TransactionMastStore::new()` already holds `StandardsLib` and `agglayer_package()`, so a store that delegates `get` to one (and loads account code into it with `load_account_code`) needs no change. A store that resolves procedures some other way must also serve the procedures of `StandardsLib::default()` and, for AggLayer accounts, `miden_agglayer::agglayer_package()`. Otherwise execution fails with `procedure with root digest {root_digest} could not be found`, the same error a store built from another protocol release produces.
- **Proofs, proven transactions, block headers and transaction inputs serialized by 0.16 do not load** (`invalid value: unsupported execution proof format {format}` for proofs). See [Imports & Dependencies](./imports-dependencies).

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0599]: no method named `fee_faucet_id` found `` | The fee faucet moved to `ProtocolConfig` | `protocol_config.fee_asset_id().faucet_id()` |
| `error[E0061]: this function takes 5 arguments but 4 arguments were supplied` (`TransactionInputs::new`) | New `ProtocolConfig` parameter | Pass the config third. |
| `protocol config has commitment {actual} which does not match the block header's protocol config commitment {expected}` | Config built with another protocol release or fee asset | Match the node's protocol version and fee asset. |
| `the advice map holds no preimage for the multisig auth args` | Multisig request without `MultisigAuthArgs` | Build `MultisigAuthArgs` (Web: `feeAwareTransactionRequestBuilder`). |
| `advice stack read failed` | Two-word fee preimage on a multisig account | Use `MultisigAuthArgs`. |
| `failed to lookup value in Merkle store` | Multisig bound block not tracked by the partial blockchain | `block_numbers` / `withBlockNumbers`, or add it in your `DataStore`. |
| `block N has been pruned` | Multisig re-executed at an old anchor | Execute at the tip. |
| `the multisig approval expired at or before the transaction reference block` | Approval window passed | Collect fresh approvals. |
| `the transaction fee must be paid in the native fee asset at rate 1/1` | Non-native fee asset or rate | `FeeConversionInfo::one_to_one` with the chain's fee faucet. |
| `error[E0061]: this function takes 7 arguments but 6 arguments were supplied` | `TransactionSummary::new` gained the bound block number | Pass it. |
| Transaction dropped as expired shortly after submit | It emitted a network note or moved a policy-gated asset (20-block cap) | Submit promptly; sync and retry. |
| `expected a library package, but the provided package is an executable` | `from_package` on an executable package | Build a library package. |
| `invalid value: HASHLESS flag is set; use UntrustedMastForest for untrusted input` | 0.17 script or account code bytes read with the trusted `MastForest::read_from` or by a 0.16 build | Deserialize the 0.17 type itself, or use `UntrustedMastForest`. |
| `procedure with root digest {root_digest} could not be found` | A custom `DataStore` does not serve `StandardsLib` (or `agglayer_package()`), which the standard components now link dynamically | Delegate to `TransactionMastStore::new()` or serve those libraries. |
| `` error[E0432]: unresolved import `miden_tx::ProvingOptions` `` | Replaced by `Prover` | `Prover::new().with_hash_fn(..)` |
| `error[E0308]: mismatched types` (expected `Result<(), _>`, found `Result<VerificationOutcome, _>`) | `verify` returns an outcome | Map it; check `is_complete()`. |
