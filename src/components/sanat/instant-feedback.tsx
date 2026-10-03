'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const START_EVENT = 'sanat:nav-start';
// if a page never arrives (offline, an error page), stop pretending
const GIVE_UP_MS = 12000;

// For code that navigates with router.push (not a link): shows the bar too.
export function startNavProgress() {
  window.dispatchEvent(new Event(START_EVENT));
}

// Is this click a plain in-site link to another page?
// (next/link prevents the default and navigates itself, so that is not checked)
function leadsElsewhere(e: MouseEvent): boolean {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
  if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return false;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return false;
  return url.pathname !== location.pathname || url.search !== location.search;
}

// Instant answers to a press, before the server does:
// - a thin bar at the top of the screen from the moment a link is clicked
//   until the next page is on screen;
// - native (non-React) forms such as "Выйти" can't be sent twice: a second
//   submit while the first is on its way is dropped.
// Forms with server actions use <SubmitButton>, which disables itself.
export function InstantFeedback() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [bar, setBar] = useState<'off' | 'on' | 'done'>('off');
  const giveUp = useRef<number | undefined>(undefined);

  useEffect(() => {
    const start = () => {
      setBar('on');
      window.clearTimeout(giveUp.current);
      giveUp.current = window.setTimeout(() => setBar('off'), GIVE_UP_MS);
    };
    const onClick = (e: MouseEvent) => {
      if (leadsElsewhere(e)) start();
    };

    const onSubmitCapture = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      if (form.hasAttribute('data-submitting')) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    // after React and the page's own handlers: only a form the browser will
    // really send (not one handled in JS) is locked
    const onSubmit = (e: SubmitEvent) => {
      if (e.defaultPrevented) return;
      const form = e.target as HTMLFormElement;
      if ((form.getAttribute('action') ?? '').startsWith('javascript:')) return;
      form.setAttribute('data-submitting', '');
      start();
      window.setTimeout(() => form.removeAttribute('data-submitting'), GIVE_UP_MS);
    };
    // coming back with the browser's back button: nothing is in flight any more
    const onPageShow = () => {
      document.querySelectorAll('form[data-submitting]').forEach((f) => f.removeAttribute('data-submitting'));
      setBar('off');
    };

    document.addEventListener('click', onClick);
    document.addEventListener('submit', onSubmitCapture, true);
    window.addEventListener('submit', onSubmit);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener(START_EVENT, start);
    // This component comes alive a little after the links do (it waits in a
    // Suspense). The mark tells the tests that presses are answered from now on.
    document.documentElement.dataset.instantFeedback = '';
    return () => {
      delete document.documentElement.dataset.instantFeedback;
      document.removeEventListener('click', onClick);
      document.removeEventListener('submit', onSubmitCapture, true);
      window.removeEventListener('submit', onSubmit);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener(START_EVENT, start);
    };
  }, []);

  // the new page is here
  useEffect(() => {
    setBar((b) => (b === 'on' ? 'done' : b));
    window.clearTimeout(giveUp.current);
  }, [pathname, search]);

  useEffect(() => {
    if (bar !== 'done') return;
    const t = window.setTimeout(() => setBar('off'), 350);
    return () => window.clearTimeout(t);
  }, [bar]);

  if (bar === 'off') return null;
  return <div className={bar === 'done' ? 'nav-progress done' : 'nav-progress'} role="progressbar" aria-label="Загрузка страницы" />;
}
