---
sidebar_position: 10
title: "Rust Contract SDK & Compiler"
description: "Changes to the miden crate and midenc for developers writing smart contracts in Rust"
---

# Rust Contract SDK & Compiler

:::info Which "Rust SDK"?
Two different things get called the Rust SDK. This page is about the **`miden` crate and `midenc`**, used to write account components, notes, and transaction scripts *in Rust* and compile them to MASM. The `miden-client` library — used to build applications that talk to a Miden node — is covered in [Client Changes](./client-changes).
:::

:::warning Breaking Change
Component trait methods must now be marked `#[account_procedure]` to be part of the account interface, and `#[account(..)]` generates one trait per interface instead of inherent methods. Note also that the contract toolchain **lags the rest of the 0.16 line**: it builds against protocol `0.16.0-alpha.4` and VM `0.25`, not the protocol `0.16.0-rc` and VM `0.29.1` that the client and node use.
:::

## Quick Fix

```rust
// Before
#[component]
trait BasicWallet {
    fn receive_asset(&mut self, asset: Asset);
}

// After
#[component]
trait BasicWallet {
    #[account_procedure]
    fn receive_asset(&mut self, asset: Asset);
}
```

If you encounter errors, continue reading for detailed migration steps.

---

## Versions

The contract toolchain versions independently of the rest of the stack, and in this release it is genuinely behind.

| Component | Version |
| --- | --- |
| `midenc` / compiler workspace | 0.10.0 |
| `miden` contract SDK crate (and `miden-base-sys`, `miden-stdlib-sys`, `miden-sdk-alloc`) | 0.14.0 |
| Protocol it builds against | `0.16.0-alpha.4` |
| VM crates it builds against | 0.25 |
| MSRV | 1.97 (plus a nightly toolchain) |

Two consequences worth planning around:

- The MSRV is **1.97**, higher than the 1.96 the rest of the stack requires. Your toolchain must satisfy the highest of the two.
- Because the toolchain pins protocol `0.16.0-alpha.4` and VM `0.25`, contract code compiled with it sees an earlier snapshot of the 0.16 protocol surface than your client does. The MAST and package wire formats are compatible across VM 0.25 and 0.29.1, so artifacts still load; the skew is in the protocol API surface, not serialization.

---

## Component methods must be marked `#[account_procedure]`

### Summary

A `#[component]` trait's methods are no longer implicitly part of the account interface. Every method that must be callable from a note script, a transaction script, a foreign procedure invocation, or a sibling component now needs `#[account_procedure]` **on the trait declaration**, not on the `impl`.

`#[auth_script]` and `#[account_procedure]` cannot be combined in one component. An authentication component keeps using `#[auth_script]` alone; mixing them is a compile error. Like `#[auth_script]`, `#[account_procedure]` is recognised by the enclosing `#[component]` macro and needs no import.

### Affected Code

```rust
// Before
use miden::{Asset, NoteIdx, component, component_storage, output_note};

#[component]
trait BasicWallet {
    fn receive_asset(&mut self, asset: Asset);
    fn move_asset_to_note(&mut self, asset: Asset, note_idx: NoteIdx);
}
```

```rust
// After
use miden::{Asset, NoteIdx, NoteType, Recipient, Tag, component, component_storage, output_note};

#[component]
trait BasicWallet {
    #[account_procedure]
    fn receive_asset(&mut self, asset: Asset);

    #[account_procedure]
    fn move_asset_to_note(&mut self, asset: Asset, note_idx: NoteIdx);

    #[account_procedure]
    fn create_note(&mut self, tag: Tag, note_type: NoteType, recipient: Recipient) -> NoteIdx;
}
```

The `impl` block is unchanged — the attribute is not repeated there.

### Migration Steps

1. For each `#[component] trait`, add `#[account_procedure]` above every method called from a note, a transaction script, FPI, or a sibling component.
2. Leave authentication components alone. They keep `#[auth_script]` and must not gain `#[account_procedure]`.
3. Purely internal helper methods can stay unmarked.

:::caution The shipped templates disagree with this rule
The `cargo miden new` account template declares its method without `#[account_procedure]` while the sibling note and tx-script templates call it, and the full-project scaffold has the same gap. The repository's own `examples/counter-contract` does mark them. The template tests only build, never execute, so the gap is not caught by CI. If you scaffold a new project, add the attribute yourself rather than trusting the generated code.
:::

---

## `#[account(..)]` generates one trait per interface

### Summary

`#[account(..)]` used to generate the referenced component's methods as **inherent** methods on the wrapper struct. It now generates **one trait per referenced interface**, named after the interface, and implements it for the wrapper. This lets two components exporting the same method name coexist on one account.

Most single-component call sites are unchanged, but two situations break.

### Affected Code

The wrapper struct may no longer share its name with a generated trait:

```rust
// Before — compiled
#[account(counter_contract::CounterContract)]
struct CounterContract;

// After — rename the wrapper
#[account(counter_contract::CounterContract)]
struct Counter;

let counter = Counter::new(counter_account_id);
let count = counter.get_count();
```

Cross-module call sites need the generated trait in scope. A `#[note]` or `#[tx_script]` entrypoint in the same module sees it automatically; a call site in a different module needs to import the trait, which is named after the interface:

```rust
use crate::BasicWallet;   // the generated trait, not the wrapper struct
```

### Migration Steps

1. Rename any wrapper struct that collides with its interface name.
2. Import the generated trait at cross-module call sites.

---

## Other changes

- **Transaction-kernel bindings were renamed and moved** to track the protocol 0.16 surface, and several were removed.
- **Kernel scalars are typed** rather than raw `Felt`, so values that used to be interchangeable now need explicit conversion.
- **`AssetAmount`** is a validated fungible-amount type, matching the protocol and client surfaces.
- **`miden-project.toml` requires an explicit `path`** on `[lib]` and every `[[bin]]`. See [VM & Assembler Changes](./vm-assembler#miden-projecttoml-path-is-mandatory-on-every-target).
- **`#[note]` reserves `get_entrypoint_root`**, so a note struct cannot define a method with that name, and note structs now implement `ToFeltRepr`.
- **`cargo miden new` fetches templates from a release bundle** rather than embedding them.

Additive in this line: typed transaction-script arguments, note constructors, and `println!`-style formatting.

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| A component method is not callable from a note or script | Missing `#[account_procedure]` | Add it to the trait method declaration. |
| Compile error combining auth and account attributes | They are mutually exclusive | Auth components keep `#[auth_script]` only. |
| Name collision between a wrapper struct and a trait | `#[account(..)]` now generates traits | Rename the wrapper. |
| `no method named ..` at a cross-module call site | The generated trait is not in scope | Import the trait named after the interface. |
| `missing field path` in `miden-project.toml` | Now mandatory | Add `path` to every target. |
| Toolchain version error | MSRV is 1.97 here | Use the higher of the stack's requirements. |
