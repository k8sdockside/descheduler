// What the descheduler's plugins are, and what each one can be told.
//
// This is the whole of the Policy page's knowledge. Every name, every argument
// and every allowed value here is taken from the descheduler's own types in
// pkg/framework/plugins/*/types.go and its validation, at v0.36 -- getting one
// wrong would write a policy the descheduler refuses to start with.
//
// A plugin the descheduler gains later, or an argument this catalogue does not
// know, is not lost: the editor keeps the parsed policy and writes back the
// same object, so anything it does not draw a control for survives a round
// trip untouched. What is here is what can be *changed* from a form.

/** Where a plugin runs. The descheduler's own words for its extension points. */
export type Point = 'balance' | 'deschedule';

export type Field =
    | { kind: 'bool'; path: string; label: string; help: string }
    | {
          kind: 'number';
          path: string;
          label: string;
          help: string;
          min?: number;
          max?: number;
          unit?: string;
          placeholder?: string;
      }
    | { kind: 'text'; path: string; label: string; help: string; placeholder?: string }
    | { kind: 'labels'; path: string; label: string; help: string; placeholder?: string }
    | { kind: 'list'; path: string; label: string; help: string; suggest?: string[]; numeric?: boolean }
    | { kind: 'choice'; path: string; label: string; help: string; options: string[] }
    | { kind: 'select'; path: string; label: string; help: string; options: string[] }
    | { kind: 'namespaces'; path: string; label: string; help: string }
    | { kind: 'thresholds'; path: string; label: string; help: string };

export interface PluginSpec {
    /** Exactly as it is written in the policy. */
    name: string;
    point: Point;
    title: string;
    /** What it does, for somebody who has not read the descheduler's README. */
    summary: string;
    /** The thing people get wrong about it. */
    caution?: string;
    docs: string;
    fields: Field[];
}

const DOCS = 'https://github.com/kubernetes-sigs/descheduler#';

const NAMESPACES: Field = {
    kind: 'namespaces',
    path: 'namespaces',
    label: 'Namespaces',
    help: 'Include only these, or exclude these. One list or the other, never both.',
};

const LABEL_SELECTOR: Field = {
    kind: 'labels',
    path: 'labelSelector.matchLabels',
    label: 'Pod labels',
    help: 'Only pods carrying these labels. Written as key=value, comma separated.',
    placeholder: 'app=web,tier=frontend',
};

const POD_STATES = [
    'Running',
    'Pending',
    'Succeeded',
    'Failed',
    'Unknown',
    'NodeAffinity',
    'NodeLost',
    'Shutdown',
    'UnexpectedAdmissionError',
    'PodInitializing',
    'ContainerCreating',
    'ImagePullBackOff',
    'CrashLoopBackOff',
    'CreateContainerConfigError',
    'ErrImagePull',
    'CreateContainerError',
    'InvalidImageName',
    'OOMKilled',
    'Error',
    'Completed',
    'DeadlineExceeded',
    'Evicted',
    'ContainerCannotRun',
    'StartError',
];

const OWNER_KINDS = ['ReplicaSet', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob', 'ReplicationController'];

/** Every plugin the descheduler ships, in the order the Policy page lists them. */
export const PLUGINS: PluginSpec[] = [
    {
        name: 'LowNodeUtilization',
        point: 'balance',
        title: 'Spread off busy nodes',
        summary:
            'Evicts pods from nodes that are more loaded than the target thresholds, so the scheduler can place them on nodes below the low thresholds. Utilisation is counted from pod requests unless a metrics source is named.',
        caution:
            'It needs somewhere to put them: with no node under every low threshold, it evicts nothing. Do not run it together with Pack onto fewer nodes.',
        docs: `${DOCS}lownodeutilization`,
        fields: [
            {
                kind: 'thresholds',
                path: 'thresholds',
                label: 'Under-used below',
                help: 'A node under every one of these is a candidate to receive pods.',
            },
            {
                kind: 'thresholds',
                path: 'targetThresholds',
                label: 'Over-used above',
                help: 'A node over any one of these has pods evicted from it, until it is back under.',
            },
            {
                kind: 'bool',
                path: 'useDeviationThresholds',
                label: 'Thresholds are deviations from the average',
                help: 'Read the numbers as percentage points below and above the cluster average rather than as absolute utilisation.',
            },
            {
                kind: 'number',
                path: 'numberOfNodes',
                label: 'Only act above this many under-used nodes',
                help: 'Nothing is evicted until at least this many nodes are under-used. 0 means act whenever there is one.',
                min: 0,
            },
            {
                kind: 'number',
                path: 'evictionLimits.node',
                label: 'At most this many evictions per node',
                help: 'A ceiling for one pass over one node. Leave empty for no limit.',
                min: 0,
            },
            {
                kind: 'select',
                path: 'metricsUtilization.source',
                label: 'Measure with',
                help: 'Requests are used when this is empty. KubernetesMetrics reads the metrics server; Prometheus reads the query below.',
                options: ['KubernetesMetrics', 'Prometheus'],
            },
            {
                kind: 'text',
                path: 'metricsUtilization.prometheus.query',
                label: 'Prometheus query',
                help: 'Returns one value per node, labelled by instance. Only read when the source is Prometheus.',
                placeholder: 'instance:node_cpu:rate:sum',
            },
            {
                kind: 'namespaces',
                path: 'evictableNamespaces',
                label: 'Evictable namespaces',
                help: 'Usually an exclude list: namespaces whose pods are counted but never moved.',
            },
        ],
    },
    {
        name: 'HighNodeUtilization',
        point: 'balance',
        title: 'Pack onto fewer nodes',
        summary:
            'The other direction: evicts everything off nodes that are barely used, so the scheduler can consolidate them and the empty nodes can go away.',
        caution:
            'Only useful with the scheduler scoring MostAllocated or RequestedToCapacityRatio, otherwise the pods come straight back. Never together with Spread off busy nodes.',
        docs: `${DOCS}highnodeutilization`,
        fields: [
            {
                kind: 'thresholds',
                path: 'thresholds',
                label: 'Under-used below',
                help: 'Nodes under every one of these are drained onto fuller nodes.',
            },
            {
                kind: 'number',
                path: 'numberOfNodes',
                label: 'Only act above this many under-used nodes',
                help: 'Nothing is evicted until at least this many nodes are under-used.',
                min: 0,
            },
            {
                kind: 'choice',
                path: 'evictionModes',
                label: 'Eviction mode',
                help: 'OnlyThresholdingResources evicts only pods that actually request one of the resources above.',
                options: ['OnlyThresholdingResources'],
            },
            {
                kind: 'namespaces',
                path: 'evictableNamespaces',
                label: 'Evictable namespaces',
                help: 'Usually an exclude list: namespaces whose pods are counted but never moved.',
            },
        ],
    },
    {
        name: 'RemoveDuplicates',
        point: 'balance',
        title: 'Spread copies of the same workload',
        summary:
            'Evicts a pod when another pod of the same ReplicaSet, ReplicationController, StatefulSet or Job is already running on that node — which is what you are left with after a node comes back from an outage.',
        docs: `${DOCS}removeduplicates`,
        fields: [
            NAMESPACES,
            {
                kind: 'list',
                path: 'excludeOwnerKinds',
                label: 'Leave these owners alone',
                help: 'Pods owned by one of these kinds are never treated as duplicates. Add ReplicaSet to exclude everything created by a Deployment.',
                suggest: OWNER_KINDS,
            },
        ],
    },
    {
        name: 'RemovePodsViolatingTopologySpreadConstraint',
        point: 'balance',
        title: 'Honour topology spread constraints',
        summary:
            'Evicts pods so that topologySpreadConstraints the scheduler could not satisfy at placement time are satisfied now — the zones and nodes filled up in the wrong order.',
        docs: `${DOCS}removepodsviolatingtopologyspreadconstraint`,
        fields: [
            NAMESPACES,
            LABEL_SELECTOR,
            {
                kind: 'choice',
                path: 'constraints',
                label: 'Which constraints to act on',
                help: 'By default only DoNotSchedule ones. Adding ScheduleAnyway acts on soft constraints too.',
                options: ['DoNotSchedule', 'ScheduleAnyway'],
            },
            {
                kind: 'bool',
                path: 'topologyBalanceNodeFit',
                label: 'Only evict when another node fits',
                help: 'On by default. Turn it off and it evicts even when nothing else can take the pod.',
            },
        ],
    },
    {
        name: 'RemovePodsViolatingNodeTaints',
        point: 'deschedule',
        title: 'Evict pods that no longer tolerate their node',
        summary:
            'A taint added after a pod was placed does not move it. This evicts pods whose tolerations no longer cover the taints on the node they are running on.',
        docs: `${DOCS}removepodsviolatingnodetaints`,
        fields: [
            NAMESPACES,
            LABEL_SELECTOR,
            {
                kind: 'bool',
                path: 'includePreferNoSchedule',
                label: 'Count PreferNoSchedule taints too',
                help: 'Off by default: only NoSchedule and NoExecute taints are considered.',
            },
            {
                kind: 'list',
                path: 'excludedTaints',
                label: 'Ignore these taints',
                help: 'A key, or key=value. Taints listed here never cause an eviction.',
                suggest: ['node.kubernetes.io/unreachable', 'node.kubernetes.io/not-ready'],
            },
            {
                kind: 'list',
                path: 'includedTaints',
                label: 'Only these taints',
                help: 'A key, or key=value. Given, only these taints cause evictions.',
            },
        ],
    },
    {
        name: 'RemovePodsViolatingNodeAffinity',
        point: 'deschedule',
        title: 'Evict pods whose node affinity stopped holding',
        summary:
            'Evicts a pod when the node it is on no longer satisfies its nodeAffinity — because the node was relabelled, or because a preferred affinity can now be met somewhere better.',
        docs: `${DOCS}removepodsviolatingnodeaffinity`,
        fields: [
            NAMESPACES,
            LABEL_SELECTOR,
            {
                kind: 'choice',
                path: 'nodeAffinityType',
                label: 'Which affinity to check',
                help: 'Required by itself is the usual setting. This argument has no default: with nothing chosen the plugin does nothing.',
                options: [
                    'requiredDuringSchedulingIgnoredDuringExecution',
                    'preferredDuringSchedulingIgnoredDuringExecution',
                    'requiredDuringSchedulingRequiredDuringExecution',
                ],
            },
        ],
    },
    {
        name: 'RemovePodsViolatingInterPodAntiAffinity',
        point: 'deschedule',
        title: 'Break up pods that should not be neighbours',
        summary:
            'Evicts pods that violate another pod’s anti-affinity — two pods on one node that were never meant to share it, usually because the rule was added after both were placed.',
        docs: `${DOCS}removepodsviolatinginterpodantiaffinity`,
        fields: [NAMESPACES, LABEL_SELECTOR],
    },
    {
        name: 'RemovePodsHavingTooManyRestarts',
        point: 'deschedule',
        title: 'Move pods that keep restarting',
        summary:
            'A pod restarting on one node may be the node’s fault. Past the restart threshold, this evicts it so it is scheduled somewhere else.',
        docs: `${DOCS}removepodshavingtoomanyrestarts`,
        fields: [
            {
                kind: 'number',
                path: 'podRestartThreshold',
                label: 'Restarts before evicting',
                help: 'Summed across the pod’s containers.',
                min: 1,
                placeholder: '100',
            },
            {
                kind: 'bool',
                path: 'includingInitContainers',
                label: 'Count init container restarts',
                help: 'Add init containers’ restarts into the total.',
            },
            {
                kind: 'choice',
                path: 'states',
                label: 'Only pods in these states',
                help: 'Left empty, a pod in any state counts. These two are all this plugin accepts.',
                options: ['Running', 'CrashLoopBackOff'],
            },
            NAMESPACES,
            LABEL_SELECTOR,
        ],
    },
    {
        name: 'RemoveFailedPods',
        point: 'deschedule',
        title: 'Clear out failed pods',
        summary:
            'Deletes pods that have ended up in Failed, optionally only those that failed for particular reasons — the tidying job that otherwise falls to a cron script.',
        docs: `${DOCS}removefailedpods`,
        fields: [
            {
                kind: 'number',
                path: 'minPodLifetimeSeconds',
                label: 'Only pods older than',
                help: 'Leaves a just-failed pod alone long enough for somebody to look at it.',
                min: 0,
                unit: 'seconds',
                placeholder: '3600',
            },
            {
                kind: 'list',
                path: 'reasons',
                label: 'Only these failure reasons',
                help: 'The pod’s status reason, or a container’s waiting reason.',
                suggest: ['NodeAffinity', 'Shutdown', 'UnexpectedAdmissionError', 'Evicted', 'OutOfcpu', 'OutOfmemory'],
            },
            {
                kind: 'list',
                path: 'exitCodes',
                label: 'Only these exit codes',
                help: 'A container’s terminated exit code.',
                numeric: true,
                suggest: ['1', '137', '143'],
            },
            {
                kind: 'bool',
                path: 'includingInitContainers',
                label: 'Look at init containers too',
                help: 'Match reasons and exit codes from init containers as well.',
            },
            {
                kind: 'list',
                path: 'excludeOwnerKinds',
                label: 'Leave these owners alone',
                help: 'Pods owned by one of these kinds are never removed. Jobs are the common one to keep.',
                suggest: OWNER_KINDS,
            },
            NAMESPACES,
            LABEL_SELECTOR,
        ],
    },
    {
        name: 'PodLifeTime',
        point: 'deschedule',
        title: 'Evict pods past an age',
        summary:
            'Evicts pods older than a given age, oldest first — for workloads that ought to be recycled, and for clearing pods stuck in a state that will not resolve.',
        caution: 'On a Deployment with no other filter this restarts everything you run, on a rolling basis. Set the namespaces or labels first.',
        docs: `${DOCS}podlifetime`,
        fields: [
            {
                kind: 'number',
                path: 'maxPodLifeTimeSeconds',
                label: 'Evict when older than',
                help: '86400 is a day. Pods are taken oldest first.',
                min: 0,
                unit: 'seconds',
                placeholder: '86400',
            },
            {
                kind: 'choice',
                path: 'states',
                label: 'Only pods in these states',
                help: 'A pod phase, a pod status reason, or a container’s waiting or terminated reason.',
                options: POD_STATES,
            },
            {
                kind: 'list',
                path: 'ownerKinds.include',
                label: 'Only these owners',
                help: 'Only pods owned by one of these kinds.',
                suggest: OWNER_KINDS,
            },
            {
                kind: 'list',
                path: 'ownerKinds.exclude',
                label: 'Leave these owners alone',
                help: 'Never pods owned by one of these kinds.',
                suggest: OWNER_KINDS,
            },
            {
                kind: 'list',
                path: 'exitCodes',
                label: 'Only these exit codes',
                help: 'A container’s terminated exit code.',
                numeric: true,
            },
            {
                kind: 'bool',
                path: 'includingInitContainers',
                label: 'Look at init containers too',
                help: 'Match states and exit codes from init containers as well.',
            },
            {
                kind: 'bool',
                path: 'includingEphemeralContainers',
                label: 'Look at ephemeral containers too',
                help: 'Match states and exit codes from debug containers as well.',
            },
            NAMESPACES,
            LABEL_SELECTOR,
        ],
    },
];

/** The evictor every profile has, whether or not it says so. */
export const DEFAULT_EVICTOR = 'DefaultEvictor';

/**
 * What the DefaultEvictor can be told. It is not in PLUGINS because it is not
 * a strategy: it is the filter every strategy's evictions go through, so the
 * page gives it a card of its own above the rest.
 */
export const EVICTOR_FIELDS: Field[] = [
    {
        kind: 'bool',
        path: 'nodeFit',
        label: 'Only evict when another node fits the pod',
        help: 'Checks taints, node selectors, affinity and room before evicting, so a pod is not evicted into Pending. Off by default, and worth turning on.',
    },
    {
        kind: 'number',
        path: 'minReplicas',
        label: 'Leave workloads smaller than',
        help: 'A pod whose owner has fewer replicas than this is never evicted. 2 keeps single-replica workloads alone.',
        min: 0,
    },
    {
        kind: 'text',
        path: 'minPodAge',
        label: 'Leave pods younger than',
        help: 'A duration — 5m, 1h. Newly started pods are left alone.',
        placeholder: '5m',
    },
    {
        kind: 'bool',
        path: 'evictLocalStoragePods',
        label: 'May evict pods with local storage',
        help: 'Pods with an emptyDir or hostPath volume lose that data when they move. Off by default.',
    },
    {
        kind: 'bool',
        path: 'evictDaemonSetPods',
        label: 'May evict DaemonSet pods',
        help: 'A DaemonSet pod comes straight back on the same node. Off by default.',
    },
    {
        kind: 'bool',
        path: 'evictSystemCriticalPods',
        label: 'May evict system-critical pods',
        help: 'Ignores priority altogether, including the priority threshold below. Off by default, and best left off.',
    },
    {
        kind: 'bool',
        path: 'ignorePvcPods',
        label: 'Never evict pods with a PVC',
        help: 'Off by default — a pod with a PersistentVolumeClaim is evictable unless you say otherwise.',
    },
    {
        kind: 'bool',
        path: 'ignorePodsWithoutPDB',
        label: 'Never evict pods with no PodDisruptionBudget',
        help: 'Makes a PDB the price of being moved at all.',
    },
    {
        kind: 'bool',
        path: 'evictFailedBarePods',
        label: 'May evict failed pods with no owner',
        help: 'Bare pods are not recreated by anything, so this is off by default.',
    },
    {
        kind: 'number',
        path: 'priorityThreshold.value',
        label: 'Only evict below this priority',
        help: 'Pods at or above this priority value are left alone. Defaults to the system-cluster-critical priority.',
    },
    {
        kind: 'text',
        path: 'priorityThreshold.name',
        label: 'Or name a PriorityClass',
        help: 'The threshold is that class’s value. Give a name or a value, not both.',
        placeholder: 'system-cluster-critical',
    },
    {
        kind: 'select',
        path: 'noEvictionPolicy',
        label: 'The no-eviction annotation is',
        help: 'How descheduler.alpha.kubernetes.io/prefer-no-eviction is read. Mandatory makes it absolute; Preferred lets plugins evict anyway.',
        options: ['Preferred', 'Mandatory'],
    },
    {
        kind: 'text',
        path: 'nodeSelector',
        label: 'Only nodes matching',
        help: 'Restricts this profile to nodes with these labels. key=value, comma separated.',
        placeholder: 'node-role.kubernetes.io/worker=',
    },
    {
        kind: 'choice',
        path: 'podProtections.extraEnabled',
        label: 'Extra protections',
        help: 'The newer spelling of the two "never evict" switches above. Do not set both forms.',
        options: ['PodsWithPVC', 'PodsWithoutPDB'],
    },
    {
        kind: 'choice',
        path: 'podProtections.defaultDisabled',
        label: 'Protections to switch off',
        help: 'The newer spelling of the "may evict" switches above.',
        options: ['PodsWithLocalStorage', 'DaemonSetPods', 'SystemCriticalPods', 'FailedBarePods'],
    },
];

/** The policy's own top-level settings, which apply to every profile. */
export const GLOBAL_FIELDS: Field[] = [
    {
        kind: 'text',
        path: 'nodeSelector',
        label: 'Only these nodes',
        help: 'Restricts the whole run to nodes with these labels. key=value, comma separated.',
        placeholder: 'node-role.kubernetes.io/worker=',
    },
    {
        kind: 'number',
        path: 'maxNoOfPodsToEvictPerNode',
        label: 'At most, per node',
        help: 'A ceiling on one pass. Leave empty for no limit.',
        min: 0,
    },
    {
        kind: 'number',
        path: 'maxNoOfPodsToEvictPerNamespace',
        label: 'At most, per namespace',
        help: 'A ceiling on one pass. Leave empty for no limit.',
        min: 0,
    },
    {
        kind: 'number',
        path: 'maxNoOfPodsToEvictTotal',
        label: 'At most, in total',
        help: 'A ceiling on one pass over the whole cluster. The safest dial there is.',
        min: 0,
    },
    {
        kind: 'number',
        path: 'gracePeriodSeconds',
        label: 'Grace period',
        help: 'Given to each evicted pod. Empty uses each pod’s own.',
        min: 0,
        unit: 'seconds',
    },
    {
        kind: 'bool',
        path: 'evictionFailureEventNotification',
        label: 'Record an event when an eviction fails',
        help: 'Turn this on and refused evictions appear in Activity beside the successful ones. Off by default.',
    },
];

export function pluginByName(name: string): PluginSpec | undefined {
    return PLUGINS.find((plugin) => plugin.name === name);
}

/** Plugins in the order the page draws them: balance first, then deschedule. */
export function pluginsAt(point: Point): PluginSpec[] {
    return PLUGINS.filter((plugin) => plugin.point === point);
}
