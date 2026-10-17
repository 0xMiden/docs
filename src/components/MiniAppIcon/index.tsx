import React from "react";

type IconName = "apps" | "arcade" | "finance" | "others" | "setup" | "wallet" | "test" | "publish";

const paths: Record<IconName, React.ReactNode> = {
  apps: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  arcade: <><path d="M7.5 7h9a4 4 0 0 1 3.9 3.1l1.1 5a3 3 0 0 1-5 2.8L14 16h-4l-2.5 1.9a3 3 0 0 1-5-2.8l1.1-5A4 4 0 0 1 7.5 7Z" /><path d="M7 10v5m-2.5-2.5h5" /><circle cx="16" cy="11" r=".75" fill="currentColor" stroke="none" /><circle cx="18" cy="14" r=".75" fill="currentColor" stroke="none" /></>,
  finance: <><path d="M4 20V9m5 11v-7m5 7V6m5 14V3M2 20h20" /></>,
  others: <><path d="m3 7 9-4 9 4-9 4-9-4Zm3 2v7l6 3 6-3V9M21 7v9" /></>,
  setup: <><path d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-11-2 14" /></>,
  wallet: <><path d="M4 6h14a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12" /><path d="M20 10h-5v5h5" /><circle cx="16.5" cy="12.5" r=".5" fill="currentColor" /></>,
  test: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M9 12l2 2 4-4" /></>,
  publish: <><path d="M12 16V3m-5 5 5-5 5 5M4 14v6h16v-6" /></>,
};

/** Decorative navigation icons, using the documentation's existing stroke style. */
export default function MiniAppIcon({ name }: { name: IconName }): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
}
