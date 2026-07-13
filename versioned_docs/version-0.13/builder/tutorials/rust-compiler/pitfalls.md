---
sidebar_position: 3
title: "Common Pitfalls"
description: "Reference guide for known issues, limitations, and workarounds when developing with the Miden Rust compiler."
---

# Common Pitfalls

This reference documents known issues and limitations when developing with the Miden Rust compiler, along with recommended workarounds.

## Felt Comparison Operators

### Problem

Direct comparison operators (`<`, `>`, `<=`, `>=`) on `Felt` values produce incorrect results.

```rust
// WRONG: This does NOT work correctly
let a = Felt::new(100);
let b = Felt::new(200);
if a < b {  // May produce unexpected results!
    // ...
}
```

### Solution

Always convert Felt values to `u64` before comparing:

```rust
// CORRECT: Convert to u64 first
let a = Felt::new(100);
let b = Felt::new(200);
if a.as_u64() < b.as_u64() {
    // Works correctly
}
```

### Example from Bank Contract

```rust title="contracts/bank-account/src/lib.rs"
// Validating deposit amount
let amount = asset.unwrap_fungible().amount().as_u64();

// Use u64 comparison
assert!(
    amount <= MAX_DEPOSIT_AMOUNT,  // MAX_DEPOSIT_AMOUNT is u64
    "Deposit exceeds maximum"
);
```

:::warning Always Use .as_u64()
Any time you compare Felt values, convert them first. This applies to:
- Amount comparisons
- Balance checks
- Index comparisons
- Any numeric ordering
:::

---

## Stack Limit (16 Elements)

### Problem

The Miden VM stack only allows direct access to the first 16 elements. Complex functions with many local variables trigger this error:

```
invalid stack index: only the first 16 elements on the stack are directly accessible
```

This may also appear as:
```
values not found in advice provider
```

### Solution

**1. Reduce local variables:**

```rust
// WRONG: Too many local variables
fn complex_operation(&mut self) {
    let a = self.get_a();
    let b = self.get_b();
    let c = self.get_c();
    let d = self.get_d();
    let e = self.get_e();
    let f = self.get_f();
    // ... more variables cause stack overflow
}

// CORRECT: Use values directly or minimize locals
fn complex_operation(&mut self) {
    // Process in smaller batches
    let result_ab = self.process(self.get_a(), self.get_b());
    let result_cd = self.process(self.get_c(), self.get_d());
    self.finalize(result_ab, result_cd);
}
```

**2. Break into smaller functions:**

```rust
// WRONG: One large function
fn do_everything(&mut self, a: Word, b: Word, c: Word) {
    // Many operations touching all parameters...
}

// CORRECT: Split into stages
fn stage_one(&mut self, a: Word) -> Felt {
    // Process a
}

fn stage_two(&mut self, b: Word, result: Felt) -> Felt {
    // Process b with result from stage one
}

fn stage_three(&mut self, c: Word, result: Felt) {
    // Final processing
}
```

**3. Process iteratively:**

```rust
// CORRECT: Process one at a time
for asset in assets {
    self.process_single_asset(asset);
}
```

---

## Function Argument Limit (4 Words)

### Problem

Miden functions can receive at most 4 Words (16 Felts) as arguments:

```
error: expected at most 4 words of arguments
```

```rust
// WRONG: Too many arguments
fn process(
    &mut self,
    depositor: AccountId,    // ~1 Word
    asset: Asset,            // 1 Word
    serial_num: Word,        // 1 Word
    tag: Felt,               // 1 Felt
    note_type: Felt,         // 1 Felt
    extra_data: Word,        // 1 Word - EXCEEDS LIMIT!
) {
    // ...
}
```

### Solution

**1. Make sure to only pass 4 Words to functions:**

```rust
// CORRECT: Only pass 4 Words
fn process(
    &mut self,
    depositor: AccountId,    // ~1 Word
    asset: Asset,            // 1 Word
    serial_num: Word,        // 1 Word
    params: Word,            // [tag, note_type, 0, 0] - 1 Word
) {
    let tag = params[0];
    let note_type = params[1];
    // ...
}
```

**2. Use note inputs for passing data:**

For note scripts, pass complex data via `active_note::get_inputs()`:

```rust
#[note]
struct MyNote;

#[note]
impl MyNote {
    #[note_script]
    fn run(self, _arg: Word) {
        let inputs = active_note::get_inputs();
        // Inputs can hold many Felts without function argument limits
        let param1 = inputs[0];
        let param2 = inputs[1];
        // ... access up to the full input capacity
    }
}
```

**3. Store data first, reference by key:**

```rust
// Store complex data in storage
fn store_config(&mut self, key: Word, config_data: Word) {
    self.configs.set(key, config_data);
}

// Reference by key in other operations
fn process_with_config(&mut self, key: Word) {
    let config = self.configs.get(&key);
    // Use config...
}
```

---

## Array Ordering (Rust/MASM Reversal)

### Problem

Arrays passed from Rust to the Miden VM are received in **reversed order**.

```rust
// In Rust, you define:
let word = Word::from([a, b, c, d]);

// In MASM, this becomes: [d, c, b, a]
```

### Solution

Be aware of this when:
- Constructing storage keys
- Parsing note inputs
- Working with asset data

**Example: Storage Key Construction**

```rust
// Balance key format in Rust
let key = Word::from([
    depositor.prefix().as_felt(),  // Position 0 in Rust
    depositor.suffix(),             // Position 1
    faucet.prefix().as_felt(),      // Position 2
    faucet.suffix(),                // Position 3
]);

// When the VM processes this, it sees:
// [faucet.suffix, faucet.prefix, depositor.suffix, depositor.prefix]
```

**Example: Asset Structure**

```rust
// Asset Word layout (Rust perspective)
// [amount, 0, faucet_suffix, faucet_prefix]

let asset_word = Word::from([
    Felt::new(amount),           // [0] amount
    Felt::new(0),                // [1] padding
    faucet.id().suffix(),        // [2] faucet suffix
    faucet.id().prefix().as_felt(), // [3] faucet prefix
]);
```

:::tip Consistency is Key
The reversal doesn't matter as long as you're **consistent**. Always construct and parse arrays the same way throughout your codebase.
:::

---

## Felt Arithmetic Underflow/Overflow

### Problem

Miden uses field element (Felt) arithmetic, which operates in a prime field with modulus `p = 2^64 - 2^32 + 1`. This means arithmetic is **modular** and will silently wrap around instead of causing an error.

```rust
// DANGEROUS: This does NOT error on underflow!
let balance = Felt::new(100);
let withdrawal = Felt::new(500);
let new_balance = balance - withdrawal;  // Silently wraps to a huge positive number!
```

When you subtract a larger value from a smaller one, the result wraps around to a large positive number (approximately `2^64`). This is NOT an error in the Miden VM - the transaction will succeed with an incorrect balance.

### Why This Happens

The Miden VM performs all Felt arithmetic as modular operations within the prime field. There is no automatic overflow or underflow detection at the VM level. The Rust compiler's default overflow mode is `Unchecked`, meaning it compiles directly to raw VM arithmetic operations.

### Solution

**Always validate before subtraction:**

```rust
// CORRECT: Check balance before subtracting
let current_balance: Felt = self.balances.get(&key);
let withdraw_amount = withdraw_asset.inner[0];

// Validate that balance is sufficient
assert!(
    current_balance.as_u64() >= withdraw_amount.as_u64(),
    "Withdrawal amount exceeds available balance"
);

// Only subtract after validation
let new_balance = current_balance - withdraw_amount;
```

### Example from Bank Contract

```rust title="contracts/bank-account/src/lib.rs"
pub fn withdraw(&mut self, depositor: AccountId, withdraw_asset: Asset, /* ... */) {
    let withdraw_amount = withdraw_asset.inner[0];

    // Get current balance and validate sufficient funds exist.
    // This check is critical: Felt arithmetic is modular, so subtracting
    // more than the balance would silently wrap to a large positive number.
    let current_balance: Felt = self.balances.get(&key);
    assert!(
        current_balance.as_u64() >= withdraw_amount.as_u64(),
        "Withdrawal amount exceeds available balance"
    );

    let new_balance = current_balance - withdraw_amount;
    self.balances.set(key, new_balance);
}
```

:::danger Critical Security Issue
Failure to validate before subtraction can lead to:
- Users withdrawing more than their balance
- Balance values becoming astronomically large
- Complete loss of funds in the contract

**Always check bounds before Felt subtraction operations.**
:::

---

## Wallet Component Requirement

### Problem

The `active_note::add_assets_to_account()` function fails if the consuming account doesn't have the basic wallet component.

```
Error: Account does not support asset operations
```

### Solution

Ensure accounts that receive assets via this function have wallet capability:

```rust
use miden_client::account::component::BasicWallet;

// When creating an account that needs to receive assets
let account = AccountBuilder::new(seed)
    .with_component(BasicWallet)  // Add wallet capability
    .with_component(YourCustomComponent)
    .build()?;
```

**Alternative: Use `native_account::add_asset()`**

For account components, use the native account API instead:

```rust
#[component]
impl Bank {
    pub fn deposit(&mut self, depositor: AccountId, asset: Asset) {
        // This works for any account - no wallet required
        native_account::add_asset(asset);

        // Track balance in storage
        self.update_balance(depositor, asset);
    }
}
```

---

## Storage Map Key Consistency

### Problem

Storage map lookups return unexpected results or zeros when keys are constructed inconsistently.

### Solution

Define a single key construction pattern and use it everywhere:

```rust title="contracts/bank-account/src/lib.rs"
#[component]
impl Bank {
    /// Construct a balance key for a depositor and asset.
    /// Key format: [depositor_prefix, depositor_suffix, faucet_prefix, faucet_suffix]
    fn balance_key(&self, depositor: AccountId, faucet_id: AccountId) -> Word {
        Word::from([
            depositor.prefix().as_felt(),
            depositor.suffix(),
            faucet_id.prefix().as_felt(),
            faucet_id.suffix(),
        ])
    }

    pub fn get_balance(&self, depositor: AccountId, faucet_id: AccountId) -> Felt {
        let key = self.balance_key(depositor, faucet_id);
        self.balances.get(&key)
    }

    fn update_balance(&mut self, depositor: AccountId, faucet_id: AccountId, amount: Felt) {
        let key = self.balance_key(depositor, faucet_id);
        self.balances.set(key, amount);
    }
}
```

---

## Note Type Values

### Problem

When creating output notes, the `note_type` parameter uses specific integer values that aren't obvious.

### Solution

Use the correct values for note types:

| Value | Type | Description |
|-------|------|-------------|
| 1 | Public | Note data is visible on-chain |
| 2 | Private | Note data is hidden (only hash on-chain) |

```rust
// In note inputs or when creating output notes
let note_type = Felt::new(1);  // Public note
// or
let note_type = Felt::new(2);  // Private note
```

---

## P2ID Script Root

### Problem

When creating P2ID (Pay-to-ID) output notes, you need the correct script root digest, which is a constant value from miden-base.

### Solution

Use the hardcoded P2ID script root:

```rust title="contracts/bank-account/src/lib.rs"
/// Get the P2ID note script root digest.
/// This is a constant from miden-standards that identifies the P2ID script.
fn p2id_note_root() -> Digest {
    Digest::from_word(Word::new([
        Felt::from_u64_unchecked(13362761878458161062),
        Felt::from_u64_unchecked(15090726097241769395),
        Felt::from_u64_unchecked(444910447169617901),
        Felt::from_u64_unchecked(3558201871398422326),
    ]))
}
```

:::info Where This Comes From
This digest is computed from the P2ID note script in miden-standards. If the P2ID script changes in a future version, this value will need to be updated.
:::

---

## Quick Reference Table

| Pitfall | Symptom | Solution |
|---------|---------|----------|
| Felt comparison | Wrong comparison results | Use `.as_u64()` |
| Stack overflow | "16 elements" error | Reduce locals, split functions |
| Too many args | "4 words" error | Group into Words, use inputs |
| Array reversal | Wrong data order | Be consistent with construction |
| Felt underflow | Balance wraps to huge number | Validate before subtraction |
| Missing wallet | Asset operation fails | Add `BasicWallet` component |
| Key mismatch | Zero balances | Use helper function for keys |
| Note type | Wrong note visibility | Use 1 (Public) or 2 (Private) |

:::tip View Complete Source
See these patterns in context in the [miden-bank repository](https://github.com/keinberger/miden-bank).
:::

## Next Steps

- **[Debugging Guide](./debugging)** - Troubleshoot errors
- **[Testing Guide](./testing)** - MockChain patterns
- **[Miden Bank Tutorial](./miden-bank/)** - See these patterns in context
