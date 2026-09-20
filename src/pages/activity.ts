// Activity: the log this plugin exists for.
//
// The filter bar is built once and the results are redrawn under it, so a
// poll landing while somebody is typing does not take the cursor out of the
// box. Everything else is model code: the events come in whole, and
// activity.ts turns them into evictions, buckets and tallies.

import { byId, button, el, replace, svg } from '../ui/dom.js';
import { start } from '../ui/page.js';
import { block, evictionTable, picker } from '../ui/parts.js';
import { bars, timeline } from '../ui/bars.js';
import { SEARCH, TERMINAL } from '../ui/icons.js';
import { findDescheduler, listOrNone, pods as listPods, watchEvents } from '../ui/cluster.js';
import type { Event, Pod } from '../model/kube.js';
import { ownPods } from '../model/install.js';
import type { Eviction, Filter } from '../model/activity.js';
import { NO_FILTER, apply, buckets, evictions, since as within, tally, totals, values } from '../model/activity.js';

const WINDOWS = [
    { value: '60', label: 'last hour' },
    { value: '360', label: 'last 6 hours' },
    { value: '1440', label: 'last day' },
    { value: '10080', label: 'last week' },
    { value: '0', label: 'everything kept' },
];

let filter: Filter = { ...NO_FILTER };
let minutes = 360;
let all: Eviction[] = [];
let logPod: Pod | null = null;

start('page', async () => {
    const remembered = await k8sdockside.storage?.get<number>('window').catch(() => null);
    if (typeof remembered === 'number' && WINDOWS.some((option) => option.value === String(remembered))) {
        minutes = remembered;
    }

    // The descheduler's own pod, for the button that opens its raw log.
    void findDescheduler()
        .then(async (found) => {
            if (!found.install) return;
            const pods = ownPods(await listPods(found.install.namespace), found.install);
            logPod =
                pods
                    .slice()
                    .sort((a, b) => (b.metadata.creationTimestamp ?? '').localeCompare(a.metadata.creationTimestamp ?? ''))[0] ??
                null;
            drawFilters();
        })
        .catch(() => {});

    drawFilters();
    replace(byId('rows'), el('p', { class: 'loading' }, 'Reading the cluster’s events…'));

    const stop = watchEvents(
        (events: Event[]) => {
            all = evictions(events);
            draw();
        },
        (err) => {
            replace(byId('rows'), el('div', { class: 'failure' }, `Events could not be read: ${err.message}`));
        },
    );
    window.addEventListener('pagehide', () => stop());

    // A first read straight away, so the page is not empty while the watch
    // waits out its interval.
    all = evictions(await listOrNone<Event>({ kind: 'events', namespace: '' }));
    draw();
});

function windowed(): Eviction[] {
    return minutes > 0 ? within(all, minutes) : all;
}

function drawFilters(): void {
    const search = el('input', {
        type: 'search',
        placeholder: 'pod, node, message…',
        value: filter.text,
        'aria-label': 'Search',
    }) as HTMLInputElement;
    search.addEventListener('input', () => {
        filter = { ...filter, text: search.value };
        draw();
    });

    const list = windowed();
    replace(
        byId('filters'),
        svg(SEARCH, 'icon'),
        search,
        picker('Window', WINDOWS, String(minutes), (value) => {
            minutes = Number(value);
            void k8sdockside.storage?.set('window', minutes).catch(() => {});
            drawFilters();
            draw();
        }),
        picker(
            'Plugin',
            [{ value: '', label: 'every plugin' }, ...values(list, (item) => item.strategy).map((name) => ({ value: name, label: name }))],
            filter.strategy,
            (value) => {
                filter = { ...filter, strategy: value };
                draw();
            },
        ),
        picker(
            'Namespace',
            [{ value: '', label: 'every namespace' }, ...values(list, (item) => item.namespace).map((name) => ({ value: name, label: name }))],
            filter.namespace,
            (value) => {
                filter = { ...filter, namespace: value };
                draw();
            },
        ),
        picker(
            'Node',
            [{ value: '', label: 'every node' }, ...values(list, (item) => item.node).map((name) => ({ value: name, label: name }))],
            filter.node,
            (value) => {
                filter = { ...filter, node: value };
                draw();
            },
        ),
        picker(
            'Result',
            [
                { value: '', label: 'evicted and refused' },
                { value: 'evicted', label: 'evicted only' },
                { value: 'refused', label: 'refused only' },
            ],
            filter.result,
            (value) => {
                filter = { ...filter, result: value as Filter['result'] };
                draw();
            },
        ),
        el('span', { class: 'spacer' }),
        logButton(),
    );
}

/** The button that opens the descheduler's own log in the app's log view. */
function logButton(): HTMLElement | null {
    const pod = logPod;
    if (!pod) return null;
    const made = button('Descheduler’s log', () =>
        void k8sdockside
            .logs({ kind: 'pods', namespace: pod.metadata.namespace ?? '', name: pod.metadata.name })
            .catch(() => {}),
    );
    made.prepend(svg(TERMINAL, 'icon'));
    return made;
}

function draw(): void {
    const list = windowed();
    const shown = apply(list, filter);
    const counts = totals(shown);
    const span = minutes > 0 ? minutes : 24 * 60;

    replace(
        byId('summary'),
        el(
            'div',
            { class: 'stats' },
            el('div', { class: 'stat' }, el('div', { class: 'stat-value tone-ok' }, String(counts.evicted)), el('div', { class: 'stat-label' }, 'Evicted')),
            el('div', { class: 'stat' }, el('div', { class: `stat-value ${counts.refused ? 'tone-error' : ''}` }, String(counts.refused)), el('div', { class: 'stat-label' }, 'Refused')),
            el('div', { class: 'stat' }, el('div', { class: 'stat-value' }, String(counts.pods)), el('div', { class: 'stat-label' }, 'Pods')),
            el('div', { class: 'stat' }, el('div', { class: 'stat-value' }, String(counts.nodes)), el('div', { class: 'stat-label' }, 'Nodes')),
        ),
        block(
            'Over time',
            '',
            timeline(buckets(shown, span, 60)),
            el(
                'div',
                { class: 'columns', style: 'margin-top:10px' },
                el('div', {}, el('h3', {}, 'By plugin'), bars(tally(shown, (item) => item.strategy))),
                el('div', {}, el('h3', {}, 'By namespace'), bars(tally(shown, (item) => item.namespace))),
                el('div', {}, el('h3', {}, 'By node'), bars(tally(shown, (item) => item.node))),
            ),
        ),
    );

    replace(
        byId('rows'),
        block(
            `${shown.length} eviction${shown.length === 1 ? '' : 's'}`,
            shown.length === list.length ? '' : `Filtered from ${list.length} in this window.`,
            el('div', { class: 'scroll' }, evictionTable(shown.slice(0, 500))),
            shown.length > 500 ? el('p', { class: 'faint' }, 'Showing the newest 500.') : null,
        ),
    );
}
