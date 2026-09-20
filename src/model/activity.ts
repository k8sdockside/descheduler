// What the descheduler did, read from the Events it leaves behind.
//
// There is no API to ask. Every eviction the descheduler makes is recorded as
// an Event on the pod it evicted, through the events.k8s.io recorder named
// "sigs.k8s.io.descheduler", and every eviction it was refused is another one,
// as a Warning. The app serves Events as core/v1, where the recorder's note
// arrives as `message` and its controller as `reportingComponent`, so this
// reads both spellings and falls back to the sentence itself:
//
//     pod eviction from node-3 node by sigs.k8s.io/descheduler
//     pod eviction from node-3 node by sigs.k8s.io/descheduler failed: \
//         error when evicting pod ... Cannot evict pod as it would violate the pod's disruption budget
//
// The event's `reason` is the plugin that asked for the eviction -- the
// descheduler puts the strategy name there -- which is what makes this a log
// worth reading rather than a list of pod names: it says *why* each pod moved.

import type { Event } from './kube.js';

export const RECORDER = 'sigs.k8s.io.descheduler';
export const MARK = 'sigs.k8s.io/descheduler';

export interface Eviction {
    /** Stable enough to key a row by: the event's uid, or where it lives. */
    id: string;
    /** RFC 3339, as the cluster wrote it. */
    when: string;
    /** The same moment in milliseconds, for sorting and bucketing. */
    at: number;
    namespace: string;
    pod: string;
    node: string;
    /** The descheduler plugin that asked for it; `''` when the event does not say. */
    strategy: string;
    result: 'evicted' | 'refused';
    /** Why it was refused, in the cluster's words. `''` for a success. */
    refusal: string;
    message: string;
    /** How many times this same event has been recorded. */
    count: number;
}

const SENTENCE = /pod eviction from (.+?) node by sigs\.k8s\.io\/descheduler(?:\s+failed:\s*([\s\S]*))?$/;

function timeOf(event: Event): string {
    return (
        event.lastTimestamp ||
        event.eventTime ||
        event.firstTimestamp ||
        event.metadata.creationTimestamp ||
        ''
    );
}

/** Whether an event came from the descheduler. */
export function fromDescheduler(event: Event): boolean {
    if (event.reportingComponent === RECORDER) return true;
    if (event.source?.component === RECORDER) return true;
    if (event.action === 'Descheduled') return true;
    return (event.message ?? event.note ?? '').includes(MARK);
}

/** The descheduler's events as evictions, newest first. */
export function evictions(events: Event[]): Eviction[] {
    const out: Eviction[] = [];
    for (const event of events) {
        if (!fromDescheduler(event)) continue;
        const message = event.message ?? event.note ?? '';
        const target = event.involvedObject ?? event.regarding ?? {};
        const parsed = SENTENCE.exec(message);
        const refused =
            event.type === 'Warning' || event.reason === 'EvictionFailed' || Boolean(parsed?.[2]);
        const when = timeOf(event);
        const at = Date.parse(when);
        out.push({
            id: event.metadata.uid || `${event.metadata.namespace ?? ''}/${event.metadata.name}`,
            when,
            at: Number.isNaN(at) ? 0 : at,
            namespace: target.namespace ?? event.metadata.namespace ?? '',
            pod: target.name ?? '',
            node: parsed?.[1]?.trim() ?? '',
            strategy: event.reason && event.reason !== 'EvictionFailed' ? event.reason : '',
            result: refused ? 'refused' : 'evicted',
            refusal: (parsed?.[2] ?? '').trim(),
            message,
            count: event.count ?? 1,
        });
    }
    return out.sort((a, b) => b.at - a.at);
}

/** Those recorded in the last `minutes`. */
export function since(list: Eviction[], minutes: number, now = Date.now()): Eviction[] {
    const floor = now - minutes * 60_000;
    return list.filter((item) => item.at >= floor);
}

export interface Totals {
    evicted: number;
    refused: number;
    pods: number;
    nodes: number;
    strategies: number;
}

export function totals(list: Eviction[]): Totals {
    const pods = new Set<string>();
    const nodes = new Set<string>();
    const strategies = new Set<string>();
    let evicted = 0;
    let refused = 0;
    for (const item of list) {
        if (item.result === 'evicted') evicted += item.count;
        else refused += item.count;
        pods.add(`${item.namespace}/${item.pod}`);
        if (item.node) nodes.add(item.node);
        if (item.strategy) strategies.add(item.strategy);
    }
    return { evicted, refused, pods: pods.size, nodes: nodes.size, strategies: strategies.size };
}

export interface Count {
    key: string;
    evicted: number;
    refused: number;
    total: number;
}

/** Counts by one field, largest first; blanks are folded into `unknown`. */
export function tally(list: Eviction[], pick: (item: Eviction) => string, unknown = '(no plugin named)'): Count[] {
    const counts = new Map<string, Count>();
    for (const item of list) {
        const key = pick(item) || unknown;
        const row = counts.get(key) ?? { key, evicted: 0, refused: 0, total: 0 };
        if (item.result === 'evicted') row.evicted += item.count;
        else row.refused += item.count;
        row.total += item.count;
        counts.set(key, row);
    }
    return [...counts.values()].sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
}

export interface Bucket {
    /** The bucket's first moment, in milliseconds. */
    start: number;
    evicted: number;
    refused: number;
}

/**
 * Evictions per bucket over a window ending now, oldest bucket first. Empty
 * buckets are kept -- a gap in a timeline means "nothing happened then", which
 * is half of what the chart is for.
 */
export function buckets(list: Eviction[], minutes: number, count: number, now = Date.now()): Bucket[] {
    const span = (minutes * 60_000) / count;
    const first = Math.floor((now - minutes * 60_000) / span) * span;
    const out: Bucket[] = [];
    for (let i = 0; i < count; i++) out.push({ start: first + i * span, evicted: 0, refused: 0 });
    for (const item of list) {
        const index = Math.floor((item.at - first) / span);
        const bucket = out[index];
        if (!bucket) continue;
        if (item.result === 'evicted') bucket.evicted += item.count;
        else bucket.refused += item.count;
    }
    return out;
}

export interface Filter {
    text: string;
    namespace: string;
    node: string;
    strategy: string;
    result: '' | 'evicted' | 'refused';
}

export const NO_FILTER: Filter = { text: '', namespace: '', node: '', strategy: '', result: '' };

export function apply(list: Eviction[], filter: Filter): Eviction[] {
    const text = filter.text.trim().toLowerCase();
    return list.filter((item) => {
        if (filter.namespace && item.namespace !== filter.namespace) return false;
        if (filter.node && item.node !== filter.node) return false;
        if (filter.strategy && item.strategy !== filter.strategy) return false;
        if (filter.result && item.result !== filter.result) return false;
        if (!text) return true;
        return `${item.namespace} ${item.pod} ${item.node} ${item.strategy} ${item.message}`
            .toLowerCase()
            .includes(text);
    });
}

/** The values a field takes across the list, sorted, for a picker. */
export function values(list: Eviction[], pick: (item: Eviction) => string): string[] {
    return [...new Set(list.map(pick).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
