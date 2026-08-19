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

### When to use Felt vs u64

Use `Felt` when you need field-native behavior that must match the Miden VM exactly:

- Hashing and commitment inputs
- Storage words and protocol-defined field values
- Arithmetic that is intentionally part of a field-based construction

Use `u64` when you are working with business quantities and expect integer semantics:

- Token amounts and balances
- Fee calculations and proportional splits
- Counters, limits, cooldowns, and similar control-flow values

The `as_u64()` conversion is inexpensive and gives you standard Rust integer behavior. For DeFi-style
logic, convert out of `Felt`, do the arithmetic in `u64`, and convert back with
`Felt::from_u64_unchecked()` once you know the result is in range.

### Anti-patterns

- **Don't store secrets in contract code** — contract code is visible onchain
- **Don't skip nonce management** — prevents replay attacks
- **Don't use Felt division for business logic** — convert to `u64` first when you need integer-style division or rounding

## `#![no_std]` environment

All Miden contracts run without the standard library:

| Not available | Alternative |
|---------------|-------------|
| `std::collections::HashMap` | Use `BTreeMap` from `alloc`, or `StorageMap` for persistent account storage |
| `std::string::String` | Use `alloc::string::String` |
| `std::vec::Vec` | Use `alloc::vec::Vec` |
| `println!()` / `eprintln!()` | No direct equivalent — run the transaction under the Mockchain and inspect outputs, or use the external debugger |
| Error strings in `assert!()` | Use `assert!(condition)` without messages |
