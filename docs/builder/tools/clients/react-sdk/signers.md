---
title: External signers
sidebar_position: 6
---

# External signers

The React SDK treats signing as a pluggable contract: `MidenProvider` accepts any `SignerContext` that exposes a `signCb` function, and hooks call into it whenever a transaction needs a signature. Prebuilt providers exist for the major wallet integrations; you can also build your own.

## Built-in signer providers

### Para (EVM wallets)

```tsx
import { ParaSignerProvider } from "@miden-sdk/para-react";
import { MidenProvider } from "@miden-sdk/react";

function App() {
  return (
    <ParaSignerProvider apiKey="your-api-key" environment="PRODUCTION">
      <MidenProvider config={{ rpcUrl: "testnet" }}>
        <YourApp />
      </MidenProvider>
    </ParaSignerProvider>
  );
}
```

Expose Para-specific data inside your app:

```tsx
import { useParaSigner } from "@miden-sdk/para-react";

const { para, wallet, isConnected } = useParaSigner();
```

### Turnkey

```tsx
import { TurnkeySignerProvider } from "@miden-sdk/turnkey-react";
import { MidenProvider } from "@miden-sdk/react";

function App() {
  return (
    <TurnkeySignerProvider
      config={{ defaultOrganizationId: "your-org-id" }}
    >
      <MidenProvider config={{ rpcUrl: "testnet" }}>
        <YourApp />
      </MidenProvider>
    </TurnkeySignerProvider>
  );
}
```

Connect via passkey authentication:

```tsx
import { useSigner } from "@miden-sdk/react";
import { useTurnkeySigner } from "@miden-sdk/turnkey-react";

function ConnectButton() {
  const signer = useSigner();
  const turnkey = useTurnkeySigner(); // call unconditionally — rules of hooks

  if (!signer) return null; // no signer provider mounted

  if (!signer.isConnected) {
    return <button onClick={signer.connect}>Connect</button>;
  }
  return (
    <button onClick={signer.disconnect}>
      Disconnect ({turnkey.account?.address})
    </button>
  );
}
```

### MidenFi wallet adapter

```tsx
import { MidenFiSignerProvider } from "@miden-sdk/miden-wallet-adapter-react";
import { MidenProvider } from "@miden-sdk/react";

<MidenFiSignerProvider>
  <MidenProvider config={{ rpcUrl: "testnet" }}>
    <YourApp />
  </MidenProvider>
</MidenFiSignerProvider>
```

## Unified signer interface

Use `useSigner()` with any provider. It returns `null` when no signer provider is mounted:

```tsx
import { useSigner } from "@miden-sdk/react";

function Header() {
  const signer = useSigner();
  if (!signer) return null; // no signer provider above

  if (!signer.isConnected) {
    return <button onClick={signer.connect}>Connect {signer.name}</button>;
  }
  return <button onClick={signer.disconnect}>Disconnect</button>;
}
```

## Custom signer providers

Connect your signing service through `SignerContext`. This fragment assumes the SDK is ready and your service provides ECDSA K256/Keccak signatures, a public-key commitment serialized as an SDK word, and a stable 32-byte account seed.

```tsx
import { MidenProvider, SignerContext, type SignerContextValue } from "@miden-sdk/react";
import { AccountStorageMode } from "@miden-sdk/miden-sdk";

const signer: SignerContextValue = {
  name: "MyWallet",
  storeName: `mywallet_${signingService.identity}`,
  isConnected: signingService.isConnected,
  accountConfig: {
    publicKeyCommitment: signingService.publicKeyCommitment,
    storageMode: AccountStorageMode.private(),
    accountSeed: signingService.accountSeed,
  },
  signCb: async (pubKey, signingInputs) => {
    if (!signingService.isConnected) throw new Error("MyWallet is not connected");
    return signingService.signMessage(pubKey, signingInputs);
  },
  connect: async () => { await signingService.connect(); },
  disconnect: async () => { await signingService.disconnect(); },
};

<SignerContext.Provider value={signer}>
  <MidenProvider config={{ rpcUrl: "testnet" }}>
    <YourApp />
  </MidenProvider>
</SignerContext.Provider>
```

Build this value inside your provider's render and update it when the connection changes. Use a unique `storeName` per signing identity to isolate each user's database.

## Custom `AccountComponent`s

Attach application-specific components — compiled from `.masp` packages, e.g. a DEX module — alongside the default auth and basic wallet components:

```tsx
import { type SignerAccountConfig } from "@miden-sdk/react";
import {
  AccountComponent,
  AccountStorageMode,
} from "@miden-sdk/miden-sdk";

const myDexComponent: AccountComponent = await loadCompiledComponent();

const accountConfig: SignerAccountConfig = {
  publicKeyCommitment: userPublicKeyCommitment,
  storageMode: AccountStorageMode.private(),
  accountSeed: stableAccountSeed, // persist this 32-byte seed for this identity
  customComponents: [myDexComponent],
};
```

`customComponents` is optional. Components are added alongside the default auth and basic wallet components.

## `MultiSignerProvider`

Use `MultiSignerProvider` to switch signers at runtime. Register each provider with `<SignerSlot />` and place `MidenProvider` alongside them:

```tsx
import { MultiSignerProvider, SignerSlot, MidenProvider } from "@miden-sdk/react";
import { ParaSignerProvider } from "@miden-sdk/para-react";
import { TurnkeySignerProvider } from "@miden-sdk/turnkey-react";

function App() {
  return (
    <MultiSignerProvider>
      <ParaSignerProvider apiKey="your-api-key" environment="PRODUCTION">
        <SignerSlot />
      </ParaSignerProvider>
      <TurnkeySignerProvider
        config={{ defaultOrganizationId: "your-org-id" }}
      >
        <SignerSlot />
      </TurnkeySignerProvider>

      <MidenProvider config={{ rpcUrl: "testnet" }}>
        <YourApp />
      </MidenProvider>
    </MultiSignerProvider>
  );
}
```

Connect and disconnect by name via `useMultiSigner()`:

```tsx
import { useMultiSigner } from "@miden-sdk/react";

function SignerPicker() {
  const multi = useMultiSigner();
  if (!multi) return null; // no MultiSignerProvider above

  return (
    <>
      <button onClick={() => multi.connectSigner("Para")}>Connect Para</button>
      <button onClick={() => multi.connectSigner("Turnkey")}>Connect Turnkey</button>
      <button onClick={() => multi.disconnectSigner()}>Disconnect</button>
    </>
  );
}
```

`connectSigner(name)` uses the provider's `name`; `disconnectSigner()` clears the active signer.

## Next

- [Recipes](./recipes.md) — end-to-end patterns with signer integration examples.
- [Setup](./setup.md) — client config and lifecycle.
