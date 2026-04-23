---
title: "Patterns"
sidebar_position: 6
description: "Common patterns and security considerations for Miden smart contracts."
---

# Patterns

Security considerations and common patterns for Miden smart contracts. For runnable examples, see the [compiler examples directory](https://github.com/0xMiden/compiler/tree/next/examples) and the [Miden Bank Tutorial](../tutorials/rust-compiler/miden-bank/).

## Access control

:::warning[No msg.sender in account components]
Unlike Solidity, account component procedures cannot check "who is calling me." In Miden:
- **Note scripts** can check who created the note via `active_note::get_sender()`
- **Account components** rely on authentication components (Falcon512, ECDSA) which the transaction kernel invokes automatically in the epilogue
:::

For account-level access control, Miden uses **authentication components** rather than manual sender checks. The transaction kernel calls the account's `auth` procedure automatically during the transaction epilogue — if the signature is invalid, the entire transaction fails. See [Authentication](./accounts/authentication) for the full pattern.

For note-level access control, note scripts can check who created the note using `active_note::get_sender()`. The protocol-level `ownable` standard (`miden-standards/asm/standards/access/ownable.masm`) provides `verify_owner`, `get_owner`, `transfer_ownership`, and `renounce_ownership` procedures.

## Rate limiting {#rate-limiting}

Use `tx::get_block_number()` to enforce cooldown periods between actions. Store the last action block number in a `Value` storage slot, then compare against the current block number before allowing the next action.

See [Transaction Context](./transactions/transaction-context) for the available block and transaction info functions.

## Security

### Assertions and error handling

Miden doesn't support error strings or `Result` types in contract execution. Use assertions:

```rust
assert!(amount > 0);
assert_eq!(a, b);
```

When an assertion fails, proof generation fails and the transaction is rejected before reaching the network.

### Replay protection

Every state-changing transaction must increment the nonce. The auth component handles this automatically — see [Authentication](./accounts/authentication).

### Safe arithmetic

Use `saturating_sub` to prevent underflow:

```rust
// Good — won't underflow
let elapsed = current_block.saturating_sub(last_block);

// Dangerous — could underflow
let elapsed = current_block - last_block;
```

For Felt arithmetic, values wrap modulo the prime field (no overflow panic), but the result may not be what you expect if you're treating Felts as integers. See [Types — Felt](./types#felt--field-elements) for details.

### Anti-patterns

- **Don't store secrets in contract code** — contract code is visible on-chain
- **Don't skip nonce management** — prevents replay attacks
- **Be careful with Felt division** — Felt division computes the multiplicative inverse, not integer division. Convert to `u64` first for integer-style operations

## `#![no_std]` environment

All Miden contracts run without the standard library:

| Not available | Alternative |
|---------------|-------------|
| `std::collections::HashMap` | Use `BTreeMap` from `alloc`, or `StorageMap` for persistent account storage |
| `std::string::String` | Use `alloc::string::String` |
| `std::vec::Vec` | Use `alloc::vec::Vec` |
| `println!()` / `eprintln!()` | No direct equivalent — run the transaction under the Mockchain and inspect outputs, or use the external debugger |
| Error strings in `assert!()` | Use `assert!(condition)` without messages |
