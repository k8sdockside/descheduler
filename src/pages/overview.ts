// The overview: is the descheduler here, how does it run, and what has it done.
//
// It leads with the verdict rather than with numbers, because the question
// this page exists to answer -- for a cluster that has never had a descheduler
// as much as for one that has -- is "is anything moving my pods?". The
// generated overview would answer "the cluster serves ConfigMaps", which is
// true and useless: the descheduler has no CRD to find it by.

import { byId, button, dot, el, replace } from '../ui/dom.js';
import { start, stat, since } from '../ui/page.js';
import { block, facts, objectLink, verdictBanner, evictionTable } from '../ui/parts.js';
import { bars, formatValue, sparkline, timeline } from '../ui/bars.js';
import {findDescheduler, listOrNone, pods as listPods } from '../ui/cluster.js';
import { readPolicy } from '../ui/policyfile.js';
import type { Event, Job, Pod } from '../model/kube.js';
import { cadence, jobState, ownJobs, ownPods, verdict } from '../model/install.js';
import { buckets, evictions, since as within, tally, totals } from '../model/activity.js';
import { argsOf, enabledPlugins, getPath, profileNames, profiles } from '../model/policy.js';
import { GLOBAL_FIELDS, pluginByName } from '../model/plugins.js';

const WINDOW_MINUTES = 24 * 60;

start('page', async () => {
    const [found, events] = await Promise.all([
        findDescheduler(),
        listOrNone<Event>({ kind: 'events', namespace: '' }),
    ]);
    const install = found.install;
    const all = evictions(events);
    const recent = within(all, WINDOW_MINUTES);
    const counts = totals(recent);

    const policy = await readPolicy(install);
    const pods = install ? ownPods(await listPods(install.namespace), install) : [];
    const jobs = install?.mode === 'cronjob' ? ownJobs(await listOrNone<Job>({ kind: 'jobs', namespace: install.namespace }), install) : [];

    byId('lead').textContent = install
        ? `${install.namespace}/${install.name} runs ${cadence(install)}. Everything below is read from the cluster: its workload, the policy it mounts, and the events it leaves on the pods it evicts.`
        : 'The descheduler evicts running pods so the scheduler can place them again somewhere better. Nothing in this cluster runs it yet.';

    replace(byId('verdict'), verdictBanner(verdict(found.installs, pods, counts.refused)));

    replace(
        byId('stats'),
        stat('Evicted, 24h', String(counts.evicted), counts.evicted ? 'ok' : ''),
        stat('Refused, 24h', String(counts.refused), counts.refused ? 'error' : ''),
        stat('Nodes touched', String(counts.nodes)),
        stat('Plugins that fired', String(counts.strategies)),
        stat('Runs', install ? cadence(install) : '—'),
        stat('Version', install?.version || '—'),
    );

    const blocks = byId('blocks');
    replace(blocks);

    // ----- what it did ---------------------------------------------------------

    blocks.append(
        block(
            'The last day',
            'Every eviction the descheduler recorded, by the hour. Refusals are stacked on top in red — an eviction a PodDisruptionBudget turned down is the one worth reading.',
            timeline(buckets(recent, WINDOW_MINUTES, 48)),
            // Upstream gates every EvictionFailed event on this one field, so a
            // window with no refusals in it may mean nothing was refused -- or
            // that nothing is recorded when something is.
            policy.doc && getPath(policy.doc, 'evictionFailureEventNotification') !== true
                ? el(
                      'p',
                      { class: 'faint', style: 'margin:6px 0 0' },
                      'Refused evictions are not recorded in this cluster: the policy leaves evictionFailureEventNotification off, so only successful evictions appear here. ',
                      button('Turn it on in Policy', () => void k8sdockside.openView('policy'), { class: 'link' }),
                  )
                : null,
            el(
                'div',
                { class: 'columns' },
                el('div', {}, el('h3', {}, 'By plugin'), bars(tally(recent, (item) => item.strategy))),
                el('div', {}, el('h3', {}, 'By namespace'), bars(tally(recent, (item) => item.namespace))),
                el('div', {}, el('h3', {}, 'By node'), bars(tally(recent, (item) => item.node))),
            ),
            el(
                'div',
                { class: 'bar', style: 'margin:10px 0 0' },
                button('Open Activity', () => void k8sdockside.openView('activity'), { class: 'primary' }),
                el('span', { class: 'faint' }, `${all.length} descheduler events are in the cluster's event history.`),
            ),
        ),
    );

    if (recent.length) {
        blocks.append(block('Most recent', '', evictionTable(recent.slice(0, 8))));
    }

    // ----- how it runs -----------------------------------------------------------

    if (install) {
        const kind = install.mode === 'cronjob' ? 'cronjobs' : 'deployments';
        const rows: [string, Node | string][] = [
            ['Runs as', el('span', {}, install.mode === 'cronjob' ? 'a CronJob, ' : 'a Deployment, ', cadence(install))],
            ['Workload', objectLink(kind, install.namespace, install.name, `${install.namespace}/${install.name}`)],
            ['Image', install.image || '—'],
            ['Dry run', install.dryRun ? el('span', { class: 'tone-warn' }, 'yes — it evicts nothing') : 'no'],
        ];
        if (install.mode === 'cronjob') {
            rows.push(['Schedule', install.schedule || '—']);
            rows.push(['Last run', install.lastSchedule ? `${since(install.lastSchedule)} ago` : 'never']);
            rows.push(['Last success', install.lastSuccess ? `${since(install.lastSuccess)} ago` : 'never']);
            if (install.suspended) rows.push(['Suspended', el('span', { class: 'tone-warn' }, 'yes')]);
        } else {
            rows.push(['Replicas', `${install.ready} of ${install.desired} ready`]);
            rows.push(['Leader election', install.leaderElection ? 'on' : 'off']);
        }
        rows.push([
            'Policy',
            install.policy
                ? objectLink(
                      'configmaps',
                      install.policy.namespace,
                      install.policy.configMap,
                      `${install.policy.namespace}/${install.policy.configMap} · ${install.policy.key}`,
                  )
                : el('span', { class: 'tone-warn' }, install.policyPath ? `mounted from ${install.policyPath}, source not found` : 'no --policy-config-file'),
        ]);
        rows.push(['Command', el('span', { class: 'mono' }, install.command.join(' ') || '—')]);

        const podRows = pods
            .slice()
            .sort((a, b) => (b.metadata.creationTimestamp ?? '').localeCompare(a.metadata.creationTimestamp ?? ''))
            .slice(0, 5);

        blocks.append(
            block(
                'How it runs',
                'Read from the workload itself — the flags it was started with are the whole of its configuration, beside the policy.',
                el(
                    'div',
                    { class: 'columns' },
                    facts(rows),
                    el(
                        'div',
                        {},
                        el('h3', {}, install.mode === 'cronjob' ? 'Its recent runs' : 'Its pods'),
                        install.mode === 'cronjob' && jobs.length ? jobTable(jobs) : podTable(podRows),
                        el(
                            'div',
                            { class: 'bar', style: 'margin-top:8px' },
                            podRows[0]
                                ? button('Its logs', () =>
                                      void k8sdockside
                                          .logs({ kind: 'pods', namespace: podRows[0]?.metadata.namespace ?? '', name: podRows[0]?.metadata.name ?? '' })
                                          .catch(() => {}),
                                  )
                                : null,
                            button('Open the workload', () =>
                                void k8sdockside.open({ kind, namespace: install.namespace, name: install.name }).catch(() => {}),
                            ),
                        ),
                    ),
                ),
            ),
        );
    } else {
        blocks.append(
            block(
                'Putting one in',
                'The descheduler is one workload and one ConfigMap. The chart installs either shape:',
                el('pre', { class: 'yaml' },
                    'helm repo add descheduler https://kubernetes-sigs.github.io/descheduler/\n' +
                    'helm install descheduler descheduler/descheduler \\\n' +
                    '  --namespace kube-system --set kind=CronJob',
                ),
                el('p', { class: 'faint' }, 'This page fills in as soon as something here runs the descheduler image — it is found by its image and its flags, not by a name.'),
            ),
        );
    }

    // ----- what the policy says -----------------------------------------------------

    if (policy.doc) {
        const doc = policy.doc;
        const cards: Node[] = [];
        for (const profile of profiles(doc)) {
            const enabled = enabledPlugins(profile);
            cards.push(
                el(
                    'div',
                    {},
                    el('h3', {}, String(profile['name'] ?? 'unnamed profile')),
                    el(
                        'div',
                        { class: 'chips', style: 'margin:4px 0 6px' },
                        ...(enabled.length
                            ? enabled.map((name) =>
                                  el('span', { class: 'tag tag-on', title: pluginByName(name)?.summary ?? '' }, pluginByName(name)?.title ?? name),
                              )
                            : [el('span', { class: 'faint' }, 'no plugins enabled — this profile does nothing')]),
                    ),
                    facts(evictorFacts(argsOf(profile, 'DefaultEvictor'))),
                ),
            );
        }
        const limits = GLOBAL_FIELDS.map((field) => [field.label, getPath(doc, field.path)] as const).filter(
            ([, value]) => value !== undefined && value !== null && value !== false,
        );
        blocks.append(
            block(
                'What the policy asks for',
                `${policy.configMap?.metadata.namespace}/${policy.configMap?.metadata.name} · ${policy.key}${policy.guessed ? ' — found by looking, not named by the workload' : ''}`,
                el('div', { class: 'columns' }, ...cards),
                limits.length
                    ? el('div', { style: 'margin-top:10px' }, el('h3', {}, 'Limits on a single pass'), facts(limits.map(([label, value]) => [label, String(value)])))
                    : null,
                el(
                    'div',
                    { class: 'bar', style: 'margin:10px 0 0' },
                    button('Open Policy', () => void k8sdockside.openView('policy'), { class: 'primary' }),
                    el('span', { class: 'faint' }, `${profileNames(doc).length} profile(s), apiVersion ${String(doc['apiVersion'] ?? 'not set')}.`),
                ),
            ),
        );
    } else if (install) {
        blocks.append(
            block(
                'What the policy asks for',
                '',
                el('p', { class: 'tone-warn' }, `The policy could not be read: ${policy.error}.`),
                button('Open Policy', () => void k8sdockside.openView('policy')),
            ),
        );
    }

    // ----- charts ---------------------------------------------------------------------

    await drawCharts(blocks);

    // ----- links ------------------------------------------------------------------------

    const ctx = await k8sdockside.ready();
    const links = ctx.plugin?.links ?? [];
    if (links.length) {
        blocks.append(
            block(
                'Read further',
                'These open in your browser — the page itself has no network, so it asks the app.',
                el('div', { class: 'links' }, ...links.map((link) => button(link.label, () => void k8sdockside.openUrl(link.url)))),
            ),
        );
    }
});

function evictorFacts(evictor: Record<string, unknown>): [string, string][] {
    const rows: [string, string][] = [];
    rows.push(['Only where another node fits', evictor['nodeFit'] === true ? 'yes' : 'no']);
    if (evictor['minReplicas'] !== undefined) rows.push(['Leaves workloads under', `${String(evictor['minReplicas'])} replicas`]);
    if (evictor['minPodAge'] !== undefined) rows.push(['Leaves pods younger than', String(evictor['minPodAge'])]);
    const may: string[] = [];
    if (evictor['evictLocalStoragePods'] === true) may.push('local storage');
    if (evictor['evictDaemonSetPods'] === true) may.push('DaemonSet pods');
    if (evictor['evictSystemCriticalPods'] === true) may.push('system critical');
    if (evictor['evictFailedBarePods'] === true) may.push('failed bare pods');
    if (may.length) rows.push(['May also evict', may.join(', ')]);
    const never: string[] = [];
    if (evictor['ignorePvcPods'] === true) never.push('pods with a PVC');
    if (evictor['ignorePodsWithoutPDB'] === true) never.push('pods with no PDB');
    if (never.length) rows.push(['Never evicts', never.join(', ')]);
    return rows;
}

function podTable(pods: Pod[]): HTMLElement {
    if (!pods.length) return el('p', { class: 'faint' }, 'No pods of its own right now.');
    const body = el('tbody', {});
    for (const pod of pods) {
        const restarts = (pod.status?.containerStatuses ?? []).reduce((sum, c) => sum + (c.restartCount ?? 0), 0);
        const phase = pod.status?.phase ?? '';
        body.append(
            el(
                'tr',
                {},
                el('td', {}, objectLink('pods', pod.metadata.namespace ?? '', pod.metadata.name)),
                el('td', {}, dot(phase === 'Running' || phase === 'Succeeded' ? 'ok' : phase === 'Failed' ? 'error' : 'warn'), ' ', phase || '—'),
                el('td', { class: restarts > 3 ? 'tone-warn' : 'faint' }, `${restarts} restart${restarts === 1 ? '' : 's'}`),
                el('td', { class: 'faint' }, since(pod.metadata.creationTimestamp)),
            ),
        );
    }
    return el('table', {}, body);
}

function jobTable(jobs: Job[]): HTMLElement {
    const body = el('tbody', {});
    for (const job of jobs.slice(0, 6)) {
        const state = jobState(job);
        body.append(
            el(
                'tr',
                {},
                el('td', {}, objectLink('jobs', job.metadata.namespace ?? '', job.metadata.name)),
                el('td', {}, dot(state.tone), ' ', state.text),
                el('td', { class: 'faint' }, `${since(job.metadata.creationTimestamp)} ago`),
            ),
        );
    }
    return el('table', {}, body);
}

/** The plugin's own Prometheus charts, as one compact row each. */
async function drawCharts(blocks: HTMLElement): Promise<void> {
    let panel: K8sDockside.ChartsPanel;
    try {
        panel = await k8sdockside.charts({ minutes: 180 });
    } catch {
        return;
    }
    if (!panel.attached) return;
    if (!panel.source.available) {
        blocks.append(
            block(
                'From Prometheus',
                'The descheduler exports its own counters. No Prometheus was found in this cluster, so these are empty.',
                el('p', { class: 'faint' }, panel.source.error || 'Set one on the cluster in the sidebar’s settings panel to fill them in.'),
            ),
        );
        return;
    }
    const rows = el('div', { class: 'bars' });
    for (const chart of panel.charts) {
        const series = chart.series[0];
        const last = series?.points[series.points.length - 1];
        rows.append(
            el(
                'div',
                { class: 'bar-row' },
                el('div', { class: 'bar-label', title: chart.description }, chart.label),
                el('div', {}, series ? sparkline(series.points) : el('span', { class: 'faint' }, chart.error || 'no data')),
                el('div', { class: 'bar-value' }, last ? formatValue(chart.unit, last.v) : '—'),
            ),
        );
        for (const extra of chart.series.slice(1, 5)) {
            const tail = extra.points[extra.points.length - 1];
            rows.append(
                el(
                    'div',
                    { class: 'bar-row' },
                    el('div', { class: 'bar-label faint', title: extra.name }, `  ${extra.name}`),
                    el('div', {}, sparkline(extra.points)),
                    el('div', { class: 'bar-value' }, tail ? formatValue(chart.unit, tail.v) : '—'),
                ),
            );
        }
    }
    blocks.append(
        block('From Prometheus', `The last three hours, through ${panel.source.describe}.`, rows),
    );
}
