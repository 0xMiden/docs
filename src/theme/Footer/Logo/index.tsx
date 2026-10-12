import React from 'react';
import Link from '@docusaurus/Link';
import MidenLogo from '@site/src/components/MidenLogo';
import type {Props} from '@theme/Footer/Logo';

export default function FooterLogo({logo}: Props) {
  const mark = <MidenLogo className={`footer__logo ${logo.className || ''}`} width={logo.width || 106} height={logo.height || 33} label={logo.alt || 'Miden'}/>;
  return logo.href ? <Link href={logo.href} target={logo.target}>{mark}</Link> : mark;
}
