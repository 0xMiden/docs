---
sidebar_position: 4
title: "Note Changes"
description: "Standard notes gain typed builders, the per-note asset limit drops from 64 to 16, and mint/burn scripts are unified"
---

# Note Changes

:::warning Breaking Change
Every standard note changed shape. `P2idNote`, `P2ideNote`, `SwapNote`, `MintNote`, and `BurnNote` were marker types with a `create(..)` associated function returning a `Note`; they are now real structs built with a typed builder and converted with `.into()`. Separately, **`MAX_ASSETS_PER_NOTE` dropped from 64 to 16**, so any note packing more than 16 assets now fails to build.
:::

## Quick Fix

```rust
// Before (0.15)
let note = P2idNote::create(
    sender, target, vec![asset], NoteType::Public, attachments, &mut rng,
)?;

// After (0.16)
use miden_standards::note::P2idNote;

let note: Note = P2idNote::builder()
    .sender(sender)
    .target(target)
    .assets(vec![asset])
    .note_type(NoteType::Public)
    .generate_serial_number(&mut rng)
    .build()?
    .into();
```

If you encounter errors, continue reading for detailed migration steps.

---

## Summary

In 0.15 each standard note was a unit struct — `pub struct P2idNote;` — with a `create` associated function that took every parameter positionally and returned a finished `Note`. In 0.16 each is a real struct holding its fields, built through a `bon` builder and converted to a `Note` with `Into`.

The cost is that every call site changes. The benefit is worth more than a mechanical rewrite, so it is worth pausing on before you reach for search-and-replace: each standard note is now a distinct type, which means your own functions can take a `P2idNote` or a `SwapNote` instead of a bare `Note`. What used to be a runtime check — is this really a P2ID note? — becomes a signature the compiler enforces, and the conversion to `Note` happens once, at the boundary where you actually need one. Optional parameters also stop being positional, and the typed value is inspectable before you convert it.

Watch the asset limit separately. Nothing about it is visible at compile time, so your build stays green and only notes carrying more than 16 assets fail, at the point they are built.

---

## Standard notes are built with typed builders

### Summary

Each standard note struct now exposes `builder()` and converts into `Note` via `From` / `Into`.

### Affected Code

```rust
// Before (0.15)
pub fn create<R: FeltRng>(
    sender: AccountId,
    target: AccountId,
    assets: Vec<Asset>,
    note_type: NoteType,
    attachments: NoteAttachments,
    rng: &mut R,
) -> Result<Note, NoteError>
```

```rust
// After (0.16)
let p2id = P2idNote::builder()
    .sender(sender)
    .target(target)
    .assets(vec![asset])          // or .asset(x), repeatable
    .note_type(NoteType::Public)
    .generate_serial_number(&mut rng)   // or .serial_number(word)
    .build()?;
let note: Note = p2id.into();
```

Note two naming details that are easy to get wrong: the setter is `serial_number`, not `serial_num`, and `generate_serial_number(&mut rng)` is the direct replacement for the old `rng` parameter.

`P2ideNote` takes its optional parameters as optional setters rather than positionally:

```rust
let p2ide = P2ideNote::builder()
    .sender(sender)
    .target(target)
    .assets(vec![asset])
    .note_type(NoteType::Private)
    .serial_number(serial_number)
    .reclaimer(reclaimer_account_id)        // optional; defaults to the sender
    .reclaim_height(BlockNumber::from(n))   // optional
    .timelock_height(BlockNumber::from(m))  // optional
    .build()?;
```

`SwapNote` follows the same pattern. In 0.15 `SwapNote::create` returned a `(Note, NoteDetails)` tuple carrying the payback details; in 0.16 you build the `SwapNote` and read its parts from the typed value.

The same builder treatment applies to `MintNote`, `BurnNote`, `PswapNote`, and `TxFeeNote`, along with the configuration notes (`AllowlistConfigNote`, `OwnerConfigNote`, `FaucetMetadataConfigNote`, `NetworkAccountConfigNote`, `FaucetPolicyConfigNote`, `MinBurnAmountConfigNote`).

### Migration Steps

1. Replace every `XNote::create(..)` call with the corresponding `XNote::builder()` chain ending in `.build()?`, then `.into()` wherever a `Note` is required.
2. Replace the trailing `rng` argument with `.generate_serial_number(&mut rng)`.
3. Use `.assets(..)` for a collection or `.asset(..)` repeatedly for individual assets.
4. For `P2ideNote`, set only the optional parameters you actually need. `reclaimer` still defaults to the sender, so existing "sender can reclaim" behaviour is preserved without changes.
5. Push the `.into()` outward while you are here. Any function of yours that only ever handles one kind of note can take the typed note instead of a `Note`, which turns a runtime check into a compile-time guarantee; convert once, where a `Note` is genuinely needed.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `no function or associated item named create` | Replaced by the builder | Use `XNote::builder()`. |
| `no method named serial_num` | Setter renamed | Use `serial_number` or `generate_serial_number`. |
| `expected Note, found P2idNote` | The builder yields the typed note | Add `.into()`. |
| `a P2ID note must contain at least one asset` | Built with no assets | Add at least one asset. |

---

## `MAX_ASSETS_PER_NOTE` dropped from 64 to 16

### Summary

The protocol limit on assets carried by a single note fell from 64 to 16.

### Affected Code

```diff
- pub const MAX_ASSETS_PER_NOTE: usize = 64;
+ pub const MAX_ASSETS_PER_NOTE: usize = 16;
```

This is enforced by `NoteAssets::new`, so it surfaces as a `NoteError` at build time rather than a compile error.

### Migration Steps

1. Audit any code path that batches assets into a single note and cap it at 16.
2. If you previously relied on packing up to 64 assets, split the payload across multiple notes.
3. If you compute a batch size from the constant rather than hard-coding it, no change is needed beyond a rebuild.

---

## `MINT` and `BURN` are unified across faucet kinds

### Summary

One `mint.masm` and one `burn.masm` script now serve both fungible and non-fungible faucets, with the variant carried in the note storage. **The script roots changed**, so any hard-coded or cached root is now wrong.

### Migration Steps

1. Recompute and re-store any cached standard note script roots.
2. Remove per-faucet-kind branching that selected between separate mint or burn scripts.

---

## Other note changes

- **`PswapNote` (partial swap)** gained a minimum-fill parameter, and its fields were renamed.
- **`NoteFile` was reworked and moved to `miden-standards`**, with variants keyed on `NoteId`, `ExpectedNote`, and `Committed`. This mostly affects client code — see [Client Changes](./client-changes).
- **`NoteTag`** moved under `miden::standards::note::note_tag` in MASM. In the released `0.16.0-rc` line it is still reachable at `miden::standards::note_tag`.

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `no function or associated item named create` | Notes use builders now | Rewrite with `XNote::builder()`. |
| `NoteError` about exceeding asset limits | Limit is now 16 | Split across multiple notes. |
| Note script root mismatch for mint or burn | Scripts were unified | Recompute the roots. |
| `expected Note, found MintNote` | Builder returns the typed note | Add `.into()`. |
