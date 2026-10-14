---
title: "Patterns"
sidebar_position: 6
description: "Common patterns and security considerations for Miden smart contracts."
---

# Patterns

Security considerations and common patterns for Miden smart contracts. For runnable examples, see the [compiler examples directory](https://github.com/0xMiden/compiler/tree/next/examples) and the [Miden Bank Tutorial](../tutorials/miden-bank/).

## Access control

:::warning[No msg.sender in account components]
Unlike Solidity, account component procedures cannot check "who is calling me." In Miden:
- **Note scripts** can check who created the note via `active_note::get_sender()`
- **Account components** rely on authentication components (Falcon512, ECDSA) which the transaction kernel invokes automatically in the epilogue
:::

For account-level access control, Miden uses **authentication components** rather than manual sender checks. The transaction kernel calls the account's `auth` procedure automatically during the transaction epilogue — if the signature is invalid, the entire transaction fails. See [Authentication](./accounts/authentication) for the full pattern.

For note-level access control, note scripts can check who created the note using `active_note::get_sender()`. The protocol-level `ownable2step` standard (`miden-standards/asm/standards/access/ownable2step.masm`) provides `get_owner`, `get_nominated_owner`, `is_sender_owner`, `assert_sender_is_owner`, `transfer_ownership`, `accept_ownership`, and `renounce_ownership` procedures.

## Rate limiting {#rate-limiting}

Use `tx::get_reference_block_number()` to enforce cooldown periods between actions. It returns a typed `BlockNumber`; convert it with `.as_u32()` before using integer arithmetic. Store the last action block number in a `Value` storage slot, then compare it with the current block number before allowing the next action.

See [Transaction Context](./transactions/transaction-context) for the available block and transaction info functions.

## Spending policy {#spending-policy}

A spending policy belongs in the account code that removes assets. This runnable
MASM example uses shipped `miden-protocol`, `miden-standards`, `miden-testing`, and
`miden-tx` **0.17.1**, with VM **0.35.0** and Rust **1.98.1**. It enforces a fixed
**lifetime allowance for one fungible asset**, measured in that asset's smallest
units. It is developer account authorization and storage behavior; consumer wallet
limits and the Partner Mainnet bridge cap are separate controls.

The component stores the configured asset ID and remaining allowance in named
`Value` slots. Its `send` procedure accepts only an amount and output-note index:
the caller cannot substitute a different asset ID. Each successful send subtracts
from the stored allowance before moving assets from the vault to the note. A
second send reads the updated storage, so splitting a spend across calls or
transactions does not evade the budget.

### Account component

Save this complete component as `masm/policy.masm` in the example package:

```masm
use miden::protocol::active_account
use miden::protocol::native_account
use miden::protocol::output_note

# CONSTANTS
# =================================================================================================

const ASSET_SLOT = word("demo::spending_policy::asset")
const REMAINING_SLOT = word("demo::spending_policy::remaining")

# ERRORS
# =================================================================================================

const ERR_AMOUNT_NOT_U32 = "spending amount must fit u32"
const ERR_AMOUNT_ZERO = "spending amount must be positive"
const ERR_ALLOWANCE_NOT_U32 = "spending allowance must fit u32"
const ERR_ALLOWANCE_EXCEEDED = "spending allowance exceeded"

# PUBLIC INTERFACE
# =================================================================================================

pub use {create_note} from miden::standards::note::note_creator
pub use {receive_asset} from miden::standards::wallets::basic

#! Moves a positive u32 amount of the configured fungible asset to an output note.
#! Debits the persistent lifetime allowance; receiving assets does not reset it.
#!
#! Inputs:  [amount, note_idx, pad(14)]
#! Outputs: [pad(16)]
#!
#! Where:
#! - amount is the quantity in the asset's smallest units.
#! - note_idx is the index of an output note already created in this transaction.
#!
#! Panics if:
#! - amount is zero, exceeds u32, or exceeds the remaining allowance.
#! - the stored allowance is not a u32.
#! - native_account::remove_asset or output_note::add_asset fails.
#!
#! Invocation: call
@account_procedure
@locals(2)
pub proc send
    loc_store.0 loc_store.1

    loc_load.0 u32assert.err=ERR_AMOUNT_NOT_U32
    dup neq.0 assert.err=ERR_AMOUNT_ZERO drop

    push.REMAINING_SLOT[0..2] exec.active_account::get_item
    movdn.4 dropw
    # => [remaining, pad(16)]

    u32assert.err=ERR_ALLOWANCE_NOT_U32
    dup loc_load.0 u32gte assert.err=ERR_ALLOWANCE_EXCEEDED
    loc_load.0 sub
    # => [new_remaining, pad(16)]

    push.0.0.0 movup.3
    push.REMAINING_SLOT[0..2] exec.native_account::set_item dropw
    # => [pad(16)]

    # construct only the configured asset; the caller supplies no asset ID
    loc_load.1
    push.0.0.0 loc_load.0
    push.ASSET_SLOT[0..2] exec.active_account::get_item
    # => [ASSET_ID, ASSET_VALUE, note_idx, pad(16)]

    dupw.1 dupw.1
    exec.native_account::remove_asset dropw
    exec.output_note::add_asset
end
```

Both operands are asserted to be `u32`, and the amount is checked against the
allowance **before** subtraction. Under those bounds, `sub` produces an ordinary
nonnegative integer result without field wraparound. The asset quantity itself is
constructed as `[amount, 0, 0, 0]`; the supported outgoing amount is deliberately
limited to `u32::MAX`, even though the protocol supports larger fungible amounts.

`create_note` and `receive_asset` are re-exported individually. Receiving funds
adds to the vault without replenishing the allowance. Do **not** compose this
account with the full `BasicWallet`: it would also export an unrestricted
`move_asset_to_note`. Likewise, another component that removes assets or writes
the policy slots could bypass the policy. Account composition is part of the
policy's security boundary.

### Construct and execute locally

The complete runnable package is `examples/patterns/spending-policy/` in the
[Miden docs repository](https://github.com/0xMiden/docs). Its `tests/policy.rs`
compiles the component with `CodeBuilder`, initializes these slots, and composes
it with Falcon singlesig authentication. This is the account-construction
excerpt executed by the tests:

```rust
    let asset = FungibleAsset::mock(balance).unwrap_fungible();
    let code = CodeBuilder::default()
        .compile_component_code("demo::spending_policy", include_str!("../masm/policy.masm"))?;
    let component = AccountComponent::new(
        code.clone(),
        vec![
            StorageSlot::with_value(
                StorageSlotName::new("demo::spending_policy::asset")?,
                asset.to_id_word(),
            ),
            StorageSlot::with_value(
                StorageSlotName::new(REMAINING_SLOT)?,
                Word::from([allowance, 0, 0, 0]),
            ),
        ],
        AccountComponentMetadata::new("SpendingPolicy"),
    )?;
    let mut builder = MockChain::builder().verification_base_fee(0);
    let account = builder.add_account_from_builder(
        Auth::basic_falcon(),
        AccountBuilder::new([42; 32])
            .account_type(AccountType::Public)
            .with_component(component)
            .with_assets([asset.into()]),
        AccountState::Exists,
    )?;
```

`build_existing` funding and `FungibleAsset::mock` are test fixtures. The sender's
`Auth::basic_falcon()` uses the shipped singlesig verification procedure; its
keys and signatures are generated locally for the tests. `Auth::IncrNonce` is used
only by the recipient fixture. No RPC connection, faucet request, or real
transaction is involved. The fixture explicitly sets and checks a zero
verification fee. On a nonzero-fee chain, the shipped singlesig component also
pays transaction fees from the vault through `fee::pay_fee`; that removal does
not debit this counter. The P2ID fixtures also avoid fee sponsorship, which
can require payment even when the verification fee is zero. This example limits
explicit `send` calls, not every possible vault outflow or fee payment.

The harness constructs a P2ID recipient and calls `create_note`, then calls
`send` with the returned note index and the requested amount. After execution it
checks the output-note asset, reduced vault balance, reduced allowance, and nonce.
`add_pending_executed_transaction` followed by `prove_next_block` commits the
result in MockChain; subsequent transactions read that committed allowance.

From the docs repository root, run:

```bash
cargo +1.98.1 test --locked --manifest-path examples/patterns/spending-policy/Cargo.toml
```

The 11 tests exercise these cases:

| Case | Expected behavior |
| --- | --- |
| Spend 1 or 40 of a 100-unit allowance | Asset moves to the output note; allowance decreases |
| Spend exactly 100 | Succeeds; allowance becomes zero |
| Spend 101 | Fails with `spending allowance exceeded` |
| Spend 60 then 41 in one transaction | Entire transaction fails |
| Commit 60, then commit 40, then try 1 | First two succeed; third fails |
| Zero amount or exhausted allowance | Fails before asset removal |
| Spend `u32::MAX`; try `u32::MAX + 1` | Boundary succeeds; larger amount fails the u32 assertion |
| Receive funds after exhausting allowance | Vault grows; allowance stays zero and sends still fail |
| Missing authenticator or wrong Falcon key | Transaction fails authentication |
| Call unrestricted BasicWallet send or remove assets from the transaction script | Procedure authorization rejects the bypass |

Rejected transactions leave the committed account unchanged. The tests match the
policy's exact error codes, the VM's u32 assertion, and Falcon's failed assertion;
they also verify that neither bypass procedure is authorized by the account.

### Scope

This example has no allowance reset, rolling window, recipient allowlist, or
administrative storage setter. Repeated receipts do not extend its lifetime
budget. The code demonstrates a supported account-component pattern and local
execution, not a production custody system. Adding resets, extra assets,
fee-paying behavior, upgrades, or additional account components requires a new
policy design and tests for every asset-removal path.

## Security

### Assertions and error handling

Use assertions for conditions that must abort contract execution:

```rust
assert!(amount > 0);
assert_eq!(a, b);
```

When an assertion fails, proof generation fails and the transaction is rejected before reaching the network.

Internal Rust functions can also return and handle `Result` for recoverable
conditions. Returning an error value does not itself abort a transaction: the
caller must handle it or explicitly fail an assertion. Exported procedures and
entry points must follow the SDK's supported signatures.

### Replay protection

Every state-changing transaction must increment the nonce. The auth component handles this automatically — see [Authentication](./accounts/authentication).

### Safe arithmetic

Use `saturating_sub` to prevent underflow. If the stored block is ahead of the
current block, it returns zero. Ordinary unsigned subtraction can wrap to a large
value in a release build:

```rust
let current_block = tx::get_reference_block_number().as_u32();

// Good — won't underflow
let elapsed = current_block.saturating_sub(last_block);

// Dangerous — could underflow
let elapsed = current_block - last_block;
```

For Felt arithmetic, values wrap modulo the prime field (no overflow panic), but the result may not be what you expect if you're treating Felts as integers. See [Types — Felt](./types#felt--field-elements) for details.

### Anti-patterns

- **Don't store secrets in contract code** — public account code is published onchain
- **Don't skip nonce management** — prevents replay attacks
- **Be careful with Felt division** — Felt division computes the multiplicative inverse, not integer division. Convert to `u64` first for integer-style operations

## `#![no_std]` environment

All Miden contracts run without the standard library:

| Not available | Alternative |
|---------------|-------------|
| `std::collections::HashMap` | Use `BTreeMap` from `alloc`, or `StorageMap` for persistent account storage |
| `std::string::String` | Use `alloc::string::String` |
| `std::vec::Vec` | Use `alloc::vec::Vec` |
| `println!()` | Use `miden::println!()` |
| `eprintln!()` | No direct equivalent — run the transaction under the Mockchain and inspect outputs, or use the external debugger |
| Error strings in `assert!()` | Use `assert!(condition)` without messages |
