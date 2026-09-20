// The panel in every pod's detail view: could the descheduler move this pod?
//
// The answer is worth having in front of the pod rather than in the
// documentation, because it depends on the DefaultEvictor settings actually in
// this cluster's policy -- which is what this reads. Each check says which way
// it went and why, so a "no" is a sentence you can act on rather than a verdict.

import { byId, button, dot, el, replace } from '../ui/dom.js';
import { start } from '../ui/page.js';
import { checkRow, evictionTable } from '../ui/parts.js';
import {budgets, findDescheduler, listOrNone, ownerOf } from '../ui/cluster.js';
import { readPolicy } from '../ui/policyfile.js';
import type { Event, Pod } from '../model/kube.js';
import { evictions } from '../model/activity.js';
import { argsOf, profileNames, profileNamed } from '../model/policy.js';
import { effectiveProtections, evaluate } from '../model/protect.js';
import { DEFAULT_EVICTOR } from '../model/plugins.js';

start('page', async (ctx) => {
    const target = ctx.object;
    if (!target) return;
    const pod = await k8sdockside.object<Pod>();

    const [found, events] = await Promise.all([
        findDescheduler(),
        listOrNone<Event>({ kind: 'events', namespace: target.namespace }),
    ]);
    const file = await readPolicy(found.install);
    const mine = evictions(events).filter((item) => item.pod === target.name && item.namespace === target.namespace);

    byId('loading').remove();
    const body = byId('body');

    if (!file.doc) {
        replace(
            body,
            el(
                'p',
                { class: 'note' },
                found.install
                    ? `The descheduler runs here, but its policy could not be read (${file.error}), so what it would do with this pod cannot be worked out.`
                    : 'Nothing in this cluster runs the descheduler, so nothing here evicts this pod.',
            ),
            mine.length ? evictionTable(mine, { showNamespace: false, showPod: false }) : null,
        );
        return;
    }

    const names = profileNames(file.doc);
    const profile = profileNamed(file.doc, names[0] ?? '') ?? null;
    const evictor = profile ? argsOf(profile, DEFAULT_EVICTOR) : {};
    const protections = effectiveProtections(evictor);
    const owner = await ownerOf(pod);
    const pdbs = protections.has('PodsWithoutPDB') ? await budgets(target.namespace).catch(() => []) : [];
    const answer = evaluate(pod, { profile: names[0] ?? '', evictor, owner, pdbs });

    // Being evictable is the ordinary state of a healthy Deployment's pod, so
    // it is not drawn as a warning. Protected is the green one: nothing here
    // will move it.
    const tone = answer.evictable === false ? 'ok' : answer.evictable === true ? 'info' : 'none';
    replace(
        body,
        el(
            'div',
            { class: 'bar' },
            dot(tone),
            el('strong', {}, answer.headline),
            el('span', { class: 'faint' }, `by the DefaultEvictor in profile ${names[0] || '(unnamed)'}`),
            el('span', { class: 'spacer' }),
            ...(await actionButtons()),
        ),
        el('div', { class: 'checks' }, ...answer.checks.map(checkRow)),
        mine.length
            ? el(
                  'div',
                  { style: 'margin-top:10px' },
                  el('h3', {}, 'What the descheduler did with it'),
                  evictionTable(mine, { showNamespace: false, showPod: false }),
              )
            : null,
    );
});

/** The plugin's own actions, as the app offers them for this pod right now. */
async function actionButtons(): Promise<HTMLElement[]> {
    let offered: K8sDockside.OfferedAction[] = [];
    try {
        offered = await k8sdockside.actions();
    } catch {
        return [];
    }
    return offered.map((action) =>
        button(action.label, () => {
            void k8sdockside.run(action.id).catch(() => {});
        }),
    );
}
