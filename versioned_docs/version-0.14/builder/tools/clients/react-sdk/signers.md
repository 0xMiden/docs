---
title: External signers
sidebar_position: 6
---

# External signers

The React SDK treats signing as a pluggable contract: `MidenProvider` accepts any `SignerContext` that exposes a `signCb` function, and hooks call into it whenever a transaction needs a signature. Prebuilt providers exist for the major wallet integrations; you can also build your own.

## Built-in signer providers

### Para (EVM wallets)

```tsx
import { ParaSignerProvider } from "@miden-sdk/para";
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
import { useParaSigner } from "@miden-sdk/para";

const { para, wallet, isConnected } = useParaSigner();
```

### Turnkey

```tsx
import { TurnkeySignerProvider } from "@miden-sdk/miden-turnkey-react";

// Config is optional — defaults to https://api.turnkey.com and reads
// VITE_TURNKEY_ORG_ID from the environment.
<TurnkeySignerProvider>
  <MidenProvider config={{ rpcUrl: "testnet" }}>
    <YourApp />
  </MidenProvider>
</TurnkeySignerProvider>

// Or with explicit config:
<TurnkeySignerProvider
  config={{
    apiBaseUrl: "https://api.turnkey.com",
    defaultOrganizationId: "your-org-id",
  }}
>
  ...
</TurnkeySignerProvider>
```

Connect via passkey authentication. `useSigner()` returns `SignerContextValue | null` (null when no signer provider is above the component), so always null-guard:

```tsx
import { useSigner } from "@miden-sdk/react";
import { useTurnkeySigner } from "@miden-sdk/miden-turnkey-react";

function ConnectButton() {
  const signer = useSigner();
  const turnkey = useTurnkeySigner(); // call unconditionally — rules of hooks

  if (!signer) return null; // no signer provider mounted

  if (!signer.isConnected) {
    return <button onClick={signer.connect}>Connect</button>;
  }
  return (
    <button onClick={signer.disconnect}>
      Disconnect ({turnkey.account?.name})
    </button>
  );
}
```

### MidenFi wallet adapter

```tsx
import { MidenFiSignerProvider } from "@miden-sdk/wallet-adapter-react";

<MidenFiSignerProvider network="testnet">
  <MidenProvider config={{ rpcUrl: "testnet" }}>
    <YourApp />
  </MidenProvider>
</MidenFiSignerProvider>
```

## Unified signer interface

Every prebuilt provider exposes the same `useSigner` surface, so UI code that only cares about connect/disconnect stays signer-agnostic. Note the return is `SignerContextValue | null`:

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

For a signing service that doesn't have a prebuilt provider — internal HSM, hardware wallet, or experimental integration — wire `SignerContext` directly:

```tsx
import { SignerContext, type SignerContextValue } from "@miden-sdk/react";

const signer: SignerContextValue = {
  name: "MyWallet",
  storeName: `mywallet_${userAddress}`, // unique per user for DB isolation
  isConnected: true,
  accountConfig: {
    publicKeyCommitment: userPublicKeyCommitment, // Uint8Array
    storageMode: "private",
    accountType: "RegularAccountUpdatableCode",
  },
  signCb: async (pubKey, signingInputs) => {
    // Route to your signing service
    return signature; // Uint8Array
  },
  connect: async () => {
    /* trigger wallet connection */
  },
  disconnect: async () => {
    /* clear session */
  },
};

function App() {
  return (
    <SignerContext.Provider value={signer}>
      <MidenProvider config={{ rpcUrl: "testnet" }}>
        <YourApp />
      </MidenProvider>
    </SignerContext.Provider>
  );
}
```

`storeName` is critical: each user's data lives in its own IndexedDB database, so make the `storeName` unique per signing identity (typically the wallet address or a derived hash).

## Custom `AccountComponent`s

Attach application-specific components — compiled from `.masp` packages, e.g. a DEX module — alongside the default auth and basic wallet components:

```tsx
import { type SignerAccountConfig } from "@miden-sdk/react";
import { AccountComponent } from "@miden-sdk/miden-sdk";

const myDexComponent: AccountComponent = await loadCompiledComponent();

const accountConfig: SignerAccountConfig = {
  publicKeyCommitment: userPublicKeyCommitment,
  accountType: "RegularAccountUpdatableCode",
  storageMode: "private",
  customComponents: [myDexComponent],
};
```

Components are appended to the `AccountBuilder` after the default basic wallet component and before `build()` is called, so the account always includes wallet functionality plus any extras you pass. The field is optional; leaving it unset (or passing an empty array) preserves the default behaviour.

## `MultiSignerProvider`

For apps that need to swap between multiple signer providers at runtime (e.g. "connect with Para" or "connect with Turnkey"), use `MultiSignerProvider`. Each registered signer provider renders its own `<SignerSlot />` (the component takes no children — it registers the provider's current `SignerContext` with the multi-signer context) and `MidenProvider` sits as a sibling inside `MultiSignerProvider`:

```tsx
import { MultiSignerProvider, SignerSlot, MidenProvider } from "@miden-sdk/react";

function App() {
  return (
    <MultiSignerProvider>
      <ParaSignerProvider apiKey="...">
        <SignerSlot />
      </ParaSignerProvider>
      <TurnkeySignerProvider>
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

`useMultiSigner()` returns `MultiSignerContextValue | null`; its `connectSigner(name)` / `disconnectSigner()` actions switch and clear the active signer respectively. The name passed to `connectSigner` matches the `name` field on each signer's `SignerContextValue`.

## Next

- [Recipes](./recipes.md) — end-to-end patterns with signer integration examples.
- [Setup](./setup.md) — client config and lifecycle.
