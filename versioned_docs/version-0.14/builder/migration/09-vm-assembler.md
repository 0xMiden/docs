---
sidebar_position: 9
title: "VM & Assembler Changes"
description: "Host trait consolidation, FastProcessor builder API, and other VM-level breaking changes in v0.14"
---

# VM & Assembler Changes

:::warning Breaking Change
The VM host interface has been collapsed from three traits to one, the processor construction API has changed to a builder pattern, and several types have been cleaned up or relocated. These changes affect anyone embedding the Miden VM directly.
:::

---

## `SyncHost` / `BaseHost` Removed; `AsyncHost` → `Host`

### Summary

The previous three-trait hierarchy (`BaseHost`, `SyncHost`, `AsyncHost`) has been collapsed into a single `Host` trait. All methods now return `impl FutureMaybeSend<...>`, making the trait async-compatible by default. Additionally, `ProcessState` was renamed from `ProcessorState`, and the `on_assert_failed` callback was removed.

### Affected Code

```rust
// Before (0.13)
impl BaseHost for MyHost {}

impl SyncHost for MyHost {
    fn get_mast_forest(
        &self,
        node_digest: &Digest,
    ) -> Option<Arc<MastForest>> {
        // ...
    }

    fn on_event(
        &mut self,
        process: &ProcessState,
        event_id: u32,
    ) -> Result<(), ExecutionError> {
        // ...
    }
}
```

```rust
// After (0.14)
impl Host for MyHost {
    fn get_mast_forest(
        &self,
        node_digest: &Digest,
    ) -> impl FutureMaybeSend<Output = Option<Arc<MastForest>>> {
        async {
            // ...
        }
    }

    fn on_event(
        &mut self,
        process: &ProcessorState,
        event_id: u32,
    ) -> impl FutureMaybeSend<Output = Result<(), ExecutionError>> {
        async {
            // ...
        }
    }
}
```

### Migration Steps

1. Remove `impl BaseHost for ...` and `impl SyncHost for ...` blocks.
2. Implement the single `Host` trait instead.
3. Wrap each method body in `async { ... }` and return `impl FutureMaybeSend<...>`.
4. Rename any `ProcessState` references to `ProcessorState`.
5. Remove any `on_assert_failed` implementations — the callback no longer exists.

---

## `FastProcessor` Builder API

### Summary

`FastProcessor::new_with_advice_inputs()` and `FastProcessor::new_debug()` have been removed. Construction now follows a builder pattern starting from `FastProcessor::new(stack_inputs)`.

### Affected Code

```rust
// Before (0.13)
let processor = FastProcessor::new_with_advice_inputs(stack_inputs, advice_inputs);
let processor = FastProcessor::new_debug(stack_inputs);
```

```rust
// After (0.14)
let processor = FastProcessor::new(stack_inputs)
    .with_advice(advice_inputs)
    .with_debugging(true)
    .with_tracing(true);

// Or with execution options:
let processor = FastProcessor::new(stack_inputs)
    .with_advice(advice_inputs)
    .with_options(execution_options);
```

### Migration Steps

1. Replace `new_with_advice_inputs(stack, advice)` with `new(stack).with_advice(advice)`.
2. Replace `new_debug(stack)` with `new(stack).with_debugging(true)`.
3. Chain `.with_options(...)` or `.with_tracing(true)` as needed.

---

## `StackInputs` / `StackOutputs` API Cleanup

### Summary

Both `StackInputs` and `StackOutputs` now derive `Copy`, so you can drop explicit `.clone()` calls. `StackInputs::new()` now takes a `&[Felt]` slice instead of a `Vec<Felt>`.

### Affected Code

```rust
// Before (0.13)
let inputs = StackInputs::new(vec![felt_a, felt_b, felt_c]);
let inputs_copy = inputs.clone();

// After (0.14)
let inputs = StackInputs::new(&[felt_a, felt_b, felt_c]);
let inputs_copy = inputs; // Copy, no clone needed
```

### Migration Steps

1. Replace `StackInputs::new(vec![...])` with `StackInputs::new(&[...])`.
2. Remove unnecessary `.clone()` calls on `StackInputs` and `StackOutputs`.

---

## `MastForest::strip_decorators` → `clear_debug_info`

### Summary

`MastForest::strip_decorators()` has been renamed to `MastForest::clear_debug_info()` and now wipes the entire `DebugInfo` structure, not just decorators. A new convenience method `MastForest::write_stripped()` writes the forest with debug info removed without mutating the original.

The MAST serialization format version was also bumped — `.masl` and `.masp` files produced by v0.13 will **not** deserialize under v0.14.

### Affected Code

```rust
// Before (0.13)
forest.strip_decorators();

// After (0.14)
forest.clear_debug_info();

// Or write a stripped copy without mutating:
forest.write_stripped(&mut output)?;
```

### Migration Steps

1. Replace `strip_decorators()` calls with `clear_debug_info()`.
2. Consider using `write_stripped()` if you only need stripped output without modifying the forest in memory.
3. Re-assemble all `.masl` and `.masp` files from source — 0.13 serialized files will fail to deserialize.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `no method named strip_decorators found` | Method renamed | Use `clear_debug_info()`. |
| `MastForest deserialization failed: unexpected version` | MAST format version bumped | Re-assemble from source under 0.22. |

---

## `Process`, `VmStateIterator`, `execute_iter()` Removed

### Summary

The "slow" `Process` type, `VmStateIterator`, `VmState`, `AsmOpInfo`, `SlowProcessState`, and the top-level `miden_processor::execute_iter()` function have been removed. Execution goes exclusively through `FastProcessor`.

### Affected Code

```rust
// Before (0.13)
for state in execute_iter(&program, stack_inputs, advice_inputs, &mut host) {
    let state: VmState = state?;
    println!("clk={} op={:?}", state.clk(), state.op());
}

// After (0.14)
let mut processor = FastProcessor::new(stack_inputs).with_advice(advice_inputs);
let mut ctx = processor.get_initial_resume_context(&program)?;
loop {
    let outcome = processor.step(&program, &mut ctx, &mut host)?;
    if outcome.is_done() { break; }
}
```

For one-shot non-iterating execution, use `FastProcessor::execute_sync(...)` or the top-level `miden_processor::execute_sync(...)`.

---

## `miden debug` / `analyze` / `repl` Removed

The three CLI subcommands were removed along with `VmStateIterator`. The CLI now exposes only `compile`, `bundle`, `run`, `prove`, `verify`. There is no drop-in replacement; use the external debugger or write a small Rust program that drives `FastProcessor::step` if you need step-by-step inspection.

---

## `Operation` Enum Trimmed to Basic-Block Ops

### Summary

Control-flow opcodes (`Join`, `Split`, `Loop`, `Call`, `Dyn`, `Dyncall`, `SysCall`, `Span`, `End`, `Respan`, `Halt`) were removed from `miden_core::Operation`; they live exclusively at the MAST node level (`MastNode::Join`, etc.). Pattern matches over those variants must move to traversals over `MastNode`.

---

## `ExecutionOptions`, `ProvingOptions`, `ExecutionProof` Relocated

These types have moved crates. See [Imports & Dependencies](./imports-dependencies) for the updated import paths.

---

## Project File Format

### Summary

v0.14 introduces a **first-class Miden project file format** (`miden-project.toml`), implemented in the new `miden-project` crate. Projects describe a single package or a workspace of packages with dependencies (path, git, registry), profiles, lints, and per-package metadata — much like `Cargo.toml`. The assembler compiles a project directly to a `.masp` package via `Assembler::link_package`, with dependency resolution through `pubgrub`.

This is **additive** for existing per-file assembly users — old `Assembler::compile_and_statically_link` / `assemble_library` APIs still work — but it is the recommended layout for any new MASM project of more than a single file.

### Standalone Package Example

```toml title="my-app/miden-project.toml"
[package]
name = "example"
version = "0.1.0"

[lib]
path = "lib/mod.masm"

[dependencies]
miden-protocol = { path = "../protocol/userspace" }

[profile.test]
inherits = "dev"
network = "local"

[lints.miden]
unused = "error"
```

### Building from Rust

```rust
use miden_assembly::Assembler;

let package = Assembler::default()
    .link_package("./my-app/miden-project.toml")?;
```

---

:::tip
For the full VM changelog, see the [miden-vm releases](https://github.com/0xMiden/miden-vm/releases).
:::
