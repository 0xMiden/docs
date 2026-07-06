---
title: TypeScript SDK
sidebar_position: 3
---

# TypeScript Multisig SDK

The `@openzeppelin/miden-multisig-client` package provides a high-level TypeScript SDK for private multisig workflows on Miden. It supports multiple signer types including external wallets.

**Package**: [`@openzeppelin/miden-multisig-client`](https://www.npmjs.com/package/@openzeppelin/miden-multisig-client)
**Source**: [`packages/miden-multisig-client`](https://github.com/OpenZeppelin/guardian/tree/main/packages/miden-multisig-client)

## Installation

```bash
npm install @openzeppelin/miden-multisig-client @miden-sdk/miden-sdk
```

## Setup

```typescript
import { MultisigClient, FalconSigner } from '@openzeppelin/miden-multisig-client';
import { MidenClient, AuthSecretKey } from '@miden-sdk/miden-sdk';

// Initialize the Miden SDK client
const midenClient = await MidenClient.createTestnet();

// Create a Falcon signer
const secretKey = AuthSecretKey.rpoFalconWithRNG(undefined);
const signer = new FalconSigner(secretKey);

// Create the multisig client and fetch Guardian info
const client = new MultisigClient(midenClient, {
  psmEndpoint: 'http://localhost:3000',
});
const { psmCommitment } = await client.initialize();
```

:::note
The multisig client accepts any `MidenClient` instance, so `createTestnet()` / `createDevnet()` / `create({ rpcUrl })` all work. See the [Web SDK setup guide](../tools/clients/web-client/setup.md) for the full factory list.
:::

## Creating a multisig account

```typescript
const config = {
  threshold: 2,
  signerCommitments: [signer.commitment, otherSignerCommitment],
  psmCommitment,
  signatureScheme: 'falcon',
};

const multisig = await client.create(config, signer);
console.log('Account ID:', multisig.accountId);

// Register on Guardian
await multisig.registerOnPsm();
```

## Loading an existing account

```typescript
// Configuration is auto-detected from onchain storage
const multisig = await client.load(accountId, signer);
```

## Syncing state

Fetch proposals, state, notes, and config in a single call:

```typescript
const { proposals, state, notes, config } = await multisig.syncAll();
```

## Creating and executing proposals

```typescript
// Send payment
const { proposal } = await multisig.createSendProposal(recipientId, faucetId, amount);

// Sign a proposal
await multisig.signTransactionProposal(proposal.commitment);

// Execute when ready
if (proposal.status.type === 'ready') {
  await multisig.executeTransactionProposal(proposal.commitment);
}
```

Other proposal types:

```typescript
await multisig.createConsumeNotesProposal(noteIds);
await multisig.createAddSignerProposal(newCommitment, { newThreshold: 3 });
await multisig.createRemoveSignerProposal(signerToRemove);
await multisig.createChangeThresholdProposal(3);
await multisig.createSwitchPsmProposal(newEndpoint, newPubkey);
```

## External wallet integration

For browser wallets where the signing key is external:

```typescript
// Sign the commitment with an external wallet
const signature = await wallet.sign(proposal.commitment);

// Submit the external signature
await multisig.signTransactionProposalExternal({
  commitment: proposal.commitment,
  signature,
  publicKey: wallet.publicKey,
  scheme: 'ecdsa',
});
```

### Wallet signers

```typescript
import { ParaSigner, MidenWalletSigner } from '@openzeppelin/miden-multisig-client';

// Para wallet integration
const signer = new ParaSigner(paraContext, walletId, commitment, publicKey);

// Miden wallet integration
const signer = new MidenWalletSigner(walletContext, commitment, 'ecdsa');
```

## Offline workflows

Export and import proposals for side-channel signing:

```typescript
// Export a proposal as JSON
const json = multisig.exportTransactionProposalToJson(proposal.commitment);

// Sign offline
const signedJson = multisig.signTransactionProposalOffline(proposal.commitment);

// Import on another device
const { proposal: imported } = multisig.importTransactionProposal(json);
```

## Full reference

See the [`packages/miden-multisig-client/README.md`](https://github.com/OpenZeppelin/guardian/tree/main/packages/miden-multisig-client) for the complete API reference.
