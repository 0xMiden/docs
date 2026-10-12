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

The guided-flow draft proposes an explicit testnet stage, but the published template must be checked for its available client binaries and configuration before executing them. No generic deployment command or automatic network handoff is supplied here.

Ask the agent to return the completed handoff record with each open gate and the next executable check. Do not label the app deployed until the selected network's commitments and final assertions have been observed.
