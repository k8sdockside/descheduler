// The policy itself: YAML in a ConfigMap key, in and out.
//
// The editor works on the object js-yaml parsed, and writes that same object
// back out. That is the whole reason it is safe to point at a policy somebody
// else wrote: a field this plugin has never heard of is read, carried through
// untouched, and dumped again. What the forms change is the handful of paths
// they draw controls for, and nothing else moves.
//
// What is lost in a round trip is the file's comments and its exact layout --
// js-yaml parses to data, not to a document. The page says so before applying,
// and shows the file it is about to write.

import { dump, load } from 'js-yaml';
import type { Field, Point } from './plugins.js';
import { DEFAULT_EVICTOR } from './plugins.js';

export type Doc = Record<string, unknown>;

export const API_VERSION = 'descheduler/v1alpha2';
export const KIND = 'DeschedulerPolicy';

export interface Parsed {
    doc: Doc | null;
    error: string;
}

/** The policy as data, or the reason it could not be read. */
export function parsePolicy(text: string): Parsed {
    if (!text.trim()) return { doc: null, error: 'the key is empty' };
    let value: unknown;
    try {
        value = load(text);
    } catch (err) {
        return { doc: null, error: err instanceof Error ? err.message : String(err) };
    }
    if (!isRecord(value)) return { doc: null, error: 'the file is not a YAML mapping' };
    if (value['kind'] !== undefined && value['kind'] !== KIND) {
        return { doc: null, error: `this is a ${String(value['kind'])}, not a ${KIND}` };
    }
    return { doc: value, error: '' };
}

/** The policy as a file again. */
export function dumpPolicy(doc: Doc): string {
    return dump(doc, { indent: 2, lineWidth: 100, noRefs: true, sortKeys: false, quotingType: '"' });
}

/** An empty policy with one profile, for a cluster that has none yet. */
export function newPolicy(profileName = 'default'): Doc {
    return {
        apiVersion: API_VERSION,
        kind: KIND,
        profiles: [
            {
                name: profileName,
                pluginConfig: [{ name: DEFAULT_EVICTOR, args: {} }],
                plugins: { balance: { enabled: [] }, deschedule: { enabled: [] } },
            },
        ],
    };
}

export function isRecord(value: unknown): value is Doc {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ----- profiles --------------------------------------------------------------

export function profiles(doc: Doc): Doc[] {
    const list = doc['profiles'];
    return Array.isArray(list) ? list.filter(isRecord) : [];
}

export function profileNames(doc: Doc): string[] {
    return profiles(doc).map((profile, index) => String(profile['name'] ?? `profile ${index + 1}`));
}

export function profileNamed(doc: Doc, name: string): Doc | null {
    return profiles(doc).find((profile) => String(profile['name'] ?? '') === name) ?? null;
}

/** Adds a profile, and returns it. */
export function addProfile(doc: Doc, name: string): Doc {
    const existing = profileNamed(doc, name);
    if (existing) return existing;
    const profile: Doc = {
        name,
        pluginConfig: [{ name: DEFAULT_EVICTOR, args: {} }],
        plugins: { balance: { enabled: [] }, deschedule: { enabled: [] } },
    };
    const list = Array.isArray(doc['profiles']) ? (doc['profiles'] as unknown[]) : [];
    list.push(profile);
    doc['profiles'] = list;
    return profile;
}

export function removeProfile(doc: Doc, name: string): void {
    const list = Array.isArray(doc['profiles']) ? (doc['profiles'] as unknown[]) : [];
    doc['profiles'] = list.filter((profile) => !(isRecord(profile) && String(profile['name'] ?? '') === name));
}

// ----- which plugins are on --------------------------------------------------

function pluginSet(profile: Doc, point: Point, create: boolean): Doc | null {
    let plugins = profile['plugins'];
    if (!isRecord(plugins)) {
        if (!create) return null;
        plugins = {};
        profile['plugins'] = plugins;
    }
    const holder = plugins as Doc;
    let set = holder[point];
    if (!isRecord(set)) {
        if (!create) return null;
        set = {};
        holder[point] = set;
    }
    return set as Doc;
}

function names(set: Doc | null, key: 'enabled' | 'disabled'): string[] {
    const list = set?.[key];
    return Array.isArray(list) ? list.map(String) : [];
}

export function enabledAt(profile: Doc, point: Point): string[] {
    return names(pluginSet(profile, point, false), 'enabled');
}

export function isEnabled(profile: Doc, name: string, point: Point): boolean {
    return enabledAt(profile, point).includes(name);
}

/** Every plugin this profile turns on, whatever the extension point. */
export function enabledPlugins(profile: Doc): string[] {
    return [...enabledAt(profile, 'balance'), ...enabledAt(profile, 'deschedule')];
}

export function setEnabled(profile: Doc, name: string, point: Point, on: boolean): void {
    const set = pluginSet(profile, point, true);
    if (!set) return;
    const enabled = names(set, 'enabled').filter((item) => item !== name);
    if (on) enabled.push(name);
    if (enabled.length) set['enabled'] = enabled;
    else delete set['enabled'];
    // A plugin cannot be in both lists, and leaving it in `disabled` while
    // enabling it is the kind of thing the descheduler refuses to start on.
    const disabled = names(set, 'disabled').filter((item) => item !== name);
    if (disabled.length) set['disabled'] = disabled;
    else delete set['disabled'];
    const plugins = profile['plugins'];
    if (isRecord(plugins) && !Object.keys(set).length) delete plugins[point];
}

// ----- a plugin's arguments ----------------------------------------------------

function configs(profile: Doc, create: boolean): unknown[] | null {
    const list = profile['pluginConfig'];
    if (Array.isArray(list)) return list;
    if (!create) return null;
    const made: unknown[] = [];
    profile['pluginConfig'] = made;
    return made;
}

/** A plugin's arguments as they are, or an empty object when it has none. */
export function argsOf(profile: Doc, name: string): Doc {
    const entry = (configs(profile, false) ?? [])
        .filter(isRecord)
        .find((config) => String(config['name'] ?? '') === name);
    const args = entry?.['args'];
    return isRecord(args) ? args : {};
}

/** A plugin's arguments, made if they are not there. */
export function ensureArgs(profile: Doc, name: string): Doc {
    const list = configs(profile, true) ?? [];
    let entry = list.filter(isRecord).find((config) => String(config['name'] ?? '') === name);
    if (!entry) {
        entry = { name, args: {} };
        list.push(entry);
    }
    let args = entry['args'];
    if (!isRecord(args)) {
        args = {};
        entry['args'] = args;
    }
    return args as Doc;
}

/** Drops a plugin's whole pluginConfig entry. */
export function removeArgs(profile: Doc, name: string): void {
    const list = configs(profile, false);
    if (!list) return;
    const kept = list.filter((config) => !(isRecord(config) && String(config['name'] ?? '') === name));
    if (kept.length) profile['pluginConfig'] = kept;
    else delete profile['pluginConfig'];
}

/**
 * What a plugin is given when it is switched on. The descheduler refuses to
 * start when a plugin that needs arguments has none -- LowNodeUtilization
 * without thresholds, RemovePodsViolatingNodeAffinity without a type -- so
 * enabling one from a form has to put something sensible there. These are the
 * values from the descheduler's own README examples.
 */
export function startingArgs(name: string): Doc {
    switch (name) {
        case 'LowNodeUtilization':
            return {
                thresholds: { cpu: 20, memory: 20, pods: 20 },
                targetThresholds: { cpu: 50, memory: 50, pods: 50 },
            };
        case 'HighNodeUtilization':
            return { thresholds: { cpu: 20, memory: 20, pods: 20 } };
        case 'RemovePodsViolatingNodeAffinity':
            return { nodeAffinityType: ['requiredDuringSchedulingIgnoredDuringExecution'] };
        case 'RemovePodsHavingTooManyRestarts':
            return { podRestartThreshold: 100, includingInitContainers: true };
        case 'PodLifeTime':
            return { maxPodLifeTimeSeconds: 86400 };
        case 'RemoveFailedPods':
            return { minPodLifetimeSeconds: 3600 };
        default:
            return {};
    }
}

// ----- reading and writing one field -------------------------------------------

/** The value at a dotted path, or undefined. */
export function getPath(root: Doc, path: string): unknown {
    let here: unknown = root;
    for (const step of path.split('.')) {
        if (!isRecord(here)) return undefined;
        here = here[step];
    }
    return here;
}

/**
 * Writes a value at a dotted path. `undefined` removes it, and removes any
 * mapping left empty behind it -- a policy full of `labelSelector: {}` is a
 * policy nobody can read.
 */
export function setPath(root: Doc, path: string, value: unknown): void {
    const steps = path.split('.');
    const last = steps.pop();
    if (!last) return;
    const chain: Doc[] = [root];
    let here: Doc = root;
    for (const step of steps) {
        let next = here[step];
        if (!isRecord(next)) {
            if (value === undefined) return;
            next = {};
            here[step] = next;
        }
        here = next as Doc;
        chain.push(here);
    }
    if (value === undefined) delete here[last];
    else here[last] = value;
    for (let i = chain.length - 1; i > 0; i--) {
        const node = chain[i] as Doc;
        if (Object.keys(node).length) break;
        const parent = chain[i - 1] as Doc;
        const key = steps[i - 1];
        if (key !== undefined) delete parent[key];
    }
}

/** `a=b,c=d` as a map, ignoring anything that is not a pair. */
export function parseLabels(text: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const part of text.split(',')) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const equals = trimmed.indexOf('=');
        if (equals < 0) continue;
        out[trimmed.slice(0, equals).trim()] = trimmed.slice(equals + 1).trim();
    }
    return out;
}

export function formatLabels(value: unknown): string {
    if (!isRecord(value)) return '';
    return Object.entries(value)
        .map(([key, item]) => `${key}=${String(item ?? '')}`)
        .join(',');
}

// ----- checking it before it is written -------------------------------------------

/**
 * What the descheduler would refuse to start on. Not a reimplementation of its
 * validation -- only the mistakes a form can actually produce, checked before
 * the user is asked to apply a file that would leave the descheduler
 * crash-looping until somebody edits the ConfigMap by hand.
 */
export function problems(doc: Doc): string[] {
    const found: string[] = [];
    const version = String(doc['apiVersion'] ?? '');
    if (version && !version.startsWith('descheduler/')) {
        found.push(`apiVersion is "${version}", which is not a descheduler policy version`);
    }
    const list = profiles(doc);
    if (!list.length) found.push('the policy has no profiles, so nothing would run');
    for (const profile of list) {
        const where = String(profile['name'] ?? '(unnamed)');
        if (!profile['name']) found.push('a profile has no name');
        if (!enabledPlugins(profile).length) {
            found.push(`profile "${where}" enables no plugins, so it would do nothing`);
        }
        for (const name of enabledPlugins(profile)) {
            const args = argsOf(profile, name);
            found.push(...argProblems(where, name, args));
        }
        const evictor = argsOf(profile, DEFAULT_EVICTOR);
        const threshold = evictor['priorityThreshold'];
        if (isRecord(threshold) && threshold['value'] !== undefined && threshold['name'] !== undefined) {
            found.push(`profile "${where}": the evictor names both a priority value and a PriorityClass`);
        }
        found.push(...namespaceProblems(where, DEFAULT_EVICTOR, evictor));
    }
    return found;
}

function argProblems(where: string, name: string, args: Doc): string[] {
    const found: string[] = [];
    const at = `profile "${where}", ${name}`;
    for (const key of ['thresholds', 'targetThresholds']) {
        const value = args[key];
        if (value === undefined) continue;
        if (!isRecord(value)) {
            found.push(`${at}: ${key} is not a mapping of resource to percentage`);
            continue;
        }
        for (const [resource, percentage] of Object.entries(value)) {
            const number = Number(percentage);
            if (!Number.isFinite(number) || number < 0 || number > 100) {
                found.push(`${at}: ${key}.${resource} is ${String(percentage)}, and a percentage is 0 to 100`);
            }
        }
    }
    if (name === 'LowNodeUtilization' || name === 'HighNodeUtilization') {
        if (!isRecord(args['thresholds']) || !Object.keys(args['thresholds'] as Doc).length) {
            found.push(`${at}: needs thresholds, and has none`);
        }
    }
    if (name === 'LowNodeUtilization') {
        const low = args['thresholds'];
        const high = args['targetThresholds'];
        if (!isRecord(high) || !Object.keys(high).length) {
            found.push(`${at}: needs targetThresholds, and has none`);
        } else if (isRecord(low) && args['useDeviationThresholds'] !== true) {
            for (const [resource, value] of Object.entries(low)) {
                const target = high[resource];
                if (target !== undefined && Number(value) > Number(target)) {
                    found.push(`${at}: ${resource} is under-used above ${String(value)}% but over-used above ${String(target)}%`);
                }
            }
        }
    }
    if (name === 'RemovePodsViolatingNodeAffinity') {
        const types = args['nodeAffinityType'];
        if (!Array.isArray(types) || !types.length) {
            found.push(`${at}: needs a nodeAffinityType, or it does nothing`);
        }
    }
    if (name === 'RemovePodsHavingTooManyRestarts') {
        const threshold = Number(args['podRestartThreshold'] ?? 0);
        if (!Number.isFinite(threshold) || threshold < 1) {
            found.push(`${at}: podRestartThreshold must be 1 or more`);
        }
    }
    if (name === 'PodLifeTime') {
        const filters = ['maxPodLifeTimeSeconds', 'states', 'conditions', 'exitCodes'];
        if (!filters.some((key) => args[key] !== undefined)) {
            found.push(`${at}: needs at least one of an age, states, conditions or exit codes`);
        }
    }
    found.push(...namespaceProblems(where, name, args));
    return found;
}

function namespaceProblems(where: string, name: string, args: Doc): string[] {
    const found: string[] = [];
    for (const key of ['namespaces', 'evictableNamespaces']) {
        const value = args[key];
        if (!isRecord(value)) continue;
        const include = Array.isArray(value['include']) ? value['include'] : [];
        const exclude = Array.isArray(value['exclude']) ? value['exclude'] : [];
        if (include.length && exclude.length) {
            found.push(`profile "${where}", ${name}: ${key} has both an include and an exclude list`);
        }
    }
    return found;
}

/** Whether two policies would be written the same way. */
export function same(a: Doc, b: Doc): boolean {
    return dumpPolicy(a) === dumpPolicy(b);
}

/**
 * The `profile|plugin` keys whose pluginConfig entry has no arguments, as the
 * file already has them.
 *
 * Drawing a plugin's form needs somewhere to write into, so opening the page
 * makes an empty entry for every enabled plugin that has none. Written back
 * out, those would be a diff of pure noise -- the page would announce
 * "unapplied changes" the moment it opened. `tidy` takes them out again, and
 * this is what tells it which empty entries were the file's own and must stay.
 */
export function emptyArgs(doc: Doc): Set<string> {
    const found = new Set<string>();
    for (const profile of profiles(doc)) {
        const where = String(profile['name'] ?? '');
        const list = Array.isArray(profile['pluginConfig']) ? profile['pluginConfig'] : [];
        for (const config of list) {
            if (!isRecord(config)) continue;
            const args = config['args'];
            if (!isRecord(args) || !Object.keys(args).length) found.add(`${where}|${String(config['name'] ?? '')}`);
        }
    }
    return found;
}

/** A copy without the empty pluginConfig entries the editor made along the way. */
export function tidy(doc: Doc, keep: Set<string>): Doc {
    const tidied = copy(doc);
    for (const profile of profiles(tidied)) {
        const where = String(profile['name'] ?? '');
        const list = Array.isArray(profile['pluginConfig']) ? (profile['pluginConfig'] as unknown[]) : [];
        const kept = list.filter((config) => {
            if (!isRecord(config)) return true;
            const args = config['args'];
            if (isRecord(args) && Object.keys(args).length) return true;
            return keep.has(`${where}|${String(config['name'] ?? '')}`);
        });
        if (kept.length) profile['pluginConfig'] = kept;
        else delete profile['pluginConfig'];
    }
    return tidied;
}

/** A deep copy, for keeping the file as it was beside the file being edited. */
export function copy<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

/** The fields whose value is set, for the "what this profile says" summary. */
export function setFields(args: Doc, fields: Field[]): number {
    return fields.filter((field) => getPath(args, field.path) !== undefined).length;
}
