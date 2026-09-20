// The forms the Policy page is made of.
//
// One function per kind of thing a descheduler argument can be, each writing
// straight into the parsed policy through setPath. Emptying a control removes
// the argument rather than writing a zero or an empty string: a policy that
// says `minReplicas: 0` and one that does not mention it are the same to the
// descheduler, and only one of them reads well.
//
// Nothing here knows what a descheduler plugin is. It is handed a Field from
// the catalogue and a mapping to write into, which is what keeps adding an
// argument to a plugin a one-line change in plugins.ts.

import { el, button, replace, svg } from './dom.js';
import { CROSS } from './icons.js';
import type { Field } from '../model/plugins.js';
import type { Doc } from '../model/policy.js';
import { argsOf, ensureArgs, formatLabels, getPath, parseLabels, setPath } from '../model/policy.js';

let uniqueId = 0;

/**
 * Where a group of fields reads from and writes to.
 *
 * Two functions rather than one object because drawing a form must not change
 * the policy: `read` never creates anything, and `write` is called only when
 * somebody actually edits a control. A page that handed the fields
 * `ensureArgs(...)` would add a `pluginConfig` entry for every enabled plugin
 * simply by rendering, and the foot would report unapplied changes to a policy
 * nobody had touched.
 */
export interface Target {
    read(): Doc;
    write(): Doc;
}

/** A mapping that is already there -- the policy's own top level. */
export function docTarget(doc: Doc): Target {
    return { read: () => doc, write: () => doc };
}

/** One plugin's arguments inside a profile, made on the first edit. */
export function argsTarget(profile: Doc, name: string): Target {
    return { read: () => argsOf(profile, name), write: () => ensureArgs(profile, name) };
}

/** A labelled control with its sentence of help under it. */
function row(field: Field, control: Node, extra?: Node | null): HTMLElement {
    const id = `field-${++uniqueId}`;
    if (control instanceof HTMLElement && control.tagName !== 'DIV') control.id = id;
    return el(
        'div',
        { class: 'field' },
        el('label', { class: 'field-label', for: id }, field.label),
        control,
        extra ?? null,
        el('p', { class: 'field-help' }, field.help),
    );
}

function asArray(value: unknown): string[] {
    return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

/** A removable chip, as a list's values are drawn. */
function chip(text: string, remove: () => void): HTMLElement {
    const drop = el('button', { type: 'button', class: 'chip-x', 'aria-label': `Remove ${text}` }, svg(CROSS, 'icon tiny'));
    drop.addEventListener('click', remove);
    return el('span', { class: 'chip' }, el('span', {}, text), drop);
}

/** A list of strings as chips, with a box to add another. */
function chipList(
    values: string[],
    write: (next: string[]) => void,
    options: { suggest?: string[]; numeric?: boolean; placeholder?: string } = {},
): HTMLElement {
    const holder = el('div', { class: 'chips' });
    const draw = () => {
        const parts: Node[] = values.map((value, index) =>
            chip(value, () => {
                values.splice(index, 1);
                write([...values]);
                draw();
            }),
        );
        const box = el('input', {
            type: 'text',
            class: 'chip-input',
            placeholder: options.placeholder ?? 'add…',
            ...(options.suggest?.length ? { list: `suggest-${uniqueId}` } : {}),
        }) as HTMLInputElement;
        const add = () => {
            const text = box.value.trim();
            if (!text) return;
            if (options.numeric && !Number.isFinite(Number(text))) return;
            if (!values.includes(text)) {
                values.push(text);
                write([...values]);
            }
            box.value = '';
            draw();
            holder.querySelector<HTMLInputElement>('.chip-input')?.focus();
        };
        box.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();
                add();
            }
        });
        box.addEventListener('blur', add);
        parts.push(box);
        if (options.suggest?.length) {
            uniqueId++;
            box.setAttribute('list', `suggest-${uniqueId}`);
            parts.push(
                el(
                    'datalist',
                    { id: `suggest-${uniqueId}` },
                    ...options.suggest.map((item) => el('option', { value: item })),
                ),
            );
        }
        replace(holder, ...parts);
    };
    draw();
    return holder;
}

/** One field of a plugin's arguments, drawn and wired to the policy. */
export function field(spec: Field, target: Target, changed: () => void): HTMLElement {
    const current = getPath(target.read(), spec.path);
    const write = (value: unknown) => {
        setPath(target.write(), spec.path, value);
        changed();
    };

    switch (spec.kind) {
        case 'bool': {
            const box = el('input', { type: 'checkbox', class: 'switch', ...(current === true ? { checked: 'checked' } : {}) }) as HTMLInputElement;
            box.addEventListener('change', () => write(box.checked ? true : undefined));
            const id = `field-${++uniqueId}`;
            box.id = id;
            return el(
                'div',
                { class: 'field field-bool' },
                el('div', { class: 'switch-row' }, box, el('label', { for: id }, spec.label)),
                el('p', { class: 'field-help' }, spec.help),
            );
        }
        case 'number': {
            const input = el('input', {
                type: 'number',
                class: 'input',
                ...(spec.min !== undefined ? { min: spec.min } : {}),
                ...(spec.max !== undefined ? { max: spec.max } : {}),
                ...(spec.placeholder ? { placeholder: spec.placeholder } : {}),
                value: current === undefined || current === null ? '' : String(current),
            }) as HTMLInputElement;
            input.addEventListener('change', () => {
                const text = input.value.trim();
                if (!text) return write(undefined);
                const value = Number(text);
                return write(Number.isFinite(value) ? value : undefined);
            });
            return row(spec, spec.unit ? el('div', { class: 'with-unit' }, input, el('span', { class: 'unit' }, spec.unit)) : input);
        }
        case 'text': {
            const input = el('input', {
                type: 'text',
                class: 'input',
                ...(spec.placeholder ? { placeholder: spec.placeholder } : {}),
                value: current === undefined || current === null ? '' : String(current),
            }) as HTMLInputElement;
            input.addEventListener('change', () => write(input.value.trim() || undefined));
            return row(spec, input);
        }
        case 'labels': {
            const input = el('input', {
                type: 'text',
                class: 'input',
                ...(spec.placeholder ? { placeholder: spec.placeholder } : {}),
                value: formatLabels(current),
            }) as HTMLInputElement;
            input.addEventListener('change', () => {
                const labels = parseLabels(input.value);
                write(Object.keys(labels).length ? labels : undefined);
                input.value = formatLabels(getPath(target.read(), spec.path));
            });
            return row(spec, input);
        }
        case 'list': {
            const values = asArray(current);
            const list = chipList(
                values,
                (next) => write(next.length ? (spec.numeric ? next.map(Number) : next) : undefined),
                { suggest: spec.suggest, numeric: spec.numeric },
            );
            return row(spec, list);
        }
        case 'choice': {
            const chosen = new Set(asArray(current));
            const boxes = el('div', { class: 'choices' });
            for (const option of spec.options) {
                const id = `field-${++uniqueId}`;
                const box = el('input', {
                    type: 'checkbox',
                    id,
                    ...(chosen.has(option) ? { checked: 'checked' } : {}),
                }) as HTMLInputElement;
                box.addEventListener('change', () => {
                    if (box.checked) chosen.add(option);
                    else chosen.delete(option);
                    write(chosen.size ? [...chosen] : undefined);
                });
                boxes.append(el('label', { class: 'choice', for: id }, box, el('span', {}, option)));
            }
            return row(spec, boxes);
        }
        case 'select': {
            const picker = el('select', { class: 'input' }) as HTMLSelectElement;
            picker.append(el('option', { value: '' }, '(not set)'));
            for (const option of spec.options) {
                picker.append(el('option', { value: option, ...(current === option ? { selected: 'selected' } : {}) }, option));
            }
            picker.addEventListener('change', () => write(picker.value || undefined));
            return row(spec, picker);
        }
        case 'namespaces': {
            const include = asArray(getPath(target.read(), `${spec.path}.include`));
            const exclude = asArray(getPath(target.read(), `${spec.path}.exclude`));
            const both = el('div', { class: 'two-up' });
            const warn = el('p', { class: 'field-warn' }, 'A list is one or the other: the descheduler refuses a policy naming both.');
            const refresh = () => {
                warn.style.display =
                    asArray(getPath(target.read(), `${spec.path}.include`)).length &&
                    asArray(getPath(target.read(), `${spec.path}.exclude`)).length
                        ? 'block'
                        : 'none';
            };
            both.append(
                el(
                    'div',
                    {},
                    el('div', { class: 'field-sublabel' }, 'Only these'),
                    chipList(include, (next) => {
                        setPath(target.write(), `${spec.path}.include`, next.length ? next : undefined);
                        refresh();
                        changed();
                    }, { placeholder: 'namespace…' }),
                ),
                el(
                    'div',
                    {},
                    el('div', { class: 'field-sublabel' }, 'All but these'),
                    chipList(exclude, (next) => {
                        setPath(target.write(), `${spec.path}.exclude`, next.length ? next : undefined);
                        refresh();
                        changed();
                    }, { placeholder: 'namespace…' }),
                ),
            );
            refresh();
            return row(spec, both, warn);
        }
        case 'thresholds': {
            const holder = el('div', { class: 'thresholds' });
            for (const resource of ['cpu', 'memory', 'pods']) {
                const value = getPath(target.read(), `${spec.path}.${resource}`);
                const input = el('input', {
                    type: 'number',
                    class: 'input small',
                    min: 0,
                    max: 100,
                    placeholder: '—',
                    value: value === undefined || value === null ? '' : String(value),
                }) as HTMLInputElement;
                input.addEventListener('change', () => {
                    const text = input.value.trim();
                    if (!text) {
                        setPath(target.write(), `${spec.path}.${resource}`, undefined);
                    } else {
                        const number = Number(text);
                        setPath(target.write(), `${spec.path}.${resource}`, Number.isFinite(number) ? number : undefined);
                    }
                    changed();
                });
                holder.append(
                    el('label', { class: 'threshold' }, el('span', {}, resource), input, el('span', { class: 'unit' }, '%')),
                );
            }
            const known = new Set(['cpu', 'memory', 'pods']);
            const extra = Object.keys((getPath(target.read(), spec.path) as Doc | undefined) ?? {}).filter((key) => !known.has(key));
            return row(
                spec,
                holder,
                extra.length
                    ? el('p', { class: 'field-warn' }, `Also set, and left as they are: ${extra.join(', ')}.`)
                    : null,
            );
        }
    }
}

/** Every field of a group. */
export function fields(specs: Field[], target: Target, changed: () => void): HTMLElement {
    const holder = el('div', { class: 'fields' });
    for (const spec of specs) holder.append(field(spec, target, changed));
    return holder;
}

/** A button that looks like the app's primary one. */
export function primary(label: string, onClick: () => void): HTMLButtonElement {
    return button(label, onClick, { class: 'primary' });
}
