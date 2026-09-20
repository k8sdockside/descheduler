import { describe, expect, test } from 'vitest';
import type { Event } from './kube.js';
import { apply, buckets, evictions, fromDescheduler, since, tally, totals, values } from './activity.js';

/** An event as the descheduler's recorder writes it, read back through core/v1. */
function evicted(pod: string, node: string, strategy: string, when: string, namespace = 'shop'): Event {
    return {
        metadata: { name: `${pod}.17abc`, namespace, uid: `${pod}-${when}` },
        type: 'Normal',
        reason: strategy,
        action: 'Descheduled',
        message: `pod eviction from ${node} node by sigs.k8s.io/descheduler`,
        reportingComponent: 'sigs.k8s.io.descheduler',
        lastTimestamp: when,
        involvedObject: { kind: 'Pod', namespace, name: pod },
        count: 1,
    };
}

function refused(pod: string, node: string, why: string, when: string): Event {
    return {
        metadata: { name: `${pod}.17def`, namespace: 'shop', uid: `${pod}-fail` },
        type: 'Warning',
        reason: 'EvictionFailed',
        action: 'Descheduled',
        message: `pod eviction from ${node} node by sigs.k8s.io/descheduler failed: ${why}`,
        reportingComponent: 'sigs.k8s.io.descheduler',
        lastTimestamp: when,
        involvedObject: { kind: 'Pod', namespace: 'shop', name: pod },
    };
}

const somebodyElse: Event = {
    metadata: { name: 'web.17aaa', namespace: 'shop' },
    type: 'Normal',
    reason: 'Scheduled',
    message: 'Successfully assigned shop/web to node-1',
    source: { component: 'default-scheduler' },
    lastTimestamp: '2026-09-20T10:00:00Z',
    involvedObject: { kind: 'Pod', namespace: 'shop', name: 'web' },
};

describe('telling the descheduler’s events apart', () => {
    test('by the controller that reported them', () => {
        expect(fromDescheduler(evicted('web-1', 'node-1', 'RemoveDuplicates', '2026-09-20T10:00:00Z'))).toBe(true);
    });

    test('by the sentence, when the app gives no reporting component', () => {
        const bare: Event = {
            metadata: { name: 'x' },
            message: 'pod eviction from node-2 node by sigs.k8s.io/descheduler',
        };
        expect(fromDescheduler(bare)).toBe(true);
    });

    test('the scheduler’s own events are not the descheduler’s', () => {
        expect(fromDescheduler(somebodyElse)).toBe(false);
    });
});

describe('reading an eviction', () => {
    const list = evictions([
        evicted('web-1', 'node-1', 'RemoveDuplicates', '2026-09-20T10:00:00Z'),
        refused('web-2', 'node-2', 'Cannot evict pod as it would violate the pod’s disruption budget', '2026-09-20T10:05:00Z'),
        somebodyElse,
    ]);

    test('keeps only the descheduler’s, newest first', () => {
        expect(list).toHaveLength(2);
        expect(list[0]?.pod).toBe('web-2');
    });

    test('takes the node out of the sentence', () => {
        expect(list[1]?.node).toBe('node-1');
    });

    test('the reason is the plugin that asked', () => {
        expect(list[1]?.strategy).toBe('RemoveDuplicates');
    });

    test('a refusal keeps why, and claims no plugin it does not know', () => {
        expect(list[0]?.result).toBe('refused');
        expect(list[0]?.refusal).toContain('disruption budget');
        expect(list[0]?.strategy).toBe('');
    });

    test('totals count both kinds apart', () => {
        expect(totals(list)).toMatchObject({ evicted: 1, refused: 1, pods: 2, nodes: 2 });
    });
});

describe('slicing the list', () => {
    const now = Date.parse('2026-09-20T12:00:00Z');
    const list = evictions([
        evicted('a', 'node-1', 'PodLifeTime', '2026-09-20T11:50:00Z'),
        evicted('b', 'node-1', 'PodLifeTime', '2026-09-20T11:30:00Z'),
        evicted('c', 'node-2', 'RemoveDuplicates', '2026-09-20T06:00:00Z', 'data'),
        refused('d', 'node-2', 'too many requests', '2026-09-20T11:55:00Z'),
    ]);

    test('a window keeps what falls inside it', () => {
        expect(since(list, 60, now).map((item) => item.pod).sort()).toEqual(['a', 'b', 'd']);
    });

    test('tallies are largest first and split by result', () => {
        const byNode = tally(list, (item) => item.node);
        expect(byNode[0]).toMatchObject({ key: 'node-1', evicted: 2, refused: 0 });
        expect(byNode[1]).toMatchObject({ key: 'node-2', evicted: 1, refused: 1 });
    });

    test('a blank field is folded into its own bucket rather than dropped', () => {
        expect(tally(list, (item) => item.strategy).map((count) => count.key)).toContain('(no plugin named)');
    });

    test('buckets cover the whole window, empty ones included', () => {
        const columns = buckets(list, 120, 12, now);
        expect(columns).toHaveLength(12);
        expect(columns.reduce((sum, column) => sum + column.evicted + column.refused, 0)).toBe(3);
    });

    test('filters compose, and the text one looks at the message too', () => {
        expect(apply(list, { text: '', namespace: 'data', node: '', strategy: '', result: '' })).toHaveLength(1);
        expect(apply(list, { text: '', namespace: '', node: 'node-1', strategy: 'PodLifeTime', result: '' })).toHaveLength(2);
        expect(apply(list, { text: 'node-2', namespace: '', node: '', strategy: '', result: 'refused' })).toHaveLength(1);
    });

    test('values are the picker’s options, sorted and without blanks', () => {
        expect(values(list, (item) => item.node)).toEqual(['node-1', 'node-2']);
    });
});
