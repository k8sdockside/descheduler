import { describe, expect, test } from 'vitest';
import type { CronJob, Deployment } from './kube.js';
import { cadence, cronInWords, findInstalls, flags, isDescheduler, policySource, verdict } from './install.js';

const container = {
    name: 'descheduler',
    image: 'registry.k8s.io/descheduler/descheduler:v0.33.0',
    command: ['/bin/descheduler'],
    args: ['--policy-config-file', '/policy-dir/policy.yaml', '--descheduling-interval=5m', '--v=3'],
    volumeMounts: [{ name: 'policy-volume', mountPath: '/policy-dir' }],
};

const spec = {
    containers: [container],
    volumes: [{ name: 'policy-volume', configMap: { name: 'descheduler' } }],
};

const deployment: Deployment = {
    metadata: { name: 'descheduler', namespace: 'kube-system', labels: { 'app.kubernetes.io/name': 'descheduler' } },
    spec: { replicas: 1, template: { metadata: { labels: { 'app.kubernetes.io/name': 'descheduler' } }, spec } },
    status: { readyReplicas: 1 },
};

const cronJob: CronJob = {
    metadata: { name: 'descheduler', namespace: 'kube-system' },
    spec: {
        schedule: '*/2 * * * *',
        jobTemplate: { metadata: { labels: { 'app.kubernetes.io/name': 'descheduler' } }, spec: { template: { spec } } },
    },
    status: { lastScheduleTime: '2026-09-20T10:00:00Z' },
};

describe('flags', () => {
    test('reads --flag=value and --flag value alike', () => {
        const read = flags(['--dry-run', '--policy-config-file', '/p/policy.yaml', '--descheduling-interval=5m']);
        expect(read.get('dry-run')).toBe('true');
        expect(read.get('policy-config-file')).toBe('/p/policy.yaml');
        expect(read.get('descheduling-interval')).toBe('5m');
    });

    test('a flag followed by another flag has no value of its own', () => {
        // --dry-run --v=3 must not read "3" as the value of dry-run.
        const read = flags(['--dry-run', '--v=3']);
        expect(read.get('dry-run')).toBe('true');
        expect(read.get('v')).toBe('3');
    });
});

describe('finding it', () => {
    test('a Deployment running the image', () => {
        const [install] = findInstalls([deployment], []);
        expect(install?.mode).toBe('deployment');
        expect(install?.namespace).toBe('kube-system');
        expect(install?.version).toBe('v0.33.0');
        expect(install?.interval).toBe('5m');
        expect(install?.dryRun).toBe(false);
        expect(install?.ready).toBe(1);
    });

    test('a CronJob, with its schedule', () => {
        const [install] = findInstalls([], [cronJob]);
        expect(install?.mode).toBe('cronjob');
        expect(install?.schedule).toBe('*/2 * * * *');
        expect(cadence(install!)).toBe('every 2 minutes');
    });

    test('something else entirely is not one', () => {
        const other: Deployment = {
            metadata: { name: 'web', namespace: 'shop' },
            spec: { template: { spec: { containers: [{ name: 'web', image: 'nginx:1.27' }] } } },
        };
        expect(isDescheduler(other.spec?.template)).toBe(false);
        expect(findInstalls([other], [])).toEqual([]);
    });

    test('dry run is read from the command line', () => {
        const dry = structuredClone(deployment);
        dry.spec!.template!.spec!.containers![0]!.args!.push('--dry-run');
        const [install] = findInstalls([dry], []);
        expect(install?.dryRun).toBe(true);
    });
});

describe('the policy it mounts', () => {
    test('is found through the volume mounted at the file’s folder', () => {
        expect(policySource(spec, 'kube-system', '/policy-dir/policy.yaml')).toEqual({
            namespace: 'kube-system',
            configMap: 'descheduler',
            key: 'policy.yaml',
        });
    });

    test('follows a volume that remaps the key', () => {
        const remapped = {
            containers: [container],
            volumes: [{ name: 'policy-volume', configMap: { name: 'cm', items: [{ key: 'my-policy', path: 'policy.yaml' }] } }],
        };
        expect(policySource(remapped, 'ns', '/policy-dir/policy.yaml')?.key).toBe('my-policy');
    });

    test('a subPath mount of the file itself', () => {
        const single = {
            containers: [
                {
                    ...container,
                    volumeMounts: [{ name: 'policy-volume', mountPath: '/etc/descheduler/policy.yaml', subPath: 'policy.yaml' }],
                },
            ],
            volumes: [{ name: 'policy-volume', configMap: { name: 'descheduler' } }],
        };
        expect(policySource(single, 'ns', '/etc/descheduler/policy.yaml')).toEqual({
            namespace: 'ns',
            configMap: 'descheduler',
            key: 'policy.yaml',
        });
    });

    test('no flag, no source', () => {
        expect(policySource(spec, 'ns', '')).toBeNull();
    });
});

describe('cron in words', () => {
    test.each([
        ['*/2 * * * *', 'every 2 minutes'],
        ['0 */6 * * *', 'every 6 hours'],
        ['30 3 * * *', 'daily at 03:30'],
        ['0 0 1 * *', ''],
        ['nonsense', ''],
    ])('%s -> %s', (schedule, words) => {
        expect(cronInWords(schedule)).toBe(words);
    });
});

describe('the verdict', () => {
    test('nothing installed', () => {
        expect(verdict([], [], 0).tone).toBe('none');
    });

    test('dry run is called out before anything else looks fine', () => {
        const dry = structuredClone(deployment);
        dry.spec!.template!.spec!.containers![0]!.args!.push('--dry-run');
        const installs = findInstalls([dry], []);
        expect(verdict(installs, [], 0).headline).toBe('Running in dry run');
    });

    test('a Deployment with no ready replica is an error', () => {
        const down = structuredClone(deployment);
        down.status = { readyReplicas: 0 };
        expect(verdict(findInstalls([down], []), [], 0).tone).toBe('error');
    });

    test('refusals are surfaced even when it is running', () => {
        const answer = verdict(findInstalls([deployment], []), [], 3);
        expect(answer.tone).toBe('warn');
        expect(answer.headline).toContain('3 evictions refused');
    });
});
