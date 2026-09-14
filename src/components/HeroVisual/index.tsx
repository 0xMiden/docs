import React from "react";
import styles from "./styles.module.css";

/** A schematic of a private-account transaction, not live network activity. */
export default function HeroVisual() {
  return (
    <figure className={styles.root}>
      <svg className={styles.diagram} viewBox="0 0 420 268" fill="none" role="img" aria-label="A private account executes locally. Its proof is sent to the network for verification.">
        <path className={styles.guide} d="M18 42H402M18 228H402M42 18V250M378 18V250" />
        <rect className={styles.client} x="26" y="58" width="154" height="152" rx="10" />
        <text className={styles.label} x="44" y="85">YOUR APPLICATION</text>
        <path className={styles.separator} d="M26 100h154" />
        <rect className={styles.stateRow} x="44" y="120" width="70" height="6" rx="3" />
        <rect className={styles.stateRow} x="44" y="136" width="100" height="6" rx="3" />
        <rect className={styles.stateRow} x="44" y="152" width="84" height="6" rx="3" />
        <g className={styles.privateLabel}>
          <rect x="45" y="178" width="8" height="7" rx="1" stroke="currentColor" />
          <path d="M47 178v-2a2 2 0 0 1 4 0v2" stroke="currentColor" />
          <text x="61" y="185">Private account state</text>
        </g>
        <path className={styles.connection} d="M180 132h61m-5-4 5 4-5 4" />
        <rect className={styles.network} x="246" y="58" width="148" height="152" rx="10" />
        <text className={styles.label} x="264" y="85">MIDEN NETWORK</text>
        <path className={styles.separator} d="M246 100h148" />
        <circle className={styles.checkCircle} cx="272" cy="125" r="8" />
        <path className={styles.check} d="m268 125 3 3 5-6" />
        <text className={styles.networkText} x="288" y="129">Verify proof</text>
        <circle className={styles.checkCircle} cx="272" cy="151" r="8" />
        <path className={styles.check} d="m268 151 3 3 5-6" />
        <text className={styles.networkText} x="288" y="155">Commit state</text>
        <text className={styles.commitment} x="264" y="185">0x7a…c42f</text>
        <g className={styles.proof}>
          <rect x="167" y="117" width="67" height="30" rx="5" />
          <text x="200.5" y="136" textAnchor="middle">Proof</text>
        </g>
        <text className={styles.step} x="103" y="237" textAnchor="middle">Execute + prove</text>
        <text className={styles.step} x="320" y="237" textAnchor="middle">Verify + settle</text>
      </svg>
      <figcaption>Keep private account state local.<br />Let the network verify the proof.</figcaption>
    </figure>
  );
}
