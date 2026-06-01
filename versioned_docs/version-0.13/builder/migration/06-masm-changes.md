---
sidebar_position: 6
title: "MASM Changes"
description: "Syntax modernization and cryptography updates"
---

# MASM Changes

:::warning Breaking Change
MASM syntax has been modernized. Replace dotted keywords (`const.`, `export.`, `use.`) with spaced forms.
:::

## Quick Fix

```masm title="src/contract.masm"
# Before
const.MY_CONSTANT=42
use.miden::account
export.my_procedure

# After
const MY_CONSTANT=42
use miden::account
export my_procedure
```

---

## Syntax Modernization

Replace dotted keywords with spaced forms:

### Constants

```diff title="src/contract.masm"
- const.MY_CONSTANT=42
+ const MY_CONSTANT=42
```

### Exports

```diff title="src/contract.masm"
- export.my_procedure
+ export my_procedure
    # procedure body
- end
+ end
```

### Imports

```diff title="src/contract.masm"
- use.miden::account
- use.miden::note

+ use miden::account
+ use miden::note
```

### Re-exports

```diff title="src/contract.masm"
- export.miden::account::get_id
+ pub use miden::account::get_id
```

:::tip Helper Script
Use sed to batch-update MASM files:
```bash
# Update constants
sed -i 's/const\./const /g' *.masm

# Update exports
sed -i 's/export\./export /g' *.masm

# Update imports
sed -i 's/use\./use /g' *.masm
```
:::

---

## Named Storage Slots

:::warning Breaking Change
Storage access is now name-based, not index-based. Use `word("...")` to derive slot IDs from names.
:::

In v0.13, account storage slots are identified by name rather than numeric index. In MASM, the `word("...")` syntax computes a deterministic slot ID from a slot name string:

```diff title="src/contract.masm"
- # Before (v0.12): index-based storage access
- const.BALANCE_SLOT=0
- push.BALANCE_SLOT
- exec.account::get_item

+ # After (v0.13): name-based storage access
+ use miden::protocol::active_account
+ const BALANCE_SLOT = word("my_project::my_component::balance")
+ push.BALANCE_SLOT[0..2]
+ exec.active_account::get_item
```

Key changes:
- Define slot constants using `word("slot_name")` instead of integer indices
- The `word()` function hashes the name string to produce a `Word` (4 field elements)
- Use `[0..2]` slice notation to extract the slot ID (first 2 elements) for kernel procedures like `get_item` and `set_item`
- Slot names should follow the `project::component::slot` naming convention to avoid collisions

For more details on storage slot naming conventions, see [Account Storage](../../reference/miden-base/account/storage.md). For the full list of storage procedures, see the [Protocol Library Reference](../../reference/miden-base/protocol_library.md).

---

## Cryptography Updates

### Falcon Signature Rename

Rename `RpoFalcon512` to `Falcon512Rpo` throughout codebase:

```diff title="src/auth.masm"
- use.miden::contracts::auth::basic::auth_tx_rpo_falcon512
+ use miden::contracts::auth::basic::auth_tx_falcon512_rpo
```

### ECDSA Procedures

ECDSA procedures moved to new namespace:

```diff title="src/crypto.masm"
- use.miden::crypto::dsa::ecdsa
- exec.ecdsa::verify_k256

+ use miden::core::crypto::dsa::ecdsa_k256_keccak
+ exec.ecdsa_k256_keccak::verify
```

### RPO Hash Renames

The RPO module was renamed from `rpo` to `rpo256`, and several procedures were renamed to standardize naming across all hash modules:

```diff title="src/hash.masm"
- use.std::crypto::hashes::rpo
+ use miden::core::crypto::hashes::rpo256

- exec.rpo::hash_memory
+ exec.rpo256::hash_elements

- exec.rpo::hash_memory_words
+ exec.rpo256::hash_words

- exec.rpo::hash_memory_double_words
+ exec.rpo256::hash_double_words

- exec.rpo::hash_memory_with_state
+ exec.rpo256::hash_elements_with_state

- exec.rpo::hash_1to1
+ exec.rpo256::hash

- exec.rpo::hash_2to1
+ exec.rpo256::merge
```

---

## Complete MASM Migration Example

Before:
```masm title="src/contract.masm (before)"
use.miden::account
use.std::crypto::hashes::rpo

const.BALANCE_SLOT=0

export.get_balance
    push.BALANCE_SLOT
    exec.account::get_item
end

export.transfer
    exec.rpo::hash_memory_words
    # ... rest of procedure
end
```

After:
```masm title="src/contract.masm (after)"
use miden::protocol::active_account
use miden::core::crypto::hashes::rpo256

const BALANCE_SLOT = word("my_project::my_component::balance")

export get_balance
    push.BALANCE_SLOT[0..2]
    exec.active_account::get_item
end

export transfer
    exec.rpo256::hash_words
    # ... rest of procedure
end
```

---

## Migration Steps

1. Find all `.masm` files in your project
2. Replace `const.` with `const ` (space instead of dot)
3. Replace `export.` with `export ` (space instead of dot)
4. Replace `use.` with `use ` (space instead of dot)
5. Replace `export.<path>` re-exports with `pub use <path>`
6. Update `std::` namespace to `miden::core::`
7. Replace numeric storage slot constants with `word("...")` named slots
8. Update `get_item`/`set_item` calls to use `[0..2]` slice for slot IDs
9. Rename `RpoFalcon512` to `Falcon512Rpo`
10. Update ECDSA procedure paths
11. Rename RPO module `rpo` to `rpo256`
12. Rename `hash_memory` to `hash_elements`, `hash_memory_words` to `hash_words`, `hash_memory_double_words` to `hash_double_words`, `hash_memory_with_state` to `hash_elements_with_state`
13. Rename `hash_1to1` to `hash`, `hash_2to1` to `merge`

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `unexpected token '.'` | Old syntax | Use space: `const X` not `const.X` |
| `module 'std' not found` | Namespace changed | Use `miden::core::` |
| `procedure 'auth_tx_rpo_falcon512' not found` | Renamed | Use `auth_tx_falcon512_rpo` |
| `procedure 'hash_memory' not found` | Renamed | Use `hash_elements` (module `rpo256`) |
| `procedure 'hash_memory_words' not found` | Renamed | Use `hash_words` (module `rpo256`) |
| `procedure 'hash_1to1' not found` | Renamed | Use `hash` (module `rpo256`) |
| `procedure 'hash_2to1' not found` | Renamed | Use `merge` (module `rpo256`) |
| `module 'rpo' not found` | Renamed | Use `rpo256` |
| `get_item` returns unexpected values | Using integer index instead of slot ID | Use `word("...")` and `[0..2]` slice |
