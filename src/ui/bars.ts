// The two drawings this plugin makes: a column per time bucket, and a row per
// counted thing.
//
// Both are SVG built with the DOM, in the app's own chart tokens, so they
// follow the theme like everything else. No library: a bar chart is rectangles,
// and a dependency that draws rectangles would still not know what --chart-1
// is.

import { el } from './dom.js';
import type { Bucket, Count } from '../model/activity.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function node<K extends keyof SVGElementTagNameMap>(
    tag: K,
    attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
    const made = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) made.setAttribute(name, String(value));
    return made;
}

/** When a bucket started, written the way a chart axis wants it. */
export function clockAt(ms: number): string {
    const date = new Date(ms);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Evictions over time, one column per bucket: successes from the baseline,
 * refusals stacked on top in the error colour. An empty window draws its
 * gridline and says so, rather than collapsing to nothing.
 */
export function timeline(buckets: Bucket[], height = 72): HTMLElement {
    const width = Math.max(buckets.length * 8, 240);
    const top = Math.max(1, ...buckets.map((bucket) => bucket.evicted + bucket.refused));
    const chart = node('svg', {
        viewBox: `0 0 ${width} ${height}`,
        preserveAspectRatio: 'none',
        class: 'timeline',
        role: 'img',
        'aria-label': `Evictions over time: ${buckets.reduce((sum, b) => sum + b.evicted, 0)} evicted, ${buckets.reduce((sum, b) => sum + b.refused, 0)} refused`,
    });
    chart.append(node('line', { x1: 0, y1: height - 0.5, x2: width, y2: height - 0.5, stroke: 'var(--chart-grid, var(--border))', 'stroke-width': 1 }));
    const step = width / Math.max(buckets.length, 1);
    const bar = Math.max(2, step - 2);
    buckets.forEach((bucket, index) => {
        const x = index * step + (step - bar) / 2;
        const total = bucket.evicted + bucket.refused;
        if (!total) return;
        const evictedHeight = (bucket.evicted / top) * (height - 4);
        const refusedHeight = (bucket.refused / top) * (height - 4);
        if (refusedHeight > 0) {
            const rect = node('rect', {
                x,
                y: height - evictedHeight - refusedHeight,
                width: bar,
                height: Math.max(refusedHeight, 1),
                fill: 'var(--error)',
                rx: 1,
            });
            rect.append(title(`${clockAt(bucket.start)} — ${bucket.refused} refused`));
            chart.append(rect);
        }
        if (evictedHeight > 0) {
            const rect = node('rect', {
                x,
                y: height - evictedHeight,
                width: bar,
                height: Math.max(evictedHeight, 1),
                fill: 'var(--chart-1, var(--accent))',
                rx: 1,
            });
            rect.append(title(`${clockAt(bucket.start)} — ${bucket.evicted} evicted`));
            chart.append(rect);
        }
    });
    const first = buckets[0];
    const last = buckets[buckets.length - 1];
    return el(
        'div',
        { class: 'timeline-holder' },
        chart,
        el(
            'div',
            { class: 'timeline-axis' },
            el('span', {}, first ? clockAt(first.start) : ''),
            el('span', { class: 'faint' }, `peak ${top}`),
            el('span', {}, last ? clockAt(last.start) : ''),
        ),
    );
}

function title(text: string): SVGTitleElement {
    const made = document.createElementNS(SVG_NS, 'title');
    made.textContent = text;
    return made;
}

/** A counted list as rows of bars -- by plugin, by namespace, by node. */
export function bars(counts: Count[], limit = 8): HTMLElement {
    const shown = counts.slice(0, limit);
    const top = Math.max(1, ...shown.map((count) => count.total));
    const list = el('div', { class: 'bars' });
    for (const count of shown) {
        const evicted = (count.evicted / top) * 100;
        const refused = (count.refused / top) * 100;
        list.append(
            el(
                'div',
                { class: 'bar-row' },
                el('div', { class: 'bar-label', title: count.key }, count.key),
                el(
                    'div',
                    { class: 'bar-track' },
                    el('div', { class: 'bar-fill', style: `width:${evicted.toFixed(1)}%` }),
                    refused > 0 ? el('div', { class: 'bar-fill bar-refused', style: `width:${refused.toFixed(1)}%` }) : null,
                ),
                el('div', { class: 'bar-value' }, count.refused ? `${count.evicted} + ${count.refused}` : String(count.evicted)),
            ),
        );
    }
    if (!shown.length) list.append(el('p', { class: 'faint' }, 'Nothing yet.'));
    return list;
}

/** A ring of one value out of a total, for "how much of the window was this". */
export function share(value: number, total: number, label: string): HTMLElement {
    const fraction = total > 0 ? Math.min(1, value / total) : 0;
    const radius = 15;
    const circumference = 2 * Math.PI * radius;
    const ring = node('svg', { viewBox: '0 0 40 40', class: 'ring', role: 'img', 'aria-label': `${label}: ${value} of ${total}` });
    ring.append(node('circle', { cx: 20, cy: 20, r: radius, fill: 'none', stroke: 'var(--border)', 'stroke-width': 4 }));
    ring.append(
        node('circle', {
            cx: 20,
            cy: 20,
            r: radius,
            fill: 'none',
            stroke: 'var(--accent)',
            'stroke-width': 4,
            'stroke-linecap': 'round',
            'stroke-dasharray': `${(fraction * circumference).toFixed(2)} ${circumference.toFixed(2)}`,
            transform: 'rotate(-90 20 20)',
        }),
    );
    return el('div', { class: 'ring-holder' }, ring, el('div', { class: 'ring-label' }, label));
}

/** One chart series as a sparkline, for the compact chart rows on the overview. */
export function sparkline(points: K8sDockside.ChartPoint[], width = 160, height = 26): SVGElement {
    const line = node('svg', { viewBox: `0 0 ${width} ${height}`, class: 'spark', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    if (points.length < 2) return line;
    const times = points.map((point) => point.t);
    const values = points.map((point) => point.v);
    const firstTime = Math.min(...times);
    const lastTime = Math.max(...times);
    const top = Math.max(...values, 0);
    const span = Math.max(1, lastTime - firstTime);
    const path = points
        .map((point) => {
            const x = ((point.t - firstTime) / span) * width;
            const y = height - (top > 0 ? (point.v / top) * (height - 2) : 0) - 1;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
    line.append(
        node('polyline', {
            points: path,
            fill: 'none',
            stroke: 'var(--chart-1, var(--accent))',
            'stroke-width': 1.5,
            'stroke-linejoin': 'round',
            'stroke-linecap': 'round',
            'vector-effect': 'non-scaling-stroke',
        }),
    );
    return line;
}

/** A chart value written the way its unit asks for. */
export function formatValue(unit: string, value: number): string {
    if (!Number.isFinite(value)) return '—';
    switch (unit) {
        case 'percent':
            return `${(value * 100).toFixed(0)}%`;
        case 'bytes':
        case 'bytes/s': {
            const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
            let size = value;
            let index = 0;
            while (size >= 1024 && index < units.length - 1) {
                size /= 1024;
                index++;
            }
            return `${size.toFixed(size < 10 && index > 0 ? 1 : 0)} ${units[index]}${unit.endsWith('/s') ? '/s' : ''}`;
        }
        case 'seconds':
            return value < 1 ? `${(value * 1000).toFixed(0)} ms` : `${value.toFixed(value < 10 ? 2 : 0)} s`;
        case 'cores':
            return value < 1 ? `${(value * 1000).toFixed(0)}m` : value.toFixed(2);
        case 'ops/s':
            return `${value.toFixed(2)}/s`;
        default:
            return value >= 100 ? value.toFixed(0) : value.toFixed(value < 10 ? 1 : 0);
    }
}
