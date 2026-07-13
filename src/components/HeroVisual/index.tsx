import React from "react";
import styles from "./styles.module.css";

/**
 * Miden hero — client-side proving on a user's phone.
 *
 * 8-second loop, six stages (matches creative brief):
 *   1. Build      (0.0–1.8s)   tx rows pop into the phone with a spring settle
 *   2. Prove      (1.8–3.2s)   rows compress toward center; ember scan passes;
 *                              a proof capsule pops out with overshoot
 *   3. Submit     (3.2–4.8s)   capsule lifts off, travels an arc to the chain;
 *                              two afterimages trail behind it
 *   4. Commit     (4.8–6.6s)   chain card receives a commitment hash; private
 *                              rows stay masked/hidden throughout
 *   5. Seal       (6.6–7.5s)   sealed check pill settles into place with a
 *                              brief glow pulse
 *   6. Reset      (7.5–8.0s)   soft crossfade back to an empty frame
 *
 * Motion language: four moves only — pop-in, compress/merge, arc travel,
 * settle/lock. Labels and card frames stay still; only interactive glyphs
 * get the bouncy easing. Pure SVG + CSS. Respects prefers-reduced-motion
 * via the global guard.
 */
export default function HeroVisual(): JSX.Element {
  const vbWidth = 380;
  const vbHeight = 220;

  // Transaction rows inside the phone screen. Widths are percentages of
  // the screen-row width (82px). Each entry gets a 0.15s-stagger pop-in.
  const txRows: Array<{ y: number; w: number }> = [
    { y: 62, w: 90 },
    { y: 80, w: 70 },
    { y: 98, w: 82 },
    { y: 116, w: 52 },
  ];

  // Hidden (private) rows on the chain side — dashed, dimmed, never lit.
  const hiddenRows: Array<{ y: number; w: number }> = [
    { y: 122, w: 78 },
    { y: 138, w: 58 },
    { y: 154, w: 70 },
  ];

  return (
    <div className={styles.root} aria-hidden="true">
      <div className={styles.frame}>
        {/* top chrome */}
        <div className={styles.chromeTop}>
          <svg
            className={styles.lockIcon}
            width="11"
            height="11"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="2.5"
              y="6.5"
              width="9"
              height="6.5"
              rx="1.25"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M4.5 6.5V4.25a2.5 2.5 0 0 1 5 0V6.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <span className={styles.chromeLabel}>
            Client-side proof · private by default
          </span>
          <span className={styles.chromeStatus}>
            <span className={styles.chromeDot} />
            live
          </span>
        </div>

        <svg
          className={styles.lattice}
          viewBox={`0 0 ${vbWidth} ${vbHeight}`}
          xmlns="http://www.w3.org/2000/svg"
          role="presentation"
        >
          <defs>
            {/* ember scan gradient used during the Prove stage */}
            <linearGradient id="heroScan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="transparent" />
              <stop
                offset="45%"
                stopColor="var(--color-brand)"
                stopOpacity="0.9"
              />
              <stop
                offset="55%"
                stopColor="var(--color-brand)"
                stopOpacity="0.9"
              />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>

            {/* tx row fill — subtle left→right gradient */}
            <linearGradient id="heroBar" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--color-border-strong)" />
              <stop offset="100%" stopColor="var(--color-border)" />
            </linearGradient>

            {/* The arc the proof capsule travels along. Used both as a
                visible dashed guide AND as the offset-path for the capsule. */}
            <path
              id="heroArc"
              d="M 126 124 Q 186 60 250 124"
              fill="none"
            />
          </defs>

          {/* ================= PHONE / CLIENT ================= */}
          <g className={styles.phoneZone}>
            <text x="14" y="24" className={styles.zoneLabel}>
              Mobile
            </text>

            {/* phone body */}
            <rect
              x="18"
              y="38"
              width="108"
              height="160"
              rx="14"
              className={styles.phoneBody}
            />
            {/* screen */}
            <rect
              x="26"
              y="48"
              width="92"
              height="140"
              rx="6"
              className={styles.phoneScreen}
            />
            {/* notch */}
            <rect
              x="60"
              y="44"
              width="24"
              height="4"
              rx="2"
              className={styles.phoneNotch}
            />

            {/* transaction rows that pop in during Build */}
            {txRows.map((r, i) => (
              <rect
                key={`row-${i}`}
                x="32"
                y={r.y}
                width={(82 * r.w) / 100}
                height="6"
                rx="2"
                fill="url(#heroBar)"
                className={`${styles.txRow} ${styles[`row${i}`]}`}
              />
            ))}

            {/* ember scan line that passes through the phone during Prove */}
            <rect
              x="18"
              y="-160"
              width="108"
              height="100"
              rx="14"
              fill="url(#heroScan)"
              className={styles.phoneScan}
            />

            {/* the proof capsule — pops in during Prove, travels in Submit */}
            <g className={styles.capsuleGroup}>
              <rect
                x="-24"
                y="-10"
                width="48"
                height="20"
                rx="6"
                className={styles.capsuleBox}
              />
              <text x="0" y="4" className={styles.capsuleGlyph}>
                π
              </text>
            </g>

            {/* capsule afterimages — trail the main capsule on arc travel */}
            <g className={`${styles.capsuleGroup} ${styles.capsuleGhostA}`}>
              <rect
                x="-22"
                y="-9"
                width="44"
                height="18"
                rx="6"
                className={styles.capsuleBoxGhost}
              />
            </g>
            <g className={`${styles.capsuleGroup} ${styles.capsuleGhostB}`}>
              <rect
                x="-20"
                y="-8"
                width="40"
                height="16"
                rx="6"
                className={styles.capsuleBoxGhost}
              />
            </g>
          </g>

          {/* ================= TRANSFER ARC ================= */}
          <g className={styles.arcZone}>
            <use
              href="#heroArc"
              className={styles.arcGuide}
            />
          </g>

          {/* ================= CHAIN ================= */}
          <g className={styles.chainZone}>
            <text x={vbWidth - 14} y="24" className={styles.zoneLabelR}>
              Chain
            </text>

            {/* chain card */}
            <rect
              x="250"
              y="48"
              width="116"
              height="152"
              rx="10"
              className={styles.chainCard}
            />

            {/* public commitment slot — highlighted when active */}
            <rect
              x="258"
              y="58"
              width="100"
              height="32"
              rx="4"
              className={styles.chainCommitSlot}
            />
            <text x="266" y="72" className={styles.chainSlotLabel}>
              commitment
            </text>
            <text x="266" y="86" className={styles.chainHashInline}>
              <tspan className={styles.hashPiece} data-delay="0">0x</tspan>
              <tspan className={styles.hashPiece} data-delay="1">a3</tspan>
              <tspan className={styles.hashPiece} data-delay="2">f9</tspan>
              <tspan className={styles.hashPiece} data-delay="3">12</tspan>
              <tspan className={styles.hashPiece} data-delay="4">7b</tspan>
              <tspan className={styles.hashPiece} data-delay="5">…</tspan>
            </text>

            {/* "private" label above the masked rows */}
            <text x="266" y="110" className={styles.chainHiddenLabel}>
              state · private
            </text>

            {/* private/hidden rows — stay dimmed all the way through */}
            {hiddenRows.map((r, i) => (
              <rect
                key={`hidden-${i}`}
                x="266"
                y={r.y}
                width={(84 * r.w) / 100}
                height="4"
                rx="2"
                className={styles.chainHiddenRow}
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}

            {/* verified check that lands on the chain card during Seal */}
            <g className={styles.chainVerifyGroup}>
              <circle
                cx="352"
                cy="72"
                r="8"
                className={styles.chainVerifyCircle}
              />
              <path
                d="M348 72 l3 3 l5 -5"
                className={styles.chainVerifyCheck}
              />
            </g>
          </g>

          {/* stage caption — single text element whose content changes via
              stacked <text> nodes that fade in/out on their assigned stage */}
          <g className={styles.stageCaption}>
            <text
              x={vbWidth / 2}
              y={vbHeight - 8}
              className={`${styles.stageText} ${styles.stageBuild}`}
            >
              Build locally
            </text>
            <text
              x={vbWidth / 2}
              y={vbHeight - 8}
              className={`${styles.stageText} ${styles.stageProve}`}
            >
              Prove on device
            </text>
            <text
              x={vbWidth / 2}
              y={vbHeight - 8}
              className={`${styles.stageText} ${styles.stageSubmit}`}
            >
              Submit proof
            </text>
            <text
              x={vbWidth / 2}
              y={vbHeight - 8}
              className={`${styles.stageText} ${styles.stageCommit}`}
            >
              Commit — no state revealed
            </text>
            <text
              x={vbWidth / 2}
              y={vbHeight - 8}
              className={`${styles.stageText} ${styles.stageSealed}`}
            >
              Sealed
            </text>
          </g>
        </svg>
      </div>

      {/* decorative ember halo */}
      <div className={styles.glow} aria-hidden="true" />
    </div>
  );
}
