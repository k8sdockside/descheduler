// Reading the policy out of the ConfigMap the descheduler mounts.
//
// Apart from cluster.ts on purpose: parsing YAML is the one heavy thing these
// pages do, and a page that only draws events -- Activity, the node panel --
// should not carry a YAML parser it never calls.

import type { ConfigMap } from '../model/kube.js';
import type { Install } from '../model/install.js';
import { policyConfigMaps } from '../model/install.js';
import type { Doc } from '../model/policy.js';
import { parsePolicy } from '../model/policy.js';

export interface PolicyFile {
    configMap: ConfigMap | null;
    /** The key in it holding the policy. */
    key: string;
    text: string;
    doc: Doc | null;
    error: string;
    /** Whether the install pointed at this, or it was found by looking. */
    guessed: boolean;
}

/** The policy an install mounts, or the likeliest one when it names none. */
export async function readPolicy(install: Install | null): Promise<PolicyFile> {
    const namespace = install?.policy?.namespace ?? '';
    const configMaps = await k8sdockside.list<ConfigMap>({ kind: 'configmaps', namespace });
    const candidates = policyConfigMaps(configMaps, install);
    const configMap = candidates[0] ?? null;
    if (!configMap) {
        return {
            configMap: null,
            key: install?.policy?.key ?? 'policy.yaml',
            text: '',
            doc: null,
            error: install?.policy
                ? `${install.policy.namespace}/${install.policy.configMap} is not in the cluster`
                : 'no ConfigMap here holds a DeschedulerPolicy',
            guessed: !install?.policy,
        };
    }
    const guessed =
        !install?.policy ||
        install.policy.configMap !== configMap.metadata.name ||
        install.policy.namespace !== configMap.metadata.namespace;
    const keys = Object.keys(configMap.data ?? {});
    const key = !guessed && install?.policy?.key && keys.includes(install.policy.key)
        ? install.policy.key
        : (keys.find((name) => name.endsWith('.yaml') && (configMap.data?.[name] ?? '').includes('DeschedulerPolicy')) ??
          keys[0] ??
          'policy.yaml');
    const text = configMap.data?.[key] ?? '';
    const parsed = parsePolicy(text);
    return { configMap, key, text, doc: parsed.doc, error: parsed.error, guessed };
}
