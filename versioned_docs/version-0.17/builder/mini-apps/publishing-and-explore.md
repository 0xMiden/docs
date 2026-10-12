---
sidebar_position: 6
title: "Publish and list in Explore"
description: "Host the app, prepare its catalog entry and submit a wallet-config pull request for review."
---

# Publish and list in Explore

Deploy your mini-app as a hosted web application, then submit its Explore catalog change through a pull request to [wallet-config](https://github.com/0xMiden/wallet-config). The configuration workflow targets wallet-config for all dynamic wallet data, including Explore listings and configured bridge, market and swap metadata. Hosting, configuration review and an observed listing are separate steps. There is no mini-app registration API established by the wallet adapter.

## Prepare the hosted app

Use a production HTTPS URL on the intended domain. Confirm that the deployed app matches the reviewed source and package versions, starts without a local developer server and works inside each Bread app-browser platform you claim. Test provider detection, explicit permission, supported transactions and interruption recovery before requesting a listing.

A catalog URL is an app launch target, not authority to select another user's account or read private state. Keep the network visible in the app and reject stale or mismatched request context. If the app uses a provider route, verify its actual activation and recovery behavior separately.

## Prepare the catalog entry

Follow the current catalog layout and schema in wallet-config. Follow the repository's contributor instructions for network selection and preserve unrelated bridge, market and feature configuration. Do not invent another endpoint, listing API or JSON property to get around repository validation.

The wallet's Explore catalog contract includes:

| Metadata | Requirement |
| --- | --- |
| App ID | Unique lowercase letters, digits and hyphens. Keep it stable when updating the same app. |
| Name and tagline | Literal localized text; English is required. The reviewed reader limits names to 40 and taglines to 120 characters per locale. |
| Launch URL | HTTPS, with no username/password, IP address, localhost or punycode host. |
| Category | A supported category such as `tools`, `defi`, `games`, `nft` or `learn`. |
| Icon | Optional repository-owned PNG. Follow its allowed path, square dimensions and byte-size validation. Without one the wallet can draw an initial. |
| Exchange classification | Set accurately for an exchange/swap app; platform feature gating can hide such entries. |
| Section placement | Use the section's app IDs in display order, without duplicate IDs. Recents and search results belong to the wallet. |

The [wallet parser](https://github.com/0xMiden/wallet/blob/main/src/lib/explore-config/schema.ts) describes the reviewed catalog limits. Use wallet-config's current contributor instructions for the accepted file layout and validation rather than copying a standalone document into an unrelated field.

## Submit a reviewable configuration PR

1. Select the intended network and update its catalog entry, localization, icon and section placement.
2. Increase the document version according to the repository's rules. Restoring older values is still a new version; wallets retain a floor against older accepted documents.
3. Run the repository's current validation/test workflow from its README. Check the catalog, icon and document limits as well as any shared configuration checks.
4. Describe the app, deployed URL, source repository, intended network/platforms and completed test evidence in the pull request. Keep secrets and private account state out of that evidence.
5. Obtain maintainer review. A PR, passing validation or a catalog merge alone does not prove that every wallet candidate has loaded the change.

After publication, allow configuration refresh and CDN caching, then verify the exact entry and launch URL on the intended wallet/network. Confirm that the app opens, the expected provider is detected and the original permission/transaction checks still apply. A wallet may initially show a bundled or previously accepted catalog.

## What listing means

Listing makes the app discoverable in Explore. It does not grant a trust badge, permission, keys, Mainnet admission, provider liquidity or route support. The wallet continues to ask its normal connection and transaction questions.

For updates, redirects, removals or rollback, use another reviewed configuration change with the required higher version and verify the resulting catalog. Removing a listing does not cancel an already submitted transaction, delete an onchain account or change the recovery responsibilities of the app and provider.
