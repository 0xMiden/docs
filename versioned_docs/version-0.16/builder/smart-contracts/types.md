---
title: "Types"
sidebar_position: 5.6
description: "Felt field arithmetic, Word layout, Asset encoding, and type conversions in the Miden Rust SDK."
---

# Types

Miden's type system is built around field elements rather than standard integers. All computation inside the Miden VM is modular arithmetic over the Goldilocks prime field ($p = 2^{64} - 2^{32} + 1$), so overflow and division behave differently from standard integers. `Felt` is the native numeric type, `Word` is a tuple of four Felts used for [storage](./accounts/storage) and hashing, and `Asset` encodes fungible and non-fungible assets as Words.

## Felt — Field elements

`Felt` is the fundamental numeric type in Miden. It represents an element of the **Goldilocks prime field**:

$$
p = 2^{64} - 2^{32} + 1 = 18446744069414584321
$$

:::warning This is not integer arithmetic
`Felt` uses **modular arithmetic**. Values wrap around the prime modulus, not at `u64::MAX`. Addition, subtraction, and multiplication all happen modulo $p$. Division computes the **multiplicative inverse**, not integer division.
:::

### Creating Felt values

```rust
use miden::{felt, Felt};

// Literal construction (validated when evaluated)
let zero = felt!(0);
let one = felt!(1);
let answer = felt!(42);

// From u32 (always safe)
let f = Felt::from_u32(255);

// From u64 (fallible if the value is outside the field)
let f = Felt::new(1_000_000_000).unwrap();

// Built-in zero / one constants
let z = Felt::ZERO;
let o = Felt::ONE;
```

:::info `felt!()` range limitation
The `felt!()` macro accepts integer literals representable as `u64` and
validates them through `Felt::new(...).unwrap()`. An out-of-field literal
panics when evaluated; it is not currently rejected by `cargo check`. For
runtime values, use the fallible `Felt::new(...)` and handle the error.
:::

### Arithmetic

```rust
let a = felt!(10);
let b = felt!(3);

// Standard arithmetic (modular)
let sum = a + b;        // felt!(13)
let diff = a - b;       // felt!(7)
let prod = a * b;       // felt!(30)
let neg = -a;           // p - 10

// Division computes multiplicative inverse
// a / b = a * b^(-1) mod p
let quot = a / b;       // NOT integer 3 — it's 10 * inverse(3) mod p

// In-place operators
let mut x = felt!(5);
x += felt!(1);          // x is now felt!(6)
x *= felt!(2);          // x is now felt!(12)
```

:::note For business logic, prefer u64
For computing amounts, balances, counters, or any value where overflow/underflow behavior matters, convert to `u64` first, perform the arithmetic, then convert back with `Felt::new(...).unwrap()` or explicit error handling.
:::

### Comparison and conversion

```rust
let f = felt!(42);

// Convert to u64 (canonical representation)
let n: u64 = f.as_canonical_u64();

// Equality comparison
if f == felt!(42) { /* ... */ }

// For numeric comparisons, convert to u64 first
if f.as_canonical_u64() > 100 { /* ... */ }

// Check parity
if f.is_odd() { /* ... */ }
```

:::tip Integer arithmetic on Felt values
Converting `Felt` to `u64` with `.as_canonical_u64()` gives you standard Rust integer arithmetic — with overflow and underflow protection from Rust's debug-mode checks and `saturating_*` / `checked_*` methods. For business logic involving amounts, limits, or counters, prefer `u64` arithmetic:

```rust
// Convert, compute in u64, convert back
let a: u64 = felt_a.as_canonical_u64();
let b: u64 = felt_b.as_canonical_u64();
let sum = a.saturating_add(b); // safe addition
let diff = a.saturating_sub(b); // no underflow
let result = Felt::new(sum).unwrap();
```

Saturating arithmetic prevents `u64` overflow, but the result can still be outside the field. The final `unwrap()` panics if `sum >= p`; handle that conversion explicitly when the inputs are not bounded.
:::

### Advanced operations

```rust
let f = felt!(7);

// Multiplicative inverse: f * f.inv() == felt!(1)
let inv = f.inv();      // Panics if f == felt!(0)

// Exponentiation: base^exponent mod p
let result = f.exp(felt!(3));  // 7^3 mod p = 343

// Squaring: f^2
let square = f * f;       // 7^2 mod p = 49
```

:::caution Squaring with SDK 0.14.0
With `miden` 0.14.0 and `midenc` 0.10.0, `Felt::square()` is lowered to the VM's `pow2` operation, which computes `2^f`: `felt!(7).square()` returns 128. Use `f * f` to compute the square in this version.
:::

## Word — Four field elements

A `Word` holds four `Felt` values. It's the standard unit for storage, hashing, and data passing in Miden.

```rust
#[repr(C)]
pub struct Word {
    pub a: Felt,
    pub b: Felt,
    pub c: Felt,
    pub d: Felt,
}
```

### Creating Words

```rust
use miden::{felt, Felt, Word};

// From an array of 4 Felts
let w = Word::new([felt!(1), felt!(2), felt!(3), felt!(4)]);

// Shorthand via `From<[Felt; 4]>`
let w: Word = [felt!(1), felt!(2), felt!(3), felt!(4)].into();

// Shorthand via `From<[u32; 4]>` (or [u8; 4] / [u16; 4] / [bool; 4])
let w = Word::from([1u32, 2, 3, 4]);

// All-zero word
let z = Word::empty();            // same as Word::default()
```

### Indexing

```rust
let w = Word::new([felt!(10), felt!(20), felt!(30), felt!(40)]);

// Named fields
let a: Felt = w.a;                // felt!(10)
let d: Felt = w.d;                // felt!(40)

// Convert to array
let arr: [Felt; 4] = w.into_elements();
// or via the `From<Word> for [Felt; 4]` impl
let arr2: [Felt; 4] = w.into();
```

### Packing data into Words

Since each storage slot holds one `Word`, you'll often pack multiple values:

```rust
// Pack two u64 values into a Word
let config = Word::new([
    Felt::new(max_amount).unwrap(),    // a: max amount
    Felt::new(cooldown).unwrap(),      // b: cooldown blocks
    felt!(0),                 // c: unused
    felt!(0),                 // d: unused
]);

// Unpack via named fields
let max_amount = config.a.as_canonical_u64();
let cooldown = config.b.as_canonical_u64();
```

## Asset

`Asset` represents either a fungible or non-fungible asset. In contract code it is **two words** — a `key` (the asset ID used by the vault) and a `value` (encoding the fungible amount or non-fungible data).

```rust
pub struct Asset {
    pub key: Word,
    pub value: Word,
}
```

### Encoding

**Fungible assets** (tokens):

| Word     | Field | Content |
|----------|-------|---------|
| `key`    | `a`   | `0` |
| `key`    | `b`   | `0` |
| `key`    | `c`   | Faucet ID suffix plus metadata byte |
| `key`    | `d`   | Faucet ID prefix |
| `value`  | `a`   | Amount |
| `value`  | `b`   | `0` |
| `value`  | `c`   | `0` |
| `value`  | `d`   | `0` |

**Non-fungible assets** (NFTs):

| Word     | Field | Content |
|----------|-------|---------|
| `key`    | `a`   | Data hash element 0 |
| `key`    | `b`   | Data hash element 1 |
| `key`    | `c`   | Faucet ID suffix plus metadata byte |
| `key`    | `d`   | Faucet ID prefix |
| `value`  | `a..d`| Data hash elements 0–3 |

The low metadata byte in `key.c` encodes `AssetComposition` in bits 0-1. Whether assets invoke callbacks is encoded in the faucet account ID when that account is built. Use protocol helpers instead of hand-decoding the metadata.

### Working with assets

```rust
use miden::{Asset, Word, felt};

// Build a fungible asset from key + value words.
// Fungible key = [0, 0, faucet_suffix_with_metadata, faucet_prefix],
// fungible value = [amount, 0, 0, 0].
let asset = Asset::new(
    Word::from([felt!(0), felt!(0), faucet_suffix_with_metadata, faucet_prefix]),
    Word::from([felt!(100), felt!(0), felt!(0), felt!(0)]),
);

// Read the amount (fungible): first limb of `value`.
let amount: u64 = asset.value.a.as_canonical_u64();

// Assets passed into contract procedures are already constructed by the host.
// Read the ID word when querying the active account vault.
let asset_id: Word = asset.key;
let is_present = miden::active_account::has_asset(asset_id);
```

:::note Asset on the host side
On the client / host side, `Asset` is an enum (`Asset::Fungible(_) | Asset::NonFungible(_)`) exposed from `miden-protocol`, with `id()` / `to_id_word()` / `to_value_word()` / `from_id_and_value_words()` helpers. Inside a Rust contract the SDK exposes the two-word `Asset` struct shown above.
:::

## AccountId

Identifies an account with two Felt values:

```rust
pub struct AccountId {
    pub prefix: Felt,
    pub suffix: Felt,
}
```

```rust
use miden::AccountId;

let id = AccountId::new(prefix_felt, suffix_felt);

// Use in comparisons
let current: AccountId = self.get_id();
assert_eq!(current.prefix, expected.prefix);
assert_eq!(current.suffix, expected.suffix);
```

## Other types

The SDK also provides `NoteIdx`, `Tag`, `NoteType`, `Recipient`, `Digest`, and `StorageSlotId`. See the [full API docs on docs.rs](https://docs.rs/miden/latest/miden/) for their definitions.
## Type conversion table

| From | To | Method |
|------|----|--------|
| `u32` | `Felt` | `Felt::from_u32(n)` |
| `u64` | `Felt` | `Felt::new(n).unwrap()` |
| literal | `Felt` | `felt!(n)` |
| `Felt` | `u64` | `f.as_canonical_u64()` |
| `[Felt; 4]` | `Word` | `Word::new(arr)` or `Word::from(arr)` |
| `[u32; 4]` / `[u16; 4]` / `[u8; 4]` / `[bool; 4]` | `Word` | `Word::from(arr)` |
| `Word` | `[Felt; 4]` | `w.into_elements()` or `let arr: [Felt; 4] = w.into()` |

Use these types in [component definitions](./accounts/components), store and retrieve Words from [persistent storage](./accounts/storage), or define your own types for public APIs with [`#[export_type]`](./accounts/custom-types).

:::info API Reference
Full API docs on docs.rs: [`Felt`](https://docs.rs/miden/latest/miden/struct.Felt.html), [`Word`](https://docs.rs/miden/latest/miden/struct.Word.html), [`Asset`](https://docs.rs/miden/latest/miden/struct.Asset.html)
:::
