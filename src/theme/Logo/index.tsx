import React from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useThemeConfig} from '@docusaurus/theme-common';
import MidenLogo from '@site/src/components/MidenLogo';
import type {Props} from '@theme/Logo';

export default function Logo({imageClassName, titleClassName, ...props}: Props) {
  const {navbar: {logo, title}} = useThemeConfig();
  const destination = useBaseUrl(logo?.href || '/');
  return <Link to={destination} {...props} {...(logo?.target && {target:logo.target})}>
    <div className={imageClassName}><MidenLogo label={logo?.alt || 'Miden'} width={logo?.width || 84} height={logo?.height || 26}/></div>
    {title != null && <b className={titleClassName}>{title}</b>}
  </Link>;
}
