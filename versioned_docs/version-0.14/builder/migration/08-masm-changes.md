---
sidebar_position: 8
title: "MASM Changes"
description: "New MASM features and standard library additions in v0.14"
---

# MASM Changes

:::info New MASM Features
Miden v0.14 introduces assembly-time string-literal constants (`word("...")`, `event("...")`) and new standard library modules for MASM, including native 128-bit unsigned integer arithmetic.
:::

---

## String-Literal Constants: `word("...")` and `event("...")`

### Summary

Miden v0.14 adds two constant expressions that derive their values from a string literal at assembly time:

- `word("literal")` — hashes the literal with Blake3 and produces a `Word` (four field elements).
- `event("literal")` — hashes the literal with Blake3 and reduces to a single `Felt` event id (the first element of the word, reduced modulo the Goldilocks prime).

Both run at assembly time, so the hashing cost is paid by the assembler — the emitted MAST sees only the final word/felt immediate.

:::note Kernel events also renamespaced in v0.14
Event names on the kernel moved from `miden::…` to `miden::protocol::…` — see [Kernel Events Prefixed with `miden::protocol`](./transaction-changes#kernel-events-prefixed-with-midenprotocol).
:::

### `word("...")`

`word("literal")` is valid anywhere a `Word` constant expression is accepted, most commonly in a `const` declaration. The literal string is hashed with Blake3; the 32-byte digest is split into four little-endian `u64` limbs and each limb becomes a `Felt`.

**Naming a storage slot:**

```masm
use.miden::protocol::active_account
use.miden::protocol::native_account
use.miden::core::sys

const COUNTER_SLOT = word("miden::tutorials::counter")

#! Inputs:  []
#! Outputs: [count]
pub proc get_count
    push.COUNTER_SLOT[0..2] exec.active_account::get_item
    # => [count]

    exec.sys::truncate_stack
end

#! Inputs:  []
#! Outputs: []
pub proc increment_count
    push.COUNTER_SLOT[0..2] exec.active_account::get_item
    add.1
    push.COUNTER_SLOT[0..2] exec.native_account::set_item
    # => []

    exec.sys::truncate_stack
end
```

`push.COUNTER_SLOT` pushes the full four-element word; `push.COUNTER_SLOT[0..2]` pushes a slice of the word. The derived word is deterministic — the same literal always hashes to the same word — so components that agree on a string convention share the same slot without a separately distributed constant.

`word("...")` is only valid inside a `const` declaration. `push` and other instructions accept named constants but not inline `word("...")` calls, so always bind the expression to a name first.

### `event("...")`

`event("literal")` derives a `Felt` event id from the literal using the same hashing procedure as `word(...)`, then taking the first limb. This matches `EventId::from_name` in `miden-core`.

Use `event("...")` in a `const` to name an event, then `emit.NAME`:

```masm
const U64_DIV_EVENT = event("miden::core::math::u64::u64_div")

proc handler
    # ... stack shaping ...
    emit.U64_DIV_EVENT
    # ... continue ...
end
```

You can also emit a literal inline, without naming it:

```masm
begin
    emit.event("miden::test::equiv")
end
```

The assembler guarantees the three forms below produce the same MAST:

```masm
const EVT = event("miden::test::equiv")

# (1) named constant
begin
    emit.EVT
end

# (2) inline literal
begin
    emit.event("miden::test::equiv")
end

# (3) manual push + emit
begin
    push.EVT
    emit
    drop
end
```

### Where each is valid

| Context                              | `word("...")` | `event("...")` |
| ------------------------------------ | :-----------: | :------------: |
| `const NAME = ...`                   |      yes      |      yes       |
| `push.NAME` (immediate Word context) |      yes      |       —        |
| `push.NAME` (immediate Felt context) |       —       |      yes       |
| `emit.NAME`                          |       —       |      yes       |
| `emit.event("...")` inline           |       —       |      yes       |
| Inline `word("...")` in `push.`      |      no       |       —        |

`emit.CONST` is accepted when `CONST` resolves (directly or via an alias chain) to an `event("...")` hash. A constant declared with `word("...")` or a plain integer will be rejected by the assembler.

### Why prefer literal hashing?

- **Readable MASM.** `event("miden::core::math::u64::u64_div")` documents intent directly in the source; the equivalent `push.<felt>` loses all context.
- **Decoupled components.** Two MASM libraries that agree on a string name (e.g. `"miden::tutorials::counter"`) share a storage slot or event id without passing a constant between them.
- **Assembly-time cost.** The Blake3 hash is computed once by the assembler; the running VM sees a plain immediate.

### Notes and limitations

- Hashing uses **Blake3**, not the VM's native hash. The derived values are convenient identifiers, not commitments produced inside a proof.
- `word("")` and `event("")` (empty string) are valid and hash like any other input; collisions are vanishingly unlikely but not impossible.
- Event ids are `Felt`s, so they are reduced modulo the Goldilocks prime ($p = 2^{64} - 2^{32} + 1$). Two distinct Blake3 digests whose first 8 little-endian bytes coincide modulo $p$ would collide — again, vanishingly unlikely for meaningful names.
- These constants are evaluated inside the assembler (`miden-assembly` / `miden-assembly-syntax`). Code generated before v0.14 that did its own string-to-felt mapping for event ids must drop that logic — the assembler now owns it.

---

## 128-bit Integer Math: `std::math::u128`

### Summary

A new `std::math::u128` module provides full 128-bit unsigned integer arithmetic in MASM. A `u128` value is represented as four `u32` limbs in **little-endian** order `[a0, a1, a2, a3]`, where `a0` (the low limb) sits on top of the stack.

For example, the value `0x00000001_00000002_00000003_00000004` is pushed as:

```masm
# Stack (top → bottom): [0x4, 0x3, 0x2, 0x1]
#                         a0    a1    a2    a3
push.0x00000001.0x00000002.0x00000003.0x00000004
```

### Usage Examples

**Wrapping addition:**

```masm
use.std::math::u128

# Push two u128 values (low limb on top)
# a = 0x00000000_00000000_00000000_00000005
push.0.0.0.5
# b = 0x00000000_00000000_00000000_00000003
push.0.0.0.3

exec.u128::wrapping_add
# Stack: [8, 0, 0, 0] (a + b = 8)
```

**Comparison (`lt`, `gte`):**

```masm
use.std::math::u128

# a = 10
push.0.0.0.10
# b = 20
push.0.0.0.20

exec.u128::lt
# Stack: [1] (10 < 20 is true)
```

**Bitwise operations (`and`, `xor`):**

```masm
use.std::math::u128

push.0.0.0.0xFF
push.0.0.0.0x0F

exec.u128::and
# Stack: [0x0F, 0, 0, 0]
```

**Shift left:**

```masm
use.std::math::u128

push.0.0.0.1
push.4  # shift amount

exec.u128::shl
# Stack: [16, 0, 0, 0] (1 << 4 = 16)
```

**Division and divmod:**

```masm
use.std::math::u128

# a = 100
push.0.0.0.100
# b = 7
push.0.0.0.7

exec.u128::divmod
# Stack: [quotient (4 limbs), remainder (4 limbs)]
```

### Available Procedures

The full list of procedures in `std::math::u128`:

| Category | Procedures |
|----------|-----------|
| **Arithmetic** | `overflowing_add`, `widening_add`, `wrapping_add`, `overflowing_sub`, `wrapping_sub`, `overflowing_mul`, `widening_mul`, `wrapping_mul`, `div`, `mod`, `divmod` |
| **Comparison** | `eq`, `neq`, `eqz`, `lt`, `gt`, `lte`, `gte`, `min`, `max` |
| **Bitwise** | `and`, `or`, `xor`, `not` |
| **Bit counting** | `clz`, `ctz`, `clo`, `cto` |
| **Shifts / Rotates** | `shl`, `shr`, `rotl`, `rotr` |

---

## `u32overflowing_mul` → `u32widening_mul`

### Summary

Three rename pairs that better reflect that the result is *wider* than the operands (not arithmetic overflow):

```masm
# Before (0.13)
u32overflowing_mul
u32overflowing_madd
exec.::std::math::u64::overflowing_mul

# After (0.14)
u32widening_mul
u32widening_madd
exec.::std::math::u64::widening_mul
```

`u32overflowing_add` is unchanged (the rename only applies to multiplication and madd). v0.14 also adds matching `u32widening_add` and `std::math::u64::widening_add` helpers.

---

## `breakpoint` Instruction Removed

The `breakpoint` MASM instruction was a no-op used with the old `miden debug` REPL. Both the REPL and the instruction are gone — any `.masm` source containing `breakpoint` will now fail to assemble. Delete those lines.

```masm
# Before (0.13)
breakpoint  # used for debugging

# After (0.14)
# Just remove the line — breakpoint no longer exists
```

---

## Migration Steps

1. Replace any hand-rolled string-to-felt mapping for event ids with `event("...")` — the assembler now owns this derivation.
2. Where a storage-slot name or event id is shared across components, prefer `word("...")` / `event("...")` over distributing a pre-computed `Word` / `Felt` constant.
3. If you have custom 128-bit arithmetic helpers in MASM, consider replacing them with the new `std::math::u128` module.
4. Remember that `u128` values follow the same little-endian convention as the rest of v0.14 — the low limb (`a0`) is on top of the stack.
5. Rename `u32overflowing_mul` → `u32widening_mul` and `u32overflowing_madd` → `u32widening_madd`.
6. Rename `std::math::u64::overflowing_mul` → `std::math::u64::widening_mul`.
7. Remove any `breakpoint` instructions from your MASM source.

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `unknown module std::math::u128` | Using an older assembler version | Update to `miden-assembly` 0.22. |
| Incorrect `u128` results | Limbs pushed in big-endian order | Push low limb last so it lands on top: `push.a3.a2.a1.a0`. |
| `unknown instruction u32overflowing_mul` | Instruction renamed | Use `u32widening_mul`. |
| `unknown instruction breakpoint` | Instruction removed | Delete the line. |
