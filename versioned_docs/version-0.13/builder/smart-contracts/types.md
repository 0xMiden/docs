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

// Compile-time literal (validated at compile time)
let zero = felt!(0);
let one = felt!(1);
let answer = felt!(42);

// From u32 (always safe)
let f = Felt::from_u32(255);

// From u64 without range check (caller ensures value < p)
let f = Felt::from_u64_unchecked(1_000_000_000);

// From u64 with validation (returns Result)
let f = Felt::new(999).unwrap();
```

:::info `felt!()` range limitation
The `felt!()` macro currently only accepts values up to `u32::MAX` (4,294,967,295). For larger values, use `Felt::from_u64_unchecked()`. This limitation may be lifted in a future release.
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
For computing amounts, balances, counters, or any value where overflow/underflow behavior matters, convert to `u64` first, perform the arithmetic, then convert back with `Felt::from_u64_unchecked()`.
:::

### Comparison and conversion

```rust
let f = felt!(42);

// Convert to u64 (canonical representation)
let n: u64 = f.as_u64();

// Equality comparison
if f == felt!(42) { /* ... */ }

// For numeric comparisons, convert to u64 first
if f.as_u64() > 100 { /* ... */ }

// Check parity
if f.is_odd() { /* ... */ }
```

:::tip Integer arithmetic on Felt values
Converting `Felt` to `u64` with `.as_u64()` gives you standard Rust integer arithmetic — with overflow and underflow protection from Rust's debug-mode checks and `saturating_*` / `checked_*` methods. For business logic involving amounts, limits, or counters, prefer `u64` arithmetic:

```rust
// Convert, compute in u64, convert back
let a: u64 = felt_a.as_u64();
let b: u64 = felt_b.as_u64();
let sum = a.saturating_add(b); // safe addition
let diff = a.saturating_sub(b); // no underflow
let result = Felt::from_u64_unchecked(sum);
```
:::

### Advanced operations

```rust
let f = felt!(7);

// Multiplicative inverse: f * f.inv() == felt!(1)
let inv = f.inv();      // Panics if f == felt!(0)

// Exponentiation: base^exponent mod p
let result = f.exp(felt!(3));  // 7^3 mod p = 343

// Power of 2: computes 2^self
let power = felt!(10).pow2();  // 2^10 = 1024 (panics if self > 63)
```

## Word — Four-element tuples

A `Word` is a tuple of four `Felt` values. It's the standard unit for storage, hashing, and data passing in Miden.

```rust
#[repr(C, align(16))]
pub struct Word {
    pub inner: (Felt, Felt, Felt, Felt),
}
```

### Creating Words

```rust
use miden::{felt, Felt, Word};

// From an array of 4 Felts
let w = Word::new([felt!(1), felt!(2), felt!(3), felt!(4)]);

// Shorthand from array (via From trait)
let w = Word::from([felt!(1), felt!(2), felt!(3), felt!(4)]);

// From 4 u64 values (unchecked)
let w = Word::from_u64_unchecked(1, 2, 3, 4);

// From a single Felt (placed in position [3], positions [0]–[2] zeroed)
let w = Word::from(felt!(42));  // [felt!(0), felt!(0), felt!(0), felt!(42)]

// From a tuple
let w = Word::from((felt!(1), felt!(2), felt!(3), felt!(4)));
```

### Indexing

```rust
let w = Word::from([felt!(10), felt!(20), felt!(30), felt!(40)]);

// Read by index
let first: Felt = w[0];   // felt!(10)
let last: Felt = w[3];    // felt!(40)

// Mutable indexing
let mut w = Word::from([felt!(0), felt!(0), felt!(0), felt!(0)]);
w[0] = felt!(99);

// Convert to array
let arr: [Felt; 4] = w.into();

// Convert to tuple
let tup: (Felt, Felt, Felt, Felt) = w.into();
```

### Packing data into Words

Since each storage slot holds one `Word`, you'll often pack multiple values:

```rust
// Pack two u64 values into a Word
let config = Word::from([
    Felt::from_u64_unchecked(max_amount),    // [0]: max amount
    Felt::from_u64_unchecked(cooldown),      // [1]: cooldown blocks
    felt!(0),                                 // [2]: unused
    felt!(0),                                 // [3]: unused
]);

// Unpack
let max_amount = config[0].as_u64();
let cooldown = config[1].as_u64();
```

## Asset

`Asset` wraps a `Word` and represents either a fungible or non-fungible asset.

```rust
pub struct Asset {
    pub inner: Word,
}
```

### Encoding

**Fungible assets** (tokens):

| Index | Content |
|-------|---------|
| `inner[0]` | Amount |
| `inner[1]` | `0` |
| `inner[2]` | Faucet ID suffix |
| `inner[3]` | Faucet ID prefix |

**Non-fungible assets** (NFTs):

| Index | Content |
|-------|---------|
| `inner[0]` | Data hash element 0 |
| `inner[1]` | Data hash element 1 |
| `inner[2]` | Data hash element 2 |
| `inner[3]` | Faucet ID prefix |

### Working with assets

```rust
use miden::Asset;

// Create from a Word
let asset = Asset::new([felt!(100), felt!(0), faucet_suffix, faucet_prefix]);

// Read the amount (fungible)
let amount: u64 = asset.inner[0].as_u64();

// Build a fungible asset from faucet ID and amount
use miden::asset;
let asset = asset::build_fungible_asset(faucet_id, felt!(1000));

// Build a non-fungible asset
let nft = asset::build_non_fungible_asset(faucet_id, data_hash);
```

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
| `u64` | `Felt` | `Felt::from_u64_unchecked(n)` or `Felt::new(n)?` |
| literal | `Felt` | `felt!(n)` |
| `Felt` | `u64` | `f.as_u64()` |
| `Felt` | `Word` | `Word::from(f)` — fills position 3, rest zeroed |
| `Word` | `Felt` | `let f: Felt = w.into()` — extracts position 3 |
| `[Felt; 4]` | `Word` | `Word::from(arr)` |
| `Word` | `[Felt; 4]` | `let arr: [Felt; 4] = w.into()` |
| `(Felt, Felt, Felt, Felt)` | `Word` | `Word::from(tuple)` |
| `Word` | `Digest` | `Digest::from_word(w)` |
| `Digest` | `Word` | `let w: Word = d.into()` |

Use these types in [component definitions](./accounts/components), store and retrieve Words from [persistent storage](./accounts/storage), or define your own types for public APIs with [`#[export_type]`](./accounts/custom-types).

:::info API Reference
Full API docs on docs.rs: [`Felt`](https://docs.rs/miden/latest/miden/struct.Felt.html), [`Word`](https://docs.rs/miden/latest/miden/struct.Word.html), [`Asset`](https://docs.rs/miden/latest/miden/struct.Asset.html)
:::
