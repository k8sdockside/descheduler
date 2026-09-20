// Finding the descheduler in a cluster, and reading how it was set up.
//
// The descheduler has no custom resource to look for -- it is a CronJob or a
// Deployment, and everything about how it runs is in its command line and in
// the ConfigMap it mounts. So detection is: a workload running the descheduler
// image (or calling the descheduler binary), and then its flags.
//
// The policy's whereabouts are read the same way the container reads them:
// --policy-config-file names a path, the volume mounted at that path's folder
// names a ConfigMap, and the file's name is the key in it -- unless the volume
// remaps keys with `items`, which the chart does not do but a hand-written
// manifest may.

import type { ConfigMap, CronJob, Deployment, Job, Pod, PodSpec, PodTemplate } from './kube.js';
import { containersOf, imageTag } from './kube.js';

export interface PolicySource {
    namespace: string;
    configMap: string;
    /** The key in the ConfigMap's data holding the policy. */
    key: string;
}

export interface Install {
    mode: 'deployment' | 'cronjob';
    name: string;
    namespace: string;
    image: string;
    /** The image's tag -- what passes for a version here. */
    version: string;
    /** The whole command line, for showing it as it is. */
    command: string[];
    dryRun: boolean;
    /** --descheduling-interval, on a Deployment. */
    interval: string;
    /** The CronJob's schedule, and its time zone when it names one. */
    schedule: string;
    timeZone: string;
    suspended: boolean;
    leaderElection: boolean;
    policy: PolicySource | null;
    /** What --policy-config-file said, even when the volume behind it could not be found. */
    policyPath: string;
    /** Replicas wanted and ready, on a Deployment. */
    desired: number;
    ready: number;
    lastSchedule: string;
    lastSuccess: string;
    /** The labels its own pods carry, for finding them. */
    podLabels: Record<string, string>;
}

/** What the plugin says about this cluster before it draws anything else. */
export interface Verdict {
    tone: 'ok' | 'warn' | 'error' | 'none';
    headline: string;
    detail: string;
}

const IMAGE_MARK = 'descheduler';

/** Whether a pod template is running the descheduler. */
export function isDescheduler(template: PodTemplate | undefined, labels: Record<string, string> = {}): boolean {
    if (labels['app.kubernetes.io/name'] === 'descheduler') return true;
    for (const container of containersOf(template?.spec)) {
        if ((container.image ?? '').includes(IMAGE_MARK)) return true;
        const line = [...(container.command ?? []), ...(container.args ?? [])].join(' ');
        if (line.includes('/descheduler') || line.includes('--policy-config-file')) return true;
    }
    return false;
}

/**
 * The flags of a command line, as `--flag=value` and `--flag value` both. A
 * flag with no value at all reads as `"true"`, which is how `--dry-run` is
 * written.
 */
export function flags(tokens: string[]): Map<string, string> {
    const found = new Map<string, string>();
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i] ?? '';
        if (!token.startsWith('-')) continue;
        const name = token.replace(/^-+/, '');
        const equals = name.indexOf('=');
        if (equals >= 0) {
            found.set(name.slice(0, equals), name.slice(equals + 1));
            continue;
        }
        const next = tokens[i + 1];
        if (next !== undefined && !next.startsWith('-')) {
            found.set(name, next);
            i++;
        } else {
            found.set(name, 'true');
        }
    }
    return found;
}

/** The ConfigMap a path is mounted from, given the pod's volumes and mounts. */
export function policySource(spec: PodSpec | undefined, namespace: string, path: string): PolicySource | null {
    if (!path) return null;
    const slash = path.lastIndexOf('/');
    const dir = slash > 0 ? path.slice(0, slash) : '/';
    const file = path.slice(slash + 1);
    for (const container of containersOf(spec)) {
        for (const mount of container.volumeMounts ?? []) {
            // The mount is either the folder the file is in, or the file itself
            // through a subPath.
            const wholeDir = mount.mountPath === dir && !mount.subPath;
            const single = mount.mountPath === path;
            if (!wholeDir && !single) continue;
            const volume = (spec?.volumes ?? []).find((v) => v.name === mount.name);
            const configMap = volume?.configMap;
            if (!configMap?.name) continue;
            const wanted = single ? (mount.subPath ?? file) : file;
            const item = (configMap.items ?? []).find((i) => i.path === wanted);
            return { namespace, configMap: configMap.name, key: item?.key ?? wanted };
        }
    }
    return null;
}

function readTemplate(
    mode: Install['mode'],
    name: string,
    namespace: string,
    template: PodTemplate | undefined,
    podLabels: Record<string, string>,
): Install {
    const container = containersOf(template?.spec).find((c) => (c.image ?? '').includes(IMAGE_MARK)) ??
        containersOf(template?.spec)[0];
    const command = [...(container?.command ?? []), ...(container?.args ?? [])];
    const flag = flags(command);
    const policyPath = flag.get('policy-config-file') ?? '';
    return {
        mode,
        name,
        namespace,
        image: container?.image ?? '',
        version: imageTag(container?.image),
        command,
        dryRun: flag.get('dry-run') === 'true',
        interval: flag.get('descheduling-interval') ?? '',
        schedule: '',
        timeZone: '',
        suspended: false,
        leaderElection: flag.get('leader-elect') === 'true',
        policy: policySource(template?.spec, namespace, policyPath),
        policyPath,
        desired: 0,
        ready: 0,
        lastSchedule: '',
        lastSuccess: '',
        podLabels,
    };
}

/** Every descheduler among the cluster's Deployments and CronJobs. */
export function findInstalls(deployments: Deployment[], cronJobs: CronJob[]): Install[] {
    const found: Install[] = [];
    for (const deployment of deployments) {
        const labels = deployment.metadata.labels ?? {};
        if (!isDescheduler(deployment.spec?.template, labels)) continue;
        const install = readTemplate(
            'deployment',
            deployment.metadata.name,
            deployment.metadata.namespace ?? '',
            deployment.spec?.template,
            deployment.spec?.template?.metadata?.labels ?? labels,
        );
        install.desired = deployment.spec?.replicas ?? 0;
        install.ready = deployment.status?.readyReplicas ?? 0;
        found.push(install);
    }
    for (const cronJob of cronJobs) {
        const labels = cronJob.metadata.labels ?? {};
        const template = cronJob.spec?.jobTemplate?.spec?.template;
        if (!isDescheduler(template, labels)) continue;
        const install = readTemplate(
            'cronjob',
            cronJob.metadata.name,
            cronJob.metadata.namespace ?? '',
            template,
            template?.metadata?.labels ?? labels,
        );
        install.schedule = cronJob.spec?.schedule ?? '';
        install.timeZone = cronJob.spec?.timeZone ?? '';
        install.suspended = cronJob.spec?.suspend === true;
        install.lastSchedule = cronJob.status?.lastScheduleTime ?? '';
        install.lastSuccess = cronJob.status?.lastSuccessfulTime ?? '';
        install.desired = (cronJob.status?.active ?? []).length;
        found.push(install);
    }
    return found.sort((a, b) => (a.namespace + a.name).localeCompare(b.namespace + b.name));
}

/** The pods belonging to an install, by its own label set. */
export function ownPods(pods: Pod[], install: Install): Pod[] {
    const wanted = Object.entries(install.podLabels).filter(([key]) =>
        key === 'app.kubernetes.io/name' || key === 'app.kubernetes.io/instance' || key === 'app',
    );
    return pods.filter((pod) => {
        const labels = pod.metadata.labels ?? {};
        if (pod.metadata.namespace !== install.namespace) return false;
        if (wanted.length) return wanted.every(([key, value]) => labels[key] === value);
        return pod.metadata.name.startsWith(install.name);
    });
}

/** The Jobs a CronJob install has run, newest first. */
export function ownJobs(jobs: Job[], install: Install): Job[] {
    return jobs
        .filter((job) => job.metadata.namespace === install.namespace)
        .filter((job) => (job.metadata.ownerReferences ?? []).some((o) => o.name === install.name))
        .sort((a, b) => (b.metadata.creationTimestamp ?? '').localeCompare(a.metadata.creationTimestamp ?? ''));
}

/** Whether a Job finished, failed, or is still going. */
export function jobState(job: Job): { tone: 'ok' | 'warn' | 'error' | 'none'; text: string } {
    const conditions = job.status?.conditions ?? [];
    if (conditions.some((c) => c.type === 'Failed' && c.status === 'True')) {
        return { tone: 'error', text: conditions.find((c) => c.type === 'Failed')?.reason || 'failed' };
    }
    if (conditions.some((c) => c.type === 'Complete' && c.status === 'True')) return { tone: 'ok', text: 'complete' };
    if ((job.status?.active ?? 0) > 0) return { tone: 'warn', text: 'running' };
    return { tone: 'none', text: 'pending' };
}

/** The policy ConfigMaps in the cluster an install points at, or that look like one. */
export function policyConfigMaps(configMaps: ConfigMap[], install: Install | null): ConfigMap[] {
    const named = install?.policy;
    const mine = configMaps.filter(
        (cm) => named && cm.metadata.name === named.configMap && cm.metadata.namespace === named.namespace,
    );
    if (mine.length) return mine;
    // No install, or its ConfigMap is gone: anything holding something that
    // parses as a policy is worth offering rather than showing nothing.
    return configMaps.filter((cm) =>
        Object.entries(cm.data ?? {}).some(([key, value]) => key.endsWith('.yaml') && value.includes('DeschedulerPolicy')),
    );
}

/** A cron expression in words, when it is one of the shapes worth wording. */
export function cronInWords(schedule: string): string {
    const parts = schedule.trim().split(/\s+/);
    if (parts.length !== 5) return '';
    const [minute, hour, day, month, weekday] = parts as [string, string, string, string, string];
    const everything = day === '*' && month === '*' && weekday === '*';
    if (!everything) return '';
    const everyMinutes = /^\*\/(\d+)$/.exec(minute);
    if (everyMinutes && hour === '*') {
        const n = Number(everyMinutes[1]);
        return n === 1 ? 'every minute' : `every ${n} minutes`;
    }
    const everyHours = /^\*\/(\d+)$/.exec(hour);
    if (everyHours && /^\d+$/.test(minute)) {
        const n = Number(everyHours[1]);
        return n === 1 ? 'every hour' : `every ${n} hours`;
    }
    if (minute === '*' && hour === '*') return 'every minute';
    if (/^\d+$/.test(minute) && hour === '*') return 'every hour';
    if (/^\d+$/.test(minute) && /^\d+$/.test(hour)) {
        return `daily at ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
    return '';
}

/** How often this install runs, in a phrase that fits after "runs". */
export function cadence(install: Install): string {
    if (install.mode === 'cronjob') {
        const words = cronInWords(install.schedule);
        const zone = install.timeZone ? ` (${install.timeZone})` : '';
        return words ? `${words}${zone}` : `on ${install.schedule}${zone}`;
    }
    return install.interval ? `every ${install.interval}` : 'continuously';
}

/** The headline the overview leads with. */
export function verdict(installs: Install[], pods: Pod[], recentFailures: number): Verdict {
    if (!installs.length) {
        return {
            tone: 'none',
            headline: 'No descheduler in this cluster',
            detail:
                'Nothing here runs the descheduler image. Install it as a CronJob or a Deployment — the Helm chart does either — and this plugin fills in.',
        };
    }
    const install = installs[0] as Install;
    if (install.suspended) {
        return {
            tone: 'warn',
            headline: 'Suspended',
            detail: `${install.namespace}/${install.name} is a suspended CronJob: it will not run until suspend is cleared.`,
        };
    }
    if (install.dryRun) {
        return {
            tone: 'warn',
            headline: 'Running in dry run',
            detail: `${install.namespace}/${install.name} is started with --dry-run, so it reports what it would evict and evicts nothing.`,
        };
    }
    if (install.mode === 'deployment' && install.ready < 1) {
        return {
            tone: 'error',
            headline: 'Not running',
            detail: `${install.namespace}/${install.name} wants ${install.desired} replica(s) and has ${install.ready} ready.`,
        };
    }
    const unhappy = pods.filter((pod) => {
        const phase = pod.status?.phase ?? '';
        return phase === 'Failed' || (pod.status?.containerStatuses ?? []).some((c) => (c.restartCount ?? 0) > 3);
    });
    if (unhappy.length) {
        return {
            tone: 'warn',
            headline: 'Running, but its own pods are unhappy',
            detail: `${unhappy.length} of the descheduler's pods have failed or are restarting. Its logs are the place to look.`,
        };
    }
    if (recentFailures > 0) {
        return {
            tone: 'warn',
            headline: `Running — ${recentFailures} eviction${recentFailures === 1 ? '' : 's'} refused`,
            detail:
                'Evictions it asked for were turned down, usually by a PodDisruptionBudget or an eviction limit. Activity has each one.',
        };
    }
    return {
        tone: 'ok',
        headline: 'Running',
        detail: `${install.namespace}/${install.name} runs ${cadence(install)} and evicts what its policy asks for.`,
    };
}
