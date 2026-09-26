# descheduler

The [K8s Dockside](https://github.com/k8sdockside/k8sdockside) plugin for the
[Kubernetes descheduler](https://github.com/kubernetes-sigs/descheduler).

The descheduler has no custom resources and no API of its own. It is a CronJob
or a Deployment, a policy in a ConfigMap, and a trail of Events on the pods it
evicted — which is exactly what this plugin reads.

## Install it

**Settings → Plugins → From a repository**, and paste

```
https://github.com/k8sdockside/descheduler
```

The app clones the repository and reads `plugin.json` and `ui/` as they are.
**Nothing is built on install**, which is why the built `ui/` is committed here
next to the TypeScript it comes from.

## What each page is for

| Page | What it shows |
| --- | --- |
| **Overview** | Whether a descheduler is here at all, how it runs — schedule or interval, dry run, version, the flags it was started with — what it evicted in the last day, and what its policy asks for |
| **Activity** | The log: every eviction it recorded, live, filterable by plugin, namespace, node and result, with refusals beside the successes |
| **Policy** | The settings, as forms. Every plugin with a sentence on what it does, thresholds and limits as fields, and the file it would write shown before anything is applied |
| **Pod panel** | Whether the descheduler could evict *this* pod, worked out from the DefaultEvictor settings in this cluster's policy |
| **Node panel** | What has left this node lately, and which plugin asked |

It also puts **Allow descheduling** and **Clear descheduling mark** on every
Pod's action bar, which set and remove
`descheduler.alpha.kubernetes.io/evict`.

### Where "what it did" comes from

The descheduler records an Event on every pod it evicts, through a recorder
named `sigs.k8s.io.descheduler`:

```
pod eviction from node-3 node by sigs.k8s.io/descheduler
```

The event's **reason is the plugin that asked for the eviction**, which is what
makes this a log worth reading rather than a list of pod names: it says why each
pod moved. A refused eviction is the same sentence as a Warning with the reason
appended — usually a PodDisruptionBudget — and those are the interesting ones,
so Activity shows them beside the successes rather than filtering them out.

Two things are worth knowing before you rely on it:

- **Kubernetes keeps events for about an hour by default.** This is a short
  memory. The counters the descheduler exports to Prometheus are the long one,
  and the overview draws those when a Prometheus is there.
- **Refused evictions are only recorded when you ask for them.** They need
  `evictionFailureEventNotification: true` in the policy, which the Policy page
  has a switch for.

### Where the settings come from

The Policy page edits the ConfigMap the descheduler actually mounts — found the
way the container finds it: `--policy-config-file` names a path, the volume
mounted at that path's folder names the ConfigMap, and the file's name is the
key in it.

It edits the parsed policy and writes that same object back, so **a field this
plugin has never heard of is read, carried through untouched and written
again**. What it cannot keep is the file's comments and its exact layout — YAML
parses to data, not to a document — so the page shows the file it is about to
write, and the app asks before anything is applied.

Before it offers to apply, it checks the draft against what the descheduler
validates at startup: percentages outside 0–100, thresholds the wrong way
round, a namespace list that both includes and excludes, `PodLifeTime` with
nothing to filter on. A policy the descheduler refuses leaves it crash-looping
until somebody edits the ConfigMap by hand, which is a bad thing for a form to
be able to do.

## Things this plugin learned the hard way

**A plugin for something with no CRD cannot be found by `requires`.** That field
asks whether the cluster *serves a kind*, and every cluster serves ConfigMaps.
So the generated overview would have reported "installed" for a cluster that has
never heard of the descheduler. This plugin ships an overview of its own that
answers the real question — is anything here running the image — and finds it by
image and flags rather than by a name, because `fullnameOverride` exists.

**The evict annotation short-circuits everything.** `DefaultEvictor.Filter`
returns true the moment it sees
`descheduler.alpha.kubernetes.io/evict`, before any protection is
checked. A pod panel that drew the protections first and the annotation last
would tell you a pod was protected when it is not.

**The priority threshold is only read while system-critical protection is on.**
Set `evictSystemCriticalPods: true` and `priorityThreshold` quietly stops
applying. The pod panel says so rather than pretending the threshold still
holds.

**`podProtections` replaces the old booleans outright; it does not merge with
them.** The moment a policy names one extra or disabled protection, the
`evictLocalStoragePods`-style switches are not consulted at all.

**Reading a form must not write to it.** Drawing a control for every enabled
plugin through `ensureArgs` added a `pluginConfig` entry for each one, so simply
opening the Policy page made it dirty and offered to apply a diff nobody had
asked for. Fields now read through one function and write through another, and
a test holds the line.

## Looking at it without a cluster

```sh
npm install
npm run build
npm run preview     # http://localhost:8173
```

`scripts/preview.mjs` serves `ui/` and answers the bridge from a fixture — a
descheduler CronJob, a policy, a day of evictions — so every page and every one
of its states can be looked at without installing anything anywhere. It is a
development tool with no dependencies, and the app never sees it.

## Working on it

```sh
npm run watch     # rebuilds ui/ on every change under src/
npm test          # the model, which is where the logic is
npm run check     # typecheck + tests + "is ui/ in step with src/"
```

Point the app at your checkout with **Settings → Plugins → Watch another
folder**. A page you change is picked up when you reopen its tab; the manifest
when you press **Reload**.

Run the app's own checks — the same ones CI runs — with:

```sh
go run github.com/k8sdockside/k8sdockside/cmd/plugincheck@main .
```

**Commit `ui/`.** Installing clones the repository, so a change to `src/` whose
`ui/` was not rebuilt never reaches anyone. `npm run check` fails when the two
disagree, and so does CI.

## Layout

```
plugin.json              the manifest -- views, cards, charts, actions, panels
src/
  model/                 no DOM, all the logic, all the tests
    install.ts           finding the descheduler, and reading its flags
    activity.ts          events -> evictions, buckets, tallies, filters
    policy.ts            the policy in and out, and what would be refused
    plugins.ts           every descheduler plugin and every argument it takes
    protect.ts           would the DefaultEvictor let this pod go
  ui/                    no cluster knowledge, all the DOM
    fields.ts            one control per kind of argument
    bars.ts              the timeline, the bars, the sparklines
    cluster.ts           the bridge calls the pages share
  pages/                 one .html + one .ts per page
  styles/                the app's theme tokens, no colours of its own
scripts/
  preview.mjs            the pages against a cluster that is not there
ui/                      what the build writes, and what the app serves
```

`src/model/plugins.ts` is the file to edit when the descheduler gains an
argument: the Policy page draws itself from it, so a new field is one entry in a
list. Every name and allowed value in it comes from the descheduler's own types
at v0.36.

## What it reads, and what it changes

It reads Pods, Nodes, Events, ConfigMaps, Deployments, CronJobs, Jobs,
ReplicaSets, StatefulSets, DaemonSets and PodDisruptionBudgets.

It can ask to change three things, and each one goes through the app's own
confirmation, outside the page: the policy ConfigMap, the evict annotation on a
Pod, and — to make a new policy take effect — a rollout restart of the
descheduler Deployment, or one Job made from the CronJob.

## Two rules the app enforces

**No network.** `fetch`, XHR and websockets are refused by the page's
Content-Security-Policy. Everything is bundled; the icons are inline SVG for
that reason. The YAML parser is bundled too, which is most of the weight of
three of the five pages — the two that never parse a policy do not carry it.

**A classic script, not a module.** The page runs in a sandboxed frame with an
opaque origin, where `type="module"` is a cross-origin load. The build uses
esbuild's `--format=iife`.

Cluster data goes on the page as **text, never HTML** — there is no `innerHTML`
in `src/` except `svg()`, which only ever receives the icon constants.

## License

Apache-2.0.
