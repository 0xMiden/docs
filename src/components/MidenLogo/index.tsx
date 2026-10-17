import React from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import OfficialLogo from '@site/static/brand/miden/miden-logo.svg';
import styles from './styles.module.css';

// Official geometry and orange are unchanged. Only the gray wordmark takes
// the theme's text color, so it remains readable without a replacement logo.
export default function MidenLogo({className = '', width = 84, height = 26, label = 'Miden'}: {className?: string; width?: number | string; height?: number | string; label?: string}) {
  const source = useBaseUrl('/brand/miden/miden-logo.svg');
  return <OfficialLogo className={`${styles.logo} ${className}`} width={width} height={height} role="img" aria-label={label} data-miden-logo="true" data-source={source}/>;
}
