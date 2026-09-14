---
sidebar_position: 8
title: "MASM Changes"
description: "The new mod declarations, rewritten import syntax, removal of the debug decorators, and the reorganised protocol procedure surface"
---

# MASM Changes

:::warning Breaking Change
Miden Assembly gained an explicit module tree. A `.masm` file is no longer picked up because it sits in the right directory — its parent must declare it with `mod` or `pub mod`, and **an undeclared file is silently dropped from the artifact** rather than silently included. The `use` form was split into module imports and braced item imports, alias syntax changed from `->` to `as`, and the `debug.*` and `trace` decorators were removed. On the protocol side, asset helpers, note creation, and several account procedures moved to new paths.
:::

## Quick Fix

```masm
# Before (0.15)
use miden::standards::wallets::basic->basic_wallet
pub use miden::core::stark::verifier

# After (0.16)
use miden::standards::wallets::basic as basic_wallet
pub mod verifier
pub use {verify} from self::verifier
```

```masm
# Every directory of .masm files now needs a mod.masm declaring its children
pub mod account
pub mod asset
mod callbacks     # private to the parent
```

If you encounter errors, continue reading for detailed migration steps.

---

## Summary

The largest change is structural rather than syntactic. In 0.15 the assembler discovered modules by walking directories; in 0.16 it follows an explicit tree of `mod` declarations rooted at your project's root module. This is why the assembler's directory-based entry points disappeared (see [VM & Assembler Changes](./vm-assembler)) and why `miden-project.toml` now requires an explicit `path` to that root.

The failure mode is worth internalising: forgetting a `mod` declaration is **not** an error at the declaration site. The module simply is not part of the artifact, and you discover it later as an undefined-symbol error at the call site — or, worse, not at all if nothing calls it.

Everything else on this page is mechanical: import rewrites, decorator replacements, and renamed protocol procedures.

---

## Every module must be declared with `mod` / `pub mod`

### Summary

A submodule's source is resolved as either `<dir>/<name>.masm` or `<dir>/<name>/mod.masm`, relative to the declaring module's directory. The assembler includes only modules reachable through these declarations ([#3220](https://github.com/0xMiden/miden-vm/pull/3220)).

### Affected Code

In 0.15 the protocol's kernel root module was a comment; the directory tree was walked implicitly. In 0.16 it enumerates its children, and every intermediate directory gained its own `mod.masm` — the protocol repo went from 9 `mod.masm` files to 35:

```masm
# After (0.16) — kernels/transaction-core/src/mod.masm
pub mod account
pub mod account_update
pub mod asset
pub mod asset_vault
mod callbacks           # private: not reachable from outside this module
pub mod constants
pub mod epilogue
# … one line per child module
```

Declarations may be interleaved with `use` statements and appear anywhere among the top-level forms. Two other top-level forms landed alongside `mod`: an optional `namespace <path>` declaration that names the module explicitly, and `extern package "<name>@<version>"`.

```masm
# After (0.16) — the full top-level form vocabulary
namespace app::accounts
extern package "miden/base@0.1.0"
mod internal
pub mod api
```

### Migration Steps

1. For every directory of `.masm` files, add a `mod.masm` (or a sibling `<dir>.masm`) that declares each child with `pub mod <name>`. Use plain `mod <name>` for modules that should not be reachable from outside the parent.
2. Walk your project root downward and confirm every `.masm` file is reachable from the root through a chain of declarations.
3. Do not declare a submodule with the same name as its parent, and do not declare the same source file from two different parents — both are hard errors.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `invalid submodule declaration '<name>': could not find module sources at '<dir>/<name>.masm' or '<dir>/<name>/mod.masm'` | `mod <name>` with no matching file | Create the file or remove the declaration. |
| `invalid submodule declaration '<name>': submodules must not have the same name as their parent` | e.g. `mod foo` inside `foo/mod.masm` | Rename the child. |
| `conflicting submodule paths detected: '<name>' can be parsed from either '<a>' and '<b>', but not both` | Both `<name>.masm` and `<name>/mod.masm` exist | Delete one. |
| `invalid submodule declaration '<name>': module source '<uri>' is already reachable through another submodule declaration` | Two parents declare the same file | Declare it once. |
| `undefined item '<path>'` on a call that used to work | The callee's module is not declared | Add the missing `mod` declaration. |

---

## Import syntax: item imports, `as` aliases, and global resolution

### Summary

The `use` form was split into two explicitly distinguished shapes, and import resolution became strictly global ([#3220](https://github.com/0xMiden/miden-vm/pull/3220)):

- **Module import** — `use some::module` or `use some::module as alias`. Brings a module into scope under a local name. **May not be `pub`.**
- **Item import** — `use {item} from some::module` or `use {a, b as c} from some::module`. Brings individual procedures, constants, or types into scope. **May be `pub`**, which is how you re-export.

Four consequences follow:

1. `pub use <path>` for re-exporting a *module* is gone. `pub use` is valid only in the braced item form, so **you can no longer re-export a module**, only named items.
2. The alias separator changed from `->` to `as`.
3. An import path may no longer begin with another import's alias — imports resolve in the global namespace, as if every path were absolute.
4. Submodule-relative imports need an explicit `self::` prefix.

Source-level digest imports (`use 0x<digest>->name`) were removed. Direct digest *invocation* targets (`exec.0x…`) still work.

### Affected Code

The alias change, from the protocol's own P2IDE note script:

```diff
- use miden::standards::wallets::basic->basic_wallet
+ use miden::standards::wallets::basic as basic_wallet
```

Re-exporting a procedure from another package:

```diff
- pub use ::miden::utils::panic
+ pub use {panic} from ::miden::utils
```

Re-exporting from your own submodule, from the core library's `stark/mod.masm`:

```masm
# Before (0.15)
use miden::core::stark::verifier
pub use verifier::verify
```

```masm
# After (0.16)
pub mod verifier
pub use {verify} from self::verifier
```

Note both halves of that change: `verifier` is now a declared submodule, and the re-export path is `self::verifier` rather than the bare alias. In 0.15 the second `use` resolved `verifier` through the first — that chaining is exactly what was removed.

Plain module imports are unchanged and remain the common case:

```masm
# Identical in 0.15 and 0.16
use miden::core::crypto::hashes::poseidon2
use miden::protocol::active_note
```

### Migration Steps

1. Rewrite every `pub use a::b::c` re-export as `pub use {c} from a::b`.
2. Replace every `use path->alias` with `use path as alias`.
3. Rewrite any `use` whose path begins with an alias introduced by an earlier `use` in the same file to use the full global path.
4. To import from a submodule of the current module, prefix with `self::`. You cannot `use` a submodule you declared yourself — it is already in scope via `mod`, so reference it by name.
5. Delete any `use 0x<digest>->name` source-level digest imports.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| ``` `pub use` is only supported for braced item imports ``` | `pub use some::module` | Use `pub use {item} from some::module`. |
| ``import aliases use `as`; `->` is no longer supported`` | `use foo->bar` | `use foo as bar`. |
| `import target '<path>' cannot be resolved through import '<alias>'` | Path starts with another import's alias | Use the full global path. |
| `cannot import submodule '<path>' declared in the same module` | `use` of your own `mod`-declared child | Drop the `use`. |
| `item import target '<path>' resolved to a module` | `use {x} from …` where `x` is a module | Use the module-import form. |
| `digest imports are not supported` | `use 0x1234->entry` | Remove it; use `exec.0x…` directly. |

---

## `debug.*` and `trace` decorators removed

### Summary

The `debug.*` decorator family and the `trace` decorator were removed from the language, along with the CLI `--trace` flag and the decorator wire slots in the MAST format. Print-style debugging now goes through the new `miden::core::debug` module, whose procedures are ordinary `emit` events handled host-side ([#3169](https://github.com/0xMiden/miden-vm/issues/3169), [#3201](https://github.com/0xMiden/miden-vm/pull/3201), [#3208](https://github.com/0xMiden/miden-vm/pull/3208)).

:::danger These print in production
Because they are events rather than decorators, they carry no MAST cost — but unlike `debug.*`, which only fired when the VM ran in debug mode, **they print whenever invoked**. Leaving one in production code will print, and will disclose private values if your program has moved witness data onto the stack or into memory.
:::

### Affected Code

| v0.15 decorator | v0.16 replacement |
| --- | --- |
| `debug.stack` | `exec.debug::print_stack` |
| `debug.stack.<n>` | `exec.debug::print_stack` (prints the whole stack; there is no top-`n` form) |
| `debug.mem` | `exec.debug::print_mem_all` |
| `debug.mem.<n>` | `push.<n> exec.debug::print_mem_addr` |
| `debug.mem.<n>.<m>` | `push.<m> push.<n> exec.debug::print_mem` — takes `[start, end]`, end-exclusive |
| `debug.local`, `debug.local.<n>`, `debug.local.<n>.<m>` | `locaddr.<n> exec.debug::print_mem_addr` |
| `debug.adv_stack.<n>` | `push.<n> push.0 exec.debug::print_adv_stack`, or `exec.debug::print_adv_stack_all` |
| `trace.<n>` | Removed with no replacement. |

```masm
# After (0.16)
use miden::core::debug

begin
    exec.debug::print_stack                 # []                -> []
    exec.debug::print_mem_all               # []                -> []
    push.16 push.0 exec.debug::print_mem    # [start=0, end=16] -> []
    locaddr.0 exec.debug::print_mem_addr    # [addr]            -> []
    exec.debug::print_adv_stack_all         # []                -> []
    exec.debug::print_adv_map_all           # []                -> []
    exec.debug::print_adv_map_item          # [KEY]             -> []   (consumes the key)
end
```

The full export list of `miden::core::debug` is `print_stack`, `print_mem`, `print_mem_addr`, `print_mem_all`, `print_adv_stack`, `print_adv_stack_all`, `print_adv_map_all`, and `print_adv_map_item`.

On the Rust side, `DebugOptions`, `Instruction::Debug(..)`, and `Instruction::Trace(..)` no longer exist.

### Migration Steps

1. Search your MASM for `debug.` and `trace.` and replace per the table. Remember `print_mem` takes `[start, end]` with `end` exclusive, and both operands are consumed.
2. Add `use miden::core::debug` to any module that now calls these.
3. Remove `--trace` from any `miden-vm` invocation.
4. Register the handlers. `CoreLibrary::handlers()` includes the stack and memory debug handlers by default; the **advice** handlers are opt-in, so extend the handler set with `miden_core_lib::handlers::debug::advice_debug_handlers` to enable `print_adv_stack*` and `print_adv_map*`.
5. Strip these calls from production code.

---

## Core library: the `miden::precompiles` namespace, and removals

### Summary

The core MASM package was split into `miden::core` and a new `miden::precompiles` namespace ([#3459](https://github.com/0xMiden/miden-vm/pull/3459), [#3222](https://github.com/0xMiden/miden-vm/pull/3222)). Some procedures that used to live under `miden::core::crypto` are now internal precompile support under `miden::precompiles`.

`miden::core::crypto::hashes::keccak256` still exists and still exports `hash_bytes`, `hash`, and `merge` — it now delegates to `miden::precompiles::hashes::keccak256`. **Application code should keep calling the `miden::core::…` facade**; reach for `miden::precompiles::*` only if you are writing your own precompile wrapper.

Several modules and procedures were removed outright. EdDSA and SHA-512 are documented as *temporarily* removed pending precompiles-prover support.

| Removed in v0.16 | Replacement |
| --- | --- |
| `miden::core::crypto::dsa::eddsa_ed25519` (whole module) | None in this line. |
| `miden::core::crypto::hashes::sha512` (whole module) | None in this line. |
| `miden::core::crypto::dsa::ecdsa_k256_keccak::verify_prehash` | `verify`, or the new `verify_bytes`. |
| `miden::core::sys::log_precompile_request` | `miden::core::sys::build_proof_request_key` — a *different* operation, not a rename. |
| `miden::core::pcs::fri::frie2f4::preprocess` | Test-only helper; no replacement. |

Additions in the same area: `ecdsa_k256_keccak::verify_bytes`, for verifying a signature over a variable-length Keccak256 message held in VM memory ([#3563](https://github.com/0xMiden/miden-vm/pull/3563)), and `miden::core::math::u256` reaching parity with the `u64` and `u128` modules ([#3167](https://github.com/0xMiden/miden-vm/pull/3167)).

### Migration Steps

1. If you verify Ed25519 signatures or hash with SHA-512 in MASM, there is no in-VM path in 0.16. Move that work off-chain or defer the upgrade.
2. Replace `ecdsa_k256_keccak::verify_prehash` with `verify` (word-sized message) or `verify_bytes` (variable-length message in memory) — and see the ABI change below, which you need either way.
3. If you wrote a custom precompile wrapper against `sys::log_precompile_request`, rewrite it against the deferred-DAG helpers in `miden::precompiles`.

---

## ECDSA advice and signature ABI changed

### Summary

The advice-stack layout consumed by `miden::core::crypto::dsa::ecdsa_k256_keccak::verify` changed from `PK[9] | SIG[17]` — a 33-byte compressed public key and a 65-byte recoverable signature, byte-packed — to `QX[8] | QY[8] | SIG_R[8] | SIG_S[8]`, native little-endian `u32` limbs with **no recovery byte** ([#3222](https://github.com/0xMiden/miden-vm/pull/3222)). The public-key *commitment* preimage changed too; see [Hashing & Crypto Changes](./hashing-crypto).

### Affected Code

```masm
# Before (0.15)
#!   Operand stack: [PK_COMM, MSG, ...]
#!   Advice stack:  [PK[9] | SIG[17] | ...]
exec.ecdsa_k256_keccak::verify
```

```masm
# After (0.16)
#!   Operand stack: [PK_COMM, MSG_WORD, ...]
#!   Advice stack:  [QX[8] | QY[8] | SIG_R[8] | SIG_S[8] | ...]
exec.ecdsa_k256_keccak::verify

# New: variable-length message held in memory
#!   Operand stack: [PK_COMM, MSG_PTR, MSG_LEN_BYTES, ...]
exec.ecdsa_k256_keccak::verify_bytes
```

Two behavioural notes carried in the 0.16 source docs: `verify` **accepts high-`s` signatures**, because it proves that some witness satisfies the ECDSA equation and `(r, s)` and `(r, n-s)` are equivalent witnesses; and it pushes **no result word** — it traps on failure.

### Migration Steps

1. Rewrite the host code that populates the advice stack to emit `QX[8]`, `QY[8]`, `SIG_R[8]`, `SIG_S[8]` as little-endian `u32` limbs.
2. Drop the recovery byte — it is not part of the new ABI.
3. If you rely on canonical Ethereum-style signatures, add your own low-`s` check; `verify` will not reject high-`s`.
4. For messages longer than one word, switch from manual chunking to `verify_bytes`.

---

## `do .. while .. end` loops added

A tail-controlled loop form was added ([#3232](https://github.com/0xMiden/miden-vm/pull/3232)). This is additive — `while.true` is unchanged and still performs an entry check.

```masm
# New in 0.16
do
    <body>          # always runs at least once
while
    <condition>     # must leave one boolean on top of the stack
end
```

Use it wherever you previously wrote `push.1 while.true … end` to force a first iteration.

---

## Protocol procedure moves and renames

### Summary

The protocol MASM surface was reorganised: asset helpers moved from the protocol library into `miden::standards::assets`, note creation moved behind `miden::standards::note::note_creator`, and several `active_account` procedures moved to `native_account`.

### Affected Code

| v0.15 | v0.16 |
| --- | --- |
| `miden::protocol::asset::*` (build/validate helpers) | `miden::standards::assets::*` |
| `miden::protocol::faucet::create_fungible_asset` / `create_non_fungible_asset` | Removed — use the `miden::standards::assets` builders |
| `miden::protocol::output_note::create` (callable from note scripts) | Account context only; note scripts must call `miden::standards::note::note_creator::create_note` |
| `miden::protocol::active_account::get_initial_*` | `miden::protocol::native_account::get_initial_*` |
| `miden::protocol::active_account::has_non_fungible_asset` | `has_asset` |
| `miden::protocol::active_note::get_assets` | `get_initial_assets`, plus explicit removal procedures |
| `basic_wallet::add_assets_to_account` | `basic_wallet::move_note_assets_to_account` |
| `miden::standards::account::metadata` | `miden::standards::account::inspection` |

```masm
# Before (0.15) — note script moving assets into the account
use miden::standards::wallets::basic->basic_wallet

@note_script
pub proc main
    call.basic_wallet::add_assets_to_account
end
```

```masm
# After (0.16)
use miden::standards::wallets::basic as basic_wallet

@note_script
pub proc main
    call.basic_wallet::move_note_assets_to_account
end
```

### Migration Steps

1. Update every `use` path in your MASM per the table above.
2. Replace `output_note::create` in note scripts with `note_creator::create_note`.
3. Rename `add_assets_to_account` to `move_note_assets_to_account`.

---

## Input-note assets are now stateful

### Summary

In 0.15 a note script read the note's asset list and the kernel reconciled it at the end of execution. In 0.16 the note's *initial* assets are read with `active_note::get_initial_assets`, and assets must be **explicitly removed** as they are consumed. Partially-consumed notes are representable, so the kernel no longer drains the note for you.

### Affected Code

The `active_note` asset surface in 0.16, verified from `asm/protocol/src/active_note.masm`:

```masm
pub proc get_initial_assets       # [dest_ptr] -> [num_assets]
pub proc get_initial_assets_info
pub proc get_initial_num_assets
pub proc get_asset
pub proc remove_asset
pub proc remove_all_assets
```

`active_note::get_storage` and the new `active_note::write_storage_to_memory` are the storage-side counterparts.

### Migration Steps

1. Replace `active_note::get_assets` with `active_note::get_initial_assets`.
2. Add an explicit removal call for each asset you move out of the note — `remove_asset` for individual assets, or `remove_all_assets` if you consume the note fully.
3. Do not assume the kernel drains the note. If you leave assets in place, the note is treated as partially consumed.

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `undefined item '<path>'` for a procedure that exists on disk | Its module is not declared with `mod` | Add the declaration to the parent module. |
| ``import aliases use `as`; `->` is no longer supported`` | Old alias syntax | Rewrite with `as`. |
| ``` `pub use` is only supported for braced item imports ``` | Re-exporting a module | Re-export named items instead. |
| `undefined instruction debug.stack` | Decorator removed | Use `exec.debug::print_stack`. |
| `undefined item 'add_assets_to_account'` | Procedure renamed | Use `move_note_assets_to_account`. |
| Note consumption fails with assets remaining | Assets are no longer drained implicitly | Call `remove_asset` / `remove_all_assets`. |
