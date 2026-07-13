---
sidebar_position: 4
title: "Note Changes"
description: "Note API renames, script format, asset building, type simplification, and constructor changes in v0.14"
---

# Note Changes

:::warning Breaking Change
`NoteInputs` has been renamed to `NoteStorage` across the entire API (Rust and MASM), and note scripts are now MASM libraries annotated with `@note_script` instead of programs with `begin` blocks. These two changes affect virtually every note-related code path.
:::

---

## NoteInputs → NoteStorage

### Summary

The `NoteInputs` type has been renamed end-to-end to `NoteStorage`. This affects the Rust struct name, its methods, associated constants, `NoteRecipient` construction, the MASM procedure path, and the relevant error variant.

### Affected Code

**Rust:**
```rust
// Before (0.13)
use miden_protocol::note::NoteInputs;

let inputs = NoteInputs::new(values)?;
let v = inputs.values();
let n = inputs.num_values();
assert!(n <= NoteInputs::MAX_INPUTS_PER_NOTE);

let recipient = NoteRecipient::new(serial_num, script, inputs);

// After (0.14)
use miden_protocol::note::NoteStorage;

let storage = NoteStorage::new(values)?;
let v = storage.storage();
let n = storage.num_items();
assert!(n <= NoteStorage::MAX_NOTE_STORAGE_ITEMS);

let recipient = NoteRecipient::new(serial_num, script, storage);
```

**MASM:**
```masm
# Before (0.13)
exec.active_note::get_inputs

# After (0.14)
exec.active_note::get_storage
```

**Error variants:**
```rust
// Before (0.13)
NoteError::TooManyInputs

// After (0.14)
NoteError::TooManyStorageItems
```

### Migration Steps

1. Find-and-replace `NoteInputs` with `NoteStorage` across all Rust files.
2. Rename method calls: `values()` → `storage()`, `num_values()` → `num_items()`.
3. Replace `MAX_INPUTS_PER_NOTE` with `MAX_NOTE_STORAGE_ITEMS`.
4. Update the third argument of `NoteRecipient::new(...)` from inputs to storage.
5. In MASM, replace `active_note::get_inputs` with `active_note::get_storage`.
6. Update any error matching on `NoteError::TooManyInputs` to `NoteError::TooManyStorageItems`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `cannot find type NoteInputs in module note` | Type renamed | Use `NoteStorage`. |
| `no method named values found for NoteStorage` | Method renamed | Use `.storage()`. |
| `unknown procedure active_note::get_inputs` | MASM procedure renamed | Use `active_note::get_storage`. |

---

## NoteMetadata::new No Longer Takes a Tag

### Summary

`NoteMetadata::new` previously accepted three arguments including the tag. It now takes only `sender` and `type`. The tag is set separately via the builder method `.with_tag(tag)`.

### Affected Code

```rust
// Before (0.13)
let metadata = NoteMetadata::new(sender, note_type, tag);

// After (0.14)
let metadata = NoteMetadata::new(sender, note_type).with_tag(tag);
```

### Migration Steps

1. Find every call to `NoteMetadata::new(sender, type, tag)`.
2. Remove the third argument and chain `.with_tag(tag)` on the result.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `this function takes 2 arguments but 3 arguments were supplied` | Signature changed | Remove the tag argument and use `.with_tag(tag)`. |

---

## Note Scripts Are MASM Libraries with @note_script

### Summary

Note scripts are no longer standalone programs with a `begin ... end` block. They are now MASM libraries that use the `@note_script` attribute on a `pub proc`. In Rust, you construct a `NoteScript` from a compiled `Library` instead of a `Program`.

### Affected Code

**MASM:**
```masm
# Before (0.13)
use.miden::contracts::wallets::basic->wallet

begin
    exec.wallet::receive_asset
end

# After (0.14)
use.miden::contracts::wallets::basic->wallet

@note_script
pub proc main
    exec.wallet::receive_asset
end
```

**Rust:**
```rust
// Before (0.13)
let program = assembler.assemble_program(source)?;
let script = NoteScript::new(program);

// After (0.14)
let library = assembler.assemble_library(source)?;
let script = NoteScript::from_library(&library)?;
```

### Migration Steps

1. In every `.masm` note script, replace the `begin ... end` block with `@note_script pub proc main ... end`.
2. In Rust, switch from `assemble_program` to `assemble_library` and use `NoteScript::from_library(&library)?`.
3. Ensure the procedure is marked `pub` — non-public procedures cannot be note entry points.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `no note_script attribute found in library` | Missing `@note_script` annotation | Add `@note_script` above the entry `pub proc`. |
| `no method named new found for NoteScript` | Constructor changed | Use `NoteScript::from_library(&library)?`. |

---

## NoteAssets::add_asset Removed; OutputNoteBuilder Accumulates

### Summary

The `NoteAssets::add_asset` method has been removed. You now construct `NoteAssets` in one shot with the full list of assets. The `OutputNoteBuilder` stores a `Vec<Asset>` internally and computes the commitment when `.build()` is called.

### Affected Code

```rust
// Before (0.13)
let mut assets = NoteAssets::default();
assets.add_asset(asset_a)?;
assets.add_asset(asset_b)?;

// After (0.14)
let assets = NoteAssets::new(vec![asset_a, asset_b])?;
```

### Migration Steps

1. Collect all assets into a `Vec<Asset>` before constructing `NoteAssets`.
2. Replace incremental `add_asset` calls with a single `NoteAssets::new(vec![...])`.
3. If using `OutputNoteBuilder`, pass assets to the builder — it accumulates them internally and computes the commitment on `.build()`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `no method named add_asset found for NoteAssets` | Method removed | Use `NoteAssets::new(vec![...])`. |

---

## NoteType::Encrypted Removed

### Summary

The `NoteType` enum has been simplified to two variants: `Private` and `Public`. The former `Encrypted` variant has been removed.

### Affected Code

```rust
// Before (0.13)
let note_type = NoteType::Encrypted;

// After (0.14)
// Use NoteType::Private or NoteType::Public
let note_type = NoteType::Private;
```

### Migration Steps

1. Replace all uses of `NoteType::Encrypted` with `NoteType::Private` (or `NoteType::Public` depending on your intent).
2. Update any match arms that handle `Encrypted` separately.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `no variant named Encrypted found for enum NoteType` | Variant removed | Use `NoteType::Private` or `NoteType::Public`. |

---

## NoteHeader::commitment → to_commitment; NoteLocation Field Rename

### Summary

The method `NoteHeader::commitment` has been renamed to `NoteHeader::to_commitment`. Additionally, the `NoteLocation` field `node_index_in_block` has been renamed to `block_note_tree_index`.

### Affected Code

```rust
// Before (0.13)
let commitment = header.commitment();
let index = location.node_index_in_block;

// After (0.14)
let commitment = header.to_commitment();
let index = location.block_note_tree_index;
```

### Migration Steps

1. Replace `.commitment()` with `.to_commitment()` on `NoteHeader`.
2. Replace `node_index_in_block` with `block_note_tree_index` on `NoteLocation`.

---

## OutputNote::Header Removed; PrivateNoteHeader Introduced

### Summary

The `OutputNote` enum has been restructured. The old `OutputNote::Full` and `OutputNote::Header` variants are gone. There are now two enums:

- **`RawOutputNote`** with variants `Full` and `Partial`.
- **`OutputNote`** with variants `Public(PublicOutputNote)` and `Private(PrivateNoteHeader)`.

### Affected Code

```rust
// Before (0.13)
match output_note {
    OutputNote::Full(note) => { /* ... */ }
    OutputNote::Header(header) => { /* ... */ }
}

// After (0.14)
match output_note {
    OutputNote::Public(public_note) => { /* ... */ }
    OutputNote::Private(private_header) => { /* ... */ }
}
```

### Migration Steps

1. Replace `OutputNote::Full(note)` matches with `OutputNote::Public(public_note)`.
2. Replace `OutputNote::Header(header)` matches with `OutputNote::Private(private_header)`.
3. If you need raw full/partial note data, use `RawOutputNote::Full` or `RawOutputNote::Partial`.
4. Update any type annotations referencing the old variants.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `no variant named Full found for enum OutputNote` | Enum restructured | Use `OutputNote::Public(PublicOutputNote)`. |
| `no variant named Header found for enum OutputNote` | Variant removed | Use `OutputNote::Private(PrivateNoteHeader)`. |

---

## WellKnownNote / WellKnownComponent → Standard...

### Summary

All `WellKnown*` types have been renamed to `Standard*`:

| Before (0.13) | After (0.14) |
| --- | --- |
| `WellKnownComponent` | `StandardAccountComponent` |
| `WellKnownNote` | `StandardNote` |
| `WellKnownNoteAttachment` | `StandardNoteAttachment` |

The module path is now `miden_standards::note::StandardNote`.

### Affected Code

```rust
// Before (0.13)
use miden_standards::note::WellKnownNote;
use miden_standards::component::WellKnownComponent;
use miden_standards::note::WellKnownNoteAttachment;

// After (0.14)
use miden_standards::note::StandardNote;
use miden_standards::component::StandardAccountComponent;
use miden_standards::note::StandardNoteAttachment;
```

### Migration Steps

1. Find-and-replace `WellKnownComponent` → `StandardAccountComponent`.
2. Find-and-replace `WellKnownNote` → `StandardNote`.
3. Find-and-replace `WellKnownNoteAttachment` → `StandardNoteAttachment`.
4. Update import paths accordingly.

---

## Standard Component Name Prefix

### Summary

The `NAME` constants on standard account components have moved under the `miden::standards::components::*` namespace.

### Affected Code

```rust
// Before (0.13)
AuthSingleSig::NAME   // "miden::auth::single_sig"
BasicWallet::NAME      // "miden::wallets::basic"
BasicFungibleFaucet::NAME // "miden::faucets::basic_fungible"

// After (0.14)
AuthSingleSig::NAME   // "miden::standards::components::auth_single_sig"
BasicWallet::NAME      // "miden::standards::components::basic_wallet"
BasicFungibleFaucet::NAME // "miden::standards::components::basic_fungible_faucet"
```

### Migration Steps

1. If you match on or compare against `NAME` constants, update the expected string values.
2. Search your codebase for any hard-coded component name strings and update them to the `miden::standards::components::*` namespace.

---

## NoteExecutionHint Moved to miden-standards

### Summary

`NoteExecutionHint` has been relocated from `miden-protocol` to `miden-standards`.

### Affected Code

```rust
// Before (0.13)
use miden_protocol::note::NoteExecutionHint;

// After (0.14)
use miden_standards::note::NoteExecutionHint;
```

### Migration Steps

1. Update all imports of `NoteExecutionHint` to use `miden_standards::note::NoteExecutionHint`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `unresolved import miden_protocol::note::NoteExecutionHint` | Type moved to `miden-standards` | Import from `miden_standards::note::NoteExecutionHint`. |

---

## 256 KiB Note Size Limit

### Summary

Public output notes are now subject to a maximum size of 256 KiB (`NOTE_MAX_SIZE = 2^18` bytes). Notes exceeding this limit will be rejected.

### Migration Steps

1. Audit any note construction that could produce large public notes (e.g., notes with many assets or large storage payloads).
2. If your notes approach the 256 KiB limit, consider splitting them or reducing their payload.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `note size exceeds maximum allowed` | Public note exceeds 2^18 bytes | Reduce note payload or split into multiple notes. |

---

## Note Constructors Moved to Associated Methods

### Summary

Free-standing note constructor functions have been replaced by associated methods on their respective types.

### Affected Code

```rust
// Before (0.13)
let note = create_p2id_note(sender, target, assets, recall_height)?;
let note = create_swap_note(sender, offered, requested)?;
let note = create_mint_note(faucet_id, amount, target)?;
let note = create_burn_note(faucet_id, amount)?;
let note = create_p2ide_note(sender, target, assets, recall_height)?;

// After (0.14)
let note = P2idNote::create(sender, target, assets, recall_height)?;
let note = SwapNote::create(sender, offered, requested)?;
let note = MintNote::create(faucet_id, amount, target)?;
let note = BurnNote::create(faucet_id, amount)?;
let note = P2ideNote::create(sender, target, assets, recall_height)?;
```

### Migration Steps

1. Replace `create_p2id_note(...)` with `P2idNote::create(...)`.
2. Replace `create_swap_note(...)` with `SwapNote::create(...)`.
3. Replace `create_mint_note(...)` with `MintNote::create(...)`.
4. Replace `create_burn_note(...)` with `BurnNote::create(...)`.
5. Replace `create_p2ide_note(...)` with `P2ideNote::create(...)`.
6. Add the appropriate `use` imports for the new types (e.g., `use miden_standards::note::P2idNote`).

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `cannot find function create_p2id_note` | Function moved to associated method | Use `P2idNote::create(...)`. |
| `cannot find function create_swap_note` | Function moved to associated method | Use `SwapNote::create(...)`. |
