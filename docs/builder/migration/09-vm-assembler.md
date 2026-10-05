---
sidebar_position: 9
title: "VM & Assembler Changes"
description: "0.16 packages and proofs no longer load, Verifier::verify returns a VerificationOutcome that can be Ok with work outstanding, ProvingOptions becomes Prover, and AdviceInputs fields go private"
---

# VM & Assembler Changes

:::warning Breaking Change
The VM moves **0.29.2 → 0.35.0** (the line protocol `0.17.0` pins). Nothing built or proven with 0.16 loads: packages move to format `7.0.0`, packages that link the core library must ask for `miden-core` `0.35`, and 0.16 proofs do not decode. The free `verify` is gone: `Verifier::new().verify(&claim, &proof)` returns a `VerificationOutcome`, and **`Ok` can still mean "precompile work outstanding"**. `ProvingOptions` and the free `execute` / `prove` functions give way to `Prover` and `FastProcessor`, and `AdviceInputs` makes its fields private.
:::

For the MASM side of this VM line (`miden::core::precompiles::*`, the `sys::vm::verify_proof` rename, the return of `trace`, and core-library procedures whose MAST roots moved), see [MASM Changes](./masm-changes). For the protocol types that wrap these APIs (`LocalTransactionProver`, `TransactionVerifier`, `ProgramExecutor`), see [Transaction Changes](./transaction-changes).

## Quick Fix

```rust
// Before (0.16)
let (outputs, proof) = prove_sync(
    &program, stack_inputs, advice_inputs, &mut host, exec_opts, ProvingOptions::new(hash_fn),
)?;
let security_level: u32 = verify(proof, claim)?;
let advice = AdviceInputs::default().with_advice_stack(stack);
let output = execute_sync(&program, stack_inputs, advice, &mut host, exec_opts)?;

// After (0.17)
let prover = Prover::new().with_hash_fn(hash_fn);
let (outputs, proof) = prove_sync(
    &prover, &program, stack_inputs, advice_inputs, &mut host, exec_opts,
)?;
let outcome = Verifier::new().verify(&claim, &proof)?;
if !outcome.is_complete() { /* the VM proof verified, but precompile work is not proven yet */ }
let advice = AdviceInputs::default().with_stack(stack);
let output = FastProcessor::new_with_options(stack_inputs, advice, exec_opts)
    .map_err(ExecutionError::advice_error_no_context)?
    .execute_sync(&program, &mut host)?;
```

Then set `miden-core` to `version = "0.35"` in every `miden-project.toml`, re-assemble every `.masp` package from source (the packages others link first), and regenerate every stored proof. Nothing from 0.16 converts.

If you encounter errors, continue reading for detailed migration steps.

---

## Summary

The VM changes fall into four groups. **Compatibility:** the package format moved to `7.0.0`, proofs became versioned and bound to the verifier's roots, and the core library's identity changes every release, so every artifact is rebuilt rather than migrated. **Proving and verification:** proving policy, including separate memory budgets for the VM and precompile proofs, moved into a `Prover` value, verification into `Verifier::verify(&claim, &proof)` returning a `VerificationOutcome`, and the partial-proof APIs were replaced by one deferred-precompile model. **Execution and advice:** the free `execute` functions are gone, `execute_trace_inputs*` became `execute_for_proving*`, `AdviceInputs` hides its fields, and the advice stack, map and Merkle store share one 16 MiB byte budget. **Packages and the core library:** `CoreLibrary` is one package, package digests became layered commitments, and the package readers changed their trust levels.

Most renames fail to compile. The dangerous changes do not: `Verifier::verify` returns `Ok` for a proof whose precompile work is still unproven, `Prover::prove` (unlike the old free `prove`) leaves that work deferred, the reported security level drops below 96 bits for tall traces (protocol 0.17 rejects those proofs), advice inputs and large traces that passed under 0.16 can fail the new budgets at run time, and `Package::read_from_bytes_trusted` no longer validates the MAST forest.

---

## Every package must be rebuilt: package format `7.0.0`

### Summary

`.masp` packages written by 0.16 (format `6.0.0`) are rejected: the 0.17 reader accepts exactly `7.0.0`, and package debug info moved from version `2` to `3`. The MAST forest wire format did not change (`[0, 0, 4]` in both), so a bare serialized `MastForest` still deserializes, but its roots may differ where core-library procedure bodies changed (see [MASM Changes](./masm-changes)).

Separately, the core library package (`miden-core`, namespace `miden::core`) is versioned with the VM, so its identity changes every release. Protocol 0.17.0 ships `miden-core` `0.35.0` (dependency commitment `0xdd25712ddf6939c3d5970b060c2c0f6dcb45d5bb15436739417820f5f0a82ec5`). A package that links it dynamically records the dependency's version and digest, and package-level resolution (the assembler, the package registry) only matches that exact build. A `miden-project.toml` that still asks for `miden-core` `0.29` fails dependency resolution: the 0.17 assembler cannot load a 0.29 build of the core library (it is a `6.0.0` package).

### Affected Code

```rust
// Any 0.16 package fails to load under 0.17:
let pkg = Package::read_from_bytes(&old_masp)?;
// Err: invalid value: unsupported version. Got '[6, 0, 0]', but only '[7, 0, 0]' is supported
```

```toml
# Before (0.16): miden-project.toml
[dependencies]
miden-core = { linkage = "dynamic", version = "0.29" }

# After (0.17)
[dependencies]
miden-core = { linkage = "dynamic", version = "0.35" }
```

### Migration Steps

1. Set the `miden-core` dependency in every `miden-project.toml` to `version = "0.35"`.
2. Re-assemble every `.masp` from source with the new VM (`miden-vm bundle`, the `Assembler`, or your build script). Go bottom-up through dynamically linked packages: a package records the dependency commitment of every package it links, so assemble and publish a dependency before the packages that link it.
3. Drop every persisted package produced by 0.16: databases, caches and registries. The client's bundled packages are covered in [Client Changes](./client-changes).
4. Make the VM version part of your package cache key. A package linked against one core-library build does not resolve against the next. At the MAST level, execution resolves external calls by procedure root, so calls into core procedures whose roots changed fail with `procedure with root digest ... could not be found`.
5. Rebuild statically linked packages too. They do not record a core-library dependency, but they are `6.0.0` packages like any other, and the core procedures they embed keep their 0.16 bodies until you rebuild.
6. If you built packages with a 0.17 release candidate (VM 0.33): they are `7.0.0` and still load, but a manifest at `version = "0.33"` fails resolution like a `0.29` one, and a project that depends on a package assembled against core `0.33` fails with `dependency resolution failed: ... depends on miden-core <digest> in =0.33.0 ...`. Re-assemble them bottom-up as well. Statically linked rc packages keep the 0.33 core bodies (including the old `aead::decrypt` overlap check, see [MASM Changes](./masm-changes)) until rebuilt.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `invalid value: unsupported version. Got '[6, 0, 0]', but only '[7, 0, 0]' is supported` | Package written by 0.16 | Re-assemble the package. |
| `dependency resolution failed: Because there is no version of miden-core in >= 0.29.0 and < 0.30.0 and <pkg> =<version> depends on miden-core >= 0.29.0 and < 0.30.0, <pkg> =<version> is forbidden.` | `miden-project.toml` still asks for `miden-core` `0.29` (`0.33` from an rc reads the same, with `0.33.0` / `0.34.0`) | Set `version = "0.35"`. |
| `dependency resolution failed: ... <dep> <digest> in =<version> depends on miden-core <digest> in =0.33.0 ...` | A dependency was assembled against a 0.17 release candidate's core library | Re-assemble the dependency, then its dependents. |
| `invalid value: unsupported debug_info version: 2, expected 3` | Standalone 0.16 debug-info bytes read with the `PackageDebugInfo` readers (a whole 0.16 package fails the package version check first) | Re-assemble the package. |
| `procedure with root digest <root> could not be found` | A call into a core-library procedure whose root changed | Re-assemble against the current core library. |

---

## 0.16 proofs do not decode

### Summary

`ExecutionProof` bytes are now versioned. They start with a format byte (`2` in 0.17) followed by the recursive VM and PVM (precompile VM) verifier roots the proof claims compatibility with, and the verifier accepts only its own release's roots. A 0.16 proof fails to decode because its first byte was a length prefix, not a format byte. No converter exists.

Proofs from a 0.17 release candidate (VM 0.33) still decode, because the format byte is still `2`, but VM 0.34 and 0.35 closed AIR soundness gaps that changed the VM and PVM verifier roots, so verification rejects them with `execution proof does not name a compatible VM verifier`.

### Affected Code

```rust
// Proof bytes serialized by 0.16:
let proof = ExecutionProof::read_from_bytes(&old_proof_bytes)?;
// Err: invalid value: unsupported execution proof format <n>
```

### Migration Steps

1. Discard every stored proof and queued proving job from 0.16 (and from a 0.17 release candidate), and regenerate the proofs with the new VM.
2. Upgrade clients, remote provers and nodes together. A remote prover must run the same VM version as the node that verifies its output.
3. Do not hard-code `miden_core::proof::CURRENT_VM_VERIFIER_ROOT` / `CURRENT_PVM_VERIFIER_ROOT`, `miden_air::config::RELATION_DIGEST`, or recursive-verifier MAST roots across releases. They change with the VM version.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `invalid value: unsupported execution proof format {format}` | Proof bytes from VM 0.29 to 0.32 (0.16 included) | Regenerate the proof with the current VM. |
| `execution proof does not name a compatible VM verifier` | Proof from VM 0.33 (a 0.17 release candidate): it decodes, but names verifier roots that 0.35 no longer accepts | Regenerate the proof with the current VM. |

---

## `Verifier::verify(&claim, &proof)` replaces the free `verify`

### Summary

`miden_verifier::verify` and `miden_vm::verify` are gone. `Verifier::verify` now takes `(&ExecutionClaim, &ExecutionProof)`, claim first and both borrowed, and returns a `#[must_use]` `VerificationOutcome` that carries the authenticated `ProofSecurityParameters` and any precompile root still outstanding. A caller-side minimum-security check becomes `Verifier::with_min_conjectured_security_level_per_stark`. `verify_partial`, `with_max_deferred_elements` and `Unsettled` are removed.

### Affected Code

```rust
// Before (0.16)
use miden_verifier::{ExecutionClaim, verify};

let claim = ExecutionClaim::from_program_info(program_info, stack_inputs, stack_outputs);
let security_level: u32 = verify(proof.clone(), claim)?; // by value, proof first
if security_level < 96 {
    return Err(/* insufficient security */);
}
```

```rust
// After (0.17)
use miden_verifier::{ExecutionClaim, VerificationError, Verifier};

let claim = ExecutionClaim::from_program_info(program_info, stack_inputs, stack_outputs);
let outcome = Verifier::new()
    .with_min_conjectured_security_level_per_stark(96) // optional; rejects with InsufficientSecurityLevel
    .verify(&claim, &proof)?;                           // claim first, both borrowed

let vm_bits: u32 = outcome.vm_security_parameters().conjectured_security_level();
if !outcome.is_complete() {
    // The VM STARK verified, but the precompile work it authenticates is not proven yet.
    let pending_root = outcome.outstanding_precompile_root().expect("incomplete outcome has a root");
    // Settle it (prove and attach a PrecompileProof, or verify a batch proof with
    // `Verifier::verify_precompile`), or reject.
}
```

| v0.16 | v0.17 |
| --- | --- |
| `miden_verifier::verify(proof, claim) -> Result<u32, _>` / `miden_vm::verify(..)` | `Verifier::new().verify(&claim, &proof) -> Result<VerificationOutcome, _>` |
| `Verifier::verify(&self, proof, claim) -> u32` | `Verifier::verify(&self, &claim, &proof) -> VerificationOutcome` |
| `Verifier::verify_partial(proof, claim) -> (u32, Unsettled)` | `Verifier::verify` (accepts deferred proofs; see `outstanding_precompile_root()`) |
| `Unsettled::root()` / `into_state()` | `VerificationOutcome::outstanding_precompile_root()` |
| `Verifier::with_max_deferred_elements(n)` | Removed; the limit is the fixed `miden_core::deferred::MAX_DEFERRED_ELEMENTS` |
| Caller compares the returned `u32` | `Verifier::with_min_conjectured_security_level_per_stark(bits)` and/or `outcome.vm_security_parameters().conjectured_security_level()` |
| n/a | `Verifier::verify_precompile(&PrecompileProof, expected_root) -> ProofSecurityParameters`, `Verifier::proof_compatibility()` |

`Verifier` is no longer `Copy`, `PartialEq` or `Eq`; it holds an `Arc` of the canonical precompile registry. Clone it if you stored it by value.

`VerificationError` is now `#[non_exhaustive]`. `DeferredIntegrity`, `DeferredStarkVerification` and `UnsupportedDeferredProof` were removed. The new variants are `InsufficientSecurityLevel`, `UnsupportedProofFormat`, `IncompatibleVmVerifier`, `IncompatiblePvmVerifier`, `DeferredTrueRoot`, `DeferredWitnessRootMismatch`, `DeferredWitnessEvaluation`, `EmptyPrecompileRoots`, `TooManyPrecompileRoots`, `SettledPrecompileRoot`, `UnexpectedPrecompileProof`, `MissingPrecompileProof`, `InsufficientPrecompileRootCoverage` and `PrecompileStarkVerification`. `StarkVerificationError` is unchanged.

### Migration Steps

1. Replace `verify(proof, claim)` and `miden_vm::verify(..)` with `Verifier::new().verify(&claim, &proof)`. Swap the argument order and pass references; the `proof.clone()` is no longer needed.
2. Replace the returned `u32` with the `VerificationOutcome`. Move a minimum-security check into `.with_min_conjectured_security_level_per_stark(min)`, or read `outcome.vm_security_parameters().conjectured_security_level()`.
3. Decide what an incomplete outcome means for you, and check `outcome.is_complete()` before treating a proof as fully verified (see [`Ok` no longer means fully proven](#ok-no-longer-means-fully-proven)).
4. Replace `verify_partial` + `Unsettled` with `verify` + `outstanding_precompile_root()`, and delete `with_max_deferred_elements` calls.
5. Add a wildcard arm to every `match` on `VerificationError`, and drop the removed variants.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `error[E0432]: unresolved import` naming `miden_verifier::verify` or `miden_verifier::Unsettled` | Free function and `Unsettled` removed | `Verifier::new().verify(&claim, &proof)`. |
| `error[E0308]: mismatched types` on the arguments of `Verifier::verify` | Order is now `(&claim, &proof)`, both borrowed | Swap and borrow. |
| `error[E0308]: mismatched types`, expected `u32`, found `VerificationOutcome` | Return type changed | Use the outcome's accessors. |
| `error[E0599]: no method named` `verify_partial` / `with_max_deferred_elements` | Removed | See the mapping above. |
| `error[E0004]: non-exhaustive patterns` on `VerificationError` | Enum is `#[non_exhaustive]` | Add `_ =>`. |
| `conjectured security level is {actual} bits, below the required {required} bits` | The minimum set with `with_min_conjectured_security_level_per_stark` was not met | See [the security-level section](#security-level-is-computed-per-proof-and-can-fall-below-96-bits). |

:::note Changelog correction
The changelog says "`verify` and `Verifier::verify` now borrow the proof and the claim". In the shipped code there is no free `verify` at all, and `Verifier::verify` takes the claim first; no changelog entry mentions the argument-order swap. The 0.16 version of this guide taught `verify(proof, claim)`, `verify_partial` and `Unsettled`; none of them exist in 0.17.
:::

---

## `Ok` no longer means fully proven

:::warning Silent behaviour change
Nothing here fails to compile. Code that treats `Verifier::verify` returning `Ok` as "fully verified", or that switches from `prove_sync` to `Prover::prove` expecting the same proof, accepts or produces proofs whose precompile work is not proven.
:::

### Summary

Two changes combine:

- **`Verifier::verify` accepts deferred proofs.** In 0.16 it rejected a proof carrying unproven precompile work with `UnsupportedDeferredProof`. Now it verifies the VM STARK, evaluates the carried `PrecompileWitness` natively (Keccak, ECDSA and so on, bounded by `MAX_DEFERRED_ELEMENTS`), checks the result against the root the VM proof authenticates, and returns `Ok`. The precompile STARK is still missing: `outcome.is_complete()` is `false` and `outstanding_precompile_root()` is `Some`.
- **`Prover::prove` behaves like the old `prove_partial`.** Whenever the program logged precompile calls, it returns a proof whose `precompile()` is `PrecompileStatus::Deferred`, carrying the full witness. `Prover::prove_full` and the free `prove_sync` behave like the old `prove` / `prove_sync` and prove everything. `Prover::prove_vm_witness` errors if the witness has precompile work.

Transaction proofs from protocol 0.17's `LocalTransactionProver` are deferred by design, because batches settle their precompile claims (see [Transaction Changes](./transaction-changes)).

### Affected Code

| You want | v0.16 | v0.17 |
| --- | --- | --- |
| A self-contained proof | `prove(..).await` / `prove_sync(..)` | `Prover::prove_full(witness)` / `prove_sync(&prover, ..)` |
| The VM proof now, the precompile proof later | `prove_partial` / `prove_partial_sync` | `Prover::prove(witness)` |
| A VM proof for a witness with no precompile work | n/a | `Prover::prove_vm_witness(VmWitness)` |

### Migration Steps

1. After every `verify`, check `outcome.is_complete()`. If you require fully settled proofs, reject incomplete outcomes; otherwise record `outstanding_precompile_root()` and settle it, for example with `Verifier::verify_precompile` against a batch `PrecompileProof`.
2. Use `prove_full` (or `prove_sync`) where you called the old `prove` / `prove_sync` and expect a self-contained proof. Use `prove` only when something downstream settles the deferred work.
3. Budget verifier CPU for native precompile evaluation on deferred proofs.
4. If scripts run `miden-vm verify`: an incomplete proof still exits non-zero, but now reports `Program proof is valid but incomplete; ...` instead of the 0.16 unsupported-deferred-proof error.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `VM witness contains deferred precompile work` | `prove_vm_witness` called on a witness that logged precompile calls | Use `prove` or `prove_full` on the full `ExecutionWitness`. |
| `Program proof is valid but incomplete; outstanding precompile root: {root}` | `miden-vm verify` on a proof with outstanding precompile work | Complete the precompile proof first. |

---

## `ProvingOptions` and the free proving functions replaced by `Prover`

### Summary

Proving policy moved from a `ProvingOptions` argument into a `Prover` value. `prove_sync` now takes `&Prover` as its first argument and drops the trailing options argument. The async `prove`, the partial-proof functions and the trace-input entry points are gone: execute with `FastProcessor::execute_for_proving[_sync]` and hand the resulting `ExecutionWitness` to a `Prover` method instead.

### Affected Code

```rust
// Before (0.16)
use miden_prover::{ExecutionOptions, HashFunction, ProvingOptions, prove_sync};

let (stack_outputs, proof) = prove_sync(
    &program,
    stack_inputs,
    advice_inputs,
    &mut host,
    ExecutionOptions::default(),
    ProvingOptions::new(HashFunction::Poseidon2),
)?;
```

```rust
// After (0.17): same arity, different first and last arguments
use miden_prover::{ExecutionOptions, HashFunction, Prover, prove_sync};

let prover = Prover::new().with_hash_fn(HashFunction::Poseidon2);
let (stack_outputs, proof) = prove_sync(
    &prover,
    &program,
    stack_inputs,
    advice_inputs,
    &mut host,
    ExecutionOptions::default(),
)?; // Result<(StackOutputs, ExecutionProof), ExecutionError>, as before
```

Replacing the async `prove`, `prove_partial*` and `prove_from_trace_sync` (execute first, then prove the witness). This is the pattern `miden-tx`'s `LocalTransactionProver` follows in protocol 0.17 (it calls `prove`, leaving precompile work deferred):

```rust
// After (0.17)
use miden_processor::{ExecutionError, FastProcessor};
use miden_prover::{ExecutionOptions, HashFunction, Prover};

let processor =
    FastProcessor::new_with_options(stack_inputs, advice_inputs, ExecutionOptions::default())
        .map_err(ExecutionError::advice_error_no_context)?;
let witness = processor.execute_for_proving_sync(&program, &mut host)?;
// async host: processor.execute_for_proving(&program, &mut host).await?
let claim = witness.claim();                 // ExecutionClaim, keep it for verification
let stack_outputs = *claim.stack_outputs();

let prover = Prover::new().with_hash_fn(HashFunction::Poseidon2);
let proof = prover.prove_full(witness)?;     // VM STARK + precompile STARK (was `prove`)
// let proof = prover.prove(witness)?;       // VM STARK only, precompile work left deferred (was `prove_partial`)
```

The complete mapping:

| v0.16 | v0.17 |
| --- | --- |
| `ProvingOptions::new(hash_fn)` / `ProvingOptions::default()` / `with_96_bit_security(hash_fn)` | `Prover::new().with_hash_fn(hash_fn)` / `Prover::new()` (the default is still `Blake3_256`) |
| `prove_sync(&program, si, ai, &mut host, exec_opts, proving_opts)` | `prove_sync(&prover, &program, si, ai, &mut host, exec_opts)` (proves precompiles too) |
| `prove(&program, si, ai, &mut host, exec_opts, proving_opts).await` | `FastProcessor::execute_for_proving(..).await`, then `Prover::prove_full(witness)` |
| `prove_partial` / `prove_partial_sync` | `execute_for_proving[_sync]`, then `Prover::prove(witness)` |
| `prove_from_trace_sync(TraceProvingInputs::new(trace_inputs, opts))` / `prove_partial_from_trace_sync` | `Prover::prove_full(witness)` / `Prover::prove(witness)` on an `ExecutionWitness` |
| n/a | `Prover::prove_vm_witness(VmWitness)`, `Prover::prove_precompiles(Vec<PrecompileWitness>)` |
| Trace-row cap only (2^29 rows) | 2^29 cap kept, plus memory budgets: `Prover::with_max_prover_memory_bytes(u64)` for the VM proof and `with_max_precompile_prover_memory_bytes(u64)` for precompile proofs, both 64 GiB by default |
| `ProvingOptions::hash_fn()` | No getter on `Prover`; keep the `HashFunction` yourself if you read it back |
| `miden_prover::prove_stark` (public) | Private; no replacement |
| Errors: `ExecutionError` only | `Prover` methods return `ProverError` (`#[non_exhaustive]`); `prove_sync` still returns `ExecutionError` |

Removed from the `miden_prover` re-exports: `ProvingOptions`, `TraceProvingInputs`, `DeferredProof`, `TraceBuildInputs`, `TraceGenerationContext`. Added: `Prover`, `ProverError`, `ExecutionClaim`, `ExecutionWitness`, `VmWitness`, `PrecompileWitness`, `PrecompileProof`, `PrecompileStatus`, `VmProof`. The `miden_vm` facade lost `ProvingOptions`, `TraceProvingInputs`, `prove` and `prove_from_trace_sync` the same way. Protocol users see this as `miden_tx::ProvingOptions` → `miden_tx::Prover`, and `LocalTransactionProver::new`, `LocalBatchProver::new` and `LocalBlockProver::new` now take a `Prover` (see [Transaction Changes](./transaction-changes)).

### Migration Steps

1. Replace `ProvingOptions::new(hash_fn)` with `Prover::new().with_hash_fn(hash_fn)`, and keep the `Prover` wherever you kept the options (it is `Clone` and `Default`).
2. In every `prove_sync` call, move the prover to the first argument as `&prover` and delete the trailing `ProvingOptions` argument.
3. Replace `prove(..).await`, `prove_partial*` and `prove_from_trace_sync` with `execute_for_proving[_sync]` followed by `prove_full` (everything proven) or `prove` (VM only, precompile work deferred).
4. Take the `ExecutionClaim` from `witness.claim()` before handing the witness to the prover. The prover consumes the witness, and you need the claim to verify.
5. Handle `ProverError` from the `Prover` methods. Its variants are `VmWitnessHasPrecompiles`, `TraceGeneration`, `VmProofGeneration` and `PrecompileProofGeneration`; match with a wildcard arm because the enum is `#[non_exhaustive]`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `error[E0432]: unresolved import` naming `miden_prover::ProvingOptions` (also `TraceProvingInputs`, `prove_from_trace_sync`, `prove_partial_sync`) | Removed | Use `Prover` and the witness-based methods. |
| `error[E0308]: mismatched types` on the first argument of `prove_sync` | It now expects `&Prover`, not `&Program` | Pass `&prover` first and drop the trailing options. |
| `` error[E0425]: cannot find function `prove` in crate `miden_prover` `` | Async `prove` removed | `execute_for_proving(..).await`, then `Prover::prove_full`. |

:::note Changelog correction
The changelog names only `prove_partial*` as removed. The shipped code also removes the async `prove`, `ProvingOptions`, `TraceProvingInputs`, `prove_from_trace_sync`, `DeferredProof` and the public `prove_stark`, and changes the shape of `prove_sync`. The 0.16 version of this guide said `prove` and `prove_sync` kept their signatures and introduced `prove_partial*`; that no longer holds.
:::

---

## Prover memory budget added on top of the trace-row cap

### Summary

0.16 capped the trace at 2^29 rows (`build_trace_with_max_len` could set a lower cap). That hard cap remains, and trace building now also enforces a prover memory budget, set on the `Prover` (default 64 GiB). The budget adds row caps of its own, checked while the trace is built, and then an exact memory check:

- **Core rows:** the raw core-trace buffer may hold at most the budget divided by 408 bytes per row (168,429,109 rows at 64 GiB, a program of about 168 million cycles).
- **Chiplet rows:** the chiplet trace (hasher, bitwise, memory, ACE and kernel ROM rows together) may hold at most the budget divided by 4,820 bytes per row, the per-row cost of the cheapest AIR (14,257,152 rows at 64 GiB).
- **Exact model:** once the padded per-AIR heights are known, and before the trace is padded and proven, the modelled peak prover memory must fit the budget. The model charges 8,510 bytes per Core row alone and 12,650 bytes per row when all three AIRs share a height, so the default admits a Core AIR padded to 2^22 rows but not 2^23 (2^23 x 8,510 bytes is about 71.4 GB, over 64 GiB).

The row caps fail with `ExecutionError::TraceLenExceeded`, the same error as the 2^29 cap, so a program whose chiplet trace outgrows 14,257,152 rows (heavy hashing, Merkle, memory or bitwise work) reports `trace length exceeded the maximum of 14257152 rows` at the default budget, not a memory estimate. Only the exact model fails with `ExecutionError::ProverMemoryExceeded`. `Prover` methods wrap either error as `failed to materialize VM execution trace: ...`; `prove_sync` returns it unwrapped. **Large proofs that worked under 0.16 can fail by default.**

Precompile proofs have a budget of their own, also 64 GiB by default: `Prover::with_max_precompile_prover_memory_bytes(u64)` (default `Prover::DEFAULT_MAX_PRECOMPILE_PROVER_MEMORY_BYTES`, read back with `max_precompile_prover_memory_bytes()`). `prove_precompiles`, and `prove_full` / `prove_sync` on a program that logged precompile calls, check the modelled peak memory of the precompile STARK against it before building its traces, and fail with `estimated precompile prover memory of {estimated_bytes} bytes exceeds the budget of {budget_bytes} bytes` (wrapped as `failed to prove precompile witness: ...` by `Prover` methods, `failed to generate STARK proof: ...` by `prove_sync`). The free `miden_precompiles_prover::prove_precompiles` applies the default; `prove_precompiles_with_budget` takes the budget explicitly. The `miden-vm` CLI's `--max-prover-memory` sets only the VM budget.

### Affected Code

```rust
// After (0.17)
let prover = Prover::new()
    .with_hash_fn(HashFunction::Poseidon2)
    .with_max_prover_memory_bytes(128 << 30)               // default: Prover::DEFAULT_MAX_PROVER_MEMORY_BYTES (64 GiB)
    .with_max_precompile_prover_memory_bytes(128 << 30);   // default: Prover::DEFAULT_MAX_PRECOMPILE_PROVER_MEMORY_BYTES (64 GiB)

// Without a Prover:
let proof = miden_precompiles_prover::prove_precompiles_with_budget(witnesses, hash_fn, 128 << 30)?;
```

```bash
# miden-vm CLI: run and prove take the same budget (default 64 GiB; K/M/G and Ki/Mi/Gi suffixes)
miden-vm prove program.masm --max-prover-memory 32Gi
```

### Migration Steps

1. If you prove programs whose Core trace pads to 2^23 rows or more, or whose chiplet trace exceeds 14,257,152 rows, raise the budget with `Prover::with_max_prover_memory_bytes` and make sure the host has that memory. Both derived row caps scale with the budget.
2. If you prove large precompile batches (`prove_precompiles` over many witnesses, or a single execution with heavy Keccak or ECDSA work), raise `with_max_precompile_prover_memory_bytes` the same way.
3. Size remote-prover machines against the budgets you configure.
4. Where you handle an oversized trace, match both `ExecutionError::TraceLenExceeded` and `ExecutionError::ProverMemoryExceeded`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `trace length exceeded the maximum of {N} rows` | A row cap (`ExecutionError::TraceLenExceeded`). At the default budget, `N` is `14257152` for a chiplet-heavy trace and `168429109` for a program of about 168 million cycles; `536870912` is the 2^29 hard cap, reached only with a budget of 204 GiB or more | Raise the budget or split the workload. |
| `estimated prover memory of {estimated_bytes} bytes exceeds the budget of {budget_bytes} bytes` | Every row cap passed, but the modelled peak for the padded heights is over budget, for example a Core trace padded to 2^23 rows at the default (`ExecutionError::ProverMemoryExceeded`) | Raise the budget or shrink the program. |
| `estimated precompile prover memory of {estimated_bytes} bytes exceeds the budget of {budget_bytes} bytes` | The precompile STARK's modelled peak is over the precompile budget (`PrecompileProvingError::MemoryBudgetExceeded`) | Raise `with_max_precompile_prover_memory_bytes`, or split the batch. |

:::note Changelog correction
The changelog says the prover's trace-row cap was "replaced" with a memory budget. The shipped code keeps the 2^29 cap and adds the budget, which derives further row caps of its own. Some upstream descriptions of this change also name `ExecutionOptions::max_prover_memory_bytes`. No such method exists in any release: the budget is `Prover::with_max_prover_memory_bytes` (CLI `--max-prover-memory`), plus an explicit `max_prover_memory_bytes: u64` argument on `execute_and_build_trace_sync` and `build_trace_with_budget`.
:::

---

## Security level is computed per proof and can fall below 96 bits

### Summary

0.16 reported a hard-coded 96 bits for every proof. The verifier now derives the conjectured level from the proof's authenticated parameters, including the tallest AIR's trace height and the kernel size. With the deployed parameters (27 queries, 17 query-PoW bits, 12 DEEP-PoW bits, 4 folding-PoW bits, blowup 8), the lookup term binds from a height of 2^23 up: it is 96.02 bits at 2^23 and loses one bit per doubling, so a proof whose tallest AIR exceeds 2^23 rows reports 95 bits or less, and 2^29 reports 90. The precompile (PVM) STARK crosses earlier: 96 bits at 2^19, 95 at 2^20 and 91 at 2^24.

The minimum set with `with_min_conjectured_security_level_per_stark` applies to each STARK separately, including standalone `verify_precompile` calls. Protocol 0.17's `TransactionVerifier::new(level)` and `BatchVerifier::new(level)` enforce the level you pass on each STARK, and the node passes `MIN_PROOF_SECURITY_LEVEL = 96`, so **such proofs are rejected**.

### Migration Steps

1. Keep proven programs' tallest AIR at or below 2^23 rows (and precompile batches' tallest chiplet AIR at or below 2^19 rows) if they must meet a 96-bit minimum.
2. Stop treating the reported level as a constant; read it from `VerificationOutcome::vm_security_parameters()`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `conjectured security level is {actual} bits, below the required {required} bits` | Trace taller than 2^23 rows verified with a 96-bit minimum | Split the workload, or lower the minimum deliberately. |

---

## Free `execute()` / `execute_sync()` removed: execute through `FastProcessor`

### Summary

`miden_processor::execute`, `miden_processor::execute_sync` and their `miden_vm` re-exports were deleted. Construct a `FastProcessor` with `new_with_options(stack_inputs, advice_inputs, options)` and call `execute(&program, &mut host)` (async) or `execute_sync(&program, &mut host)` on it. Host construction is unchanged, and `ExecutionOutput` changes only its deferred-state field (see [below](#executionoutputdeferred_state--precompile_witness-the-deferred-element-limit-is-fixed)). Generic code can use the new `ProgramExecutor` trait, which the `miden_vm` facade now re-exports.

### Affected Code

```rust
// Before (0.16)
use miden_processor::{DefaultHost, ExecutionOptions, StackInputs, advice::AdviceInputs, execute_sync};

let program = Assembler::default()
    .assemble_program("program", "begin push.3 push.5 add swap drop end")?
    .unwrap_program();
let mut host = DefaultHost::default().with_library(&CoreLibrary::default())?;

let output = execute_sync(
    &program,
    StackInputs::default(),
    AdviceInputs::default(),
    &mut host,
    ExecutionOptions::default(),
)?;
let top = output.stack.get_element(0); // Option<Felt>
```

```rust
// After (0.17); `program` and `host` are built exactly as before
use miden_processor::{
    DefaultHost, ExecutionError, ExecutionOptions, FastProcessor, StackInputs, advice::AdviceInputs,
};

let output = FastProcessor::new_with_options(
    StackInputs::default(),
    AdviceInputs::default(),
    ExecutionOptions::default(),
)
.map_err(ExecutionError::advice_error_no_context)? // new_with_options returns AdviceError
.execute_sync(&program, &mut host)?;                // or .execute(&program, &mut host).await?
let top = output.stack.get_element(0);
```

The package-debug-info variants on `FastProcessor` (`execute_with_package_debug_info_sync`, `execute_with_package_debug_info_at_source_node_sync`) exist unchanged; only the free functions went away.

### Migration Steps

1. Replace `execute_sync(&program, stack, advice, &mut host, options)` with `FastProcessor::new_with_options(stack, advice, options)?.execute_sync(&program, &mut host)`, and the async `execute(..).await` the same way.
2. `new_with_options` returns `Result<FastProcessor, AdviceError>`. There is no `From<AdviceError> for ExecutionError`, so convert with `.map_err(ExecutionError::advice_error_no_context)` if your function returns `ExecutionError` (the free function did this conversion internally).
3. Drop `execute` / `execute_sync` from your `use miden_vm::{..}` and `use miden_processor::{..}` lists.

:::caution Calling `ProgramExecutor` on a concrete `FastProcessor`
Two method-resolution traps. To call the trait's constructor, write `<FastProcessor as ProgramExecutor>::new(..)`: the inherent one-argument `FastProcessor::new(stack_inputs)` shadows it. After `.with_debug_info(..)`, call `ProgramExecutor::execute(processor, &program, &mut host)`, not `processor.execute(..)`: the inherent `FastProcessor::execute` wins method resolution and ignores the stored debug info.
:::

`miden_tx::ProgramExecutor` is now a re-export of this VM trait, with a fallible `new` and debug info supplied through `with_debug_info` / `with_entrypoint_source_node`; custom transaction executors are covered in [Transaction Changes](./transaction-changes).

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0432]: unresolved import `miden_processor::execute_sync` `` | Free function removed | `FastProcessor::new_with_options(..)?.execute_sync(..)`. |
| `` error[E0432]: unresolved import `miden_vm::execute` `` | Facade re-export removed | Use `miden_vm::FastProcessor`. |
| `` error[E0277]: `?` couldn't convert the error to `ExecutionError` `` | `new_with_options` returns `AdviceError` | `.map_err(ExecutionError::advice_error_no_context)?`. |

---

## `execute_trace_inputs*` → `execute_for_proving*`

### Summary

The `FastProcessor` methods that execute and keep the replay data for proving were renamed from `execute_trace_inputs*` to `execute_for_proving*`, and now return an `ExecutionWitness` instead of `TraceBuildInputs`. Trace building takes the witness's `VmWitness` half and returns a `VmTrace` (was `ExecutionTrace`). The row-cap parameter of `build_trace_with_max_len` was replaced by a prover memory budget in bytes; the 2^29 hard cap still applies.

### Affected Code

```rust
// Before (0.16)
let trace_inputs = processor.execute_trace_inputs_sync(&program, &mut host)?;
let outputs = trace_inputs.stack_outputs();

// alternatives; each consumes its input, and the last one replaces the execute call above
let trace: ExecutionTrace = miden_processor::trace::build_trace(trace_inputs)?;
let trace = miden_processor::trace::build_trace_with_max_len(trace_inputs, max_rows)?;
let trace = processor.execute_and_build_trace_sync(&program, &mut host)?;
```

```rust
// After (0.17)
let witness = processor.execute_for_proving_sync(&program, &mut host)?;
let outputs = *witness.claim().stack_outputs();

let (vm_witness, precompile_witness) = witness.into_parts();
// alternatives; each consumes its input, and the last one replaces the execute call above
let trace: VmTrace = miden_processor::trace::build_trace(vm_witness)?;
let trace = miden_processor::trace::build_trace_with_budget(vm_witness, max_prover_memory_bytes)?;
let (trace, precompile_witness) = processor.execute_and_build_trace_sync(
    &program,
    &mut host,
    miden_processor::trace::DEFAULT_MAX_PROVER_MEMORY_BYTES, // 64 GiB
)?;
```

| v0.16 | v0.17 |
| --- | --- |
| `FastProcessor::execute_trace_inputs_sync` / `execute_trace_inputs` | `execute_for_proving_sync` / `execute_for_proving` |
| `execute_trace_inputs_with_package_debug_info[_at_source_node]_sync` | `execute_for_proving_with_package_debug_info[_at_source_node]_sync` |
| Returns `TraceBuildInputs` | Returns `ExecutionWitness` (`claim()`, `has_precompiles()`, `into_parts() -> (VmWitness, Option<PrecompileWitness>)`) |
| `trace::build_trace(TraceBuildInputs) -> ExecutionTrace` | `trace::build_trace(VmWitness) -> VmTrace` |
| `trace::build_trace_with_max_len(inputs, max_trace_len: usize)` | `trace::build_trace_with_budget(witness, max_prover_memory_bytes: u64)` |
| `execute_and_build_trace_sync(program, host) -> ExecutionTrace` | `execute_and_build_trace_sync(program, host, max_prover_memory_bytes: u64) -> (VmTrace, Option<PrecompileWitness>)` |
| `miden_processor::{TraceBuildInputs, TraceGenerationContext}`, `miden_vm::trace::ExecutionTrace` | `miden_processor::{ExecutionWitness, VmWitness, PrecompileWitness}`, `miden_vm::trace::VmTrace` |

### Migration Steps

1. Rename `execute_trace_inputs*` calls to `execute_for_proving*`.
2. Read public outputs through `witness.claim().stack_outputs()` instead of `trace_inputs.stack_outputs()`.
3. To build a trace yourself, split the witness with `into_parts()` and pass the `VmWitness` to `trace::build_trace` or `trace::build_trace_with_budget`.
4. Pass a memory budget as the third argument of `execute_and_build_trace_sync` (`trace::DEFAULT_MAX_PROVER_MEMORY_BYTES` for the default) and destructure its tuple result.
5. Rename `ExecutionTrace` to `VmTrace`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0599]: no method named `execute_trace_inputs_sync` found for struct `FastProcessor` `` | Renamed | `execute_for_proving_sync`. |
| `` error[E0432]: unresolved import `miden_processor::TraceBuildInputs` `` | Replaced | `ExecutionWitness` / `VmWitness`. |
| `error[E0061]: this method takes 3 arguments but 2 arguments were supplied` on `execute_and_build_trace_sync` | New budget parameter | Pass `trace::DEFAULT_MAX_PROVER_MEMORY_BYTES` or your own budget. |

---

## `ExecutionOutput.deferred_state` → `precompile_witness`; the deferred-element limit is fixed

### Summary

The public `deferred_state: DeferredState` field of `ExecutionOutput` was replaced by `precompile_witness: Option<PrecompileWitness>`, plus a `precompile_root()` helper that returns the carried deferred root, or `TRUE_DIGEST` when no precompile work happened. The execution-time deferred-state budget is no longer configurable: `ExecutionOptions::with_max_deferred_elements`, `max_deferred_elements()` and `ExecutionOptions::DEFAULT_MAX_DEFERRED_ELEMENTS` were removed, and the limit is the fixed `miden_core::deferred::MAX_DEFERRED_ELEMENTS` (2^20, the old default).

### Affected Code

```rust
// Before (0.16)
let ExecutionOutput { stack, advice, memory, deferred_state } = output;
let options = ExecutionOptions::default().with_max_deferred_elements(n);
use miden_core::deferred::DEFAULT_MAX_DEFERRED_ELEMENTS;
```

```rust
// After (0.17)
let root = output.precompile_root(); // does not validate the witness computations
let ExecutionOutput { stack, advice, memory, precompile_witness } = output;
let options = ExecutionOptions::default(); // no deferred-state knob
use miden_core::deferred::MAX_DEFERRED_ELEMENTS; // fixed 2^20
```

### Migration Steps

1. Replace reads of `output.deferred_state` with `output.precompile_witness` (an `Option`) or `output.precompile_root()`, and update struct patterns that destructure `ExecutionOutput`.
2. Delete `with_max_deferred_elements(..)` calls. There is no replacement.
3. Rename `miden_core::deferred::DEFAULT_MAX_DEFERRED_ELEMENTS` to `MAX_DEFERRED_ELEMENTS`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0609]: no field `deferred_state` on type `ExecutionOutput` `` | Field replaced | Use `precompile_witness` or `precompile_root()`. |
| `` error[E0599]: no method named `with_max_deferred_elements` found for struct `ExecutionOptions` `` | Knob removed | Delete the call. |

---

## Advice limits collapse into one 16 MiB byte budget

### Summary

The fixed advice stack cap, the advice map value and element limits, and the Merkle store node limit were replaced by one limit on the combined logical size, in bytes, of the advice stack, map and Merkle store. The default is 16 MiB. The four limit-specific `AdviceError` variants became one `SizeBudgetExceeded { current, added, max }`.

This also changes what runs. The Merkle store tightens most: 2^20 internal nodes before, about 174,500 now if nothing else is in the provider. Large advice stacks and single large map values that used to fail now pass. **Advice inputs that ran under 0.16 can fail the budget in 0.17.**

| Part | v0.16 limit | v0.17 (16 MiB shared, default) |
| --- | --- | --- |
| Advice stack | 131,072 elements (fixed `MAX_ADVICE_STACK_SIZE`) | 8 bytes per element; about 2,094,000 elements if alone |
| Advice map | 2^20 elements total (4 per key + value length), 131,072 per value | 32 bytes per key + 8 per value element; no per-value cap |
| Merkle store | 2^20 internal nodes (255 built in) | 96 bytes per internal node; about 174,500 nodes if alone |
| Combined | No combined limit | Stack + map + store must fit together |

The budget covers everything that enters the provider during execution: the initial `AdviceInputs`, host `AdviceMutation`s, `adv.insert_mem` and similar system-event inserts, Merkle updates, and the advice maps of the program's MAST forest and of forests loaded for external calls. Popping advice stack elements frees budget. An empty provider already holds 255 built-in empty-subtree nodes (24,480 bytes), so a budget below that fails even with empty inputs.

### Affected Code

```rust
// Before (0.16)
use miden_processor::{ExecutionOptions, advice::{AdviceError, MAX_ADVICE_STACK_SIZE}};

let options = ExecutionOptions::default()
    .with_max_adv_map_value_size(1 << 18)
    .with_max_adv_map_elements(1 << 21)
    .with_max_merkle_store_nodes(1 << 21);

match err {
    AdviceError::StackSizeExceeded { push_count, max } => { /* .. */ },
    AdviceError::AdvMapValueSizeExceeded { size, max } => { /* .. */ },
    AdviceError::AdvMapElementBudgetExceeded { current, added, max } => { /* .. */ },
    AdviceError::MerkleStoreNodeBudgetExceeded { current, added, max } => { /* .. */ },
    _ => { /* .. */ },
}
```

```rust
// After (0.17)
use miden_processor::{ExecutionOptions, advice::AdviceError};

let options = ExecutionOptions::default()
    .with_max_advice_size_bytes(64 * 1024 * 1024); // default: ExecutionOptions::DEFAULT_MAX_ADVICE_SIZE_BYTES (16 MiB)

match err {
    AdviceError::SizeBudgetExceeded { current, added, max } => { /* all values in bytes */ },
    _ => { /* .. */ },
}
```

| v0.16 | v0.17 |
| --- | --- |
| `ExecutionOptions::with_max_adv_map_value_size(usize)` / `max_adv_map_value_size()` | Removed; use `with_max_advice_size_bytes(usize)` |
| `ExecutionOptions::with_max_adv_map_elements(usize)` / `max_adv_map_elements()` | Removed; use `with_max_advice_size_bytes(usize)` |
| `ExecutionOptions::with_max_merkle_store_nodes(usize)` / `max_merkle_store_nodes()` | Removed; use `with_max_advice_size_bytes(usize)` |
| `ExecutionOptions::DEFAULT_MAX_ADV_MAP_VALUE_SIZE`, `DEFAULT_MAX_ADV_MAP_ELEMENTS`, `DEFAULT_MAX_MERKLE_STORE_NODES` | `ExecutionOptions::DEFAULT_MAX_ADVICE_SIZE_BYTES` (16 MiB) |
| `miden_processor::advice::MAX_ADVICE_STACK_SIZE` (2^17 elements, not configurable) | Removed; the stack counts toward the byte budget |
| `AdviceError::{StackSizeExceeded, AdvMapValueSizeExceeded, AdvMapElementBudgetExceeded, MerkleStoreNodeBudgetExceeded}` | `AdviceError::SizeBudgetExceeded { current, added, max }` |
| (none) | `ExecutionOptions::max_advice_size_bytes()` |

`ExecutionOptions::max_memory_elements` is unchanged.

### Migration Steps

1. Estimate the advice size of your largest workload: 8 bytes per stack element and per map value element, 32 bytes per map key, 96 bytes per Merkle store internal node.
2. Replace the `with_max_adv_map_*` / `with_max_merkle_store_nodes` calls with one `with_max_advice_size_bytes(bytes)` sized for the sum of stack, map and store. If your workload approaches 16 MiB, pass the raised options to `FastProcessor::new_with_options`, and to the protocol executors that take `ExecutionOptions` (`TransactionExecutor`, `LocalTransactionProver::with_execution_options`, `BatchExecutor::with_execution_options`).
3. Delete uses of `MAX_ADVICE_STACK_SIZE`.
4. Collapse matches on the four removed `AdviceError` variants into `AdviceError::SizeBudgetExceeded`. `AdviceError` is not `#[non_exhaustive]`, so exhaustive matches must be updated.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0599]: no method named `with_max_adv_map_elements` found for struct `ExecutionOptions` `` | Replaced by the byte budget | `with_max_advice_size_bytes(bytes)`. |
| `` error[E0599]: no method named `with_max_merkle_store_nodes` found for struct `ExecutionOptions` `` | Replaced by the byte budget | `with_max_advice_size_bytes(bytes)`. |
| `` error[E0432]: unresolved import `miden_processor::advice::MAX_ADVICE_STACK_SIZE` `` | Constant removed | Delete it. |
| `` error[E0599]: no variant named `StackSizeExceeded` found for enum `AdviceError` `` | Variants merged | Match `SizeBudgetExceeded`. |
| `advice provider size budget exceeded: adding {added} bytes to the current {current} bytes would exceed the maximum of {max} bytes` | Run time: stack + map + store exceed the budget | Shrink the advice inputs or raise `with_max_advice_size_bytes`. |

:::note Changelog and 0.16-guide correction
The changelog announces a 4 MiB default; a second change in the same release raised it to 16 MiB, so no release shipped with 4 MiB. The 0.16 version of this guide described the advice map as bounded by field-element count and the Merkle store by node count; both limits are gone.
:::

---

## `AdviceInputs` fields are private; `with_advice_stack` → `with_stack`

:::caution The 0.16 guide taught the old names
The 0.16 version of this guide taught `with_advice_stack(AdviceStack)` and `advice_stack()`, and said `AdviceInputs::map` and `AdviceInputs::store` "remain public fields". In 0.17 the methods are `with_stack` and `stack()`, and all three fields are private. The changelog mentions only the new `AdviceInputs::new` constructor and `From<AdviceMap>` impl; the renames and the private fields appear in no changelog entry.
:::

### Summary

`AdviceInputs` no longer exposes public fields. Read the parts through `stack()`, `map()` and `store()`, build them with `new(stack, map, store)`, `From<AdviceMap>` or the `with_*` builders, and merge extra entries with `extend()`.

### Affected Code

The before/after below is the protocol repo's own migration of `TransactionInputs::with_asset_witnesses`.

```rust
// Before (0.16)
for witness in witnesses {
    self.advice_inputs.store.extend(witness.authenticated_nodes());
    let smt_proof = SmtProof::from(witness);
    self.advice_inputs.map.extend([(
        smt_proof.leaf().hash(),
        smt_proof.leaf().to_elements().collect::<Arc<[Felt]>>(),
    )]);
}

let mut advice_inputs = AdviceInputs::default().with_merkle_store(merkle_store);
advice_inputs.map = advice_map;
let advice_inputs = advice_inputs.with_advice_stack(stack);
let stack: AdviceStack = advice_inputs.advice_stack();
let path = advice_inputs.store.get_path(root, index)?;
```

```rust
// After (0.17)
for witness in witnesses {
    let leaf = witness.proof().leaf();
    let witness_inputs = AdviceInputs::default()
        .with_merkle_store(witness.authenticated_nodes().collect())
        .with_map([(leaf.hash(), leaf.to_elements().collect())]);
    self.advice_inputs.extend(witness_inputs);
}

let advice_inputs = AdviceInputs::from(advice_map)      // new: From<AdviceMap>
    .with_merkle_store(merkle_store)
    .with_stack(stack);                                  // was with_advice_stack
// or all at once:
let advice_inputs = AdviceInputs::new(stack, advice_map, merkle_store);

let stack: AdviceStack = advice_inputs.stack();          // was advice_stack(); still returns a clone
let path = advice_inputs.store().get_path(root, index)?; // was .store
let map: &AdviceMap = advice_inputs.map();               // was .map
```

| v0.16 | v0.17 |
| --- | --- |
| `AdviceInputs::default().with_advice_stack(stack)` | `AdviceInputs::default().with_stack(stack)` |
| `inputs.advice_stack()` | `inputs.stack()` |
| `inputs.map` (read) | `inputs.map()` → `&AdviceMap` |
| `inputs.store` (read) | `inputs.store()` → `&MerkleStore` |
| `inputs.map = m` | `AdviceInputs::from(m)` or `AdviceInputs::new(stack, m, store)` |
| `inputs.map.extend(iter)` / `inputs.map.insert(k, v)` | `inputs.extend(AdviceInputs::default().with_map(iter))`, or `inputs = inputs.with_map([(k, v)])` |
| `inputs.store.extend(nodes)` | `inputs.extend(AdviceInputs::default().with_merkle_store(nodes.collect()))` |
| (none) | `AdviceInputs::new(stack, map, store)` |

`with_map`, `with_merkle_store`, `extend` and `into_parts` keep their 0.16 signatures.

### Migration Steps

1. Rename `with_advice_stack(..)` to `with_stack(..)` and `advice_stack()` to `stack()`.
2. Replace field reads `inputs.map` / `inputs.store` with `inputs.map()` / `inputs.store()`.
3. Replace field assignments with a constructor: `AdviceInputs::from(map)`, `AdviceInputs::new(stack, map, store)`, or the `with_*` builders.
4. Replace in-place mutation of `map` / `store` with `inputs.extend(AdviceInputs::default().with_map(..))` or `.with_merkle_store(nodes.collect())`. `MerkleStore` implements `FromIterator<InnerNodeInfo>`.
5. Mind the builder asymmetry: `with_map` extends the existing map, while `with_merkle_store` and `with_stack` replace the existing store and stack. To add to a store, use `extend`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0599]: no method named `with_advice_stack` found for struct `AdviceInputs` `` | Renamed | Use `with_stack`. |
| `` error[E0599]: no method named `advice_stack` found for struct `AdviceInputs` `` | Renamed | Use `stack()`. |
| `` error[E0616]: field `map` of struct `AdviceInputs` is private `` | Field made private | Use `map()` to read; `with_map`, `extend` or `From<AdviceMap>` to write. |
| `` error[E0616]: field `store` of struct `AdviceInputs` is private `` | Field made private | Use `store()` to read; `with_merkle_store` or `extend` to write. |

---

## `AdviceMutation` fields renamed; host mutations apply all or nothing

### Summary

`AdviceMutation::ExtendMap { other }` is now `ExtendMap { map }`, and `ExtendMerkleStore { infos }` is now `ExtendMerkleStore { inner_nodes }`. The constructor functions keep their names. A new `AdviceMutation::extend_advice_stack_with(impl IntoIterator<Item = Felt>)` removes the need to build an `AdviceStack` for small handler replies; elements are ordered from the top of the stack down.

The mutations an event handler returns are now validated as a batch, against the advice budget and for map-key conflicts, before any is applied. If one would fail, none is applied. In 0.16 they were applied one by one, so earlier mutations stayed applied when a later one failed; code that relied on that partial application must not.

### Affected Code

Real migration from the protocol's `TransactionAdviceInputs::into_advice_mutations` and a `miden-tx` event handler:

```rust
// Before (0.16)
[
    AdviceMutation::ExtendMap { other: map },
    AdviceMutation::ExtendMerkleStore { infos: store.inner_nodes().collect() },
    AdviceMutation::ExtendStack { stack },
]

vec![AdviceMutation::extend_advice_stack([note_idx, is_found].into_iter().collect())]
```

```rust
// After (0.17)
[
    AdviceMutation::extend_map(map),                          // or ExtendMap { map }
    AdviceMutation::extend_merkle_store(store.inner_nodes()), // or ExtendMerkleStore { inner_nodes }
    AdviceMutation::extend_advice_stack(stack),
]

vec![AdviceMutation::extend_advice_stack_with([note_idx, is_found])]
```

### Migration Steps

1. Rename `other:` to `map:` and `infos:` to `inner_nodes:` in every `AdviceMutation` literal and pattern, or switch to the constructor functions (`extend_map`, `extend_merkle_store`, `extend_advice_stack`), whose names did not change.
2. Optionally replace `extend_advice_stack(iter.into_iter().collect())` with `extend_advice_stack_with(iter)`. The result is identical.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0559]: variant `AdviceMutation::ExtendMap` has no field named `other` `` | Field renamed | Use `map`. |
| `` error[E0559]: variant `AdviceMutation::ExtendMerkleStore` has no field named `infos` `` | Field renamed | Use `inner_nodes`. |
| `` error[E0026]: variant `ExtendMap` does not have a field named `other` `` | Same, in a pattern | Use `map`. |

---

## `CoreLibrary` is a single package

### Summary

The `miden-precompiles` MASM package was folded into `miden-core`, so `CoreLibrary` now wraps exactly one `Package`. The two-package accessors are gone, and `CoreLibrary` no longer implements `AsRef<Package>`. `mast_forest()` keeps its signature and returns the core package's forest, which now contains the precompile procedures. `recursive_verifier_root()` was renamed `vm_recursive_verifier_root()`, following the MASM rename of `sys::vm::verify_vm_proof` to `verify_proof` (see [MASM Changes](./masm-changes)). `miden_protocol::CoreLibrary` re-exports this type, so code that reaches it through `miden-protocol` is affected the same way.

### Affected Code

```rust
// Before (0.16): the protocol's build.rs and transaction MAST store
let mut store = InMemoryPackageRegistry::default();
for package in CoreLibrary::default().packages() {
    store.cache_package(package).into_diagnostic()?;
}

for package in CoreLibrary::default().packages() {
    mast_store.insert_package(package.as_ref());
}

// Any caller:
let verifier_root = CoreLibrary::default().recursive_verifier_root();
```

```rust
// After (0.17)
let mut store = InMemoryPackageRegistry::default();
store.cache_package(CoreLibrary::default().package()).into_diagnostic()?;

mast_store.insert_package(CoreLibrary::default().package().as_ref());

// Any caller:
let verifier_root = CoreLibrary::default().vm_recursive_verifier_root();
let inputs = RecursiveVerifierInputs::for_request(verifier_root, &proof, &claim); // unchanged signature

// New
let pvm_root = CoreLibrary::default().pvm_recursive_verifier_root();
let estimator_root = CoreLibrary::default().conjectured_security_estimator_root();
let event = miden_core_lib::PVM_PROOF_REQUEST_EVENT_NAME; // no default handler is registered
```

| v0.16 | v0.17 |
| --- | --- |
| `CoreLibrary::packages() -> [Arc<Package>; 2]` | `CoreLibrary::package() -> Arc<Package>` |
| `CoreLibrary::package()` (the core package only) | Same signature; now the single package, precompile procedures included |
| `CoreLibrary::precompiles_package() -> Arc<Package>` | Removed; the precompiles are inside `package()` |
| `CoreLibrary::PRECOMPILES_SERIALIZED` | Removed; `CoreLibrary::SERIALIZED` is the only embedded package |
| `impl AsRef<Package> for CoreLibrary` | Removed; use `core_lib.package()` (an `Arc<Package>`) |
| `CoreLibrary::mast_forest()` (merged core + precompiles forest) | Unchanged signature; the core package's forest |
| `CoreLibrary::recursive_verifier_root()` | `vm_recursive_verifier_root()` |
| n/a | `pvm_recursive_verifier_root()`, `conjectured_security_estimator_root()` (also a free function in `miden_core_lib`), `miden_core_lib::PVM_PROOF_REQUEST_EVENT_NAME` |
| `CoreLibrary::handlers()` | Unchanged signature; also registers the ECDSA recovery handler |
| `impl From<&CoreLibrary> for HostLibrary` | Unchanged, so `host.load_library(&core_lib)` still works |

`RecursiveVerifierInputs::for_request(verifier_root, &proof, &claim)` keeps its signature; only the root you pass changes. Its error enum `RecursiveVerifierInputsError` lost the `DeferredIntegrity` variant.

### Migration Steps

1. Replace `core_lib.packages()` loops with a single `core_lib.package()`.
2. Delete uses of `precompiles_package()` and `CoreLibrary::PRECOMPILES_SERIALIZED`.
3. Replace `core_lib.as_ref()` (or passing `&core_lib` where `impl AsRef<Package>` is expected) with `core_lib.package()`.
4. Rename `recursive_verifier_root()` to `vm_recursive_verifier_root()`, and never cache the value across upgrades: the root changes with the VM version.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0599]: no method named `packages` found for struct `CoreLibrary` `` | Method removed | Use `package()`. |
| `` error[E0599]: no method named `precompiles_package` found for struct `CoreLibrary` `` | Method removed | Delete; use `package()`. |
| `` error[E0599]: no associated item named `PRECOMPILES_SERIALIZED` found for struct `CoreLibrary` `` | Constant removed | Use `SERIALIZED`. |
| `error[E0599]` on `.as_ref()`, or `error[E0277]` where `CoreLibrary: AsRef<Package>` is required | `AsRef<Package>` impl removed | Pass `core_lib.package()`. |
| `` error[E0599]: no method named `recursive_verifier_root` found for struct `CoreLibrary` `` | Renamed | Use `vm_recursive_verifier_root()`. |

:::note Changelog correction
The changelog tells users to "remove any references to `miden-precompiles` and use `miden-core` instead". That holds for the MASM package only: the `miden-precompiles` Rust crate still exists and `miden-core-lib` depends on it. The entry also omits the removed `CoreLibrary` API. The 0.16 version of this guide taught the `packages()` loop, `precompiles_package()` and `PRECOMPILES_SERIALIZED`.
:::

---

## `Package::digest()` replaced by layered commitments

### Summary

`Package::digest()`, `interface_digest()` and `content_digest()` were removed. The package now exposes six commitments, and the dependency digest recorded by `to_dependency()` (and used for registry pins) is now `dependency_commitment()` rather than the MAST forest commitment.

### Affected Code

```rust
// Before (0.16)
let mast: Word = package.digest();                 // MAST forest commitment
let iface: Word = package.interface_digest()?;
let content: Word = package.content_digest();
```

```rust
// After (0.17)
let mast: Word = package.mast_forest_commitment(); // same value as the old digest()
let iface: Word = package.interface_commitment()?;
let dep: Word = package.dependency_commitment();   // replaces content_digest(); used by to_dependency()
let code: Word = package.code_commitment();        // interface + MAST forest
let artifacts: Word = package.artifacts_commitment();
let whole: Word = package.commitment();            // code + artifacts
```

| v0.16 | v0.17 |
| --- | --- |
| `Package::digest()` | `Package::mast_forest_commitment()` (same value) |
| `Package::interface_digest()` | `Package::interface_commitment()` |
| `Package::content_digest()` | `Package::dependency_commitment()` (new preimage, new value) |
| n/a | `code_commitment()`, `artifacts_commitment()`, `commitment()` |
| `to_dependency().digest` = MAST forest commitment | `to_dependency().digest` = `dependency_commitment()` |

### Migration Steps

1. Rename `digest()` to `mast_forest_commitment()` where you want the old value; use `commitment()` if you want an identifier for the whole package (the protocol's own test of `AccountComponentCode` moved from `.digest()` to `.commitment()`).
2. Rename `interface_digest()` to `interface_commitment()` and `content_digest()` to `dependency_commitment()`.
3. Recompute any stored package digests and any exact `semver#digest` dependency pins in `miden-project.toml`: the digest a registry records is now `dependency_commitment()`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0599]: no method named `digest` found `` for `Package` | Removed | `mast_forest_commitment()` or `commitment()`. |
| `` error[E0599]: no method named `content_digest` found `` | Renamed | `dependency_commitment()`. |

---

## Package readers: `*_unchecked` removed, `*_trusted` now skips validation

:::warning Silent behaviour change
`Package::read_from_bytes_trusted` still compiles, but it no longer validates the MAST forest. Code that used it for bytes from outside its own system now accepts unvalidated packages.
:::

### Summary

The three trust levels from 0.16 collapsed to two. `Package::read_from_unchecked` / `read_from_bytes_unchecked` are gone. `read_from_trusted` / `read_from_bytes_trusted` take over their meaning: they skip MAST and manifest validation and trust serialized node digests. The untrusted `read_from` / `read_from_bytes` now validate package debug info and keep it (0.16 dropped it).

### Affected Code

```rust
// Before (0.16): three trust levels
Package::read_from_bytes(bytes)?            // untrusted: validates MAST, drops debug sections
Package::read_from_bytes_trusted(bytes)?    // local cache: validates MAST, keeps debug sections
Package::read_from_bytes_unchecked(bytes)?  // skips MAST validation
```

```rust
// After (0.17): two trust levels
Package::read_from_bytes(bytes)?            // untrusted: validates MAST and debug info, keeps debug info
Package::read_from_bytes_trusted(bytes)?    // same-system bytes only: skips MAST/manifest validation
```

### Migration Steps

1. Replace `read_from_unchecked` / `read_from_bytes_unchecked` with `read_from_trusted` / `read_from_bytes_trusted`.
2. Audit every existing `read_from_bytes_trusted` call. If the bytes come from a user, a file you did not write, a registry or the network, switch to `read_from_bytes`.
3. Expect `read_from_bytes` to reject packages whose debug info is malformed or oversized (a debug payload over 16 MiB, more than 100,000 string rows, strings over 4 KiB, more than 1,000,000 type rows). In 0.16 the untrusted reader discarded that data, with only a log warning.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0599]: no function or associated item named `read_from_bytes_unchecked` found `` | Removed | `read_from_bytes_trusted`. |

:::note Changelog correction
The changelog does document this change, but files it under the old `v0.28.0` heading, although it first shipped in 0.30.0, so reading only the 0.30 to 0.35 sections misses it. That entry also says untrusted reads drop debug sections; a separate entry in the 0.30.0 section reversed that, and untrusted reads now validate and keep debug info. The 0.16 version of this guide described three trust levels, including `read_from_bytes_unchecked`.
:::

---

## `ExecutionProof` restructured around `VmProof` and `PrecompileStatus`

### Summary

`ExecutionProof` changed from `{ miden: StarkProof, deferred: DeferredProof }` into `{ compatibility: ExecutionProofCompatibility, vm: VmProof, precompile: PrecompileStatus }`. `DeferredProof` is replaced by `PrecompileStatus::{Empty, Deferred(PrecompileWitness), Proven(PrecompileProof)}`, and the VM part is a public-field `VmProof { proof: StarkProof, precompile_root }`. The proof no longer self-reports a security level.

### Affected Code

```rust
// Before (0.16)
use miden_core::proof::{DeferredProof, ExecutionProof, HashFunction, StarkProof};

let proof = ExecutionProof::from_bytes(&bytes)?;
let stark: &StarkProof = proof.miden_proof();
let done: bool = proof.is_final();
let level: u32 = proof.security_level();          // always 96
match proof.deferred_proof() {
    DeferredProof::Empty => {},
    DeferredProof::Wire(wire) => { /* partial */ },
    DeferredProof::Stark { proof, public_root } => {},
}
let placeholder = ExecutionProof::new_dummy();    // feature "testing"
```

```rust
// After (0.17)
use miden_core::deferred::TRUE_DIGEST;
use miden_core::proof::{
    ExecutionProof, HashFunction, PrecompileProof, PrecompileStatus, StarkProof, VmProof,
};

let proof = ExecutionProof::read_from_bytes(&bytes)?;   // also rejects trailing and non-canonical bytes
let stark: &StarkProof = &proof.vm().proof;
let authenticated_root = proof.vm().precompile_root;
match proof.precompile() {
    PrecompileStatus::Empty => {},
    PrecompileStatus::Deferred(witness) => { /* precompile work not proven yet */ },
    PrecompileStatus::Proven(PrecompileProof { proof, roots }) => {},
}
let has_work: bool = proof.has_precompiles();

// Placeholder that decodes but never verifies (replaces new_dummy)
let placeholder = ExecutionProof::new(
    VmProof {
        proof: StarkProof::new(Vec::new(), HashFunction::Blake3_256),
        precompile_root: TRUE_DIGEST,
    },
    PrecompileStatus::Empty,
);
```

| v0.16 | v0.17 |
| --- | --- |
| `ExecutionProof::new(miden: StarkProof, deferred: DeferredProof)` | `ExecutionProof::new(vm: VmProof, precompile: PrecompileStatus)` (stamps the current compatibility) |
| `ExecutionProof::from_parts(bytes, hash_fn, deferred)` | `ExecutionProof::new(VmProof { proof: StarkProof::new(bytes, hash_fn), precompile_root }, status)`; `from_parts` now takes `(ExecutionProofCompatibility, VmProof, PrecompileStatus)` |
| `proof.miden_proof()` | `&proof.vm().proof` |
| `proof.deferred_proof()` | `proof.precompile()` |
| `proof.is_final()` | Removed. Shape only: `!matches!(proof.precompile(), PrecompileStatus::Deferred(_))`. After verification: `outcome.is_complete()` |
| `proof.security_level()` | Removed; read `VerificationOutcome::vm_security_parameters()` |
| `ExecutionProof::from_bytes(&bytes)` | `ExecutionProof::read_from_bytes(&bytes)` |
| `proof.to_bytes()` | Unchanged |
| `ExecutionProof::new_dummy()` | Removed; build a placeholder as above |
| `DeferredProof::{Empty, Wire(DeferredStateWire), Stark { proof, public_root }}` | `PrecompileStatus::{Empty, Deferred(PrecompileWitness), Proven(PrecompileProof { proof, roots })}` |
| n/a | `proof.complete(PrecompileProof) -> Result<Self, ExecutionProofError>`, `proof.compatibility()`, `proof.into_parts()`, `proof.has_precompiles()` |
| `serde::{Serialize, Deserialize}` on `ExecutionProof`, `StarkProof`, `HashFunction` (feature `serde`) | Removed, along with the `serde` feature of `miden-core`. Use `to_bytes` / `read_from_bytes` |

`StarkProof` and `HashFunction` keep their constructors and accessors.

### Migration Steps

1. Replace `ExecutionProof::from_bytes` with `ExecutionProof::read_from_bytes`, and store the exact `to_bytes()` output.
2. Rewrite accessors per the table: `miden_proof()` → `&vm().proof`, `deferred_proof()` → `precompile()`, and replace `DeferredProof` matches with `PrecompileStatus` matches.
3. Delete `security_level()` calls and take the level from the `VerificationOutcome` instead.
4. Replace `ExecutionProof::new_dummy()` with an explicit placeholder built from `VmProof` and `PrecompileStatus::Empty`.
5. If you relied on serde for proofs, switch to the binary `to_bytes` / `read_from_bytes` encoding and remove `features = ["serde"]` on `miden-core`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `error[E0599]: no function or associated item named` `from_bytes` / `new_dummy` for `ExecutionProof` | Removed | `read_from_bytes`; an explicit placeholder. |
| `error[E0599]: no method named` `miden_proof` / `deferred_proof` / `is_final` / `security_level` | Removed | See the table. |
| `error[E0432]: unresolved import` naming `miden_core::proof::DeferredProof` | Replaced by `PrecompileStatus` | Import `PrecompileStatus`. |
| `the execution proof is already complete` | `complete()` called on a proof that is not `PrecompileStatus::Deferred` | Only complete deferred proofs. |
| `invalid value: versioned proof bytes are not canonically encoded` / `invalid value: extra bytes after versioned proof payload` | `read_from_bytes` got a non-canonical or padded encoding | Store the exact `to_bytes()` output. |

---

## Deferred precompile work travels as a `PrecompileWitness`

### Summary

Precompile work that a program logs (for example Keccak or ECDSA through `log_precompile`) is carried as one portable `PrecompileWitness` per execution. Proofs of that work are batched with `Prover::prove_precompiles(Vec<PrecompileWitness>)` and attached with `ExecutionProof::complete`, or checked with `Verifier::verify_precompile`. The configurable deferred-element budget is gone.

### Affected Code

```rust
// Before (0.16): partial proof, then hydrate the deferred state
use miden_prover::prove_partial_sync;
use miden_verifier::Verifier;

let (_outputs, proof) =
    prove_partial_sync(&program, stack_inputs, advice_inputs, &mut host, exec_opts, proving_opts)?;
let (_level, unsettled) = Verifier::new().with_max_deferred_elements(1 << 20).verify_partial(proof, claim)?;
let state = unsettled.into_state();
```

```rust
// After (0.17): VM proof now, precompile proof later (can be batched across executions)
use miden_prover::{HashFunction, PrecompileStatus, Prover};
use miden_verifier::Verifier;

let witness = processor.execute_for_proving_sync(&program, &mut host)?;
let claim = witness.claim();
let prover = Prover::new().with_hash_fn(HashFunction::Poseidon2);
let proof = prover.prove(witness)?;                     // VM STARK only

let pending = match proof.precompile() {
    PrecompileStatus::Deferred(witness) => Some(witness.clone()),
    _ => None,
};
let proof = match pending {
    Some(witness) => proof.complete(prover.prove_precompiles(vec![witness])?)?,
    None => proof,
};
assert!(Verifier::new().verify(&claim, &proof)?.is_complete());
```

| v0.16 | v0.17 |
| --- | --- |
| `miden_core::deferred::DeferredStateWire { entries }` | `miden_core::deferred::PrecompileWitness` (private fields; `from_entries`, `entries()`, `root_unchecked()`, `compute_root(registry)`) |
| `miden_core::deferred::WireEntry` | `miden_core::deferred::PrecompileWitnessEntry` |
| `miden_core::deferred::TRUE_INDEX` | Removed (index 0 is the implicit TRUE) |
| `DeferredState::new(registry, max_elements)` / `set_max_elements` | `DeferredState::new(registry)`; no per-state budget |
| `DeferredState::to_wire()` | `DeferredState::into_witness() -> Result<Option<PrecompileWitness>, IntegrityError>` |
| `DeferredState::from_wire(registry, &wire, max)` | `witness.compute_root(registry)` (evaluates and returns the root) |
| `miden_precompiles_prover::prove_deferred_state(&state, hash_fn) -> DeferredProof` | `Prover::prove_precompiles(witnesses)`, or `miden_precompiles_prover::prove_precompiles(witnesses, hash_fn) -> PrecompileProof` |
| `miden_precompiles_prover::verify_deferred(&DeferredProof) -> DeferredRoot` | `Verifier::verify_precompile(&proof, expected_root)`, or `miden_precompiles_verifier::verify_deferred(&StarkProof, root) -> ProofSecurityParameters` |

`miden-verifier` now depends on the new `miden-precompiles-verifier` crate instead of `miden-precompiles-prover`, so a verifier-only build no longer compiles prover code.

### Migration Steps

1. Replace `prove_partial*` + `verify_partial` with `Prover::prove` + `Verifier::verify`, and read the pending work from `PrecompileStatus::Deferred`.
2. To settle deferred work, call `Prover::prove_precompiles(vec![..])` with one or more witnesses (order and duplicates are preserved) and attach the result with `ExecutionProof::complete`, or verify a shared batch proof against each execution's root with `Verifier::verify_precompile`.
3. Rename `WireEntry` → `PrecompileWitnessEntry`, and drop the `max_elements` argument of `DeferredState::new`.
4. Move direct `miden_precompiles_prover::verify_deferred` calls to `miden_precompiles_verifier::verify_deferred`, which takes `(&StarkProof, DeferredRoot)`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `error[E0432]: unresolved import` naming `DeferredStateWire`, `WireEntry`, `TRUE_INDEX` or `DEFAULT_MAX_DEFERRED_ELEMENTS` | Renamed or removed | See the table; `DEFAULT_MAX_DEFERRED_ELEMENTS` is now `MAX_DEFERRED_ELEMENTS`. |
| `error[E0061]: this function takes 1 argument but 2 arguments were supplied` on `DeferredState::new` | Budget argument removed | `DeferredState::new(registry)`. |
| `deferred witness root does not match the VM obligation` | The carried witness does not recompute to the root the VM proof authenticates | Re-prove from the same execution. |

:::note Changelog correction
The changelog lists `DeferredStateWire`, `precompile_witness_from_wire`, `DeferredState::from_wire` and `PrecompileWitness::{new, roots, state}` as supported APIs. A later release in the same line removed all of them again, so a 0.16 → 0.17 migration never sees them. Likewise, the "deferred/complete `ExecutionProof` states" it describes became the `PrecompileStatus` struct field shown above.
:::

---

## Exhaustive matches on processor enums need new arms

### Summary

Several public enums that are not `#[non_exhaustive]` gained variants or fields. `ExecutionError` is `#[non_exhaustive]`, so its new `ProverMemoryExceeded` variant is not breaking.

| Type | Change |
| --- | --- |
| `miden_processor::operation::OperationError` | New `MerkleDepthOutOfRange { depth: Felt }` |
| `miden_processor::operation::OperationError` | New `InvalidHornerEvaluationPointWord { ctx: ContextId, addr: u64 }` |
| `miden_processor::advice::AdviceError` | Four limit variants replaced by `SizeBudgetExceeded` (see the advice budget section) |
| `miden_processor::Continuation::EnterForest` | New field `inline_context_depth: usize` |

### Affected Code

```rust
// Before (0.16)
Continuation::EnterForest { forest, package_debug_info } => { /* .. */ }
```

```rust
// After (0.17)
Continuation::EnterForest { forest, package_debug_info, .. } => { /* .. */ }
```

### Migration Steps

1. Add arms for the new variants (or a wildcard arm) to exhaustive matches on `OperationError`.
2. Add `..` to `Continuation::EnterForest { .. }` patterns, and supply `inline_context_depth` (0 for a top-level forest) where you construct it.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0004]: non-exhaustive patterns: `OperationError::InvalidHornerEvaluationPointWord { .. }` and `OperationError::MerkleDepthOutOfRange { .. }` not covered `` | New variant | Add an arm or a wildcard. |
| `` error[E0027]: pattern does not mention field `inline_context_depth` `` | New field on `EnterForest` | Add `..`. |
| `` error[E0063]: missing field `inline_context_depth` in initializer of `Continuation<_>` `` | New field on `EnterForest` | Supply the field. |

---

## Assembly AST and type API changes (tooling and compiler authors)

### Summary

Code that builds or matches `miden_assembly_syntax::ast` nodes breaks in several places. MASM authors are not affected by this section; the language-level changes are in [MASM Changes](./masm-changes).

| v0.16 | v0.17 |
| --- | --- |
| `Instruction::EmitImm(ImmFelt)` | `Instruction::EmitImm(EventImmediate)` (`EventImmediate::Immediate(ImmFelt)` or `::Name(Span<Arc<str>>)`) |
| n/a | New `Instruction::Trace`, `Instruction::TraceImm(EventImmediate)`, `Instruction::DebugInlineCall(DebugInlineCallInfo)`, `Instruction::DebugInlineCallClear` |
| `DebugVarLocation::FrameBase { global_index, byte_offset }`, `Expression(Vec<u8>)` | `ResolvedFrameBase { base: DebugFrameBase, byte_offset }`, `Expression(DebugLocationExpression)`, new `Unavailable` |
| `TypeResolver::get_type -> Result<Type, E>`, `get_local_type -> Result<Option<Type>, E>`, `TypeExpr::resolve_type` | `get_type` / `get_local_type` return `Result<Option<TypeTemplate>, E>`, new required `TypeResolver::finalize`, `TypeExpr::resolve_template`; use `TypeResolver::resolve` for a `Type` |
| `FunctionType { span, cc, args, results }` | New public field `arg_names: Vec<Option<Ident>>` (parameter names; equality and hashing ignore it). `FunctionType::new(..)` leaves it empty; set it with `with_arg_names(..)` |
| `ParsingError` (exhaustive) | `#[non_exhaustive]`. New `ControlFlowNestingDepthExceeded`, plus `ConstantExpressionNestingDepthExceeded` and `TypeExpressionNestingDepthExceeded` for nesting beyond 256 levels. Protocol-ABI attributes (`@account_procedure`, `@auth_script`, `@note_script`, `@transaction_script`) imply the component-model calling convention: two different ones report `ConflictingProtocolAbiAttribute`, and one with a conflicting `@callconv` reports `CallConvAttributeConflict` |
| `midenc_hir_type` 0.10 (`ast::types::*`) | 0.17: `Type::Variadic`, `CallConv::Extern(Arc<str>)`, MASM type names now include `u256` (the existing `Type::U256`), `Type::Struct(StructRef)` / `Type::Enum(EnumRef)` (read through `.get()`), structs over 255 fields rejected, `TypeRepr::BigEndian` removed |
| Constants and inline event names folded during semantic analysis | Kept in the AST and resolved at link time |

### Migration Steps

1. Add match arms for the new `Instruction` variants, and wrap `EmitImm` payloads in `EventImmediate::Immediate(..)`.
2. Update `DebugVarLocation` and `TypeResolver` implementations per the table.
3. Add `arg_names` to `FunctionType` struct literals (`Vec::new()` if you have no names, otherwise one entry per argument), or build with `FunctionType::new(..)`.
4. Add a wildcard arm to every `match` on `ParsingError`.
5. Tools that read resolved constant values from a parsed `Module` must now run the linker first.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `` error[E0063]: missing field `arg_names` in initializer of `FunctionType` `` | New field | Add `arg_names`, or use `FunctionType::new`. |
| `` error[E0004]: non-exhaustive patterns: `_` not covered `` on `ParsingError` | Enum is `#[non_exhaustive]` | Add `_ =>`. |
| `constant expression nesting depth exceeded` / `type expression nesting depth exceeded` | Constant or type expression nested more than 256 levels deep | Flatten the expression. |

---

## `miden-vm` CLI changes

### Summary

The subcommands are unchanged (`compile`, `bundle`, `prove`, `run`, `verify`). `run` and `prove` gained `--max-prover-memory <bytes>` (default 64 GiB; accepts `K` / `M` / `G` and `Ki` / `Mi` / `Gi` suffixes). `verify` now prints the security level, and reports a valid but incomplete proof as `Program proof is valid but incomplete; ...` (still a non-zero exit: 0.16 failed such a proof as an unsupported deferred proof). `prove` and `verify --kernel` check file extensions before reading any other file. The `bundle` fixes (`--version` validated as semver and stored in the package, `--release` stripping package debug info) shipped in 0.29.3, a 0.16-line patch release, so they are new to you only if your `miden-vm` CLI is 0.29.2 or older.

### Affected Code

```bash
# New: bound the estimated prover memory (default 64 GiB)
miden-vm prove program.masm --max-prover-memory 32Gi
miden-vm run   program.masm --max-prover-memory 512M

# verify output
# Before (0.16): Verification complete in 12 ms
# After (0.17):  Verification complete in 12 ms. Security level: 96 bits
# After, on an incomplete proof (non-zero exit, as in 0.16):
#   Program proof is valid but incomplete; outstanding precompile root: <root>

# bundle (since 0.29.3): --version is stored in the package and must be valid semver,
# --release strips debug info (MAST digests unchanged)
miden-vm bundle --version 1.2.0 --release ./src/mod.masm
```

### Migration Steps

1. If scripts parse `miden-vm verify` output, match the new `Verification complete in N ms. Security level: N bits` line and the new `Program proof is valid but incomplete` error text. The exit status on incomplete proofs stays non-zero.
2. If your `miden-vm` CLI is 0.29.2 or older and you bundled without `--version`, expect the output package to be version `0.1.0` (the flag's default), not `0.0.0`. Pass `--version` explicitly if a dependent resolves by version.
3. Tune `--max-prover-memory` for very large programs on `run` and `prove`.

### Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `Program proof is valid but incomplete; outstanding precompile root: {root}` | `verify` on a proof with outstanding precompile work | Complete the precompile proof first. |
| `trace length exceeded the maximum of {N} rows` | Trace over a row cap derived from `--max-prover-memory` (`14257152` chiplet rows at the default) | Raise the budget. |
| `estimated prover memory of {estimated_bytes} bytes exceeds the budget of {budget_bytes} bytes` | Padded trace within the row caps but its modelled peak over the `--max-prover-memory` budget | Raise the budget. |
| `` Kernel file `{path}` must have a .masm or .masp extension `` | `verify --kernel` with another extension (now checked first) | Fix the kernel path. |
| `The provided file must have a .masm or .masp extension` | `prove` on another extension (now checked before inputs load) | Fix the program path. |
| `invalid package version: {err}` | `bundle --version` is not semver (checked since 0.29.3) | Pass a valid version. |

---

## Other VM changes

- **`bound_into_included_u64` returns `Option<u64>`.** `miden_core::utils::bound_into_included_u64` returns `None` when an exclusive endpoint has no inclusive `u64` value, and an excluded start bound now maps to `x + 1` (it wrongly returned `x - 1` before). Handle the `None` (an empty range) at each call site, and re-check callers that pass `Bound::Excluded` as a start bound.

  ```rust
  // After (0.17)
  let Some(start) = bound_into_included_u64(range.start_bound(), true) else {
      return Vec::new(); // the range is empty
  };
  ```

- **Two-argument `conjectured_security_level` removed.** `miden_air::config::conjectured_security_level(num_queries, query_pow_bits)` (also reachable as `miden_prover::config::conjectured_security_level`) is gone. Read the verified value with `outcome.vm_security_parameters().conjectured_security_level()`, or call `miden_air::security::conjectured_security_level(num_queries, query_pow_bits, deep_pow_bits, folding_pow_bits, log_max_height, num_kernel_procedures)` with raw parameters. `miden_verifier` and `miden_vm` re-export `AirShape`, `InstanceShape`, `LookupShape`, `ProofSecurityParameters`, `ProtocolParams`, `SecurityReport` and `SecurityTerm`. Code written against a 0.17 release candidate (Plonky3 0.7) needs the Plonky3 0.8 shapes: `AirShape` gained `num_quotient_chunks` and its `lookup` became `Option<LookupShape>`, and `ProtocolParams` gained `ood_pow_bits`.
- **`AdviceMap` decoding rejects duplicate keys.** `AdviceMap::read_from_bytes`, and every decoder that embeds it such as `AdviceInputs`, fails with `invalid value: duplicate advice map key in serialized payload` where 0.16 silently kept the last value. `to_bytes` never writes a duplicate, so only hand-built or concatenated payloads are affected.
- **`miden-lifted-stark`: `ProverInstance` takes ownership.** `ProverInstance::new(config, prover_statement, preprocessed)` takes the `ProverStatement` by value, and `prove(self, challenger)` consumes the instance and returns `(StarkOutput, Statement)`. `prover_statement()` is gone; use `statement()` or `into_statement()`. Only direct users of the lifted STARK prover are affected.
- **Merkle depth must be 1 to 64 for MPVERIFY / MRUPDATE (`mtree_verify`, `mtree_get`, `mtree_set`).** Both operations now reject a depth of 0 or above 64 before they fetch a Merkle path from the advice provider, with `OperationError::MerkleDepthOutOfRange` (`Merkle tree depth must be in the range 1..=64, but was {depth}`). Because the check runs first, a rejected MRUPDATE no longer mutates the advice Merkle store. `mtree_verify` is a bare MPVERIFY, so it rejects any out-of-range depth this way. `mtree_get` and `mtree_set` first fetch the node from the advice provider: a depth of 0 on a root in the store reaches the depth check, but a depth above 64 fails that lookup first with `provided node index {index} is out of bounds for a merkle tree node at depth {depth}`. The path the advice provider returns must also have exactly `depth` nodes, or execution fails with `invalid crypto operation: Merkle path length {path_len} does not match expected depth {depth}`. MASM authors are affected too; see [MASM Changes](./masm-changes#instruction-and-core-library-behaviour-changes).
- **`FastProcessor` caches loaded MAST forests.** Within one execution, the first time an external call loads a MAST forest from the host, `FastProcessor` caches it under every procedure digest local to that forest and merges its advice map once. `MastForestStore::get` / `get_mast_forest` is therefore called less often: hosts that count or log lookups, or return a different forest for the same digest during one execution, see different behaviour. If two forests both contain a digest, the forest loaded first wins for the rest of the execution, including its package debug info.
- **Execution witnesses serialize for remote proving.** `ExecutionWitness` implements `Serializable`. `ExecutionWitness::read_from_bytes` treats input as untrusted: it applies a budget proportional to the input size and rejects trailing bytes (`invalid value: extra bytes after execution witness payload`), but it does not check the sparse MAST replay against a source forest. `read_from_bytes_trusted` is permissive and meant only for bytes you produced. Only wire version `2` is accepted.

---

## Common Errors

| Error Message | Cause | Solution |
| --- | --- | --- |
| `invalid value: unsupported version. Got '[6, 0, 0]', but only '[7, 0, 0]' is supported` | Package written by 0.16 | Re-assemble from source. |
| `dependency resolution failed: Because there is no version of miden-core in >= 0.29.0 and < 0.30.0 ...` | `miden-project.toml` still asks for `miden-core` `0.29` (or `0.33` from an rc) | Set `version = "0.35"` and re-assemble bottom-up. |
| `invalid value: unsupported execution proof format {format}` | Proof serialized by 0.16 | Regenerate the proof. |
| `execution proof does not name a compatible VM verifier` | Proof from a 0.17 release candidate (VM 0.33) | Regenerate the proof. |
| `procedure with root digest <root> could not be found` | Call into a core-library procedure whose root changed | Re-assemble against the current core library. |
| `error[E0432]: unresolved import` naming `miden_verifier::verify` | Free `verify` removed | `Verifier::new().verify(&claim, &proof)`. |
| `error[E0432]: unresolved import` naming `miden_prover::ProvingOptions` | Replaced by `Prover` | `Prover::new().with_hash_fn(..)`. |
| `error[E0308]: mismatched types` on the first argument of `prove_sync` | It now expects `&Prover` | Pass `&prover` first and drop the trailing options. |
| `` error[E0432]: unresolved import `miden_processor::execute_sync` `` | Free function removed | `FastProcessor::new_with_options(..)?.execute_sync(..)`. |
| `` error[E0599]: no method named `with_advice_stack` found for struct `AdviceInputs` `` | Renamed | `with_stack`. |
| `` error[E0616]: field `map` of struct `AdviceInputs` is private `` | Fields made private | `map()` / `store()` to read; constructors and `extend` to write. |
| `` error[E0599]: no method named `packages` found for struct `CoreLibrary` `` | Single package now | `package()`. |
| `` error[E0599]: no method named `execute_trace_inputs_sync` found for struct `FastProcessor` `` | Renamed | `execute_for_proving_sync`. |
| `advice provider size budget exceeded: adding {added} bytes to the current {current} bytes would exceed the maximum of {max} bytes` | Stack + map + store over the 16 MiB default | Trim the advice or raise `with_max_advice_size_bytes`. |
| `trace length exceeded the maximum of 14257152 rows` | Chiplet trace over the row cap the 64 GiB default budget derives (other caps print other numbers; see [the memory-budget section](#prover-memory-budget-added-on-top-of-the-trace-row-cap)) | `Prover::with_max_prover_memory_bytes` or `--max-prover-memory`. |
| `estimated prover memory of {estimated_bytes} bytes exceeds the budget of {budget_bytes} bytes` | Padded trace within the row caps but its modelled peak over the 64 GiB default, for example a Core trace padded to 2^23 rows | `Prover::with_max_prover_memory_bytes` or `--max-prover-memory`. |
| `estimated precompile prover memory of {estimated_bytes} bytes exceeds the budget of {budget_bytes} bytes` | Precompile proof over its separate 64 GiB default | `Prover::with_max_precompile_prover_memory_bytes`, or a smaller batch. |
| `invalid value: duplicate advice map key in serialized payload` | Serialized `AdviceMap` repeats a key (0.16 kept the last value) | Write each key once. |
| `conjectured security level is {actual} bits, below the required {required} bits` | Trace taller than 2^23 rows verified with a 96-bit minimum | Split the workload. |
| `Program proof is valid but incomplete; outstanding precompile root: {root}` | Proof with outstanding precompile work | Complete the precompile proof first. |
| `Merkle tree depth must be in the range 1..=64, but was {depth}` | MPVERIFY / MRUPDATE with depth 0 or above 64: `mtree_verify` with either, `mtree_get` / `mtree_set` with depth 0 | Use a depth in `1..=64`. |
| `provided node index {index} is out of bounds for a merkle tree node at depth {depth}` | `mtree_get` / `mtree_set` with a depth above 64 (the advice lookup runs before the depth check) | Use a depth in `1..=64`. |
