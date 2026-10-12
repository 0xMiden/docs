import React, {type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import {useLayoutDoc} from '@docusaurus/plugin-content-docs/client';
import OriginalHtmlNavbarItem from '@theme-original/NavbarItem/HtmlNavbarItem';
import styles from './styles.module.css';
import type {Props} from '@theme/NavbarItem/HtmlNavbarItem';

function QuickStartItem({className, mobile = false, isDropdownItem = false, onClick}: Props): ReactNode {
  const doc = useLayoutDoc('builder/get-started/index');
  if (!doc) return null;
  const Container = isDropdownItem ? 'li' : 'div';
  const classes = [!mobile && !isDropdownItem ? 'navbar__item' : '', mobile ? 'menu__list-item' : '', className].filter(Boolean).join(' ');
  return <Container className={classes}>
    <Link className={`navbar-cta ${styles.start}`} to={doc.path} onClick={onClick}>
      <span className="navbar-cta__label">Start building</span>
      <span className="navbar-cta__arrow" aria-hidden="true">→</span>
    </Link>
  </Container>;
}

/** Keep the existing navigation, but make its quickstart CTA version-aware
 * and use the router instead of causing a full document reload. */
export default function HtmlNavbarItem(props: Props): ReactNode {
  return props.value.includes('class="navbar-cta"')
    ? <QuickStartItem {...props}/>
    : <OriginalHtmlNavbarItem {...props}/>;
}
