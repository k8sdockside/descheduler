// Opens the plugin's pages in a browser against a cluster that is not there.
//
//   node scripts/preview.mjs        http://localhost:8173
//
// The app serves the bridge at /plugin-ui/_sdk/k8sdockside.js and answers it
// from outside the page. This serves ui/ as it is and answers the bridge from
// the fixture below instead, so every page can be looked at -- and every one of
// its states: a cluster with no descheduler, a suspended CronJob, a policy that
// will not parse -- without installing anything anywhere.
//
// It is a development tool, not part of the plugin. The app never sees it, and
// what it proves is that the pages run, not that they read a real cluster
// correctly; that is what `npm test` and a real install are for.
//
// No dependencies: Node's own http and fs.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UI = path.join(ROOT, 'ui');
const PORT = Number(process.env.PORT ?? 8173);

// ----- the cluster that is not there ----------------------------------------

const NOW = Date.now();
const ago = (minutes) => new Date(NOW - minutes * 60_000).toISOString();

const POLICY = `apiVersion: "descheduler/v1alpha2"
kind: "DeschedulerPolicy"
maxNoOfPodsToEvictPerNode: 10
profiles:
  - name: default
    pluginConfig:
      - name: DefaultEvictor
        args:
          nodeFit: true
          minReplicas: 2
          minPodAge: 5m
      - name: RemoveDuplicates
        args:
          excludeOwnerKinds:
            - ReplicaSet
      - name: LowNodeUtilization
        args:
          thresholds:
            cpu: 20
            memory: 20
            pods: 20
          targetThresholds:
            cpu: 50
            memory: 50
            pods: 50
      - name: RemovePodsHavingTooManyRestarts
        args:
          podRestartThreshold: 100
          includingInitContainers: true
    plugins:
      balance:
        enabled:
          - RemoveDuplicates
          - LowNodeUtilization
      deschedule:
        enabled:
          - RemovePodsViolatingNodeTaints
          - RemovePodsHavingTooManyRestarts
`;

const podSpec = {
    containers: [
        {
            name: 'descheduler',
            image: 'registry.k8s.io/descheduler/descheduler:v0.33.0',
            command: ['/bin/descheduler'],
            args: ['--policy-config-file', '/policy-dir/policy.yaml', '--v=3'],
            volumeMounts: [{ name: 'policy-volume', mountPath: '/policy-dir' }],
        },
    ],
    volumes: [{ name: 'policy-volume', configMap: { name: 'descheduler' } }],
};

const labels = { 'app.kubernetes.io/name': 'descheduler', 'app.kubernetes.io/instance': 'descheduler' };

const CLUSTER = {
    cronjobs: [
        {
            apiVersion: 'batch/v1',
            kind: 'CronJob',
            metadata: { name: 'descheduler', namespace: 'kube-system', labels, creationTimestamp: ago(60 * 24 * 9) },
            spec: {
                schedule: '*/2 * * * *',
                suspend: false,
                jobTemplate: { metadata: { labels }, spec: { template: { metadata: { labels }, spec: podSpec } } },
            },
            status: { lastScheduleTime: ago(1), lastSuccessfulTime: ago(1) },
        },
    ],
    deployments: [
        {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            metadata: { name: 'web', namespace: 'shop', creationTimestamp: ago(60 * 24 * 30) },
            spec: { replicas: 4, template: { spec: { containers: [{ name: 'web', image: 'nginx:1.27' }] } } },
            status: { readyReplicas: 4 },
        },
    ],
    jobs: [
        {
            apiVersion: 'batch/v1',
            kind: 'Job',
            metadata: {
                name: 'descheduler-29281234',
                namespace: 'kube-system',
                creationTimestamp: ago(1),
                ownerReferences: [{ apiVersion: 'batch/v1', kind: 'CronJob', name: 'descheduler', uid: 'cj', controller: true }],
            },
            status: { succeeded: 1, conditions: [{ type: 'Complete', status: 'True' }] },
        },
        {
            apiVersion: 'batch/v1',
            kind: 'Job',
            metadata: {
                name: 'descheduler-29281232',
                namespace: 'kube-system',
                creationTimestamp: ago(3),
                ownerReferences: [{ apiVersion: 'batch/v1', kind: 'CronJob', name: 'descheduler', uid: 'cj', controller: true }],
            },
            status: { succeeded: 1, conditions: [{ type: 'Complete', status: 'True' }] },
        },
    ],
    configmaps: [
        {
            apiVersion: 'v1',
            kind: 'ConfigMap',
            metadata: { name: 'descheduler', namespace: 'kube-system', labels },
            data: { 'policy.yaml': POLICY },
        },
    ],
    pods: [
        {
            apiVersion: 'v1',
            kind: 'Pod',
            metadata: { name: 'descheduler-29281234-fk2qd', namespace: 'kube-system', labels, creationTimestamp: ago(1) },
            spec: { nodeName: 'node-1', containers: [{ name: 'descheduler' }] },
            status: { phase: 'Succeeded', containerStatuses: [{ name: 'descheduler', restartCount: 0 }] },
        },
        {
            apiVersion: 'v1',
            kind: 'Pod',
            metadata: {
                name: 'web-7d4f9-2xk11',
                namespace: 'shop',
                labels: { app: 'web' },
                creationTimestamp: ago(60 * 5),
                ownerReferences: [{ apiVersion: 'apps/v1', kind: 'ReplicaSet', name: 'web-7d4f9', uid: 'rs', controller: true }],
            },
            spec: { nodeName: 'node-2', containers: [{ name: 'web' }], volumes: [{ name: 'cache', emptyDir: {} }] },
            status: { phase: 'Running', startTime: ago(60 * 5) },
        },
    ],
    nodes: [
        {
            apiVersion: 'v1',
            kind: 'Node',
            metadata: { name: 'node-1', creationTimestamp: ago(60 * 24 * 90) },
            status: { conditions: [{ type: 'Ready', status: 'True' }] },
        },
        {
            apiVersion: 'v1',
            kind: 'Node',
            metadata: { name: 'node-2', creationTimestamp: ago(60 * 24 * 90) },
            status: { conditions: [{ type: 'Ready', status: 'True' }] },
        },
    ],
    replicasets: [
        {
            apiVersion: 'apps/v1',
            kind: 'ReplicaSet',
            metadata: { name: 'web-7d4f9', namespace: 'shop' },
            spec: { replicas: 4 },
            status: { readyReplicas: 4 },
        },
    ],
    poddisruptionbudgets: [],
    events: buildEvents(),
};

/** A day of evictions, the way the descheduler records them. */
function buildEvents() {
    const events = [];
    const plugins = ['RemoveDuplicates', 'LowNodeUtilization', 'RemovePodsViolatingNodeTaints', 'RemovePodsHavingTooManyRestarts'];
    const namespaces = ['shop', 'data', 'ops'];
    const nodes = ['node-1', 'node-2', 'node-3'];
    for (let i = 0; i < 64; i++) {
        const minutes = Math.floor(Math.pow(i / 64, 2) * 60 * 20) + 2;
        const namespace = namespaces[i % namespaces.length];
        const node = nodes[i % nodes.length];
        const pod = `${['web', 'api', 'worker'][i % 3]}-${(i * 7919).toString(36).slice(0, 5)}`;
        const refused = i % 9 === 0;
        events.push({
            apiVersion: 'v1',
            kind: 'Event',
            metadata: { name: `${pod}.17${i}`, namespace, uid: `ev-${i}`, creationTimestamp: ago(minutes) },
            type: refused ? 'Warning' : 'Normal',
            reason: refused ? 'EvictionFailed' : plugins[i % plugins.length],
            action: 'Descheduled',
            message: refused
                ? `pod eviction from ${node} node by sigs.k8s.io/descheduler failed: error when evicting pod "${pod}": Cannot evict pod as it would violate the pod's disruption budget.`
                : `pod eviction from ${node} node by sigs.k8s.io/descheduler`,
            reportingComponent: 'sigs.k8s.io.descheduler',
            lastTimestamp: ago(minutes),
            involvedObject: { kind: 'Pod', namespace, name: pod },
            count: 1,
        });
    }
    // Somebody else's events, which the plugin must leave alone.
    events.push({
        apiVersion: 'v1',
        kind: 'Event',
        metadata: { name: 'web.17zzz', namespace: 'shop', uid: 'ev-sched' },
        type: 'Normal',
        reason: 'Scheduled',
        message: 'Successfully assigned shop/web to node-1',
        source: { component: 'default-scheduler' },
        lastTimestamp: ago(4),
        involvedObject: { kind: 'Pod', namespace: 'shop', name: 'web' },
    });
    return events;
}

const THEMES = {
    dark: {
        id: 'k8sdockside-dark',
        base: 'dark',
        tokens: {
            bg: '#10151c', 'bg-sidebar': '#151b24', 'bg-panel': '#19202a', 'bg-raised': '#212b38',
            'bg-hover': 'rgba(255, 255, 255, 0.08)', 'bg-active': 'rgba(255, 255, 255, 0.13)',
            border: '#46536a', 'border-soft': 'rgba(255, 255, 255, 0.05)',
            text: '#e8eef7', 'text-dim': '#a9b6c6', 'text-faint': '#8593a3',
            accent: '#4a86ff', 'accent-text': '#ffffff', ok: '#5fd39b', warn: '#efb567', error: '#f4787f',
            'chart-1': '#3987e5', 'chart-2': '#d95926', 'chart-3': '#199e70', 'chart-4': '#c98500',
            'chart-grid': 'rgba(255, 255, 255, 0.10)',
        },
    },
    light: {
        id: 'k8sdockside-light',
        base: 'light',
        tokens: {
            bg: '#f6f7f9', 'bg-sidebar': '#eef0f4', 'bg-panel': '#ffffff', 'bg-raised': '#e7eaf0',
            'bg-hover': 'rgba(0, 0, 0, 0.045)', 'bg-active': 'rgba(0, 0, 0, 0.075)',
            border: '#d5dae2', 'border-soft': 'rgba(0, 0, 0, 0.07)',
            text: '#1b2430', 'text-dim': '#55616f', 'text-faint': '#5f6873',
            accent: '#2f6fe4', 'accent-text': '#ffffff', ok: '#1f8a58', warn: '#8f5c12', error: '#c8384a',
            'chart-1': '#2a78d6', 'chart-2': '#eb6834', 'chart-3': '#1baf7a', 'chart-4': '#eda100',
            'chart-grid': 'rgba(0, 0, 0, 0.10)',
        },
    },
};

// ----- the bridge, answered from the fixture ---------------------------------

function sdk() {
    return `// A stand-in for the app's bridge, for scripts/preview.mjs only.
(function () {
    const CLUSTER = ${JSON.stringify(CLUSTER)};
    const THEMES = ${JSON.stringify(THEMES)};
    const params = new URLSearchParams(location.search);
    const theme = THEMES[params.get('theme') === 'light' ? 'light' : 'dark'];
    const viewId = params.get('view') || (location.pathname.replace(/^\\/|\\.html$/g, '') || 'overview');
    const sectionId = viewId === 'pod' || viewId === 'node' ? viewId : '';
    const object = sectionId
        ? {
              kind: sectionId === 'pod' ? 'pods' : 'nodes',
              namespace: params.get('namespace') || (sectionId === 'pod' ? 'shop' : ''),
              name: params.get('name') || (sectionId === 'pod' ? 'web-7d4f9-2xk11' : 'node-2'),
          }
        : null;

    const root = document.documentElement;
    for (const [name, value] of Object.entries(theme.tokens)) root.style.setProperty('--' + name, value);
    root.style.setProperty('color-scheme', theme.base);
    root.setAttribute('data-theme-base', theme.base);

    const say = (what) => {
        console.log('[preview]', what);
        const note = document.createElement('div');
        note.textContent = what;
        note.style.cssText =
            'position:fixed;left:12px;bottom:12px;z-index:99;background:var(--bg-raised);color:var(--text);' +
            'border:1px solid var(--border);border-radius:6px;padding:6px 10px;font:12px system-ui;max-width:60ch';
        document.body.appendChild(note);
        setTimeout(() => note.remove(), 4000);
    };

    const kept = {};
    const copy = (value) => JSON.parse(JSON.stringify(value));
    const later = (value) => new Promise((resolve) => setTimeout(() => resolve(copy(value)), 40));

    window.k8sdockside = {
        ready: () =>
            later({
                pluginId: 'descheduler',
                viewId: sectionId ? '' : viewId,
                sectionId,
                object,
                contextId: 'preview',
                contextName: 'preview cluster',
                readable: Object.keys(CLUSTER),
                write: true,
                actions: [
                    { id: 'allow-eviction', label: 'Allow descheduling', kind: 'pods' },
                    { id: 'clear-eviction', label: 'Clear descheduling mark', kind: 'pods' },
                ],
                plugin: {
                    id: 'descheduler',
                    name: 'Descheduler',
                    version: '1.0.0',
                    docs: 'https://github.com/kubernetes-sigs/descheduler#readme',
                    links: [{ label: 'GitHub', url: 'https://github.com/kubernetes-sigs/descheduler' }],
                },
                theme,
            }),
        object: () => {
            const list = CLUSTER[object.kind] || [];
            const found = list.find((item) => item.metadata.name === object.name);
            return found ? later(found) : Promise.reject(new Error('no such object in the fixture'));
        },
        list: (query) => later((CLUSTER[query.kind] || []).filter((item) =>
            !query.namespace || item.metadata.namespace === query.namespace)),
        get: (ref) => {
            const found = (CLUSTER[ref.kind] || []).find((item) => item.metadata.name === ref.name);
            return found ? later(found) : Promise.reject(new Error(ref.kind + '/' + ref.name + ' is not in the fixture'));
        },
        watch: (query, onItems) => {
            window.k8sdockside.list(query).then(onItems);
            const timer = setInterval(() => window.k8sdockside.list(query).then(onItems), Math.max(query.interval || 5000, 1000));
            return () => clearInterval(timer);
        },
        namespaces: () => later(['default', 'kube-system', 'shop', 'data', 'ops']),
        summary: () =>
            later({
                pluginId: 'descheduler',
                installed: true,
                checked: true,
                requirements: [],
                cards: [],
                error: '',
            }),
        charts: () =>
            later({
                attached: true,
                range: 180,
                source: { available: false, error: 'no Prometheus in the fixture', describe: '', configured: '', endpoint: {} },
                charts: [],
            }),
        actions: () =>
            later([
                { pluginId: 'descheduler', pluginName: 'Descheduler', id: 'allow-eviction', label: 'Allow descheduling', icon: 'check', tone: '', confirm: '', done: '' },
            ]),
        run: (id) => { say('run(' + id + ') -- the app would ask you first'); return later({ created: '' }); },
        patch: (request) => { say('patch ' + request.kind + '/' + request.name + ' -- the app would show it and ask'); return later(null); },
        create: (request) => { say('create in ' + request.namespace + ' -- the app would show it and ask'); return later({ name: 'made-by-preview' }); },
        open: (ref) => { say('open ' + ref.kind + ' ' + (ref.name || '')); return later(null); },
        openView: (id) => { location.href = id + '.html' + location.search; return later(null); },
        edit: (ref) => { say('edit ' + ref.kind + '/' + ref.name); return later(null); },
        logs: (ref) => { say('logs for ' + ref.namespace + '/' + ref.name); return later(null); },
        openUrl: (url) => { say('openUrl ' + url); return later(null); },
        on: () => () => {},
        resize: () => later(null),
        storage: {
            get: (key) => later(kept[key] ?? null),
            set: (key, value) => { kept[key] = value; return later(null); },
            remove: (key) => { delete kept[key]; return later(null); },
            keys: () => later(Object.keys(kept).sort()),
        },
    };
})();
`;
}

const INDEX = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Descheduler plugin preview</title>
<style>
 body { font: 14px/1.6 system-ui; margin: 40px auto; max-width: 62ch; color: #e8eef7; background: #10151c; }
 a { color: #4a86ff; display: block; padding: 6px 0; }
 code { color: #a9b6c6; }
</style></head><body>
<h1>Descheduler plugin, without a cluster</h1>
<p>The pages, answered from the fixture in <code>scripts/preview.mjs</code>. Not the app: no sandbox,
no real objects, and every write only says what it would have asked.</p>
<a href="/overview.html">Overview</a>
<a href="/activity.html">Activity</a>
<a href="/policy.html">Policy</a>
<a href="/pod.html?view=pod&namespace=shop&name=web-7d4f9-2xk11">Pod panel</a>
<a href="/node.html?view=node&name=node-2">Node panel</a>
<p>Add <code>?theme=light</code> to any of them.</p>
</body></html>
`;

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === '/plugin-ui/_sdk/k8sdockside.js') {
        response.writeHead(200, { 'content-type': TYPES['.js'] });
        response.end(sdk());
        return;
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
        response.writeHead(200, { 'content-type': TYPES['.html'] });
        response.end(INDEX);
        return;
    }
    const name = path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
    try {
        const body = await readFile(path.join(UI, name));
        response.writeHead(200, { 'content-type': TYPES[path.extname(name)] ?? 'application/octet-stream' });
        response.end(body);
    } catch {
        response.writeHead(404, { 'content-type': 'text/plain' });
        response.end(`no ${name} in ui/ -- run \`npm run build\` first`);
    }
}).listen(PORT, () => {
    console.log(`Preview on http://localhost:${PORT} -- serving ui/ with a fixture for a bridge.`);
});
