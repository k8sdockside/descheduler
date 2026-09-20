// Would the descheduler evict this pod?
//
// The DefaultEvictor is the filter every strategy's evictions pass through, so
// whether a pod can move at all is decided there and nowhere else. This works
// the same checks over an object the app already has, from the arguments in
// the policy actually installed in the cluster -- which is what makes the
// answer worth showing: it is this cluster's rules, not the documentation's.
//
// Faithful to pkg/framework/plugins/defaultevictor at v0.36, including the two
// parts people misread: the evict annotation short-circuits every other check,
// and the priority threshold is only consulted while the system-critical
// protection is on.
//
// What it cannot know is checked elsewhere in the descheduler and is reported
// as such rather than guessed: nodeFit needs every node's free capacity, and a
// strategy's own filters are the strategy's business.

import type { Doc } from './policy.js';
import { getPath, isRecord } from './policy.js';
import type { Pod, PodDisruptionBudget } from './kube.js';
import { controller } from './kube.js';

export const EVICT_ANNOTATION = 'descheduler.alpha.kubernetes.io/evict';
export const NO_EVICTION_ANNOTATION = 'descheduler.alpha.kubernetes.io/prefer-no-eviction';
export const REQUEST_EVICT_ONLY_ANNOTATION = 'descheduler.alpha.kubernetes.io/request-evict-only';

/** Priorities at or above this are system critical, whatever the class is called. */
export const SYSTEM_CRITICAL_PRIORITY = 2_000_000_000;

export type Protection =
    | 'PodsWithLocalStorage'
    | 'DaemonSetPods'
    | 'SystemCriticalPods'
    | 'FailedBarePods'
    | 'PodsWithPVC'
    | 'PodsWithoutPDB'
    | 'PodsWithResourceClaims';

const DEFAULT_PROTECTIONS: Protection[] = [
    'PodsWithLocalStorage',
    'DaemonSetPods',
    'SystemCriticalPods',
    'FailedBarePods',
];

/**
 * The protections in force, from either spelling of the settings. The newer
 * `podProtections` wins outright when it says anything at all -- the older
 * booleans are not merged into it, exactly as the descheduler does it.
 */
export function effectiveProtections(evictorArgs: Doc): Set<Protection> {
    const protections = getPath(evictorArgs, 'podProtections');
    const extraEnabled = asList(getPath(evictorArgs, 'podProtections.extraEnabled'));
    const defaultDisabled = asList(getPath(evictorArgs, 'podProtections.defaultDisabled'));
    if (isRecord(protections) && (extraEnabled.length || defaultDisabled.length)) {
        const set = new Set<Protection>(DEFAULT_PROTECTIONS.filter((p) => !defaultDisabled.includes(p)));
        for (const extra of extraEnabled) set.add(extra as Protection);
        return set;
    }
    const set = new Set<Protection>();
    if (evictorArgs['evictLocalStoragePods'] !== true) set.add('PodsWithLocalStorage');
    if (evictorArgs['evictDaemonSetPods'] !== true) set.add('DaemonSetPods');
    if (evictorArgs['evictSystemCriticalPods'] !== true) set.add('SystemCriticalPods');
    if (evictorArgs['evictFailedBarePods'] !== true) set.add('FailedBarePods');
    if (evictorArgs['ignorePvcPods'] === true) set.add('PodsWithPVC');
    if (evictorArgs['ignorePodsWithoutPDB'] === true) set.add('PodsWithoutPDB');
    return set;
}

function asList(value: unknown): string[] {
    return Array.isArray(value) ? value.map(String) : [];
}

export type Outcome = 'blocked' | 'allowed' | 'unknown';

export interface Check {
    label: string;
    outcome: Outcome;
    detail: string;
}

export interface Answer {
    /** null when something could not be worked out here. */
    evictable: boolean | null;
    headline: string;
    checks: Check[];
}

/** What the evaluation needs besides the pod itself. */
export interface Surroundings {
    /** The name of the profile whose evictor this is. */
    profile: string;
    /** The DefaultEvictor's arguments from that profile. */
    evictor: Doc;
    /** The pod's controller, when it was read -- for the replica count. */
    owner?: { kind: string; replicas: number | null } | null;
    /** The PodDisruptionBudgets in the pod's namespace. */
    pdbs?: PodDisruptionBudget[];
    now?: number;
}

/** Seconds in a Kubernetes duration string: 5m, 1h30m, 90s. `null` when it is not one. */
export function seconds(duration: string): number | null {
    const matches = [...duration.matchAll(/(\d+(?:\.\d+)?)\s*(h|m|s|ms)/g)];
    if (!matches.length) return null;
    let total = 0;
    for (const match of matches) {
        const value = Number(match[1]);
        switch (match[2]) {
            case 'h':
                total += value * 3600;
                break;
            case 'm':
                total += value * 60;
                break;
            case 's':
                total += value;
                break;
            case 'ms':
                total += value / 1000;
                break;
        }
    }
    return total;
}

function labelsMatch(pod: Pod, selector: unknown): boolean | null {
    if (!isRecord(selector)) return null;
    const matchLabels = selector['matchLabels'];
    if (selector['matchExpressions'] !== undefined) return null;
    if (!isRecord(matchLabels)) return null;
    const labels = pod.metadata.labels ?? {};
    return Object.entries(matchLabels).every(([key, value]) => labels[key] === String(value));
}

function coveredByPDB(pod: Pod, pdbs: PodDisruptionBudget[]): boolean | null {
    const labels = pod.metadata.labels ?? {};
    let sure = true;
    for (const pdb of pdbs) {
        if (pdb.metadata.namespace !== pod.metadata.namespace) continue;
        const selector = pdb.spec?.selector;
        if (!selector) continue;
        if (selector.matchLabels === undefined) {
            // An expression selector: this cannot say yes or no honestly.
            sure = false;
            continue;
        }
        const wanted = Object.entries(selector.matchLabels);
        if (wanted.length && wanted.every(([key, value]) => labels[key] === value)) return true;
    }
    return sure ? false : null;
}

/** Every DefaultEvictor check, worked over one pod. */
export function evaluate(pod: Pod, where: Surroundings): Answer {
    const { evictor } = where;
    const now = where.now ?? Date.now();
    const annotations = pod.metadata.annotations ?? {};
    const checks: Check[] = [];

    if (annotations[EVICT_ANNOTATION] !== undefined) {
        return {
            evictable: true,
            headline: 'Marked for eviction, whatever the rules say',
            checks: [
                {
                    label: 'The evict annotation',
                    outcome: 'allowed',
                    detail: `${EVICT_ANNOTATION} is set, and the evictor stops checking there — every protection below is skipped for this pod.`,
                },
            ],
        };
    }

    const protections = effectiveProtections(evictor);
    const blocked = (label: string, detail: string) => checks.push({ label, outcome: 'blocked', detail });
    const fine = (label: string, detail: string) => checks.push({ label, outcome: 'allowed', detail });
    const unsure = (label: string, detail: string) => checks.push({ label, outcome: 'unknown', detail });

    // ----- the pod itself ----------------------------------------------------

    if (evictor['noEvictionPolicy'] === 'Mandatory' && annotations[NO_EVICTION_ANNOTATION] !== undefined) {
        blocked('Asked not to be evicted', `${NO_EVICTION_ANNOTATION} is set and the policy reads it as mandatory.`);
    }
    if (annotations['kubernetes.io/config.mirror'] !== undefined) {
        blocked('Mirror pod', 'A mirror pod is the API server’s copy of a static pod; evicting it does nothing.');
    }
    const source = annotations['kubernetes.io/config.source'];
    if (source !== undefined && source !== 'api') {
        blocked('Static pod', `This pod comes from ${source}, not from the API server, so the kubelet owns it.`);
    }
    if (pod.metadata.deletionTimestamp) {
        blocked('Terminating', 'The pod is already on its way out.');
    }

    // ----- the protections -----------------------------------------------------

    const owner = where.owner ?? ownerOf(pod);
    if (protections.has('DaemonSetPods')) {
        if (owner?.kind === 'DaemonSet') {
            blocked('DaemonSet pod', 'DaemonSet pods are protected. They would come straight back to the same node.');
        } else {
            fine('DaemonSet pod', 'Not owned by a DaemonSet.');
        }
    }
    if (protections.has('PodsWithLocalStorage')) {
        const volumes = pod.spec?.volumes ?? [];
        const local = volumes.filter((volume) => volume.emptyDir !== undefined || volume.hostPath !== undefined);
        if (local.length) {
            blocked(
                'Local storage',
                `${local.length} volume(s) are emptyDir or hostPath, whose contents do not survive a move.`,
            );
        } else {
            fine('Local storage', 'No emptyDir or hostPath volume.');
        }
    }
    if (protections.has('PodsWithPVC')) {
        const claims = (pod.spec?.volumes ?? []).filter((volume) => volume.persistentVolumeClaim !== undefined);
        if (claims.length) blocked('Persistent volume', `${claims.length} PersistentVolumeClaim(s), and those are protected here.`);
        else fine('Persistent volume', 'No PersistentVolumeClaim.');
    }
    const ownerRefs = pod.metadata.ownerReferences ?? [];
    if (protections.has('FailedBarePods')) {
        if (!ownerRefs.length) {
            blocked('No owner', 'Nothing would recreate this pod, so bare pods are protected.');
        } else {
            fine('No owner', `Owned by ${owner?.kind ?? 'something'}, so it would be recreated.`);
        }
    } else if (!ownerRefs.length && pod.status?.phase !== 'Failed') {
        blocked(
            'No owner',
            'Bare pods may be evicted here, but only once they have failed, and this one has not.',
        );
    }
    const priority = pod.spec?.priority;
    if (protections.has('SystemCriticalPods')) {
        if (priority !== undefined && priority >= SYSTEM_CRITICAL_PRIORITY) {
            blocked(
                'System critical',
                `Priority ${priority}${pod.spec?.priorityClassName ? ` (${pod.spec.priorityClassName})` : ''} is at or above the system-critical mark.`,
            );
        } else {
            fine('System critical', `Priority ${priority ?? 0} is below the system-critical mark.`);
        }
        const threshold = thresholdValue(evictor);
        if (threshold.value !== null) {
            if ((priority ?? 0) >= threshold.value) {
                blocked('Priority threshold', `Priority ${priority ?? 0} is at or above the threshold of ${threshold.value}.`);
            } else {
                fine('Priority threshold', `Priority ${priority ?? 0} is under the threshold of ${threshold.value}.`);
            }
        } else if (threshold.byName) {
            unsure(
                'Priority threshold',
                `The threshold is the PriorityClass ${threshold.byName}, whose value is not read here.`,
            );
        }
    } else if (thresholdValue(evictor).value !== null || thresholdValue(evictor).byName) {
        unsure(
            'Priority threshold',
            'A threshold is configured, but system-critical protection is off, and the descheduler only applies the threshold while that protection is on.',
        );
    }
    if (protections.has('PodsWithoutPDB')) {
        const covered = coveredByPDB(pod, where.pdbs ?? []);
        if (covered === null) {
            unsure('PodDisruptionBudget', 'A budget here selects pods by expression, which is not evaluated on this page.');
        } else if (covered) {
            fine('PodDisruptionBudget', 'A budget covers this pod.');
        } else {
            blocked('PodDisruptionBudget', 'No budget covers this pod, and the policy protects pods without one.');
        }
    }
    if (protections.has('PodsWithResourceClaims')) {
        unsure('Resource claims', 'Pods with resource claims are protected; the claims are not read on this page.');
    }

    // ----- the rest of the evictor's arguments ----------------------------------

    const minReplicas = Number(evictor['minReplicas'] ?? 0);
    if (minReplicas > 0) {
        const replicas = where.owner?.replicas ?? null;
        if (replicas === null) {
            unsure('Owner size', `Workloads under ${minReplicas} replicas are protected; this pod's owner was not read.`);
        } else if (replicas < minReplicas) {
            blocked('Owner size', `Its owner runs ${replicas} replica(s), and the floor is ${minReplicas}.`);
        } else {
            fine('Owner size', `Its owner runs ${replicas} replicas, at or above the floor of ${minReplicas}.`);
        }
    }
    const minPodAge = String(evictor['minPodAge'] ?? '');
    if (minPodAge) {
        const floor = seconds(minPodAge);
        const started = Date.parse(pod.status?.startTime ?? pod.metadata.creationTimestamp ?? '');
        if (floor === null || Number.isNaN(started)) {
            unsure('Pod age', `Pods younger than ${minPodAge} are protected; this pod's age could not be worked out.`);
        } else if ((now - started) / 1000 < floor) {
            blocked('Pod age', `Younger than ${minPodAge}.`);
        } else {
            fine('Pod age', `Older than ${minPodAge}.`);
        }
    }
    const selector = evictor['labelSelector'];
    if (selector !== undefined) {
        const matched = labelsMatch(pod, selector);
        if (matched === null) unsure('Evictor label selector', 'The selector uses expressions, which are not evaluated here.');
        else if (matched) fine('Evictor label selector', 'The pod carries the labels the evictor asks for.');
        else blocked('Evictor label selector', 'The pod does not carry the labels the evictor asks for.');
    }
    if (evictor['nodeFit'] === true) {
        unsure(
            'Somewhere to go',
            'nodeFit is on, so the pod is only evicted when another node could actually take it. That needs every node’s free capacity, which is not worked out here.',
        );
    }
    if (annotations[REQUEST_EVICT_ONLY_ANNOTATION] !== undefined) {
        unsure(
            'Eviction request only',
            `${REQUEST_EVICT_ONLY_ANNOTATION} is set: the descheduler asks, and something else — an operator, usually — decides.`,
        );
    }

    const blockers = checks.filter((check) => check.outcome === 'blocked');
    const unknowns = checks.filter((check) => check.outcome === 'unknown');
    if (blockers.length) {
        return {
            evictable: false,
            headline: blockers.length === 1 ? `Protected: ${blockers[0]?.label.toLowerCase()}` : `Protected, ${blockers.length} ways`,
            checks,
        };
    }
    if (unknowns.length) {
        return {
            evictable: null,
            headline: 'Nothing here protects it',
            checks,
        };
    }
    return { evictable: true, headline: 'The evictor would let this pod go', checks };
}

function ownerOf(pod: Pod): { kind: string; replicas: number | null } | null {
    const reference = controller(pod);
    return reference ? { kind: reference.kind, replicas: null } : null;
}

function thresholdValue(evictor: Doc): { value: number | null; byName: string } {
    const raw = getPath(evictor, 'priorityThreshold.value');
    const name = getPath(evictor, 'priorityThreshold.name');
    const value = raw === undefined || raw === null ? null : Number(raw);
    return {
        value: value !== null && Number.isFinite(value) ? value : null,
        byName: typeof name === 'string' ? name : '',
    };
}
