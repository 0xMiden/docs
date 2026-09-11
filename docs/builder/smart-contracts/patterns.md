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

Use `tx::get_block_number()` to enforce cooldown periods between actions. It returns a typed `BlockNumber`; convert it with `.as_u32()` before using integer arithmetic. Store the last action block number in a `Value` storage slot, then compare it with the current block number before allowing the next action.

See [Transaction Context](./transactions/transaction-context) for the available block and transaction info functions.

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
let current_block = tx::get_block_number().as_u32();

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
