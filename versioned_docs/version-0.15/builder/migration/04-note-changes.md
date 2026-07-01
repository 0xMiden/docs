---
sidebar_position: 4
title: "Note Changes"
description: "Note identity split, multiple attachments, metadata reshape, nullifier, and capacity changes in v0.15"
---

# Note Changes

:::warning Breaking Change
Note identity is split in two: the old `NoteId` (recipient + assets) becomes `NoteDetailsCommitment`, and a brand‑new `NoteId` also commits to metadata. Notes now carry multiple attachments off the metadata (`NoteMetadata` → `PartialNoteMetadata`), and nullifiers fold in the metadata word and attachments commitment. None of these values roundtrip with 0.14 — recompute and re‑persist note ids and nullifiers.
:::

---

## `NoteId` → `NoteDetailsCommitment`; new `NoteId` commits to metadata

### Summary

The 0.14 `NoteId` (a commitment over recipient + assets only) is renamed to **`NoteDetailsCommitment`**. A brand‑new **`NoteId`** is introduced that hashes the details commitment together with the note metadata commitment, so the public note ID now changes when the note's metadata (sender, type, tag, attachments) changes.

```text
NoteDetailsCommitment = hash(NOTE_RECIPIENT_DIGEST || NOTE_ASSETS_COMMITMENT)    // == old NoteId
NoteId                = hash(NOTE_DETAILS_COMMITMENT || NOTE_METADATA_COMMITMENT) // new
```

### Affected Code

```rust
// 0.15 — new API:
use miden_protocol::note::{NoteDetailsCommitment, NoteId};
let details_commitment = NoteDetailsCommitment::new(&recipient, &assets);
let id = NoteId::new(details_commitment, &metadata);   // the real NoteId mixes in metadata
// On a built note: note.id() / note.details_commitment().
```
`NoteDetails::commitment()` now returns a `NoteDetailsCommitment` (not the public note id, which requires metadata).

### Migration Steps

1. Rename any value you treated as a "note id without metadata" to `NoteDetailsCommitment`.
2. Replace `NoteId::new(recipient, asset_commitment)` with `NoteDetailsCommitment::new(&recipient, &assets)`.
3. To obtain the public `NoteId`, call `note.id()`, or `NoteId::new(details_commitment, &metadata)`.
4. Recompute and re‑persist any stored note IDs — 0.14 ids do not roundtrip, and an id now changes if metadata changes.

---

## `NoteMetadata` → `PartialNoteMetadata`; multiple attachments per note

### Summary

The metadata types were renamed and reshuffled to support **multiple attachments per note** (up to `NoteAttachments::MAX_COUNT` = 4):

| 0.14 | 0.15 |
| --- | --- |
| `NoteMetadata` (sender/type/tag + single attachment) | `PartialNoteMetadata` (sender/type/tag only) |
| `NoteMetadataHeader` (the on‑stack metadata word) | `NoteMetadata` (metadata word + attachment headers + attachments commitment) |
| `NoteAttachment` (single, `with_attachment`) | `NoteAttachments` (collection, `with_attachments`) |

`Note::new(assets, metadata, recipient)` now takes a **`PartialNoteMetadata`**; a new `Note::with_attachments(assets, partial_metadata, recipient, attachments)` carries the attachments. The single `NoteMetadata::with_attachment` / `.attachment()` API is gone.

### Affected Code

```rust
// 0.15 — new API:
use miden_protocol::note::{Note, PartialNoteMetadata, NoteType, NoteAttachments};
let partial = PartialNoteMetadata::new(sender, NoteType::Public).with_tag(tag);
let attachments = NoteAttachments::new(vec![attachment_a, attachment_b])?;   // 0..=4
let note = Note::with_attachments(assets, partial, recipient, attachments);
// (use Note::new(assets, partial, recipient) for a note with no attachments)
let found = note.attachments().find(scheme);
```

### Migration Steps

1. Search/replace the *type* used to construct a note from `NoteMetadata` to `PartialNoteMetadata`.
2. Replace `NoteMetadataHeader` with `NoteMetadata` (the word‑shaped metadata is `NoteMetadata::to_metadata_word()`).
3. Replace `.with_attachment(a)` with a `NoteAttachments::new(vec![...])` collection and `Note::with_attachments(...)`.
4. Replace single `metadata.attachment()` reads with `note.attachments().get(i)` / `.find(scheme)` / `note.has_attachments()`.

---

## Attachment MASM: `set_*` → `add_*`; `get_metadata` drops attachments

### Summary

Because a note can now hold several attachments, the kernel/protocol attachment procedures were rewritten:

- `output_note::set_attachment` → **`add_attachment`** (and `set_word_attachment` → `add_word_attachment`, `set_array_attachment` → `add_attachment_from_memory`). They *append* instead of overwriting, and the stack signature dropped the `attachment_kind` field.
- `note::extract_attachment_info_from_metadata` → **`metadata_into_attachment_schemes`**, returning the four attachment scheme markers.
- All `get_metadata` procedures (`active_note`, `input_note`, `output_note`) **no longer return attachments** — they return just the single `METADATA` word.

### Affected Code

```masm
# 0.15 — new API:
# Operand Stack: [attachment_scheme, ATTACHMENT_COMMITMENT, note_idx]
exec.output_note::add_attachment
exec.active_note::get_metadata          # => [METADATA]
exec.note::metadata_into_attachment_schemes
# => [attachment_0_scheme, attachment_1_scheme, attachment_2_scheme, attachment_3_scheme]
```

### Migration Steps

1. Rename `set_attachment` / `set_word_attachment` / `set_array_attachment` to `add_attachment` / `add_word_attachment` / `add_attachment_from_memory`, and drop the `attachment_kind` operand.
2. Replace `extract_attachment_info_from_metadata` with `metadata_into_attachment_schemes`.
3. Audit every `get_metadata` consumer: it now leaves only `[METADATA]` — remove the extra cleanup that handled the attachment word.

---

## `NoteType` encoding 2‑bit → 1‑bit; `Private` is the default

### Summary

`NoteType` dropped from a 2‑bit encoding to 1 bit. The numeric encodings flipped and `NoteType::Private` is now the `#[default]`. Anything that serialized a note type, packed it into a tag, or relied on the old `Public = 0b01` / `Private = 0b10` values changes.

| | 0.14 | 0.15 |
| --- | --- | --- |
| `Public` | `0b01` | `1` |
| `Private` | `0b10` | `0` (default) |

### Migration Steps

1. Drop any hard‑coded `0b01` / `0b10` note‑type bit literals; use the `NoteType` variants.
2. Re‑derive note tags / metadata words that packed the old 2‑bit type (`SwapNote::build_tag`, for example, now uses the 1‑bit encoding — script‑root bits 14 → 15).
3. If you relied on a particular default, note it is now `Private`.

---

## Nullifier now includes metadata and attachments commitment

### Summary

The note nullifier hash now folds in the note's **metadata word** and **attachments commitment** in addition to the serial number, script root, storage commitment, and asset commitment. `Nullifier::new` gained two parameters and the `From<&NoteDetails>` conversion was replaced by `Nullifier::from_details_and_metadata`, because a nullifier can no longer be computed from details alone.

### Affected Code

```rust
// 0.15 — new API:
let nf = Nullifier::new(
    script_root, storage_commitment, asset_commitment, serial_num,
    metadata.to_metadata_word(),       // new
    metadata.attachments_commitment(), // new
);
let nf2 = Nullifier::from_details_and_metadata(&note_details, &metadata);
```

### Migration Steps

1. Thread the metadata word and attachments commitment into every `Nullifier::new` call.
2. Replace `Nullifier::from(&details)` / `(&details).into()` with `Nullifier::from_details_and_metadata(&details, &metadata)`.
3. Recompute and re‑persist nullifiers — 0.14 nullifiers will not match.

---

## `MAX_ASSETS_PER_NOTE` 255 → 64; `NOTE_MEM_SIZE` 3072 → 1024

### Summary

The per‑note asset cap was reduced from 255 to **64**, and the kernel note memory region (`NOTE_MEM_SIZE`) shrank from 3072 to **1024**. Notes carrying more than 64 assets now fail to build, and MASM that hard‑codes note‑memory offsets against the old 3072‑word region must be reworked.

### Migration Steps

1. Cap note asset lists at 64; split larger payloads across multiple notes.
2. Audit any MASM that indexes into the note memory region against the new `NOTE_MEM_SIZE = 1024`.

---

## `SwapNote`/`MintNote` storage trimmed; `PSWAP` added

### Summary

Unused fields were removed from standard note storage: `payback_attachment` from `SwapNoteStorage` and `attachment` from `MintNoteStorage`. A new **`PSWAP`** (partial swap) note and `PswapNote` API (with a `PswapAttachment` scheme and `payback_note` / `remainder_note` discovery helpers) supports partial‑fill asset exchange with remainder re‑creation.

### Migration Steps

1. Stop reading/writing the removed `payback_attachment` / `attachment` storage fields on swap/mint notes.
2. Use `PswapNote` for partial‑fill swaps; reconstruct private paybacks via `PswapNote::payback_note` / `remainder_note`.
