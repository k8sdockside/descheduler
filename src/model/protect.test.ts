import { describe, expect, test } from 'vitest';
import type { Pod, PodDisruptionBudget } from './kube.js';
import { EVICT_ANNOTATION, SYSTEM_CRITICAL_PRIORITY, effectiveProtections, evaluate, seconds } from './protect.js';

const NOW = Date.parse('2026-09-20T12:00:00Z');

function pod(over: Partial<Pod> = {}): Pod {
    return {
        metadata: {
            name: 'web-1',
            namespace: 'shop',
            creationTimestamp: '2026-09-20T09:00:00Z',
            ownerReferences: [{ apiVersion: 'apps/v1', kind: 'ReplicaSet', name: 'web-abc', uid: 'u1', controller: true }],
            ...(over.metadata ?? {}),
        },
        spec: { nodeName: 'node-1', containers: [{ name: 'web' }], ...(over.spec ?? {}) },
        status: { phase: 'Running', ...(over.status ?? {}) },
    };
}

const blockers = (pod: Pod, evictor: Record<string, unknown>, extra = {}) =>
    evaluate(pod, { profile: 'default', evictor, now: NOW, ...extra })
        .checks.filter((check) => check.outcome === 'blocked')
        .map((check) => check.label);

describe('which protections are in force', () => {
    test('the defaults, when the policy says nothing', () => {
        expect([...effectiveProtections({})].sort()).toEqual([
            'DaemonSetPods',
            'FailedBarePods',
            'PodsWithLocalStorage',
            'SystemCriticalPods',
        ]);
    });

    test('the old booleans switch them off one at a time', () => {
        const set = effectiveProtections({ evictLocalStoragePods: true, ignorePvcPods: true });
        expect(set.has('PodsWithLocalStorage')).toBe(false);
        expect(set.has('PodsWithPVC')).toBe(true);
    });

    test('podProtections wins outright once it says anything', () => {
        // The descheduler does not merge the two spellings: the new one replaces
        // the old, so a policy with both does not keep the old switches.
        const set = effectiveProtections({
            evictLocalStoragePods: true,
            podProtections: { defaultDisabled: ['DaemonSetPods'], extraEnabled: ['PodsWithoutPDB'] },
        });
        expect(set.has('PodsWithLocalStorage')).toBe(true);
        expect(set.has('DaemonSetPods')).toBe(false);
        expect(set.has('PodsWithoutPDB')).toBe(true);
    });
});

describe('what stops a pod being evicted', () => {
    test('an ordinary pod under the default evictor is fair game', () => {
        const answer = evaluate(pod(), { profile: 'default', evictor: {}, now: NOW });
        expect(answer.evictable).toBe(true);
    });

    test('the evict annotation short-circuits every other check', () => {
        const marked = pod({
            metadata: {
                name: 'web-1',
                namespace: 'shop',
                annotations: { [EVICT_ANNOTATION]: 'true' },
                ownerReferences: [{ apiVersion: 'apps/v1', kind: 'DaemonSet', name: 'agent', uid: 'u2', controller: true }],
            },
            spec: { volumes: [{ name: 'scratch', emptyDir: {} }] },
        });
        const answer = evaluate(marked, { profile: 'default', evictor: {}, now: NOW });
        expect(answer.evictable).toBe(true);
        expect(answer.checks).toHaveLength(1);
    });

    test('a DaemonSet pod, unless the policy says otherwise', () => {
        const agent = pod({
            metadata: {
                name: 'agent-1',
                namespace: 'shop',
                ownerReferences: [{ apiVersion: 'apps/v1', kind: 'DaemonSet', name: 'agent', uid: 'u2', controller: true }],
            },
        });
        expect(blockers(agent, {}, { owner: { kind: 'DaemonSet', replicas: 3 } })).toContain('DaemonSet pod');
        expect(blockers(agent, { evictDaemonSetPods: true }, { owner: { kind: 'DaemonSet', replicas: 3 } })).not.toContain(
            'DaemonSet pod',
        );
    });

    test('local storage', () => {
        const scratch = pod({ spec: { volumes: [{ name: 'scratch', emptyDir: {} }] } });
        expect(blockers(scratch, {})).toContain('Local storage');
        expect(blockers(scratch, { evictLocalStoragePods: true })).not.toContain('Local storage');
    });

    test('a PVC only when the policy protects them', () => {
        const stateful = pod({ spec: { volumes: [{ name: 'data', persistentVolumeClaim: { claimName: 'data-0' } }] } });
        expect(blockers(stateful, {})).not.toContain('Persistent volume');
        expect(blockers(stateful, { ignorePvcPods: true })).toContain('Persistent volume');
    });

    test('a bare pod, and a failed bare pod once they are allowed', () => {
        const bare = pod({ metadata: { name: 'debug', namespace: 'shop', ownerReferences: [] } });
        expect(blockers(bare, {})).toContain('No owner');
        expect(blockers(bare, { evictFailedBarePods: true })).toContain('No owner');
        const failed = pod({ metadata: { name: 'debug', namespace: 'shop', ownerReferences: [] }, status: { phase: 'Failed' } });
        expect(blockers(failed, { evictFailedBarePods: true })).not.toContain('No owner');
    });

    test('system critical priority', () => {
        const critical = pod({ spec: { priority: SYSTEM_CRITICAL_PRIORITY, priorityClassName: 'system-cluster-critical' } });
        expect(blockers(critical, {})).toContain('System critical');
        expect(blockers(critical, { evictSystemCriticalPods: true })).not.toContain('System critical');
    });

    test('the priority threshold is only read while system-critical protection is on', () => {
        const important = pod({ spec: { priority: 5000 } });
        expect(blockers(important, { priorityThreshold: { value: 1000 } })).toContain('Priority threshold');
        const off = evaluate(important, {
            profile: 'default',
            evictor: { evictSystemCriticalPods: true, priorityThreshold: { value: 1000 } },
            now: NOW,
        });
        expect(off.checks.find((check) => check.label === 'Priority threshold')?.outcome).toBe('unknown');
    });

    test('a pod younger than minPodAge', () => {
        const fresh = pod({ status: { phase: 'Running', startTime: '2026-09-20T11:58:00Z' } });
        expect(blockers(fresh, { minPodAge: '5m' })).toContain('Pod age');
        expect(blockers(pod(), { minPodAge: '5m' })).not.toContain('Pod age');
    });

    test('an owner smaller than minReplicas', () => {
        expect(blockers(pod(), { minReplicas: 3 }, { owner: { kind: 'ReplicaSet', replicas: 2 } })).toContain('Owner size');
        expect(blockers(pod(), { minReplicas: 3 }, { owner: { kind: 'ReplicaSet', replicas: 3 } })).not.toContain('Owner size');
    });

    test('a pod with no PodDisruptionBudget, when the policy asks for one', () => {
        const covered: PodDisruptionBudget = {
            metadata: { name: 'web', namespace: 'shop' },
            spec: { selector: { matchLabels: { app: 'web' } } },
        };
        const labelled = pod({ metadata: { name: 'web-1', namespace: 'shop', labels: { app: 'web' } } });
        expect(blockers(labelled, { ignorePodsWithoutPDB: true }, { pdbs: [covered] })).not.toContain('PodDisruptionBudget');
        expect(blockers(pod(), { ignorePodsWithoutPDB: true }, { pdbs: [covered] })).toContain('PodDisruptionBudget');
    });

    test('a terminating pod is already going', () => {
        expect(blockers(pod({ metadata: { name: 'web-1', namespace: 'shop', deletionTimestamp: '2026-09-20T11:59:00Z' } }), {})).toContain(
            'Terminating',
        );
    });

    test('a static pod belongs to its kubelet', () => {
        const static_ = pod({
            metadata: { name: 'etcd-node-1', namespace: 'kube-system', annotations: { 'kubernetes.io/config.source': 'file' } },
        });
        expect(blockers(static_, {})).toContain('Static pod');
    });

    test('nodeFit is honest about not being worked out here', () => {
        const answer = evaluate(pod(), { profile: 'default', evictor: { nodeFit: true }, now: NOW });
        expect(answer.evictable).toBeNull();
        expect(answer.checks.find((check) => check.label === 'Somewhere to go')?.outcome).toBe('unknown');
    });
});

describe('durations', () => {
    test.each([
        ['5m', 300],
        ['1h30m', 5400],
        ['90s', 90],
        ['', null],
        ['soon', null],
    ])('%s', (text, want) => {
        expect(seconds(text)).toBe(want);
    });
});
