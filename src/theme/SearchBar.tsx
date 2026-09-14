import {useEffect, useRef, useState, type ReactNode} from 'react';
import SearchBar from '@theme-original/SearchBar';
import type SearchBarType from '@theme/SearchBar';
import type {WrapperProps} from '@docusaurus/types';

type Props = WrapperProps<typeof SearchBarType>;

export default function SearchBarWrapper(props: Props): ReactNode {
  const providerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [modifier, setModifier] = useState('Ctrl');

  function openSearch() {
    const input = document.querySelector<HTMLInputElement>('.aa-DetachedContainer .aa-Input');
    if (input) {
      input.focus();
      return;
    }
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : triggerRef.current;
    providerRef.current?.querySelector<HTMLButtonElement>('.aa-DetachedSearchButton')?.click();
  }

  useEffect(() => {
    const provider = providerRef.current;
    if (!provider) return;
    setModifier(/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl');

    const checkReady = () => {
      if (provider.querySelector('.aa-DetachedSearchButton')) {
        setReady(true);
        readyObserver.disconnect();
      }
    };
    const readyObserver = new MutationObserver(checkReady);
    readyObserver.observe(provider, {childList: true, subtree: true});
    checkReady();

    let dialog: HTMLElement | null = null;
    let releaseDialog: (() => void) | undefined;
    let navigating = false;
    let restoringFocus = 0;
    let dismissing = false;

    function syncDialog() {
      const next = document.querySelector<HTMLElement>('.aa-DetachedContainer');
      if (next === dialog) return;
      cancelAnimationFrame(restoringFocus);
      releaseDialog?.();
      releaseDialog = undefined;
      dialog = next;
      setIsOpen(Boolean(dialog));

      if (!dialog) {
        // Backdrop mousedown finishes its native focus change after the modal
        // is removed. Restore on the next frame, after that default behavior.
        restoringFocus = requestAnimationFrame(() => {
          if (!navigating && returnFocusRef.current?.isConnected) {
            returnFocusRef.current.focus({preventScroll: true});
          }
        });
        return;
      }

      navigating = false;
      const currentDialog = dialog;
      const app = document.getElementById('__docusaurus');
      const wasInert = app?.inert ?? false;
      if (app) app.inert = true;
      currentDialog.setAttribute('role', 'dialog');
      currentDialog.setAttribute('aria-modal', 'true');
      currentDialog.setAttribute('aria-label', 'Search documentation');

      const input = currentDialog.querySelector<HTMLInputElement>('.aa-Input');
      const hint = document.createElement('p');
      hint.className = 'miden-search-hint';
      hint.setAttribute('role', 'status');
      currentDialog.appendChild(hint);

      const help = document.createElement('div');
      help.className = 'miden-search-help';
      help.textContent = '↑ ↓ to navigate · Enter to open · Esc to close';
      help.setAttribute('aria-hidden', 'true');
      currentDialog.appendChild(help);

      function updateSearchState() {
        const hasQuery = Boolean(input?.value.trim());
        const loading = Boolean(currentDialog.querySelector('.aa-LoadingIndicator:not([hidden])'));
        currentDialog.dataset.hasQuery = String(hasQuery);
        const message = loading
          ? 'Searching documentation…'
          : hasQuery ? '' : 'Search guides, SDKs, and reference.';
        if (hint.textContent !== message) hint.textContent = message;
        if (hint.hidden !== !message) hint.hidden = !message;
        // These nested buttons are decorative enter icons, not separate actions.
        currentDialog.querySelectorAll<HTMLElement>('.aa-ItemActionButton').forEach((button) => {
          button.tabIndex = -1;
          button.setAttribute('aria-hidden', 'true');
        });
      }

      const resultsObserver = new MutationObserver(updateSearchState);
      resultsObserver.observe(currentDialog, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['hidden'],
      });
      input?.addEventListener('input', updateSearchState);
      updateSearchState();

      releaseDialog = () => {
        resultsObserver.disconnect();
        input?.removeEventListener('input', updateSearchState);
        hint.remove();
        help.remove();
        if (app) app.inert = wasInert;
      };
    }

    function dismissSearch(cancelPending: boolean) {
      if (!dialog || dismissing) return;
      dismissing = true;
      try {
        if (cancelPending) {
          dialog.querySelector<HTMLInputElement>('.aa-Input')?.dispatchEvent(
            new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}),
          );
        }
        dialog.querySelector<HTMLButtonElement>('.aa-DetachedCancelButton')?.click();
      } finally {
        dismissing = false;
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.isComposing) return;
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSearch();
        return;
      }
      if (!dialog) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        // Escape on the input already canceled pending results in the provider.
        dismissSearch(!(event.target instanceof Element && event.target.matches('.aa-Input')));
      } else if (event.key === 'Tab') {
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        )).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      } else if (
        event.key === 'Enter'
        && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
        && event.target instanceof Element
        && (event.target.matches('.aa-Input') || event.target.closest('.aa-ItemLink'))
        && dialog.querySelector('.aa-Item[aria-selected="true"]')
      ) {
        navigating = true;
      }
    }

    function onClick(event: MouseEvent) {
      if (!dialog || dismissing || !(event.target instanceof Element)) return;
      if (event.target.closest('.aa-DetachedCancelButton')) {
        event.preventDefault();
        event.stopPropagation();
        // Provider Cancel only closes the panel; Escape also cancels requests
        // that would otherwise reopen it when a slow index download completes.
        dismissSearch(true);
      } else if (event.target.closest('.aa-ClearButton')) {
        event.preventDefault();
        event.stopPropagation();
        const input = dialog.querySelector<HTMLInputElement>('.aa-Input');
        if (input) {
          // The provider's form-reset focus path closes an empty detached
          // dialog. Its normal input path clears results while staying open.
          input.focus();
          input.value = '';
          input.dispatchEvent(new Event('input', {bubbles: true}));
        }
      } else if (event.target.closest('.aa-ItemLink')) {
        navigating = true;
      }
    }

    const overlayObserver = new MutationObserver(syncDialog);
    overlayObserver.observe(document.body, {childList: true});
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('click', onClick, true);
    syncDialog();
    return () => {
      readyObserver.disconnect();
      overlayObserver.disconnect();
      cancelAnimationFrame(restoringFocus);
      releaseDialog?.();
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  return (
    <div className="miden-search">
      <button
        ref={triggerRef}
        className="miden-search-trigger"
        type="button"
        onClick={openSearch}
        disabled={!ready}
        aria-label="Search documentation"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-keyshortcuts="Control+k Meta+k">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="m13 13 4 4" />
        </svg>
        <span>Search docs</span>
        <kbd aria-hidden="true">{modifier} K</kbd>
      </button>
      <div ref={providerRef} className="miden-search-provider">
        <SearchBar {...props} />
      </div>
    </div>
  );
}
