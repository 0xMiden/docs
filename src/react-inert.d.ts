/// <reference types="@docusaurus/theme-classic" />
/// <reference types="@docusaurus/module-type-aliases" />

// The custom Layout/Logo/Navbar wrappers use the installed theme's aliases.
// Include its declarations explicitly; the base editor tsconfig omits them.
import 'react';

// The runtime is React 19; the repository's older React type declarations
// omit the native inert attribute used to block focus in hidden tab panels.
declare module 'react' {
  interface HTMLAttributes<T> {
    inert?: boolean;
  }
}
