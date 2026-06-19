---
sidebar_position: 9
title: "VM & Assembler Changes"
description: "Sync-first execution, separated proving options, stricter assembly resolution, and the MAST/project wire-format bump (0.0.2 → 0.0.3) in Miden v0.15"
---

# VM & Assembler Changes

:::warning Breaking Change
Execution and proving are now **sync-first**: the single `Host` trait is split into `BaseHost` / `SyncHost` (plus an async `Host`), and `execute()` / `execute_sync()` return an `ExecutionOutput` instead of an `ExecutionTrace`. Separately, the MAST wire format bumped `0.0.2` → `0.0.3`, so `.masl` / `.masp` packages and serialized `MastForest` blobs produced under `0.22` will **not** load under `0.23` — re-assemble everything from source.
:::

---

## Sync-first execution: `BaseHost`/`SyncHost`; `execute` returns `ExecutionOutput`

### Summary

Execution and proving became **sync-first with runtime-free async compatibility**. The single `Host` trait from `0.22` is split into three: `BaseHost` (shared source/label resolution + event-name lookup), `SyncHost: BaseHost` (synchronous `get_mast_forest` / `on_event`), and `Host: BaseHost` (the async variant). A blanket impl makes every `SyncHost` automatically a `Host`. The sync entry points (`execute_sync`, `prove_sync`, `FastProcessor::execute_sync`/`execute_mut_sync`) require `SyncHost`. Both `execute()` and `execute_sync()` now return **`ExecutionOutput`** instead of `ExecutionTrace` — trace building is explicit via `execute_trace_inputs*()` + `trace::build_trace()`. The deprecated `execute_sync_mut()` / `execute_for_trace*()` aliases and the unbound `TraceBuildInputs::new()` / `from_program()` constructors were removed.

### Affected Code

```rust
// After (0.23): implement BaseHost + SyncHost; you get Host for free via the blanket impl.
// (Before: a single async `impl Host for MyHost` with async get_mast_forest / on_event.)
use miden_processor::{BaseHost, SyncHost, AdviceMutation, host::handlers::EventError, ProcessorState};
impl BaseHost for MyHost {
    fn get_label_and_source_file(&self, location: &Location) -> (SourceSpan, Option<Arc<SourceFile>>) { /* ... */ }
}
impl SyncHost for MyHost {
    fn get_mast_forest(&self, d: &Word) -> Option<Arc<MastForest>> { /* ... */ }
    fn on_event(&mut self, p: &ProcessorState<'_>) -> Result<Vec<AdviceMutation>, EventError> { /* ... */ }
}

// Calling execute now returns ExecutionOutput (exposes `stack`, `advice`, `memory`):
let output: ExecutionOutput = miden_processor::execute_sync(&program, stack_inputs, advice_inputs, &mut host, options)?;
```

### Migration Steps

1. Split your `Host` impl into a `BaseHost` impl (label/source resolution) plus a `SyncHost` impl with plain (non-async) `get_mast_forest` / `on_event`.
2. If you call the sync entry points, pass a `SyncHost`.
3. Replace destructuring of an `ExecutionTrace` return with `ExecutionOutput` accessors; build a trace explicitly only when needed.
4. Replace `FastProcessor::execute_sync_mut(...)` with `execute_mut_sync(...)`, and `execute_for_trace*` / `TraceBuildInputs::new()` with `execute_trace_inputs_sync()` / `execute_trace_inputs()`.

---

## `prove_sync` takes execution options separately

### Summary

`ProvingOptions` no longer carries an `ExecutionOptions`. `prove_sync` / `prove` now take execution options and proving options as **two separate parameters** (and the sync path requires a `SyncHost`). The `with_execution_options(...)` / `execution_options()` accessors on `ProvingOptions` are gone. `prove_from_trace_sync()` now takes a `TraceProvingInputs`.

```diff
- let options = ProvingOptions::default().with_execution_options(exec_options);
- let (stack_outputs, proof) = prove_sync(&program, stack_inputs, advice_inputs, &mut host, options)?;
+ use miden_processor::ExecutionOptions;
+ let (stack_outputs, proof) = prove_sync(
+     &program, stack_inputs, advice_inputs, &mut host,  // must be a SyncHost
+     ExecutionOptions::default(), ProvingOptions::default())?;
```

### Migration Steps

1. Stop calling `ProvingOptions::with_execution_options(...)`; pass `ExecutionOptions` as its own argument.
2. Ensure the host you pass to `prove_sync` implements `SyncHost`.
3. If you drove `prove_from_trace_sync()`, build a `TraceProvingInputs` from post-execution trace inputs.

---

## Live advice map bounded by total field elements

### Summary

The live advice map is now bounded by total field-element count during execution. Advice-provider setup returns an error when the **initial** advice already exceeds the limit, and writes that would push the live map past the limit fail. `AdviceMap` gained a `total_element_count()` accessor.

### Migration Steps

1. If you seed very large advice maps up front, split the data or stream it in during execution.
2. Handle the new setup-time error from advice-provider construction instead of assuming it always succeeds.

---

## Stricter assembly resolution: structured errors replace panics

### Summary

Several previously-panicking or silently-partial assembly paths now return structured errors: oversized modules are rejected at resolver construction, non-procedure invoke targets are rejected, self-recursive / rootless call graphs return typed cycle errors, and unresolved `pub use <digest> -> <name>` returns a normal assembly error. The linker also rejects non-`syscall` references to exported kernel procedures and rejects empty kernel packages. Code that assembled cleanly under `0.22` continues to assemble; the change is that malformed inputs now surface as recoverable `Report` errors instead of panics.

### Migration Steps

1. If you wrapped assembly in panic-catching logic for malformed inputs, replace it with normal `Result`/`Report` error handling.
2. Fix any MASM that referenced an exported kernel procedure via `exec`/`call` instead of `syscall` — that is now a hard error.

---

## Post-last-operation decorators deprecated

### Summary

Operation-indexed decorators placed *after* the last operation of a basic block are now rejected in both block assembly and serialized MAST forests. Decorators that should run after a block exits must use the `after_exit` slot instead. This only affects code that builds `MastForest`s programmatically — ordinary MASM source is unaffected.

### Migration Steps

1. If you attach decorators programmatically, move any decorator targeting the post-last-op index to the block's `after_exit` decorator list.

---

## Project File Format

### Summary

The MAST forest serialization format was refactored around fixed-layout **full**, **stripped**, and **hashless** sections, with stable node IDs and stricter validation of untrusted forests. The wire-format version constant bumped from `[0, 0, 2]` to `[0, 0, 3]`. Serialized `.masl` / `.masp` / `MastForest` blobs produced under `0.22` will not deserialize under `0.23`. Deserialization of serialized libraries and kernel libraries is now treated as **untrusted** by default, rejecting spoofed/inconsistent node digests rather than trusting the bytes.

### Affected Code

```rust
// Any blob serialized under 0.22 (VERSION = [0, 0, 2]) fails to read under 0.23:
let forest = MastForest::read_from_bytes(&old_bytes)?; // Err: unexpected version
```

### Migration Steps

1. Re-assemble every `.masl` / `.masp` package and re-serialize any cached `MastForest` blobs from source under `0.23`.
2. If you persisted MAST forests or packages to disk or a database, invalidate and regenerate them.
3. If you deserialize forests from an untrusted source, expect stricter validation — malformed or spoofed-digest forests now return an error instead of loading.

---

:::tip
For the full VM changelog, see the [miden-vm releases](https://github.com/0xMiden/miden-vm/releases).
:::
