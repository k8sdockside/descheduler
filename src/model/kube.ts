// The shapes of the objects this plugin reads.
//
// Only the fields it actually looks at, extending K8sDockside.KubeObject so
// everything else the API server sent is still there and still typed as
// unknown. The bridge hands back whole objects, so a field missing here is a
// field this plugin decided not to read, not one the app withheld.

export interface VolumeMount {
    name: string;
    mountPath: string;
    subPath?: string;
}

export interface Volume {
    name: string;
    configMap?: { name?: string; items?: { key: string; path: string }[] };
    emptyDir?: unknown;
    hostPath?: unknown;
    persistentVolumeClaim?: { claimName?: string };
}

export interface Container {
    name?: string;
    image?: string;
    command?: string[];
    args?: string[];
    volumeMounts?: VolumeMount[];
}

export interface PodSpec {
    nodeName?: string;
    containers?: Container[];
    initContainers?: Container[];
    volumes?: Volume[];
    priority?: number;
    priorityClassName?: string;
    terminationGracePeriodSeconds?: number;
}

export interface ContainerStatus {
    name?: string;
    restartCount?: number;
    ready?: boolean;
    state?: {
        waiting?: { reason?: string; message?: string };
        terminated?: { reason?: string; exitCode?: number; finishedAt?: string };
        running?: { startedAt?: string };
    };
}

export interface PodStatus {
    phase?: string;
    startTime?: string;
    containerStatuses?: ContainerStatus[];
    initContainerStatuses?: ContainerStatus[];
    conditions?: { type?: string; status?: string; reason?: string }[];
}

export interface Pod extends K8sDockside.KubeObject {
    spec?: PodSpec;
    status?: PodStatus;
}

export interface PodTemplate {
    metadata?: { labels?: Record<string, string>; annotations?: Record<string, string> };
    spec?: PodSpec;
}

export interface Deployment extends K8sDockside.KubeObject {
    spec?: { replicas?: number; template?: PodTemplate; selector?: unknown; paused?: boolean };
    status?: { replicas?: number; readyReplicas?: number; availableReplicas?: number };
}

export interface StatefulSet extends K8sDockside.KubeObject {
    spec?: { replicas?: number };
    status?: { replicas?: number; readyReplicas?: number };
}

export interface ReplicaSet extends K8sDockside.KubeObject {
    spec?: { replicas?: number };
    status?: { replicas?: number; readyReplicas?: number };
}

export interface DaemonSet extends K8sDockside.KubeObject {
    status?: { desiredNumberScheduled?: number; numberReady?: number };
}

export interface JobSpec {
    template?: PodTemplate;
    parallelism?: number;
    completions?: number;
    backoffLimit?: number;
    ttlSecondsAfterFinished?: number;
}

export interface Job extends K8sDockside.KubeObject {
    spec?: JobSpec;
    status?: {
        succeeded?: number;
        failed?: number;
        active?: number;
        startTime?: string;
        completionTime?: string;
        conditions?: { type?: string; status?: string; reason?: string; message?: string }[];
    };
}

export interface CronJob extends K8sDockside.KubeObject {
    spec?: {
        schedule?: string;
        suspend?: boolean;
        timeZone?: string;
        jobTemplate?: { metadata?: PodTemplate['metadata']; spec?: JobSpec };
        successfulJobsHistoryLimit?: number;
        failedJobsHistoryLimit?: number;
    };
    status?: { lastScheduleTime?: string; lastSuccessfulTime?: string; active?: { name?: string }[] };
}

export interface ConfigMap extends K8sDockside.KubeObject {
    data?: Record<string, string>;
}

export interface Node extends K8sDockside.KubeObject {
    spec?: { unschedulable?: boolean; taints?: { key?: string; value?: string; effect?: string }[] };
    status?: {
        conditions?: { type?: string; status?: string }[];
        allocatable?: Record<string, string>;
        capacity?: Record<string, string>;
        nodeInfo?: { kubeletVersion?: string };
    };
}

export interface PodDisruptionBudget extends K8sDockside.KubeObject {
    spec?: { selector?: { matchLabels?: Record<string, string> } };
}

/** A core/v1 Event -- the shape the app's `events` kind returns. */
export interface Event extends K8sDockside.KubeObject {
    type?: string;
    reason?: string;
    message?: string;
    note?: string;
    action?: string;
    count?: number;
    eventTime?: string;
    firstTimestamp?: string;
    lastTimestamp?: string;
    reportingComponent?: string;
    reportingInstance?: string;
    source?: { component?: string; host?: string };
    involvedObject?: { kind?: string; namespace?: string; name?: string; uid?: string };
    regarding?: { kind?: string; namespace?: string; name?: string; uid?: string };
}

/** Every container in a pod spec, init containers first. */
export function containersOf(spec: PodSpec | undefined): Container[] {
    return [...(spec?.initContainers ?? []), ...(spec?.containers ?? [])];
}

/** The image's tag, or its digest when it is pinned by one. `''` when neither. */
export function imageTag(image: string | undefined): string {
    if (!image) return '';
    const at = image.indexOf('@');
    if (at >= 0) {
        const tagged = image.slice(0, at);
        const colon = tagged.lastIndexOf(':');
        if (colon > tagged.lastIndexOf('/')) return tagged.slice(colon + 1);
        return image.slice(at + 1, at + 19);
    }
    const colon = image.lastIndexOf(':');
    if (colon > image.lastIndexOf('/')) return image.slice(colon + 1);
    return '';
}

/** The status of a condition of that type, `''` when the object has no such condition. */
export function condition(conditions: { type?: string; status?: string }[] | undefined, type: string): string {
    return conditions?.find((c) => c.type === type)?.status ?? '';
}

/** The owner reference that controls the object, if any. */
export function controller(object: K8sDockside.KubeObject): K8sDockside.OwnerReference | undefined {
    const owners = object.metadata.ownerReferences ?? [];
    return owners.find((o) => o.controller) ?? owners[0];
}
