---
sidebar_position: 9
title: "VM & Assembler Changes"
description: "Library becomes Package, the MAST and package wire formats change, ExecutionProof is reworked, and miden-project.toml requires an explicit path"
---

# VM & Assembler Changes

:::warning Breaking Change
The VM jumps **0.23 → 0.29.1**. `Library` and `KernelLibrary` no longer exist — `Package` is the only artifact type, and the `.masl` format is gone. The MAST wire format moved `0.0.3` → `0.0.4` and the package format `4.0.0` → `6.0.0`, so **no 0.15 artifact or serialized proof loads under 0.16**. Verification now takes a single `ExecutionClaim`, and `miden-project.toml` requires an explicit `path` on every target.
:::

For the MASM language changes that ship with this VM version — the new `mod` declarations, the rewritten `use` syntax, and the removal of the `debug.*` decorators — see [MASM Changes](./masm-changes). For the changed commitment preimages, see [Hashing & Crypto Changes](./hashing-crypto).

## Quick Fix

```rust
// Before (0.15)
let mut assembler = Assembler::default();
assembler.link_dynamic_library(CoreLibrary::default())?;
let program: Program = assembler.assemble_program(source)?;

// After (0.16)
let mut assembler = Assembler::new(source_manager);
assembler.link_package(CoreLibrary::default().package(), Linkage::Dynamic)?;
let package: Box<Package> = assembler.assemble_program("program", source)?;
let program: Program = package.unwrap_program();
```

```diff title="miden-project.toml"
  [lib]
  namespace = "my::app"
+ path = "mod.masm"
```

If you encounter errors, continue reading for detailed migration steps.

---

## Summary

The assembler was rebuilt around a single artifact type. In 0.15 there were three — `Program`, `Library`, and `KernelLibrary` — serialized as `.masl` for libraries. In 0.16 everything is a `Package` serialized as `.masp`, linking goes through one `link_package(package, linkage)` method, and the directory-walking `*_from_dir` entry points became `*_from_root` entry points that take the root module file. This follows directly from the new explicit module tree: the assembler no longer discovers modules by walking directories, so a directory is no longer a meaningful input.

Three wire formats changed at the same time and none are backward compatible, which means every artifact must be rebuilt from source rather than migrated.

Verification was also reshaped: the free `verify(program_info, stack_inputs, stack_outputs, proof)` function became `verify(proof, claim)` over a single `ExecutionClaim`, and the caller-managed precompile registry disappeared entirely — deferred proofs are now rehydrated and bound automatically.

---

## `Library` → `Package` throughout the assembler

### Summary

`Library` and `KernelLibrary` were deleted. Every entry point that produced or consumed a `Library` now produces or consumes a `Package`, the `link_*_library` family collapsed into `link_package(package, linkage)`, and `assemble_program` returns a `Box<Package>` rather than a `Program`. Every assemble entry point now takes a package name ([#3216](https://github.com/0xMiden/miden-vm/pull/3216), [#3220](https://github.com/0xMiden/miden-vm/pull/3220)).

### Affected Code

```rust
// Before (0.15)
use miden_assembly::Assembler;
use miden_core_lib::CoreLibrary;

let mut assembler = Assembler::default();
assembler.link_dynamic_library(CoreLibrary::default())?;
let program: Program = assembler.assemble_program(source)?;
```

```rust
// After (0.16)
use miden_assembly::{Assembler, Linkage};
use miden_core_lib::CoreLibrary;

let mut assembler = Assembler::new(source_manager);
assembler.link_package(CoreLibrary::default().package(), Linkage::Dynamic)?;
for library in libraries {
    assembler.link_package(library, Linkage::Dynamic)?;   // Arc<Package>
}
let package: Box<Package> = assembler.assemble_program("program", source)?;
let program: Program = package.unwrap_program();          // or try_into_program()
```

The complete mapping:

| v0.15 | v0.16 |
| --- | --- |
| `Assembler::with_kernel(sm, kernel_lib: KernelLibrary) -> Self` | `Assembler::with_kernel(sm, kernel: Arc<Package>) -> Result<Self, Report>` |
| `link_library(lib, linkage)` / `link_dynamic_library(lib)` / `link_static_library(lib)` | `link_package(package: Arc<Package>, linkage: Linkage)` |
| `with_dynamic_library(lib)` / `with_static_library(lib)` | `with_package(package: Arc<Package>, linkage: Linkage)` |
| `compile_and_statically_link_from_dir(dir, namespace)` | `compile_and_statically_link_from_root(root, namespace: Option<&Path>)` |
| `assemble_library(modules) -> Arc<Library>` | `assemble_library(name, root, support) -> Box<Package>` |
| `assemble_library_from_dir(dir, namespace) -> Arc<Library>` | `assemble_library_from_root(root, namespace: Option<&Path>) -> Box<Package>` |
| `assemble_kernel(module) -> KernelLibrary` | `assemble_kernel(name, root, support) -> Box<Package>` |
| `assemble_kernel_from_dir(sys_path, lib_dir) -> KernelLibrary` | `assemble_kernel_from_root(name, sys_module_path) -> Box<Package>` |
| `assemble_program(source) -> Program` | `assemble_program(name, source) -> Box<Package>` |
| `kernel() -> &Kernel` | `kernel() -> &KernelDescriptor` |
| — | `with_profile(&miden_project::Profile)` *(new)* |

Also removed from the `miden_assembly` re-export surface: `Library`, `KernelLibrary`, `Parse`, `ParseOptions`, `LinkLibraryKind`, and the `library` module. Added: `Linkage`, the `module` module, and the project-assembly types (`ProjectSourceProvider`, `MasmSourceProvider`, `ResolvedPackage`, `AssemblyInterrupted`).

### Migration Steps

1. Replace every `Library` / `KernelLibrary` binding with `Package` — `Arc<Package>` for linking, `Box<Package>` from the assemble methods.
2. Collapse `link_dynamic_library(x)` / `link_static_library(x)` / `link_library(x, l)` into `link_package(x, Linkage::Dynamic)` or `Linkage::Static`.
3. Rename `*_from_dir` calls to `*_from_root` and pass the root module file instead of the directory. Their `namespace` parameter is now `Option<&Path>` rather than a required `impl AsRef<Path>`.
4. Thread a package name through `assemble_program`, `assemble_library`, and `assemble_kernel`. Any string works; the CLI uses the literal `"program"`.
5. After `assemble_program`, call `.unwrap_program()` (panics on a non-executable package) or `.try_into_program()` to get the `Program` the processor expects.
6. Add `?` to `Assembler::with_kernel` — it is now fallible.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `cannot find type Library in miden_assembly` | Type removed | Use `Package`. |
| `no method named link_dynamic_library` | Collapsed into one method | `link_package(pkg, Linkage::Dynamic)`. |
| `expected Program, found Box<Package>` | `assemble_program` return type changed | Call `.unwrap_program()` or `.try_into_program()`. |
| `this function takes 2 arguments but 1 was supplied` | Assemble entry points take a package name | Pass a name as the first argument. |

---

## Core package split into `miden::core` + `miden::precompiles`

### Summary

The single core MASM package was split into `miden-core` (namespace `miden::core`) and `miden-precompiles` (namespace `miden::precompiles`), freeing the bare `miden` namespace for sibling packages such as `miden-protocol` ([#3459](https://github.com/0xMiden/miden-vm/pull/3459), [#3222](https://github.com/0xMiden/miden-vm/pull/3222)). **Both must be linked** — `miden-core` has a runtime dependency on `miden-precompiles`.

### Affected Code

```rust
// Before (0.15)
let mut assembler = Assembler::default();
assembler.link_dynamic_library(CoreLibrary::default())?;
let lib = CoreLibrary::default().library();     // &Library
```

```rust
// After (0.16)
let core_lib = CoreLibrary::default();
let mut assembler = Assembler::new(source_manager);
for package in core_lib.packages() {                 // [Arc<Package>; 2]
    assembler.link_package(package, Linkage::Dynamic)?;
}

// Or individually:
let core: Arc<Package>        = core_lib.package();
let precompiles: Arc<Package> = core_lib.precompiles_package();
let mast: &Arc<MastForest>    = core_lib.mast_forest();   // merged, for execution
```

`CoreLibrary::SERIALIZED` now holds the `miden-core.masp` bytes and a new `CoreLibrary::PRECOMPILES_SERIALIZED` holds `miden-precompiles.masp`; in 0.15 `SERIALIZED` was `core.masl`. `CoreLibrary::library()` and `CoreLibrary::verifier_registry()` are gone, and `CoreLibrary::recursive_verifier_root()` is new.

### Migration Steps

1. Replace the single link call with a loop over `CoreLibrary::default().packages()`, or link `package()` and `precompiles_package()` explicitly.
2. Replace `CoreLibrary::default().library()` with `.package()`.
3. Drop `CoreLibrary::verifier_registry()`. The deferred-precompile registry now lives in the `miden-precompiles` crate as `miden_precompiles::registry()` and is applied by the verifier automatically.

---

## MAST wire format `0.0.4`, package format `6.0.0`, and `.masl` removed

### Summary

Three artifact-format changes land together, none backward compatible:

- The **MAST wire format** bumped `[0,0,3]` → `[0,0,4]`, removing inline metadata slots. Assembly-op and debug-variable metadata now live in a separate indexed `DebugInfo` section ([#3201](https://github.com/0xMiden/miden-vm/pull/3201), [#3208](https://github.com/0xMiden/miden-vm/pull/3208), [#3221](https://github.com/0xMiden/miden-vm/pull/3221)). The stripped serialization mode was removed ([#3268](https://github.com/0xMiden/miden-vm/pull/3268)).
- The **package (`.masp`) format** bumped `[4,0,0]` → `[6,0,0]`, from consolidating debug sections into `PackageDebugInfo` ([#3398](https://github.com/0xMiden/miden-vm/pull/3398)) and binding dense forest and package digests to stored roots and dependencies ([#3334](https://github.com/0xMiden/miden-vm/pull/3334)).
- The **`.masl` library format no longer exists.** `Library::LIBRARY_EXTENSION` is gone along with the type; `.masp` is the only artifact format.

### Affected Code

```rust
// Any 0.15 blob fails to read under 0.16:
let forest  = MastForest::read_from_bytes(&old_bytes)?;  // Err: unexpected version [0,0,3]
let package = Package::read_from_bytes(&old_masp)?;      // Err: unexpected version [4,0,0]
```

Package deserialization is now tiered by trust level. In 0.15 `Package` implemented only the plain `Deserializable::read_from`:

```rust
// After (0.16) — three trust levels
Package::read_from(&mut r)?            // untrusted: validates MAST, drops debug sections
Package::read_from_bytes(bytes)?
Package::read_from_trusted(&mut r)?    // local cache: validates MAST, keeps debug sections
Package::read_from_bytes_trusted(bytes)?
Package::read_from_unchecked(&mut r)?  // skips MAST validation; only for self-produced bytes
Package::read_from_bytes_unchecked(bytes)?
```

### Migration Steps

1. Re-assemble every `.masp` package from source under 0.16, and re-serialize every cached `MastForest` blob. Invalidate on-disk and database-persisted copies.
2. Delete `.masl` artifacts and any code that reads them.
3. Discard serialized proofs from 0.15 — the proof envelope changed too.
4. Choose the reader that matches your trust boundary: `read_from_bytes` for anything from a registry, the network, or a user; `read_from_bytes_trusted` for your own build cache when you want debug info retained.

---

## `ExecutionProof` reworked; `Verifier` replaces the free `verify_*` functions

### Summary

`ExecutionProof` was restructured from `{ proof, hash_fn, pc_requests }` into two envelopes, `StarkProof` and `DeferredProof`, and **proof serialization changed** ([#3222](https://github.com/0xMiden/miden-vm/pull/3222)). The legacy proof-bound precompile request model was replaced by the deferred-DAG framework in `miden_core::deferred`.

On the verification side, `verify(program_info, stack_inputs, stack_outputs, proof)` and `verify_with_precompiles(..)` were replaced by a `Verifier` type and a free `verify(proof, claim)` taking a single `ExecutionClaim` that bundles what used to be three arguments ([#3422](https://github.com/0xMiden/miden-vm/pull/3422), [#3447](https://github.com/0xMiden/miden-vm/pull/3447)).

### Affected Code

```rust
// Before (0.15)
let security_level = miden_verifier::verify(
    program_info, stack_inputs, stack_outputs, proof,
)?;
let (level, commitment) = miden_verifier::verify_with_precompiles(
    program_info, stack_inputs, stack_outputs, proof, &registry,
)?;
```

```rust
// After (0.16)
use miden_core::program::ExecutionClaim;
use miden_verifier::{Verifier, verify};

let claim = ExecutionClaim::from_program_info(program_info, stack_inputs, stack_outputs);

let security_level: u32 = verify(proof, claim)?;                 // free fn, default config
let security_level: u32 = Verifier::new().verify(proof, claim)?; // equivalent

// Partial (delegable) verification returns a #[must_use] obligation:
let (level, unsettled) = Verifier::new()
    .with_max_deferred_elements(n)
    .verify_partial(proof, claim)?;
let root: Word = unsettled.root();
```

`ExecutionProof` now exposes `miden_proof() -> &StarkProof` and `deferred_proof() -> &DeferredProof`, with constructors `ExecutionProof::new(miden, deferred)` and `from_parts(bytes, hash_fn, deferred)`. The 0.15 public fields, the three-argument `new`, `stark_proof()`, `deferred_state()`, and `into_parts()` are gone.

`verify_with_precompiles` and `verify_with_max_deferred_elements` are both removed. Precompile verification is no longer wired up by the caller: the deferred wire is rehydrated under the built-in `miden_precompiles::registry()` and bound to the STARK public inputs automatically.

`prove` and `prove_sync` keep their 0.15 signatures. New in this line: `prove_partial`, `prove_partial_sync`, and `prove_partial_from_trace_sync`.

### Migration Steps

1. Build an `ExecutionClaim` — usually `ExecutionClaim::from_program_info(info, inputs, outputs)` — and pass `(proof, claim)` to `verify`.
2. Delete `PrecompileVerifierRegistry` plumbing and calls to `verify_with_precompiles` / `verify_with_max_deferred_elements`. Use `Verifier::with_max_deferred_elements(n)` if you need a non-default budget.
3. Replace field access on `ExecutionProof` with `miden_proof()` / `deferred_proof()`.
4. Discard serialized proofs from 0.15 — they will not deserialize.
5. If you use `verify_partial`, do not drop the returned `Unsettled`. It is `#[must_use]` and represents a deferred obligation you must settle or re-expose.

---

## `AdviceInputs.stack` replaced by the `AdviceStack` type

### Summary

`AdviceInputs`'s public `stack: Vec<Felt>` field was replaced by a private `AdviceStack`, and the `with_stack` / `with_stack_values` / `extend_stack` helpers were removed in favour of `with_advice_stack(AdviceStack)` and the `advice_stack()` accessor ([#3423](https://github.com/0xMiden/miden-vm/pull/3423)).

### Affected Code

```rust
// Before (0.15)
let advice = AdviceInputs::default()
    .with_stack(vec![a, b, c])
    .with_stack_values([1u64, 2, 3])?
    .with_map(entries);
let raw: &Vec<Felt> = &advice.stack;
```

```rust
// After (0.16)
use miden_core::advice::{AdviceInputs, AdviceStack};

let mut stack = AdviceStack::new();
stack.append_word(word).append_elements([a, b, c]);
// or, from raw u64s, validating each against the field modulus:
let stack = AdviceStack::try_from_values([1u64, 2, 3])?;

let advice = AdviceInputs::default()
    .with_advice_stack(stack)
    .with_map(entries);

let stack: AdviceStack = advice.advice_stack();   // clone of the stack
let (stack, map, store) = advice.into_parts();    // new in 0.16
```

`AdviceStack` distinguishes append (bottom) from prepend/push (top) and names the MASM instruction each targets: `append_element`, `append_elements`, `append_word`, `append_dword`, `append_for_adv_push`, `append_for_adv_pipe`, `prepend_elements`, `prepend_word`, `prepend_stack`, `push_element`, plus `consume_element` / `consume_word` / `consume_dword` and `into_elements`. `AdviceInputs::map` and `AdviceInputs::store` remain public fields.

### Migration Steps

1. Replace `with_stack(iter)` with `with_advice_stack(AdviceStack::…)`, building the stack with the append/prepend methods.
2. Replace `with_stack_values(u64s)?` with `AdviceStack::try_from_values(u64s)?`.
3. Replace direct reads of `advice_inputs.stack` with `advice_inputs.advice_stack()`, or destructure with `into_parts()`.
4. Mind the ordering vocabulary: `append_*` adds below (consumed later), `prepend_*` and `push_element` add on top (consumed first).

:::info New resource bounds
The live advice map is now bounded by total field-element count and the advice Merkle store by internal node count, both during setup and execution ([#3264](https://github.com/0xMiden/miden-vm/pull/3264)). `FastProcessor` memory growth is bounded by a configurable `ExecutionOptions::max_memory_elements` ([#3226](https://github.com/0xMiden/miden-vm/pull/3226)). If you seed very large advice inputs, expect a setup-time error rather than silent success.
:::

---

## `ModuleInfo` → `ModuleDescriptor`, `Kernel` → `KernelDescriptor`

### Summary

The module and kernel metadata types were renamed and relocated ([#3356](https://github.com/0xMiden/miden-vm/pull/3356)).

### Affected Code

```diff
- use miden_core::program::Kernel;
- use miden_assembly::library::ModuleInfo;
- let k: &Kernel = assembler.kernel();
+ use miden_core::program::KernelDescriptor;
+ use miden_assembly::module::ModuleDescriptor;
+ let k: &KernelDescriptor = assembler.kernel();
```

The module path moved as well: the `library` module is gone from `miden_assembly`'s re-exports, and `ModuleDescriptor` lives under `module`.

### Migration Steps

1. Rename `Kernel` → `KernelDescriptor` and `ModuleInfo` → `ModuleDescriptor` at every import and binding.
2. Update the import path from `miden_assembly::library` to `miden_assembly::module`.
3. Re-check descriptor method names against the new type — several were renamed alongside it.

---

## `miden-project.toml`: `path` is mandatory on every target

### Summary

The `path` key on `[lib]` and `[[bin]]` targets changed from optional to required. It may point at files with extensions other than `.masm` — a Rust project's source root, for example — which is why the implicit default was dropped ([#3216](https://github.com/0xMiden/miden-vm/pull/3216)). In the Rust AST, `LibTarget::path` and `BinTarget::path` moved from `Option<Span<Uri>>` to `Span<Uri>`.

A project with neither a `[lib]` nor any `[[bin]]` still gets an implicit library target defaulting to `mod.masm`; that inference is unchanged.

### Affected Code

```diff title="miden-project.toml"
  [lib]
  namespace = "miden::protocol"
+ path = "mod.masm"

  [[bin]]
  name = "entry"
+ path = "bin/main.masm"
```

### Migration Steps

1. Add an explicit `path` to every `[lib]` and `[[bin]]` in every `miden-project.toml`.
2. If you construct `LibTarget` / `BinTarget` in Rust, drop the `Some(..)` wrapper around `path`.

---

## `miden-vm bundle` reworked

### Summary

`miden-vm bundle` now takes the path to a **root `.masm` module** instead of a directory, `--kernel` is a boolean flag instead of taking a path, and the output is a `.masp` package instead of a `.masl` library. With `--kernel` set, the kernel's support modules are derived from the explicit `mod` declarations in the root module ([#3216](https://github.com/0xMiden/miden-vm/pull/3216), [#3220](https://github.com/0xMiden/miden-vm/pull/3220)).

### Affected Code

```bash
# Before (0.15)
miden-vm bundle --namespace mylib ./src            # directory  -> out.masl
miden-vm bundle --kernel ./kernel.masm ./src       # --kernel takes a path

# After (0.16)
miden-vm bundle --namespace mylib ./src/mod.masm   # root module -> out.masp
miden-vm bundle --kernel ./kernel/mod.masm         # --kernel is a flag
```

`--namespace` is now optional in the non-kernel case: if omitted, the assembler expects a `namespace` declaration in the root module, where 0.15 fell back to the directory name. For `--kernel` the namespace defaults to `$kernel`. A new `-r` / `--release` flag disables debug symbols.

### Migration Steps

1. Change the positional argument from a directory to the root module file.
2. Change `--kernel <path>` to a bare `--kernel` with the kernel's root module as the positional argument.
3. Update the expected output filename from `out.masl` to `out.masp`.
4. Ensure the root module declares its submodules with `mod` / `pub mod` — that is now how support modules are discovered.
5. Either pass `--namespace` or add a `namespace` declaration to the root module.

---

## `ProjectAssembler::assemble_with_sources` removed

### Summary

`ProjectAssembler::assemble_with_sources(target, profile, sources)` was removed — projects must be assembled from the filesystem ([#3216](https://github.com/0xMiden/miden-vm/pull/3216)). In its place, project assembly is extensible through the `ProjectSourceProvider` trait, which lets non-MASM source languages participate ([#3375](https://github.com/0xMiden/miden-vm/pull/3375), [#3383](https://github.com/0xMiden/miden-vm/pull/3383)).

### Affected Code

```rust
// Before (0.15)
let pkg = project_assembler.assemble_with_sources(target, profile, sources)?;
```

```rust
// After (0.16)
let pkg: Arc<MastPackage> = project_assembler.assemble(target_selector, profile_name)?;

// Register a provider for a non-MASM source language:
let mut pa = Assembler::new(sm)
    .for_project_at_path_with_providers(manifest_path, &mut store, [my_provider])?;

// A provider can interrupt assembly:
match pa.assemble_interruptible(target_selector, profile_name)? {
    ControlFlow::Continue(pkg) => { /* … */ },
    ControlFlow::Break(interrupted) => { /* … */ },
}
```

`ProjectAssembler::assemble(target_selector, profile_name)` keeps its 0.15 signature.

### Migration Steps

1. Drop `assemble_with_sources`; write your sources to disk and use `assemble`, or implement a `ProjectSourceProvider`.
2. If you need to react to a provider interrupting assembly, use `assemble_interruptible` and match on the `ControlFlow`.

:::note Changelog correction
The 0.25.4 changelog names the new method `ProjectAssembler::assemble_source_project`. The method that actually exists in the released code is **`assemble_source_package`**.
:::

---

## Smaller Rust API removals

These are lower-impact, but each will break a build if you touch it.

| Removed / changed | PR |
| --- | --- |
| `MastForest::compact` removed — deduplicate through builders or explicit `MastForest::merge` | [#3318](https://github.com/0xMiden/miden-vm/pull/3318) |
| Stripped `MastForest` serialization mode removed | [#3268](https://github.com/0xMiden/miden-vm/pull/3268) |
| Dense forest construction moved to `DenseMastForestBuilder`; non-canonical dense payloads rejected | [#3334](https://github.com/0xMiden/miden-vm/pull/3334) |
| `MastForestBuilder` simplified around builder-local refs and immutable finalized forests | [#3139](https://github.com/0xMiden/miden-vm/pull/3139) |
| `prettier::pretty_print_csv`, `MastNodeId::from_usize_safe`, `DecoratorId::from_u32_bounded`, `OpBatch::end_indices` removed | [#3197](https://github.com/0xMiden/miden-vm/pull/3197) |
| `Processor` trait methods moved into their sub-interfaces | [#3202](https://github.com/0xMiden/miden-vm/pull/3202) |
| `ExecutionOptions::with_overlapped_trace_build` added, on by default | [#3407](https://github.com/0xMiden/miden-vm/pull/3407) |
| `miden-vm run` / `miden-vm prove` now fail when the inferred `.inputs` file is missing instead of proceeding | [#3236](https://github.com/0xMiden/miden-vm/pull/3236) |
| `ResumeContext` exposes its debug info outside `miden-processor` and can be built from a `Package` | [#3355](https://github.com/0xMiden/miden-vm/pull/3355) |
| Proof serialization switched from `bincode` to `wincode`; verifier-side STARK proof deserialization bounded to 64 MiB | [#3148](https://github.com/0xMiden/miden-vm/pull/3148) |
| `AeadPoseidon2::key_from_bytes` restored to canonical-`Felt` decoding; keys persisted under the brief SHA-256 KDF contract must be re-derived | [#3366](https://github.com/0xMiden/miden-vm/pull/3366) |
| `Felt::from_{u8,u16,u32}` are now `const`; `Felt::MAX` added | [crypto#1081](https://github.com/0xMiden/crypto/pull/1081) |
| Assembling a procedure with more locals than the frame pointer can represent is a diagnostic error rather than a panic | [#3332](https://github.com/0xMiden/miden-vm/pull/3332) |

The `miden-crypto` 0.26 and 0.27 breaking changes are almost entirely in `LargeSmt` / `LargeSmtForest` storage backends and prover internals, which application code does not call. The one exception worth knowing: the RustCrypto and dalek stack (`k256`, `sha2`, `sha3`, `curve25519-dalek`, `ed25519-dalek`, `x25519-dalek`, `hkdf`, `der`) was upgraded ([crypto#1045](https://github.com/0xMiden/crypto/pull/1045)) and `rand` moved to 0.10 ([crypto#995](https://github.com/0xMiden/crypto/pull/995)). Expect version-unification pressure if you depend on those crates directly.

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `unexpected version [0,0,3]` reading a `MastForest` | MAST wire format is now `0.0.4` | Re-assemble from source. |
| `unexpected version [4,0,0]` reading a package | Package format is now `6.0.0` | Rebuild the `.masp`. |
| Cannot open a `.masl` file | Format removed entirely | Rebuild as `.masp`. |
| `cannot find function verify_with_precompiles` | Replaced by automatic deferred verification | Use `verify(proof, claim)`. |
| `no field stack on type AdviceInputs` | Field is now private | Use `advice_stack()` or `into_parts()`. |
| `missing field path` parsing `miden-project.toml` | `path` is mandatory | Add it to every `[lib]` and `[[bin]]`. |
| Serialized proof fails to deserialize | Proof envelope and serialization changed | Regenerate the proof. |
