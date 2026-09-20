// The policy, as forms.
//
// Three things this page is careful about, all of them learned from what
// happens when it is not:
//
//  1. It edits a copy of the parsed policy and writes the whole key back, so
//     fields it does not draw survive. The file it would write is on screen
//     before anything is applied.
//  2. It checks the draft against what the descheduler validates at startup.
//     A policy the descheduler refuses leaves it crash-looping until somebody
//     edits the ConfigMap by hand, which is a bad thing for a form to be able
//     to do.
//  3. Nothing is written without the app's own confirmation -- `patch` puts the
//     change in front of the user, outside this frame, and it is applied only
//     if they say yes.
//
// Typing does not redraw the form: a control writes into the draft and asks the
// foot to redraw itself. Only toggling a plugin redraws that plugin's card.

import { byId, button, el, replace } from '../ui/dom.js';
import { start } from '../ui/page.js';
import { block, facts, objectLink, picker } from '../ui/parts.js';
import { argsTarget, docTarget, fields } from '../ui/fields.js';
import {findDescheduler } from '../ui/cluster.js';
import { readPolicy } from '../ui/policyfile.js';
import type { Found } from '../ui/cluster.js';
import type { PolicyFile } from '../ui/policyfile.js';
import { cadence } from '../model/install.js';
import type { Doc } from '../model/policy.js';
import {
    addProfile,
    argsOf,
    copy,
    dumpPolicy,
    emptyArgs,
    ensureArgs,
    enabledPlugins,
    isEnabled,
    newPolicy,
    problems,
    profileNames,
    profileNamed,
    removeArgs,
    same,
    setEnabled,
    startingArgs,
    tidy,
} from '../model/policy.js';
import type { PluginSpec, Point } from '../model/plugins.js';
import { DEFAULT_EVICTOR, EVICTOR_FIELDS, GLOBAL_FIELDS, pluginsAt } from '../model/plugins.js';

let found: Found;
let file: PolicyFile;
/** The policy as the cluster has it. */
let original: Doc | null = null;
/** The policy as this page would write it. */
let draft: Doc | null = null;
let current = '';
let showFile = false;
let creating = false;
/** The empty pluginConfig entries the file itself has, which are not ours to remove. */
let keepEmpty = new Set<string>();

start('page', async () => {
    found = await findDescheduler();
    file = await readPolicy(found.install);
    original = file.doc;
    keepEmpty = file.doc ? emptyArgs(file.doc) : new Set<string>();
    draft = file.doc ? copy(file.doc) : null;
    current = draft ? (profileNames(draft)[0] ?? '') : '';
    drawSource();
    drawForm();
    drawFoot();
});

function drawSource(): void {
    const install = found.install;
    byId('lead').textContent = install
        ? `What the descheduler in ${install.namespace}/${install.name} is told to do. It runs ${cadence(install)}, and reads this file ${install.mode === 'cronjob' ? 'at the start of every run' : 'when its pod starts'}.`
        : 'Nothing in this cluster runs the descheduler, so this is the policy a descheduler here would read.';

    const rows: [string, Node | string][] = [];
    if (file.configMap) {
        rows.push([
            'File',
            objectLink(
                'configmaps',
                file.configMap.metadata.namespace ?? '',
                file.configMap.metadata.name,
                `${file.configMap.metadata.namespace}/${file.configMap.metadata.name} · ${file.key}`,
            ),
        ]);
        if (file.guessed) {
            rows.push(['Found by', el('span', { class: 'tone-warn' }, 'looking for a policy, not by the workload naming it')]);
        }
    } else {
        rows.push(['File', el('span', { class: 'tone-warn' }, file.error)]);
    }
    if (draft) rows.push(['Version', String(draft['apiVersion'] ?? 'not set')]);
    if (draft) rows.push(['Profiles', profileNames(draft).join(', ') || 'none']);

    const actions = el('div', { class: 'bar', style: 'margin:10px 0 0' });
    if (!draft) {
        actions.append(
            button(
                'Start a policy',
                () => {
                    draft = newPolicy();
                    original = null;
                    creating = true;
                    current = profileNames(draft)[0] ?? '';
                    drawSource();
                    drawForm();
                    drawFoot();
                },
                { class: 'primary' },
            ),
            el('span', { class: 'faint' }, 'Builds a v1alpha2 policy here; nothing is written until you apply it.'),
        );
    }

    replace(
        byId('source'),
        block(
            'Where this comes from',
            file.error && !creating ? file.error : '',
            facts(rows),
            actions.childNodes.length ? actions : null,
        ),
    );
}

function drawForm(): void {
    const host = byId('form');
    if (!draft) {
        replace(host, el('p', { class: 'empty' }, 'No policy to edit yet.'));
        return;
    }
    const policy = draft;
    const profile = profileNamed(policy, current) ?? addProfile(policy, current || 'default');
    current = String(profile['name'] ?? current);

    const profileBar = el(
        'div',
        { class: 'bar' },
        el('span', { class: 'faint' }, 'Profile'),
        picker(
            'Profile',
            profileNames(policy).map((name) => ({ value: name, label: name })),
            current,
            (value) => {
                current = value;
                drawForm();
                drawFoot();
            },
        ),
        button('Add a profile', () => {
            const name = `profile-${profileNames(policy).length + 1}`;
            addProfile(policy, name);
            current = name;
            drawForm();
            drawFoot();
        }),
        el('span', { class: 'spacer' }),
        el('span', { class: 'faint' }, `${enabledPlugins(profile).length} plugin(s) enabled in this profile`),
    );

    replace(
        host,
        block(
            'The whole run',
            'These apply to every profile, and are the safest dials in the file: a ceiling on how much one pass may move.',
            fields(GLOBAL_FIELDS, docTarget(policy), drawFoot),
        ),
        block(
            'Profiles',
            'A profile is one set of plugins with one evictor. Most installs have exactly one.',
            profileBar,
        ),
        block(
            'What may be evicted at all',
            'The DefaultEvictor filters every eviction any plugin asks for. Nothing below it can evict a pod this refuses.',
            fields(EVICTOR_FIELDS, argsTarget(profile, DEFAULT_EVICTOR), drawFoot),
        ),
        pluginBlock(
            'Rebalancing',
            'Balance plugins look at the cluster as a whole — how full the nodes are, how the copies of a workload are spread.',
            'balance',
            profile,
        ),
        pluginBlock(
            'Evicting individual pods',
            'Deschedule plugins look at one pod at a time and decide whether it is in the wrong place.',
            'deschedule',
            profile,
        ),
    );
}

function pluginBlock(title: string, note: string, point: Point, profile: Doc): HTMLElement {
    const host = el('div', {});
    for (const spec of pluginsAt(point)) host.append(pluginCard(spec, point, profile));
    return block(title, note, host);
}

/** One plugin: its switch, and its arguments when it is on. */
function pluginCard(spec: PluginSpec, point: Point, profile: Doc): HTMLElement {
    const card = el('div', { class: 'plugin' });
    const draw = () => {
        const on = isEnabled(profile, spec.name, point);
        const box = el('input', { type: 'checkbox', class: 'switch', ...(on ? { checked: 'checked' } : {}) }) as HTMLInputElement;
        box.addEventListener('change', () => {
            setEnabled(profile, spec.name, point, box.checked);
            if (box.checked) {
                const args = ensureArgs(profile, spec.name);
                if (!Object.keys(args).length) Object.assign(args, startingArgs(spec.name));
            } else if (!Object.keys(argsOf(profile, spec.name)).length) {
                removeArgs(profile, spec.name);
            }
            draw();
            drawFoot();
        });
        card.className = `plugin${on ? ' plugin-on' : ''}`;
        replace(
            card,
            el(
                'div',
                { class: 'plugin-head' },
                box,
                el(
                    'div',
                    {},
                    el(
                        'div',
                        { class: 'plugin-title' },
                        el('strong', {}, spec.title),
                        el('span', { class: 'plugin-name' }, spec.name),
                        el('span', { class: 'tag' }, point),
                    ),
                    el('p', { class: 'plugin-summary' }, spec.summary),
                    spec.caution ? el('p', { class: 'plugin-caution' }, spec.caution) : null,
                ),
                el('span', { class: 'spacer' }),
                button('Docs', () => void k8sdockside.openUrl(spec.docs), { class: 'link' }),
            ),
            on ? el('div', { class: 'plugin-body' }, fields(spec.fields, argsTarget(profile, spec.name), drawFoot)) : null,
        );
    };
    draw();
    return card;
}

/** The foot: what is wrong, what would be written, and the buttons. */
function drawFoot(): void {
    const host = byId('foot');
    if (!draft) {
        replace(host);
        return;
    }
    const policy = draft;
    // What would actually be written: the draft without the empty entries
    // drawing the forms left behind. Both the diff and the file shown use it,
    // so what is on screen is what is applied.
    const written = tidy(policy, keepEmpty);
    const wrong = problems(written);
    const dirty = creating || !original || !same(original, written);
    const yaml = dumpPolicy(written);

    const buttons = el('div', { class: 'bar' });
    const apply = button(
        creating || !file.configMap ? 'Create the ConfigMap' : 'Apply to the cluster',
        () => void write(yaml),
        { class: 'primary' },
    );
    if (!dirty || wrong.length) apply.disabled = true;
    buttons.append(apply);
    buttons.append(
        button(showFile ? 'Hide the file' : 'Show the file', () => {
            showFile = !showFile;
            drawFoot();
        }),
    );
    if (dirty && original) {
        buttons.append(
            button('Undo my changes', () => {
                draft = copy(original as Doc);
                current = profileNames(draft)[0] ?? '';
                drawForm();
                drawFoot();
            }),
        );
    }
    buttons.append(el('span', { class: 'spacer' }));
    buttons.append(...afterwards());

    replace(
        host,
        block(
            dirty ? 'Unapplied changes' : 'No changes',
            dirty
                ? 'The app shows you this file and asks before anything is written. Comments and the original layout are not kept — the file below is exactly what would be applied.'
                : 'The form matches what is in the cluster.',
            wrong.length
                ? el(
                      'div',
                      { class: 'problems' },
                      el('strong', { class: 'tone-error' }, 'The descheduler would refuse this policy:'),
                      el('ul', {}, ...wrong.map((problem) => el('li', {}, problem))),
                  )
                : null,
            buttons,
            showFile ? el('pre', { class: 'yaml' }, yaml) : null,
        ),
    );
}

/** The buttons for making a new policy take effect. */
function afterwards(): HTMLElement[] {
    const install = found.install;
    if (!install) return [];
    if (install.mode === 'cronjob') {
        const cronJob = found.cronJobs.find(
            (job) => job.metadata.name === install.name && job.metadata.namespace === install.namespace,
        );
        if (!cronJob?.spec?.jobTemplate?.spec) return [];
        return [
            el('span', { class: 'faint' }, 'Picked up at the next run, or:'),
            button('Run it now', () => void runNow()),
        ];
    }
    return [
        el('span', { class: 'faint' }, 'A Deployment reads the policy when its pod starts:'),
        button('Restart the descheduler', () => void restart()),
    ];
}

async function write(yaml: string): Promise<void> {
    const install = found.install;
    const namespace = file.configMap?.metadata.namespace ?? install?.policy?.namespace ?? install?.namespace ?? '';
    const name = file.configMap?.metadata.name ?? install?.policy?.configMap ?? 'descheduler';
    const key = file.key || 'policy.yaml';
    try {
        if (file.configMap) {
            await k8sdockside.patch({ kind: 'configmaps', namespace, name, patch: { data: { [key]: yaml } } });
        } else {
            await k8sdockside.create({
                kind: 'configmaps',
                namespace,
                object: {
                    apiVersion: 'v1',
                    kind: 'ConfigMap',
                    metadata: { name, namespace, labels: { 'app.kubernetes.io/name': 'descheduler' } },
                    data: { [key]: yaml },
                },
            });
        }
    } catch (err) {
        note(err instanceof Error ? err.message : String(err), 'warn');
        return;
    }
    creating = false;
    file = await readPolicy(found.install);
    original = file.doc;
    keepEmpty = file.doc ? emptyArgs(file.doc) : keepEmpty;
    draft = file.doc ? copy(file.doc) : draft;
    drawSource();
    drawForm();
    drawFoot();
    note('Applied. The descheduler reads it at its next start.', 'ok');
}

async function runNow(): Promise<void> {
    const install = found.install;
    const cronJob = found.cronJobs.find(
        (job) => job.metadata.name === install?.name && job.metadata.namespace === install?.namespace,
    );
    const template = cronJob?.spec?.jobTemplate;
    if (!install || !template?.spec) return;
    try {
        const made = await k8sdockside.create({
            kind: 'jobs',
            namespace: install.namespace,
            object: {
                apiVersion: 'batch/v1',
                kind: 'Job',
                metadata: {
                    generateName: `${install.name}-manual-`,
                    namespace: install.namespace,
                    labels: template.metadata?.labels ?? {},
                    annotations: { 'cronjob.kubernetes.io/instantiate': 'manual' },
                },
                spec: template.spec,
            },
        });
        note(`${made.name} is running. Activity fills in as it evicts.`, 'ok');
    } catch (err) {
        note(err instanceof Error ? err.message : String(err), 'warn');
    }
}

async function restart(): Promise<void> {
    const install = found.install;
    if (!install) return;
    try {
        await k8sdockside.patch({
            kind: 'deployments',
            namespace: install.namespace,
            name: install.name,
            patch: {
                spec: {
                    template: {
                        metadata: {
                            annotations: { 'kubectl.kubernetes.io/restartedAt': new Date().toISOString() },
                        },
                    },
                },
            },
        });
        note('Restarting. The new pod reads the policy as it starts.', 'ok');
    } catch (err) {
        note(err instanceof Error ? err.message : String(err), 'warn');
    }
}

/** A line under the buttons -- the page cannot reach the app's own notices. */
function note(message: string, tone: 'ok' | 'warn'): void {
    const line = el('p', { class: `tone-${tone}`, style: 'margin:8px 0 0' }, message);
    byId('foot').append(line);
    setTimeout(() => line.remove(), 8000);
}
