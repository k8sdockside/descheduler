// The bridge calls the pages share.
//
// Kept apart from src/model so the model stays plain functions over plain
// objects -- everything in here needs an app to answer it, and nothing in here
// decides anything.

import type { CronJob, Deployment, Event, Job, Node, Pod, PodDisruptionBudget } from '../model/kube.js';
import type { Install } from '../model/install.js';
import { findInstalls } from '../model/install.js';

export interface Found {
    installs: Install[];
    /** The first one, which is what the pages lead with. */
    install: Install | null;
    /** The objects behind them, for a page that needs more than the reading. */
    deployments: Deployment[];
    cronJobs: CronJob[];
}

/** Every descheduler in the cluster, as a Deployment or as a CronJob. */
export async function findDescheduler(): Promise<Found> {
    const [deployments, cronJobs] = await Promise.all([
        k8sdockside.list<Deployment>({ kind: 'deployments', namespace: '' }),
        k8sdockside.list<CronJob>({ kind: 'cronjobs', namespace: '' }),
    ]);
    const installs = findInstalls(deployments, cronJobs);
    return { installs, install: installs[0] ?? null, deployments, cronJobs };
}

/** Every event in the cluster. The descheduler's are picked out from these. */
export function allEvents(): Promise<Event[]> {
    return k8sdockside.list<Event>({ kind: 'events', namespace: '' });
}

/** Watches every event, calling back with each answer. Returns the stopper. */
export function watchEvents(
    onItems: (events: Event[]) => void,
    onError: (err: Error) => void,
    interval = 10_000,
): K8sDockside.Unsubscribe {
    return k8sdockside.watch<Event>({ kind: 'events', namespace: '', interval }, onItems, onError);
}

export function pods(namespace = ''): Promise<Pod[]> {
    return k8sdockside.list<Pod>({ kind: 'pods', namespace });
}

export function jobs(namespace = ''): Promise<Job[]> {
    return k8sdockside.list<Job>({ kind: 'jobs', namespace });
}

export function nodes(): Promise<Node[]> {
    return k8sdockside.list<Node>({ kind: 'nodes', namespace: '' });
}

export function budgets(namespace: string): Promise<PodDisruptionBudget[]> {
    return k8sdockside.list<PodDisruptionBudget>({ kind: 'poddisruptionbudgets', namespace });
}

/** A kind the cluster may not serve is not a failure worth a red page. */
export async function listOrNone<T extends K8sDockside.KubeObject>(query: K8sDockside.ListQuery): Promise<T[]> {
    try {
        return await k8sdockside.list<T>(query);
    } catch {
        return [];
    }
}

/**
 * The owner of a pod, read one level up, with its replica count where the kind
 * has one. A ReplicaSet's own owner is not followed: the descheduler's
 * minReplicas is counted on the direct owner too.
 */
export async function ownerOf(pod: Pod): Promise<{ kind: string; replicas: number | null } | null> {
    const reference = (pod.metadata.ownerReferences ?? []).find((owner) => owner.controller) ??
        (pod.metadata.ownerReferences ?? [])[0];
    if (!reference) return null;
    const kinds: Record<string, string> = {
        ReplicaSet: 'replicasets',
        Deployment: 'deployments',
        StatefulSet: 'statefulsets',
        DaemonSet: 'daemonsets',
        Job: 'jobs',
    };
    const kind = kinds[reference.kind];
    if (!kind) return { kind: reference.kind, replicas: null };
    try {
        const owner = await k8sdockside.get({
            kind,
            namespace: pod.metadata.namespace ?? '',
            name: reference.name,
        });
        const spec = owner.spec as { replicas?: number } | undefined;
        const status = owner.status as { desiredNumberScheduled?: number } | undefined;
        const replicas = spec?.replicas ?? status?.desiredNumberScheduled ?? null;
        return { kind: reference.kind, replicas: typeof replicas === 'number' ? replicas : null };
    } catch {
        return { kind: reference.kind, replicas: null };
    }
}
