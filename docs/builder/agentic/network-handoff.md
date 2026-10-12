---
title: "Prepare a network handoff"
description: "Carry explicit configuration and evidence from local validation to the target network."
---

# Prepare a network handoff

Prepare this record after the [verification gates](verify.md). Use the existing [Network guide](../tools/network.md) for current endpoint discovery and [Deploy your first contract](../get-started/your-first-smart-contract/deploy.md) for the client flow. Confirm compatibility before using a hosted service.

| Handoff field | Record |
| --- | --- |
| Source | Repository and submodule commits, lockfiles, compatibility tuple, rebuilt packages |
| Target | Local node, devnet or testnet; chain/genesis identity and RPC endpoint |
| Services | Matching prover and, for private notes, transport endpoint and delivery behavior |
| Accounts | Account IDs, authentication/signing design, registration/admission requirements |
| State | Separate store and keystore locations; existing state to preserve |
| Funding | Test asset, faucet, recipient and returned note ID; consumption and resulting balance still need checks |
| Execution scope | Actions authorized to create state, prove, sign and submit; who will execute them |
| Success | Expected state, transaction/note IDs, publication and consumption commitments, browser assertion |
| Failure | Bounded waits, status checks before retries and unresolved gates |

Use test assets for the counter demonstration. Inspect its authentication from source: the public counter example is unauthenticated and is not a production authorization design. If your application adds a wallet signer, private notes or account upgrades, verify those paths independently.

A successful faucet request is an intermediate result. Preserve its note ID, synchronize, consume where required, and check committed balances or state. A funding wait, browser launch or completed build does not establish network success.

Template PR #24 implements an explicit `testnet` stage, gated on integration into your checkout and `MIDEN_ALLOW_TESTNET=1`. Inspect its binary and configuration before authorizing submission. Its hosted testnet/browser flow remains unverified; the successful root `local` stage uses a separate fee-free disposable chain and does not establish admission, funding or hosted service compatibility. Never reuse the local fixture keys for a hosted network. No automatic deployment or network handoff is supplied here.

Ask the agent to return the completed handoff record with each open gate and the next executable check. Do not label the app deployed until the selected network's commitments and final assertions have been observed.
