// The panel in every node's detail view: what the descheduler has moved off it.
//
// A node that keeps losing pods is either the busiest in the cluster or the one
// with the taint nobody tolerates, and either way the list belongs next to the
// node rather than three tabs away.

import { byId, el, replace, button } from '../ui/dom.js';
import { start } from '../ui/page.js';
import { evictionTable } from '../ui/parts.js';
import { timeline } from '../ui/bars.js';
import { listOrNone } from '../ui/cluster.js';
import type { Event } from '../model/kube.js';
import { buckets, evictions, since as within, tally, totals } from '../model/activity.js';

start('page', async (ctx) => {
    const node = ctx.object;
    if (!node) return;
    const events = await listOrNone<Event>({ kind: 'events', namespace: '' });
    const mine = evictions(events).filter((item) => item.node === node.name);
    const day = within(mine, 24 * 60);
    const counts = totals(day);

    byId('loading').remove();
    const body = byId('body');

    if (!mine.length) {
        replace(
            body,
            el(
                'p',
                { class: 'note' },
                'The descheduler has not evicted anything from this node in the events the cluster still holds — which is about an hour’s worth, by default.',
            ),
        );
        return;
    }

    const byPlugin = tally(day, (item) => item.strategy);
    replace(
        body,
        el(
            'div',
            { class: 'bar' },
            el('strong', {}, `${counts.evicted} evicted`),
            counts.refused ? el('span', { class: 'tone-error' }, `${counts.refused} refused`) : null,
            el('span', { class: 'faint' }, 'in the last day'),
            el('span', { class: 'faint' }, byPlugin.length ? `· mostly ${byPlugin[0]?.key}` : ''),
            el('span', { class: 'spacer' }),
            button('Open Activity', () => void k8sdockside.openView('activity')),
        ),
        timeline(buckets(day, 24 * 60, 48), 52),
        evictionTable(mine.slice(0, 12), { showNode: false }),
    );
});
