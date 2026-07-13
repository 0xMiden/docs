import React from "react";
import styles from "./styles.module.css";

interface SectionLink {
  href: string;
  label: string;
  description?: string;
}

interface SectionLinksProps {
  title: string;
  links: SectionLink[];
}

export default function SectionLinks({
  title,
  links,
}: SectionLinksProps): JSX.Element {
  return (
    <div className={styles.container}>
      <div className={styles.title}>{title}</div>
      <ul className={styles.list}>
        {links.map((link, idx) => (
          <li key={idx} className={styles.item}>
            <a href={link.href} className={styles.link}>
              {link.label}
            </a>
            {link.description && (
              <span className={styles.description}> — {link.description}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
