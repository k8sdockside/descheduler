// The icons the pages draw, as inline SVG.
//
// Inline because the page has no network: it cannot fetch an icon font or a
// sprite sheet. These are 16x16, stroke-based, and inherit `currentColor` so
// they follow the theme without a second thought.

export const CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 8.4l3 3 6.6-6.8"/></svg>';
export const CROSS = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
export const QUESTION = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5.8 5.8a2.3 2.3 0 114 1.6c-.9.8-1.8 1.2-1.8 2.3"/><path d="M8 12.6v.01"/></svg>';
export const CLOCK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="5.6"/><path d="M8 4.8V8l2.2 1.6"/></svg>';
export const SERVER = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><rect x="2.2" y="2.6" width="11.6" height="4.6" rx="1"/><rect x="2.2" y="8.8" width="11.6" height="4.6" rx="1"/><path d="M4.6 4.9v.01M4.6 11.1v.01"/></svg>';
export const BOX = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M8 1.7l5.5 3v6.6L8 14.3l-5.5-3V4.7z"/><path d="M2.5 4.7L8 7.7l5.5-3M8 7.7v6.6"/></svg>';
export const SLIDERS = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M2.5 4.5h11M2.5 11.5h11"/><circle cx="6" cy="4.5" r="1.7" fill="var(--bg-panel)"/><circle cx="10.5" cy="11.5" r="1.7" fill="var(--bg-panel)"/></svg>';
export const SEARCH = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="7" cy="7" r="4.3"/><path d="M10.2 10.2L14 14"/></svg>';
export const TERMINAL = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5l3 3.5-3 3.5M8 11.5h5"/></svg>';
export const ARROW = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5"/></svg>';

/** The mark beside a check: what it did to the verdict. */
export function forOutcome(outcome: 'blocked' | 'allowed' | 'unknown'): string {
    if (outcome === 'blocked') return CROSS;
    if (outcome === 'allowed') return CHECK;
    return QUESTION;
}
