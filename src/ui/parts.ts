// The pieces more than one page draws.

import { button, dot, el, svg } from './dom.js';
import { since } from './page.js';
import { forOutcome } from './icons.js';
import type { Eviction } from '../model/activity.js';
import type { Check } from '../model/protect.js';
import type { Verdict } from '../model/install.js';

/** The banner every page leads with: one line, and a sentence under it. */
export function verdictBanner(verdict: Verdict, ...extra: (Node | null)[]): HTMLElement {
    return el(
        'div',
        { class: `verdict verdict-${verdict.tone}` },
        el('span', { class: `dot dot-${verdict.tone}`, 'aria-hidden': 'true' }),
        el(
            'div',
            {},
            el('p', { class: 'verdict-headline' }, verdict.headline),
            el('p', { class: 'verdict-detail' }, verdict.detail),
            ...extra.filter((node): node is Node => node !== null),
        ),
    );
}

/** A moment, as how long ago it was, with the full stamp behind the pointer. */
export function moment(when: string, now = Date.now()): HTMLElement {
    const parsed = Date.parse(when);
    const full = Number.isNaN(parsed) ? when : new Date(parsed).toLocaleString();
    return el('span', { title: full }, since(when, now));
}

/** `namespace/name`, where the name opens the object in the app. */
export function objectLink(kind: string, namespace: string, name: string, label = name): HTMLElement {
    if (!name) return el('span', { class: 'faint' }, '—');
    return button(label, () => void k8sdockside.open({ kind, namespace, name }).catch(() => {}), { class: 'link' });
}

/** The evictions table, as Activity and the panels all draw it. */
export function evictionTable(
    list: Eviction[],
    options: { showNamespace?: boolean; showNode?: boolean; showPod?: boolean } = {},
): HTMLElement {
    const showNamespace = options.showNamespace ?? true;
    const showNode = options.showNode ?? true;
    const showPod = options.showPod ?? true;
    const now = Date.now();
    const head = el(
        'tr',
        {},
        el('th', {}, 'When'),
        showPod ? el('th', {}, 'Pod') : null,
        showNamespace ? el('th', {}, 'Namespace') : null,
        showNode ? el('th', {}, 'Node') : null,
        el('th', {}, 'Asked for by'),
        el('th', {}, 'Result'),
    );
    const body = el('tbody', {});
    for (const item of list) {
        body.append(
            el(
                'tr',
                {},
                el('td', { class: 'faint' }, moment(item.when, now)),
                showPod ? el('td', {}, objectLink('pods', item.namespace, item.pod)) : null,
                showNamespace ? el('td', { class: 'faint' }, item.namespace) : null,
                showNode ? el('td', {}, item.node ? objectLink('nodes', '', item.node) : el('span', { class: 'faint' }, '—')) : null,
                el('td', {}, item.strategy ? el('span', { class: 'tag' }, item.strategy) : el('span', { class: 'faint' }, '—')),
                el(
                    'td',
                    { class: item.refusal ? 'wrap' : '' },
                    dot(item.result === 'evicted' ? 'ok' : 'error'),
                    ' ',
                    item.result === 'evicted' ? 'evicted' : 'refused',
                    item.refusal ? el('div', { class: 'faint' }, item.refusal) : null,
                ),
            ),
        );
    }
    if (!list.length) {
        return el('p', { class: 'empty' }, 'Nothing in this window. The descheduler records an event for every pod it evicts.');
    }
    return el('table', {}, el('thead', {}, head), body);
}

/** One of the DefaultEvictor's checks, with its mark. */
export function checkRow(check: Check): HTMLElement {
    return el(
        'div',
        { class: 'check' },
        svg(forOutcome(check.outcome), `icon check-${check.outcome}`),
        el('span', { class: 'check-label' }, check.label),
        el('span', { class: 'check-detail' }, check.detail),
    );
}

/** A labelled list of facts. */
export function facts(pairs: [string, Node | string][]): HTMLElement {
    const list = el('dl', { class: 'facts' });
    for (const [term, value] of pairs) {
        list.append(el('dt', {}, term), el('dd', {}, typeof value === 'string' ? (value || '—') : value));
    }
    return list;
}

/** A heading with a sentence and some content under it. */
export function block(title: string, note: string, ...children: (Node | null)[]): HTMLElement {
    return el(
        'section',
        { class: 'block' },
        el('h2', {}, title),
        note ? el('p', { class: 'note' }, note) : null,
        ...children.filter((child): child is Node => child !== null),
    );
}

/** A picker: a label, a select, and what to do when it changes. */
export function picker(
    label: string,
    options: { value: string; label: string }[],
    value: string,
    onPick: (value: string) => void,
): HTMLElement {
    const select = el('select', { 'aria-label': label }) as HTMLSelectElement;
    for (const option of options) {
        select.append(el('option', { value: option.value, ...(option.value === value ? { selected: 'selected' } : {}) }, option.label));
    }
    select.addEventListener('change', () => onPick(select.value));
    return select;
}
