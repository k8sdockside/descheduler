import { describe, expect, test } from 'vitest';
import {
    argsOf,
    emptyArgs,
    tidy,
    copy,
    dumpPolicy,
    enabledPlugins,
    ensureArgs,
    formatLabels,
    getPath,
    isEnabled,
    newPolicy,
    parseLabels,
    parsePolicy,
    problems,
    profileNames,
    profileNamed,
    same,
    setEnabled,
    setPath,
    startingArgs,
} from './policy.js';

const FILE = `apiVersion: "descheduler/v1alpha2"
kind: "DeschedulerPolicy"
maxNoOfPodsToEvictPerNode: 10
profiles:
  - name: default
    pluginConfig:
      - name: DefaultEvictor
        args:
          nodeFit: true
          minReplicas: 2
      - name: RemoveDuplicates
        args:
          excludeOwnerKinds:
            - ReplicaSet
      - name: SomePluginThisEditorHasNeverHeardOf
        args:
          somethingNew: 12
    plugins:
      balance:
        enabled:
          - RemoveDuplicates
      deschedule:
        enabled:
          - RemovePodsViolatingNodeTaints
`;

describe('reading a policy', () => {
    test('parses, and keeps what it does not know', () => {
        const { doc, error } = parsePolicy(FILE);
        expect(error).toBe('');
        expect(doc).not.toBeNull();
        expect(getPath(doc!, 'maxNoOfPodsToEvictPerNode')).toBe(10);
        expect(dumpPolicy(doc!)).toContain('SomePluginThisEditorHasNeverHeardOf');
    });

    test('refuses something that is not a DeschedulerPolicy', () => {
        expect(parsePolicy('kind: ConfigMap\napiVersion: v1\n').error).toContain('not a DeschedulerPolicy');
    });

    test('says what is wrong with YAML that is not YAML', () => {
        expect(parsePolicy('profiles:\n  - name: a\n   bad indent\n').error).not.toBe('');
    });

    test('an empty key is not an error worth a stack trace', () => {
        expect(parsePolicy('   ').error).toBe('the key is empty');
    });

    test('profiles and what they enable', () => {
        const doc = parsePolicy(FILE).doc!;
        expect(profileNames(doc)).toEqual(['default']);
        const profile = profileNamed(doc, 'default')!;
        expect(enabledPlugins(profile)).toEqual(['RemoveDuplicates', 'RemovePodsViolatingNodeTaints']);
        expect(argsOf(profile, 'DefaultEvictor')).toMatchObject({ nodeFit: true, minReplicas: 2 });
    });
});

describe('a round trip through the editor', () => {
    test('changes nothing when nothing is changed', () => {
        const doc = parsePolicy(FILE).doc!;
        expect(same(doc, copy(doc))).toBe(true);
    });

    test('switching a plugin on adds it, with arguments it can start with', () => {
        const doc = parsePolicy(FILE).doc!;
        const profile = profileNamed(doc, 'default')!;
        setEnabled(profile, 'LowNodeUtilization', 'balance', true);
        Object.assign(ensureArgs(profile, 'LowNodeUtilization'), startingArgs('LowNodeUtilization'));
        expect(isEnabled(profile, 'LowNodeUtilization', 'balance')).toBe(true);
        expect(problems(doc)).toEqual([]);
        const written = dumpPolicy(doc);
        expect(written).toContain('LowNodeUtilization');
        expect(written).toContain('targetThresholds');
        // And the plugin nobody knows about is still there.
        expect(written).toContain('somethingNew');
    });

    test('switching one off takes it out of both lists', () => {
        const doc = parsePolicy(FILE).doc!;
        const profile = profileNamed(doc, 'default')!;
        setEnabled(profile, 'RemoveDuplicates', 'balance', false);
        expect(enabledPlugins(profile)).toEqual(['RemovePodsViolatingNodeTaints']);
        expect(dumpPolicy(doc)).not.toContain('balance:');
    });
});

describe('reading does not write', () => {
    // The Policy page draws a form for every enabled plugin before anybody
    // touches anything. If reading a plugin's arguments created them, simply
    // opening the page would change the policy and the foot would offer to
    // apply a diff nobody asked for. It did, once.
    test('argsOf leaves a policy that has no entry for the plugin alone', () => {
        const doc = parsePolicy(FILE).doc!;
        const before = dumpPolicy(doc);
        const profile = profileNamed(doc, 'default')!;
        expect(argsOf(profile, 'RemovePodsViolatingNodeTaints')).toEqual({});
        expect(dumpPolicy(doc)).toBe(before);
    });

    test('ensureArgs, which the first edit calls, does create it', () => {
        const doc = parsePolicy(FILE).doc!;
        const profile = profileNamed(doc, 'default')!;
        setPath(ensureArgs(profile, 'RemovePodsViolatingNodeTaints'), 'includePreferNoSchedule', true);
        expect(argsOf(profile, 'RemovePodsViolatingNodeTaints')).toEqual({ includePreferNoSchedule: true });
    });
});

describe('the empty entries drawing a form leaves behind', () => {
    // Opening the editor makes a pluginConfig entry for every enabled plugin so
    // its form has somewhere to write. Without tidying those away again, a page
    // that had only been *looked* at would offer to write a diff.
    test('an enabled plugin with no arguments does not become a change', () => {
        const doc = parsePolicy(FILE).doc!;
        const keep = emptyArgs(doc);
        const draft = copy(doc);
        const profile = profileNamed(draft, 'default')!;
        ensureArgs(profile, 'RemovePodsViolatingNodeTaints');
        expect(same(doc, draft)).toBe(false);
        expect(same(doc, tidy(draft, keep))).toBe(true);
    });

    test('an empty entry the file itself had is left alone', () => {
        const doc = parsePolicy(`apiVersion: "descheduler/v1alpha2"
kind: "DeschedulerPolicy"
profiles:
  - name: default
    pluginConfig:
      - name: DefaultEvictor
        args: {}
    plugins:
      balance:
        enabled:
          - RemoveDuplicates
`).doc!;
        const written = tidy(copy(doc), emptyArgs(doc));
        expect(dumpPolicy(written)).toContain('DefaultEvictor');
    });

    test('but one with something in it is kept whatever happens', () => {
        const doc = parsePolicy(FILE).doc!;
        const written = tidy(copy(doc), new Set());
        expect(dumpPolicy(written)).toContain('nodeFit');
    });
});

describe('setPath', () => {
    test('writes through mappings that are not there yet', () => {
        const args = {};
        setPath(args, 'metricsUtilization.prometheus.query', 'up');
        expect(args).toEqual({ metricsUtilization: { prometheus: { query: 'up' } } });
    });

    test('removing the last value takes the empty mappings with it', () => {
        const args = { metricsUtilization: { prometheus: { query: 'up' } } };
        setPath(args, 'metricsUtilization.prometheus.query', undefined);
        expect(args).toEqual({});
    });

    test('removing one of several leaves the rest alone', () => {
        const args = { a: { b: 1, c: 2 } };
        setPath(args, 'a.b', undefined);
        expect(args).toEqual({ a: { c: 2 } });
    });

    test('labels go in and come out as they were typed', () => {
        expect(parseLabels('app=web, tier=frontend')).toEqual({ app: 'web', tier: 'frontend' });
        expect(formatLabels({ app: 'web', tier: 'frontend' })).toBe('app=web,tier=frontend');
        expect(parseLabels('nonsense')).toEqual({});
    });
});

describe('what the descheduler would refuse', () => {
    test('a policy with no profiles', () => {
        expect(problems({ apiVersion: 'descheduler/v1alpha2', kind: 'DeschedulerPolicy' })).toContain(
            'the policy has no profiles, so nothing would run',
        );
    });

    test('a profile that enables nothing', () => {
        const doc = newPolicy();
        expect(problems(doc).join(' ')).toContain('enables no plugins');
    });

    test('a percentage outside 0 to 100', () => {
        const doc = newPolicy();
        const profile = profileNamed(doc, 'default')!;
        setEnabled(profile, 'LowNodeUtilization', 'balance', true);
        Object.assign(ensureArgs(profile, 'LowNodeUtilization'), {
            thresholds: { cpu: 120 },
            targetThresholds: { cpu: 50 },
        });
        expect(problems(doc).join(' ')).toContain('a percentage is 0 to 100');
    });

    test('thresholds the wrong way round', () => {
        const doc = newPolicy();
        const profile = profileNamed(doc, 'default')!;
        setEnabled(profile, 'LowNodeUtilization', 'balance', true);
        Object.assign(ensureArgs(profile, 'LowNodeUtilization'), {
            thresholds: { cpu: 80 },
            targetThresholds: { cpu: 40 },
        });
        expect(problems(doc).join(' ')).toContain('under-used above 80% but over-used above 40%');
    });

    test('deviation thresholds are not compared that way', () => {
        const doc = newPolicy();
        const profile = profileNamed(doc, 'default')!;
        setEnabled(profile, 'LowNodeUtilization', 'balance', true);
        Object.assign(ensureArgs(profile, 'LowNodeUtilization'), {
            useDeviationThresholds: true,
            thresholds: { cpu: 80 },
            targetThresholds: { cpu: 40 },
        });
        expect(problems(doc).join(' ')).not.toContain('over-used above');
    });

    test('a namespace list that both includes and excludes', () => {
        const doc = newPolicy();
        const profile = profileNamed(doc, 'default')!;
        setEnabled(profile, 'RemoveDuplicates', 'balance', true);
        Object.assign(ensureArgs(profile, 'RemoveDuplicates'), {
            namespaces: { include: ['shop'], exclude: ['kube-system'] },
        });
        expect(problems(doc).join(' ')).toContain('both an include and an exclude list');
    });

    test('PodLifeTime with nothing to filter on', () => {
        const doc = newPolicy();
        const profile = profileNamed(doc, 'default')!;
        setEnabled(profile, 'PodLifeTime', 'deschedule', true);
        expect(problems(doc).join(' ')).toContain('needs at least one of an age');
    });

    test('a priority threshold given twice', () => {
        const doc = newPolicy();
        const profile = profileNamed(doc, 'default')!;
        setEnabled(profile, 'RemoveDuplicates', 'balance', true);
        Object.assign(ensureArgs(profile, 'DefaultEvictor'), {
            priorityThreshold: { value: 1000, name: 'system-cluster-critical' },
        });
        expect(problems(doc).join(' ')).toContain('both a priority value and a PriorityClass');
    });
});
