// Built by k8sdockside-plugin from src/ -- edit the TypeScript there, not this file.
"use strict";
(() => {
  // node_modules/@k8sdockside/plugin-sdk/dom.js
  function el(tag, attrs = {}, ...children) {
    const node2 = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) {
      if (value === void 0 || value === false) continue;
      if (name === "class") node2.className = String(value);
      else if (name === "text") node2.textContent = String(value);
      else node2.setAttribute(name, String(value));
    }
    append(node2, children);
    return node2;
  }
  function button(label, onClick, attrs = {}) {
    const node2 = el("button", { type: "button", ...attrs }, label);
    node2.addEventListener("click", onClick);
    return node2;
  }
  function replace(parent, ...children) {
    parent.replaceChildren();
    append(parent, children);
  }
  function byId(id) {
    const node2 = document.getElementById(id);
    if (!node2) throw new Error(`the page has no #${id}`);
    return node2;
  }
  function append(parent, children) {
    for (const child of children) {
      if (child === null || child === void 0 || child === false) continue;
      parent.append(child);
    }
  }

  // src/ui/dom.ts
  function dot(tone) {
    return el("span", { class: `dot dot-${tone || "none"}`, "aria-hidden": "true" });
  }

  // src/ui/page.ts
  function fail(host, err) {
    const message = err instanceof Error ? err.message : String(err);
    replace(
      host,
      el("div", { class: "failure" }, el("strong", {}, "That did not work. "), el("span", {}, message))
    );
  }
  function start(hostId, body) {
    const run = async () => {
      const host = document.getElementById(hostId);
      try {
        const ctx = await k8sdockside.ready();
        await body(ctx);
      } catch (err) {
        if (host) fail(host, err);
      }
    };
    void run();
  }
  function stat(label, value, tone = "") {
    return el(
      "div",
      { class: "stat" },
      el("div", { class: `stat-value tone-${tone || "none"}` }, value),
      el("div", { class: "stat-label" }, label)
    );
  }
  function since(timestamp, now = Date.now()) {
    if (!timestamp) return "—";
    const then = Date.parse(timestamp);
    if (Number.isNaN(then)) return "—";
    const seconds = Math.max(0, Math.round((now - then) / 1e3));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }

  // src/ui/parts.ts
  function verdictBanner(verdict2, ...extra) {
    return el(
      "div",
      { class: `verdict verdict-${verdict2.tone}` },
      el("span", { class: `dot dot-${verdict2.tone}`, "aria-hidden": "true" }),
      el(
        "div",
        {},
        el("p", { class: "verdict-headline" }, verdict2.headline),
        el("p", { class: "verdict-detail" }, verdict2.detail),
        ...extra.filter((node2) => node2 !== null)
      )
    );
  }
  function moment(when, now = Date.now()) {
    const parsed = Date.parse(when);
    const full = Number.isNaN(parsed) ? when : new Date(parsed).toLocaleString();
    return el("span", { title: full }, since(when, now));
  }
  function objectLink(kind, namespace, name, label = name) {
    if (!name) return el("span", { class: "faint" }, "—");
    return button(label, () => void k8sdockside.open({ kind, namespace, name }).catch(() => {
    }), { class: "link" });
  }
  function evictionTable(list, options = {}) {
    const showNamespace = options.showNamespace ?? true;
    const showNode = options.showNode ?? true;
    const showPod = options.showPod ?? true;
    const now = Date.now();
    const head = el(
      "tr",
      {},
      el("th", {}, "When"),
      showPod ? el("th", {}, "Pod") : null,
      showNamespace ? el("th", {}, "Namespace") : null,
      showNode ? el("th", {}, "Node") : null,
      el("th", {}, "Asked for by"),
      el("th", {}, "Result")
    );
    const body = el("tbody", {});
    for (const item of list) {
      body.append(
        el(
          "tr",
          {},
          el("td", { class: "faint" }, moment(item.when, now)),
          showPod ? el("td", {}, objectLink("pods", item.namespace, item.pod)) : null,
          showNamespace ? el("td", { class: "faint" }, item.namespace) : null,
          showNode ? el("td", {}, item.node ? objectLink("nodes", "", item.node) : el("span", { class: "faint" }, "—")) : null,
          el("td", {}, item.strategy ? el("span", { class: "tag" }, item.strategy) : el("span", { class: "faint" }, "—")),
          el(
            "td",
            { class: item.refusal ? "wrap" : "" },
            dot(item.result === "evicted" ? "ok" : "error"),
            " ",
            item.result === "evicted" ? "evicted" : "refused",
            item.refusal ? el("div", { class: "faint" }, item.refusal) : null
          )
        )
      );
    }
    if (!list.length) {
      return el("p", { class: "empty" }, "Nothing in this window. The descheduler records an event for every pod it evicts.");
    }
    return el("table", {}, el("thead", {}, head), body);
  }
  function facts(pairs) {
    const list = el("dl", { class: "facts" });
    for (const [term, value] of pairs) {
      list.append(el("dt", {}, term), el("dd", {}, typeof value === "string" ? value || "—" : value));
    }
    return list;
  }
  function block(title2, note, ...children) {
    return el(
      "section",
      { class: "block" },
      el("h2", {}, title2),
      note ? el("p", { class: "note" }, note) : null,
      ...children.filter((child) => child !== null)
    );
  }

  // src/ui/bars.ts
  var SVG_NS = "http://www.w3.org/2000/svg";
  function node(tag, attrs) {
    const made = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) made.setAttribute(name, String(value));
    return made;
  }
  function clockAt(ms) {
    const date = new Date(ms);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
  function timeline(buckets2, height = 72) {
    const width = Math.max(buckets2.length * 8, 240);
    const top = Math.max(1, ...buckets2.map((bucket) => bucket.evicted + bucket.refused));
    const chart = node("svg", {
      viewBox: `0 0 ${width} ${height}`,
      preserveAspectRatio: "none",
      class: "timeline",
      role: "img",
      "aria-label": `Evictions over time: ${buckets2.reduce((sum, b) => sum + b.evicted, 0)} evicted, ${buckets2.reduce((sum, b) => sum + b.refused, 0)} refused`
    });
    chart.append(node("line", { x1: 0, y1: height - 0.5, x2: width, y2: height - 0.5, stroke: "var(--chart-grid, var(--border))", "stroke-width": 1 }));
    const step = width / Math.max(buckets2.length, 1);
    const bar = Math.max(2, step - 2);
    buckets2.forEach((bucket, index) => {
      const x = index * step + (step - bar) / 2;
      const total = bucket.evicted + bucket.refused;
      if (!total) return;
      const evictedHeight = bucket.evicted / top * (height - 4);
      const refusedHeight = bucket.refused / top * (height - 4);
      if (refusedHeight > 0) {
        const rect = node("rect", {
          x,
          y: height - evictedHeight - refusedHeight,
          width: bar,
          height: Math.max(refusedHeight, 1),
          fill: "var(--error)",
          rx: 1
        });
        rect.append(title(`${clockAt(bucket.start)} — ${bucket.refused} refused`));
        chart.append(rect);
      }
      if (evictedHeight > 0) {
        const rect = node("rect", {
          x,
          y: height - evictedHeight,
          width: bar,
          height: Math.max(evictedHeight, 1),
          fill: "var(--chart-1, var(--accent))",
          rx: 1
        });
        rect.append(title(`${clockAt(bucket.start)} — ${bucket.evicted} evicted`));
        chart.append(rect);
      }
    });
    const first = buckets2[0];
    const last = buckets2[buckets2.length - 1];
    return el(
      "div",
      { class: "timeline-holder" },
      chart,
      el(
        "div",
        { class: "timeline-axis" },
        el("span", {}, first ? clockAt(first.start) : ""),
        el("span", { class: "faint" }, `peak ${top}`),
        el("span", {}, last ? clockAt(last.start) : "")
      )
    );
  }
  function title(text) {
    const made = document.createElementNS(SVG_NS, "title");
    made.textContent = text;
    return made;
  }
  function bars(counts, limit = 8) {
    const shown = counts.slice(0, limit);
    const top = Math.max(1, ...shown.map((count) => count.total));
    const list = el("div", { class: "bars" });
    for (const count of shown) {
      const evicted = count.evicted / top * 100;
      const refused = count.refused / top * 100;
      list.append(
        el(
          "div",
          { class: "bar-row" },
          el("div", { class: "bar-label", title: count.key }, count.key),
          el(
            "div",
            { class: "bar-track" },
            el("div", { class: "bar-fill", style: `width:${evicted.toFixed(1)}%` }),
            refused > 0 ? el("div", { class: "bar-fill bar-refused", style: `width:${refused.toFixed(1)}%` }) : null
          ),
          el("div", { class: "bar-value" }, count.refused ? `${count.evicted} + ${count.refused}` : String(count.evicted))
        )
      );
    }
    if (!shown.length) list.append(el("p", { class: "faint" }, "Nothing yet."));
    return list;
  }
  function sparkline(points, width = 160, height = 26) {
    const line = node("svg", { viewBox: `0 0 ${width} ${height}`, class: "spark", preserveAspectRatio: "none", "aria-hidden": "true" });
    if (points.length < 2) return line;
    const times = points.map((point) => point.t);
    const values = points.map((point) => point.v);
    const firstTime = Math.min(...times);
    const lastTime = Math.max(...times);
    const top = Math.max(...values, 0);
    const span = Math.max(1, lastTime - firstTime);
    const path = points.map((point) => {
      const x = (point.t - firstTime) / span * width;
      const y = height - (top > 0 ? point.v / top * (height - 2) : 0) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    line.append(
      node("polyline", {
        points: path,
        fill: "none",
        stroke: "var(--chart-1, var(--accent))",
        "stroke-width": 1.5,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
        "vector-effect": "non-scaling-stroke"
      })
    );
    return line;
  }
  function formatValue(unit, value) {
    if (!Number.isFinite(value)) return "—";
    switch (unit) {
      case "percent":
        return `${(value * 100).toFixed(0)}%`;
      case "bytes":
      case "bytes/s": {
        const units = ["B", "KiB", "MiB", "GiB", "TiB"];
        let size = value;
        let index = 0;
        while (size >= 1024 && index < units.length - 1) {
          size /= 1024;
          index++;
        }
        return `${size.toFixed(size < 10 && index > 0 ? 1 : 0)} ${units[index]}${unit.endsWith("/s") ? "/s" : ""}`;
      }
      case "seconds":
        return value < 1 ? `${(value * 1e3).toFixed(0)} ms` : `${value.toFixed(value < 10 ? 2 : 0)} s`;
      case "cores":
        return value < 1 ? `${(value * 1e3).toFixed(0)}m` : value.toFixed(2);
      case "ops/s":
        return `${value.toFixed(2)}/s`;
      default:
        return value >= 100 ? value.toFixed(0) : value.toFixed(value < 10 ? 1 : 0);
    }
  }

  // src/model/kube.ts
  function containersOf(spec) {
    return [...spec?.initContainers ?? [], ...spec?.containers ?? []];
  }
  function imageTag(image) {
    if (!image) return "";
    const at = image.indexOf("@");
    if (at >= 0) {
      const tagged = image.slice(0, at);
      const colon2 = tagged.lastIndexOf(":");
      if (colon2 > tagged.lastIndexOf("/")) return tagged.slice(colon2 + 1);
      return image.slice(at + 1, at + 19);
    }
    const colon = image.lastIndexOf(":");
    if (colon > image.lastIndexOf("/")) return image.slice(colon + 1);
    return "";
  }

  // src/model/install.ts
  var IMAGE_MARK = "descheduler";
  function isDescheduler(template, labels = {}) {
    if (labels["app.kubernetes.io/name"] === "descheduler") return true;
    for (const container of containersOf(template?.spec)) {
      if ((container.image ?? "").includes(IMAGE_MARK)) return true;
      const line = [...container.command ?? [], ...container.args ?? []].join(" ");
      if (line.includes("/descheduler") || line.includes("--policy-config-file")) return true;
    }
    return false;
  }
  function flags(tokens) {
    const found = /* @__PURE__ */ new Map();
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i] ?? "";
      if (!token.startsWith("-")) continue;
      const name = token.replace(/^-+/, "");
      const equals = name.indexOf("=");
      if (equals >= 0) {
        found.set(name.slice(0, equals), name.slice(equals + 1));
        continue;
      }
      const next = tokens[i + 1];
      if (next !== void 0 && !next.startsWith("-")) {
        found.set(name, next);
        i++;
      } else {
        found.set(name, "true");
      }
    }
    return found;
  }
  function policySource(spec, namespace, path) {
    if (!path) return null;
    const slash = path.lastIndexOf("/");
    const dir = slash > 0 ? path.slice(0, slash) : "/";
    const file = path.slice(slash + 1);
    for (const container of containersOf(spec)) {
      for (const mount of container.volumeMounts ?? []) {
        const wholeDir = mount.mountPath === dir && !mount.subPath;
        const single = mount.mountPath === path;
        if (!wholeDir && !single) continue;
        const volume = (spec?.volumes ?? []).find((v) => v.name === mount.name);
        const configMap = volume?.configMap;
        if (!configMap?.name) continue;
        const wanted = single ? mount.subPath ?? file : file;
        const item = (configMap.items ?? []).find((i) => i.path === wanted);
        return { namespace, configMap: configMap.name, key: item?.key ?? wanted };
      }
    }
    return null;
  }
  function readTemplate(mode, name, namespace, template, podLabels) {
    const container = containersOf(template?.spec).find((c) => (c.image ?? "").includes(IMAGE_MARK)) ?? containersOf(template?.spec)[0];
    const command = [...container?.command ?? [], ...container?.args ?? []];
    const flag = flags(command);
    const policyPath = flag.get("policy-config-file") ?? "";
    return {
      mode,
      name,
      namespace,
      image: container?.image ?? "",
      version: imageTag(container?.image),
      command,
      dryRun: flag.get("dry-run") === "true",
      interval: flag.get("descheduling-interval") ?? "",
      schedule: "",
      timeZone: "",
      suspended: false,
      leaderElection: flag.get("leader-elect") === "true",
      policy: policySource(template?.spec, namespace, policyPath),
      policyPath,
      desired: 0,
      ready: 0,
      lastSchedule: "",
      lastSuccess: "",
      podLabels
    };
  }
  function findInstalls(deployments, cronJobs) {
    const found = [];
    for (const deployment of deployments) {
      const labels = deployment.metadata.labels ?? {};
      if (!isDescheduler(deployment.spec?.template, labels)) continue;
      const install = readTemplate(
        "deployment",
        deployment.metadata.name,
        deployment.metadata.namespace ?? "",
        deployment.spec?.template,
        deployment.spec?.template?.metadata?.labels ?? labels
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
        "cronjob",
        cronJob.metadata.name,
        cronJob.metadata.namespace ?? "",
        template,
        template?.metadata?.labels ?? labels
      );
      install.schedule = cronJob.spec?.schedule ?? "";
      install.timeZone = cronJob.spec?.timeZone ?? "";
      install.suspended = cronJob.spec?.suspend === true;
      install.lastSchedule = cronJob.status?.lastScheduleTime ?? "";
      install.lastSuccess = cronJob.status?.lastSuccessfulTime ?? "";
      install.desired = (cronJob.status?.active ?? []).length;
      found.push(install);
    }
    return found.sort((a, b) => (a.namespace + a.name).localeCompare(b.namespace + b.name));
  }
  function ownPods(pods2, install) {
    const wanted = Object.entries(install.podLabels).filter(
      ([key]) => key === "app.kubernetes.io/name" || key === "app.kubernetes.io/instance" || key === "app"
    );
    return pods2.filter((pod) => {
      const labels = pod.metadata.labels ?? {};
      if (pod.metadata.namespace !== install.namespace) return false;
      if (wanted.length) return wanted.every(([key, value]) => labels[key] === value);
      return pod.metadata.name.startsWith(install.name);
    });
  }
  function ownJobs(jobs, install) {
    return jobs.filter((job) => job.metadata.namespace === install.namespace).filter((job) => (job.metadata.ownerReferences ?? []).some((o) => o.name === install.name)).sort((a, b) => (b.metadata.creationTimestamp ?? "").localeCompare(a.metadata.creationTimestamp ?? ""));
  }
  function jobState(job) {
    const conditions = job.status?.conditions ?? [];
    if (conditions.some((c) => c.type === "Failed" && c.status === "True")) {
      return { tone: "error", text: conditions.find((c) => c.type === "Failed")?.reason || "failed" };
    }
    if (conditions.some((c) => c.type === "Complete" && c.status === "True")) return { tone: "ok", text: "complete" };
    if ((job.status?.active ?? 0) > 0) return { tone: "warn", text: "running" };
    return { tone: "none", text: "pending" };
  }
  function policyConfigMaps(configMaps, install) {
    const named = install?.policy;
    const mine = configMaps.filter(
      (cm) => named && cm.metadata.name === named.configMap && cm.metadata.namespace === named.namespace
    );
    if (mine.length) return mine;
    return configMaps.filter(
      (cm) => Object.entries(cm.data ?? {}).some(([key, value]) => key.endsWith(".yaml") && value.includes("DeschedulerPolicy"))
    );
  }
  function cronInWords(schedule) {
    const parts = schedule.trim().split(/\s+/);
    if (parts.length !== 5) return "";
    const [minute, hour, day, month, weekday] = parts;
    const everything = day === "*" && month === "*" && weekday === "*";
    if (!everything) return "";
    const everyMinutes = /^\*\/(\d+)$/.exec(minute);
    if (everyMinutes && hour === "*") {
      const n = Number(everyMinutes[1]);
      return n === 1 ? "every minute" : `every ${n} minutes`;
    }
    const everyHours = /^\*\/(\d+)$/.exec(hour);
    if (everyHours && /^\d+$/.test(minute)) {
      const n = Number(everyHours[1]);
      return n === 1 ? "every hour" : `every ${n} hours`;
    }
    if (minute === "*" && hour === "*") return "every minute";
    if (/^\d+$/.test(minute) && hour === "*") return "every hour";
    if (/^\d+$/.test(minute) && /^\d+$/.test(hour)) {
      return `daily at ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }
    return "";
  }
  function cadence(install) {
    if (install.mode === "cronjob") {
      const words = cronInWords(install.schedule);
      const zone = install.timeZone ? ` (${install.timeZone})` : "";
      return words ? `${words}${zone}` : `on ${install.schedule}${zone}`;
    }
    return install.interval ? `every ${install.interval}` : "continuously";
  }
  function verdict(installs, pods2, recentFailures) {
    if (!installs.length) {
      return {
        tone: "none",
        headline: "No descheduler in this cluster",
        detail: "Nothing here runs the descheduler image. Install it as a CronJob or a Deployment — the Helm chart does either — and this plugin fills in."
      };
    }
    const install = installs[0];
    if (install.suspended) {
      return {
        tone: "warn",
        headline: "Suspended",
        detail: `${install.namespace}/${install.name} is a suspended CronJob: it will not run until suspend is cleared.`
      };
    }
    if (install.dryRun) {
      return {
        tone: "warn",
        headline: "Running in dry run",
        detail: `${install.namespace}/${install.name} is started with --dry-run, so it reports what it would evict and evicts nothing.`
      };
    }
    if (install.mode === "deployment" && install.ready < 1) {
      return {
        tone: "error",
        headline: "Not running",
        detail: `${install.namespace}/${install.name} wants ${install.desired} replica(s) and has ${install.ready} ready.`
      };
    }
    const unhappy = pods2.filter((pod) => {
      const phase = pod.status?.phase ?? "";
      return phase === "Failed" || (pod.status?.containerStatuses ?? []).some((c) => (c.restartCount ?? 0) > 3);
    });
    if (unhappy.length) {
      return {
        tone: "warn",
        headline: "Running, but its own pods are unhappy",
        detail: `${unhappy.length} of the descheduler's pods have failed or are restarting. Its logs are the place to look.`
      };
    }
    if (recentFailures > 0) {
      return {
        tone: "warn",
        headline: `Running — ${recentFailures} eviction${recentFailures === 1 ? "" : "s"} refused`,
        detail: "Evictions it asked for were turned down, usually by a PodDisruptionBudget or an eviction limit. Activity has each one."
      };
    }
    return {
      tone: "ok",
      headline: "Running",
      detail: `${install.namespace}/${install.name} runs ${cadence(install)} and evicts what its policy asks for.`
    };
  }

  // src/ui/cluster.ts
  async function findDescheduler() {
    const [deployments, cronJobs] = await Promise.all([
      k8sdockside.list({ kind: "deployments", namespace: "" }),
      k8sdockside.list({ kind: "cronjobs", namespace: "" })
    ]);
    const installs = findInstalls(deployments, cronJobs);
    return { installs, install: installs[0] ?? null, deployments, cronJobs };
  }
  function pods(namespace = "") {
    return k8sdockside.list({ kind: "pods", namespace });
  }
  async function listOrNone(query) {
    try {
      return await k8sdockside.list(query);
    } catch {
      return [];
    }
  }

  // node_modules/js-yaml/dist/js-yaml.mjs
  var NOT_RESOLVED = /* @__PURE__ */ Symbol("NOT_RESOLVED");
  function defineScalarTag(tagName, options) {
    return {
      tagName,
      nodeKind: "scalar",
      implicit: options.implicit ?? false,
      matchByTagPrefix: options.matchByTagPrefix ?? false,
      implicitFirstChars: options.implicitFirstChars ?? null,
      resolve: options.resolve,
      identify: options.identify,
      represent: options.represent ?? ((data) => String(data)),
      representTagName: options.representTagName ?? (() => tagName)
    };
  }
  function defineSequenceTag(tagName, options) {
    const carrierIsResult = options.finalize === void 0;
    return {
      tagName,
      nodeKind: "sequence",
      implicit: false,
      matchByTagPrefix: options.matchByTagPrefix ?? false,
      create: options.create,
      addItem: options.addItem,
      finalize: options.finalize ?? ((carrier) => carrier),
      carrierIsResult,
      identify: options.identify,
      represent: options.represent ?? ((data) => data),
      representTagName: options.representTagName ?? (() => tagName)
    };
  }
  function defineMappingTag(tagName, options) {
    const carrierIsResult = options.finalize === void 0;
    return {
      tagName,
      nodeKind: "mapping",
      implicit: false,
      matchByTagPrefix: options.matchByTagPrefix ?? false,
      create: options.create,
      addPair: options.addPair,
      has: options.has,
      keys: options.keys,
      get: options.get,
      finalize: options.finalize ?? ((carrier) => carrier),
      carrierIsResult,
      identify: options.identify,
      represent: options.represent ?? ((data) => data),
      representTagName: options.representTagName ?? (() => tagName)
    };
  }
  var strTag = defineScalarTag("tag:yaml.org,2002:str", {
    resolve: (source) => source,
    identify: (data) => typeof data === "string"
  });
  var NULL_VALUES$1 = [
    "",
    "~",
    "null",
    "Null",
    "NULL"
  ];
  var nullCoreTag = defineScalarTag("tag:yaml.org,2002:null", {
    implicit: true,
    implicitFirstChars: [
      "",
      "~",
      "n",
      "N"
    ],
    resolve: (source) => {
      if (NULL_VALUES$1.indexOf(source) !== -1) return null;
      return NOT_RESOLVED;
    },
    identify: (object) => object === null,
    represent: () => "null"
  });
  var nullJsonTag = defineScalarTag("tag:yaml.org,2002:null", {
    implicit: true,
    implicitFirstChars: ["n"],
    resolve: (source, isExplicit) => {
      if (source === "null" || isExplicit && source === "") return null;
      return NOT_RESOLVED;
    },
    identify: (object) => object === null,
    represent: () => "null"
  });
  var NULL_VALUES = [
    "",
    "~",
    "null",
    "Null",
    "NULL"
  ];
  var nullYaml11Tag = defineScalarTag("tag:yaml.org,2002:null", {
    implicit: true,
    implicitFirstChars: [
      "",
      "~",
      "n",
      "N"
    ],
    resolve: (source) => {
      if (NULL_VALUES.indexOf(source) !== -1) return null;
      return NOT_RESOLVED;
    },
    identify: (object) => object === null,
    represent: () => "null"
  });
  var TRUE_VALUES$2 = [
    "true",
    "True",
    "TRUE"
  ];
  var FALSE_VALUES$2 = [
    "false",
    "False",
    "FALSE"
  ];
  var boolCoreTag = defineScalarTag("tag:yaml.org,2002:bool", {
    implicit: true,
    implicitFirstChars: [
      "t",
      "T",
      "f",
      "F"
    ],
    resolve: (source) => {
      if (TRUE_VALUES$2.indexOf(source) !== -1) return true;
      if (FALSE_VALUES$2.indexOf(source) !== -1) return false;
      return NOT_RESOLVED;
    },
    identify: (object) => Object.prototype.toString.call(object) === "[object Boolean]",
    represent: (object) => object ? "true" : "false"
  });
  var TRUE_VALUES$1 = ["true"];
  var FALSE_VALUES$1 = ["false"];
  var boolJsonTag = defineScalarTag("tag:yaml.org,2002:bool", {
    implicit: true,
    implicitFirstChars: ["t", "f"],
    resolve: (source) => {
      if (TRUE_VALUES$1.indexOf(source) !== -1) return true;
      if (FALSE_VALUES$1.indexOf(source) !== -1) return false;
      return NOT_RESOLVED;
    },
    identify: (object) => Object.prototype.toString.call(object) === "[object Boolean]",
    represent: (object) => object ? "true" : "false"
  });
  var TRUE_VALUES = [
    "true",
    "True",
    "TRUE",
    "y",
    "Y",
    "yes",
    "Yes",
    "YES",
    "on",
    "On",
    "ON"
  ];
  var FALSE_VALUES = [
    "false",
    "False",
    "FALSE",
    "n",
    "N",
    "no",
    "No",
    "NO",
    "off",
    "Off",
    "OFF"
  ];
  var boolYaml11Tag = defineScalarTag("tag:yaml.org,2002:bool", {
    implicit: true,
    implicitFirstChars: [
      "y",
      "Y",
      "n",
      "N",
      "t",
      "T",
      "f",
      "F",
      "o",
      "O"
    ],
    resolve: (source) => {
      if (TRUE_VALUES.indexOf(source) !== -1) return true;
      if (FALSE_VALUES.indexOf(source) !== -1) return false;
      return NOT_RESOLVED;
    },
    identify: (object) => Object.prototype.toString.call(object) === "[object Boolean]",
    represent: (object) => object ? "true" : "false"
  });
  var YAML_INTEGER_IMPLICIT_PATTERN$1 = /* @__PURE__ */ new RegExp("^(?:0o[0-7]+|0x[0-9a-fA-F]+|[-+]?[0-9]+)$");
  var YAML_INTEGER_EXPLICIT_PATTERN$1 = /* @__PURE__ */ new RegExp("^(?:[-+]?0b[0-1]+|[-+]?0o[0-7]+|[-+]?0x[0-9a-fA-F]+|[-+]?[0-9]+)$");
  function parseYamlInteger$2(source) {
    let value = source;
    let sign = 1;
    if (value[0] === "-" || value[0] === "+") {
      if (value[0] === "-") sign = -1;
      value = value.slice(1);
    }
    if (value.startsWith("0b")) return sign * parseInt(value.slice(2), 2);
    if (value.startsWith("0o")) return sign * parseInt(value.slice(2), 8);
    if (value.startsWith("0x")) return sign * parseInt(value.slice(2), 16);
    return sign * parseInt(value, 10);
  }
  function resolveYamlInteger$2(source, isExplicit) {
    if (isExplicit) {
      if (!YAML_INTEGER_EXPLICIT_PATTERN$1.test(source)) return NOT_RESOLVED;
    } else if (!YAML_INTEGER_IMPLICIT_PATTERN$1.test(source)) return NOT_RESOLVED;
    const result = parseYamlInteger$2(source);
    return Number.isFinite(result) ? result : NOT_RESOLVED;
  }
  var intCoreTag = defineScalarTag("tag:yaml.org,2002:int", {
    implicit: true,
    implicitFirstChars: [
      "-",
      "+",
      ..."0123456789"
    ],
    resolve: resolveYamlInteger$2,
    identify: (object) => Number.isInteger(object) && !Object.is(object, -0) && object.toString(10).indexOf("e") < 0,
    represent: (object) => object.toString(10)
  });
  var YAML_INTEGER_IMPLICIT_PATTERN = /* @__PURE__ */ new RegExp("^-?(?:0|[1-9][0-9]*)$");
  var YAML_INTEGER_EXPLICIT_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?0b[0-1]+|[-+]?0o[0-7]+|[-+]?0x[0-9a-fA-F]+|[-+]?[0-9]+)$");
  function parseYamlInteger$1(source) {
    let value = source;
    let sign = 1;
    if (value[0] === "-" || value[0] === "+") {
      if (value[0] === "-") sign = -1;
      value = value.slice(1);
    }
    if (value.startsWith("0b")) return sign * parseInt(value.slice(2), 2);
    if (value.startsWith("0o")) return sign * parseInt(value.slice(2), 8);
    if (value.startsWith("0x")) return sign * parseInt(value.slice(2), 16);
    return sign * parseInt(value, 10);
  }
  function resolveYamlInteger$1(source, isExplicit) {
    if (isExplicit) {
      if (!YAML_INTEGER_EXPLICIT_PATTERN.test(source)) return NOT_RESOLVED;
    } else if (!YAML_INTEGER_IMPLICIT_PATTERN.test(source)) return NOT_RESOLVED;
    const result = parseYamlInteger$1(source);
    return Number.isFinite(result) ? result : NOT_RESOLVED;
  }
  var intJsonTag = defineScalarTag("tag:yaml.org,2002:int", {
    implicit: true,
    implicitFirstChars: ["-", ..."0123456789"],
    resolve: resolveYamlInteger$1,
    identify: (object) => Number.isInteger(object) && !Object.is(object, -0) && object.toString(10).indexOf("e") < 0,
    represent: (object) => object.toString(10)
  });
  var YAML_INTEGER_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?0b[0-1_]+|[-+]?0[0-7_]+|[-+]?0x[0-9a-fA-F_]+|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+|[-+]?(?:0|[1-9][0-9_]*))$");
  function parseYamlInteger(source) {
    let value = source.replace(/_/g, "");
    let sign = 1;
    if (value[0] === "-" || value[0] === "+") {
      if (value[0] === "-") sign = -1;
      value = value.slice(1);
    }
    if (value.startsWith("0b")) return sign * parseInt(value.slice(2), 2);
    if (value.startsWith("0x")) return sign * parseInt(value.slice(2), 16);
    if (value.includes(":")) {
      let result = 0;
      for (const part of value.split(":")) result = result * 60 + Number(part);
      return sign * result;
    }
    if (value !== "0" && value[0] === "0") return sign * parseInt(value, 8);
    return sign * parseInt(value, 10);
  }
  function resolveYamlInteger(source) {
    if (!YAML_INTEGER_PATTERN.test(source)) return NOT_RESOLVED;
    const result = parseYamlInteger(source);
    return Number.isFinite(result) ? result : NOT_RESOLVED;
  }
  var intYaml11Tag = defineScalarTag("tag:yaml.org,2002:int", {
    implicit: true,
    implicitFirstChars: [
      "-",
      "+",
      ..."0123456789"
    ],
    resolve: resolveYamlInteger,
    identify: (object) => Number.isInteger(object) && !Object.is(object, -0) && object.toString(10).indexOf("e") < 0,
    represent: (object) => object.toString(10)
  });
  var YAML_FLOAT_PATTERN$1 = /* @__PURE__ */ new RegExp("^(?:[-+]?[0-9]+(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|[-+]?\\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
  var YAML_FLOAT_SPECIAL_PATTERN$1 = /* @__PURE__ */ new RegExp("^(?:[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
  function resolveYamlFloat$2(source) {
    if (!YAML_FLOAT_PATTERN$1.test(source)) return NOT_RESOLVED;
    let value = source.toLowerCase();
    const sign = value[0] === "-" ? -1 : 1;
    if ("+-".includes(value[0])) value = value.slice(1);
    if (value === ".inf") return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    if (value === ".nan") return NaN;
    const result = sign * parseFloat(value);
    if (Number.isFinite(result) || YAML_FLOAT_SPECIAL_PATTERN$1.test(source)) return result;
    return NOT_RESOLVED;
  }
  function representYamlFloat$2(object) {
    if (isNaN(object)) return ".nan";
    if (object === Number.POSITIVE_INFINITY) return ".inf";
    if (object === Number.NEGATIVE_INFINITY) return "-.inf";
    if (Object.is(object, -0)) return "-0.0";
    const result = object.toString(10);
    return /^[-+]?[0-9]+e/.test(result) ? result.replace("e", ".e") : result;
  }
  var floatCoreTag = defineScalarTag("tag:yaml.org,2002:float", {
    implicit: true,
    implicitFirstChars: [
      "-",
      "+",
      ".",
      ..."0123456789"
    ],
    resolve: resolveYamlFloat$2,
    identify: (object) => typeof object === "number" && (!Number.isInteger(object) || Object.is(object, -0) || object.toString(10).indexOf("e") >= 0),
    represent: representYamlFloat$2
  });
  var YAML_FLOAT_IMPLICIT_PATTERN = /* @__PURE__ */ new RegExp("^-?(?:0|[1-9][0-9]*)(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$");
  var YAML_FLOAT_EXPLICIT_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?[0-9]+(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|[-+]?\\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
  function resolveYamlFloat$1(source, isExplicit) {
    if (isExplicit) {
      if (!YAML_FLOAT_EXPLICIT_PATTERN.test(source)) return NOT_RESOLVED;
      let value = source.toLowerCase();
      const sign = value[0] === "-" ? -1 : 1;
      if ("+-".includes(value[0])) value = value.slice(1);
      if (value === ".inf") return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      if (value === ".nan") return NaN;
      const result2 = sign * parseFloat(value);
      return Number.isFinite(result2) ? result2 : NOT_RESOLVED;
    }
    if (!YAML_FLOAT_IMPLICIT_PATTERN.test(source)) return NOT_RESOLVED;
    const result = Number(source);
    if (Number.isFinite(result)) return result;
    return NOT_RESOLVED;
  }
  function representYamlFloat$1(object) {
    if (isNaN(object)) return ".nan";
    if (object === Number.POSITIVE_INFINITY) return ".inf";
    if (object === Number.NEGATIVE_INFINITY) return "-.inf";
    if (Object.is(object, -0)) return "-0.0";
    const result = object.toString(10);
    return /^[-+]?[0-9]+e/.test(result) ? result.replace("e", ".e") : result;
  }
  var floatJsonTag = defineScalarTag("tag:yaml.org,2002:float", {
    implicit: true,
    implicitFirstChars: ["-", ..."0123456789"],
    resolve: resolveYamlFloat$1,
    identify: (object) => typeof object === "number" && (!Number.isInteger(object) || Object.is(object, -0) || object.toString(10).indexOf("e") >= 0),
    represent: representYamlFloat$1
  });
  var YAML_FLOAT_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?(?:(?:[0-9][0-9_]*)?\\.[0-9_]*)(?:[eE][-+][0-9]+)?|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\\.[0-9_]*|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
  var YAML_FLOAT_SPECIAL_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
  function resolveYamlFloat(source) {
    if (!YAML_FLOAT_PATTERN.test(source)) return NOT_RESOLVED;
    let value = source.toLowerCase().replace(/_/g, "");
    const sign = value[0] === "-" ? -1 : 1;
    if ("+-".includes(value[0])) value = value.slice(1);
    if (value === ".inf") return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    if (value === ".nan") return NaN;
    let result = 0;
    if (value.includes(":")) {
      for (const part of value.split(":")) result = result * 60 + Number(part);
      result *= sign;
    } else result = sign * parseFloat(value);
    if (Number.isFinite(result) || YAML_FLOAT_SPECIAL_PATTERN.test(source)) return result;
    return NOT_RESOLVED;
  }
  function representYamlFloat(object) {
    if (isNaN(object)) return ".nan";
    if (object === Number.POSITIVE_INFINITY) return ".inf";
    if (object === Number.NEGATIVE_INFINITY) return "-.inf";
    if (Object.is(object, -0)) return "-0.0";
    const result = object.toString(10);
    return /^[-+]?[0-9]+e/.test(result) ? result.replace("e", ".e") : result;
  }
  var floatYaml11Tag = defineScalarTag("tag:yaml.org,2002:float", {
    implicit: true,
    implicitFirstChars: [
      "-",
      "+",
      ".",
      ..."0123456789"
    ],
    resolve: resolveYamlFloat,
    identify: (object) => typeof object === "number" && (!Number.isInteger(object) || Object.is(object, -0) || object.toString(10).indexOf("e") >= 0),
    represent: representYamlFloat
  });
  var mergeTag = defineScalarTag("tag:yaml.org,2002:merge", {
    implicit: true,
    implicitFirstChars: ["<"],
    resolve: (source, isExplicit) => {
      if (source === "<<" || isExplicit && source === "") return "<<";
      return NOT_RESOLVED;
    },
    identify: () => false
  });
  var BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
  function resolveYamlBinary(source) {
    const input = source.replace(/\s/g, "");
    if (input.length % 4 !== 0 || !BASE64_PATTERN.test(input)) return NOT_RESOLVED;
    const binary = atob(input);
    const result = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) result[index] = binary.charCodeAt(index);
    return result;
  }
  function representYamlBinary(object) {
    let binary = "";
    for (let index = 0; index < object.length; index++) binary += String.fromCharCode(object[index]);
    return btoa(binary);
  }
  var binaryTag = defineScalarTag("tag:yaml.org,2002:binary", {
    resolve: resolveYamlBinary,
    identify: (object) => Object.prototype.toString.call(object) === "[object Uint8Array]",
    represent: representYamlBinary
  });
  var YAML_DATE_REGEXP = /* @__PURE__ */ new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$");
  var YAML_TIMESTAMP_REGEXP = /* @__PURE__ */ new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$");
  function makeUtcDate(year, month, day, hour = 0, minute = 0, second = 0, fraction = 0) {
    const date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
    date.setUTCFullYear(year, month, day);
    return date;
  }
  function resolveYamlTimestamp(source) {
    let match = YAML_DATE_REGEXP.exec(source);
    if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(source);
    if (match === null) return NOT_RESOLVED;
    const year = +match[1];
    const month = +match[2] - 1;
    const day = +match[3];
    if (!match[4]) {
      const date2 = makeUtcDate(year, month, day);
      if (date2.getUTCFullYear() !== year || date2.getUTCMonth() !== month || date2.getUTCDate() !== day) return NOT_RESOLVED;
      return date2;
    }
    const hour = +match[4];
    const minute = +match[5];
    const second = +match[6];
    let fraction = 0;
    if (hour > 23 || minute > 59 || second > 59) return NOT_RESOLVED;
    if (match[7]) {
      let value = match[7].slice(0, 3);
      while (value.length < 3) value += "0";
      fraction = +value;
    }
    const date = makeUtcDate(year, month, day, hour, minute, second, fraction);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return NOT_RESOLVED;
    if (match[9]) {
      const offsetHour = +match[10];
      const offsetMinute = +(match[11] || 0);
      if (offsetHour > 23 || offsetMinute > 59) return NOT_RESOLVED;
      const offset = (offsetHour * 60 + offsetMinute) * 6e4;
      date.setTime(date.getTime() - (match[9] === "-" ? -offset : offset));
    }
    return date;
  }
  var timestampTag = defineScalarTag("tag:yaml.org,2002:timestamp", {
    implicit: true,
    implicitFirstChars: [..."0123456789"],
    resolve: resolveYamlTimestamp,
    identify: (object) => object instanceof Date,
    represent: (object) => object.toISOString()
  });
  var seqTag = defineSequenceTag("tag:yaml.org,2002:seq", {
    create: () => [],
    addItem: (container, item) => {
      container.push(item);
    },
    identify: Array.isArray
  });
  function isPlainObject(data) {
    if (data === null || typeof data !== "object" || Array.isArray(data)) return false;
    const prototype = Object.getPrototypeOf(data);
    return prototype === null || prototype === Object.prototype;
  }
  function pick(object, keys) {
    const result = {};
    for (const key of keys) if (object[key] !== void 0) result[key] = object[key];
    return result;
  }
  var omapTag = defineSequenceTag("tag:yaml.org,2002:omap", {
    create: () => ({
      list: [],
      seen: /* @__PURE__ */ new Set()
    }),
    addItem: (carrier, item) => {
      let key;
      if (item instanceof Map) {
        if (item.size !== 1) return "cannot resolve an ordered map item";
        key = item.keys().next().value;
      } else if (isPlainObject(item)) {
        const itemKeys = Object.keys(item);
        if (itemKeys.length !== 1) return "cannot resolve an ordered map item";
        key = itemKeys[0];
      } else return "cannot resolve an ordered map item";
      if (carrier.seen.has(key)) return "duplicate key in ordered map";
      carrier.seen.add(key);
      carrier.list.push(item);
      return "";
    },
    finalize: (carrier) => carrier.list,
    identify: () => false
  });
  var pairsTag = defineSequenceTag("tag:yaml.org,2002:pairs", {
    create: () => [],
    addItem: (container, item) => {
      if (item instanceof Map) {
        if (item.size !== 1) return "cannot resolve a pairs item";
        container.push(item.entries().next().value);
        return "";
      }
      if (Object.prototype.toString.call(item) !== "[object Object]") return "cannot resolve a pairs item";
      const object = item;
      const keys = Object.keys(object);
      if (keys.length !== 1) return "cannot resolve a pairs item";
      container.push([keys[0], object[keys[0]]]);
      return "";
    },
    identify: () => false
  });
  var mapTag = defineMappingTag("tag:yaml.org,2002:map", {
    create: () => ({}),
    identify: isPlainObject,
    represent: (o) => {
      const map = /* @__PURE__ */ new Map();
      for (const key of Object.keys(o)) map.set(key, o[key]);
      return map;
    },
    addPair: (container, key, value) => {
      if (key !== null && typeof key === "object") return "object-based map does not support complex keys";
      const normalizedKey = String(key);
      if (normalizedKey === "__proto__") Object.defineProperty(container, normalizedKey, {
        value,
        enumerable: true,
        configurable: true,
        writable: true
      });
      else container[normalizedKey] = value;
      return "";
    },
    has: (container, key) => {
      if (key !== null && typeof key === "object") return false;
      return Object.prototype.hasOwnProperty.call(container, String(key));
    },
    keys: (container) => Object.keys(container),
    get: (container, key) => {
      const normalizedKey = String(key);
      if (!Object.prototype.hasOwnProperty.call(container, normalizedKey)) return null;
      return container[normalizedKey];
    }
  });
  var setTag = defineMappingTag("tag:yaml.org,2002:set", {
    create: () => /* @__PURE__ */ new Set(),
    identify: (data) => data instanceof Set,
    represent: (data) => {
      const map = /* @__PURE__ */ new Map();
      for (const key of data) map.set(key, null);
      return map;
    },
    addPair: (container, key, value) => {
      if (value !== null) return "cannot resolve a set item";
      container.add(key);
      return "";
    },
    has: (container, key) => container.has(key),
    keys: (container) => container.keys(),
    get: () => null
  });
  function createTagDefinitionMap() {
    return {
      scalar: /* @__PURE__ */ Object.create(null),
      sequence: /* @__PURE__ */ Object.create(null),
      mapping: /* @__PURE__ */ Object.create(null)
    };
  }
  function createTagDefinitionListMap() {
    return {
      scalar: [],
      sequence: [],
      mapping: []
    };
  }
  function compileTags(tags) {
    const result = [];
    for (const tag of tags) {
      let index = result.length;
      for (let previousIndex = 0; previousIndex < result.length; previousIndex++) {
        const previous = result[previousIndex];
        if (previous.nodeKind === tag.nodeKind && previous.tagName === tag.tagName && previous.matchByTagPrefix === tag.matchByTagPrefix) {
          index = previousIndex;
          break;
        }
      }
      result[index] = tag;
    }
    return result;
  }
  var Schema = class Schema2 {
    tags;
    /** @internal */
    implicitScalarTags;
    /**
    * Dispatch implicit scalar resolvers by `source.charAt(0)`. Each bucket holds
    * the resolvers that may match that key, in schema order; a key absent from
    * the map uses
    * {@link Schema.implicitScalarAnyFirstChar}
    * (resolvers that declared no first-char constraint, so they apply to any
    * first character).
    */
    implicitScalarByFirstChar;
    implicitScalarAnyFirstChar;
    /**
    * The default scalar tag (`!!str`), resolved once so the composer's fallback
    * for unresolved plain scalars avoids a keyed lookup per scalar.
    *
    * @internal
    */
    defaultScalarTag;
    /**
    * The default container tags (`!!seq` / `!!map`), used by the dumper: when a
    * value is identified by its default tag, the tag is implicit and not
    * printed. Undefined if the schema does not define them (then such values
    * can't be dumped).
    *
    * @internal
    */
    defaultSequenceTag;
    /** @internal */
    defaultMappingTag;
    exact;
    prefix;
    constructor(tags) {
      const compiledTags = compileTags(tags);
      const implicitScalarTags = [];
      const exact = createTagDefinitionMap();
      const prefix = createTagDefinitionListMap();
      for (const tag of compiledTags) {
        if (tag.nodeKind === "scalar" && tag.implicit) {
          if (tag.matchByTagPrefix) throw new Error("Implicit scalar tags cannot match by tag prefix");
          implicitScalarTags.push(tag);
        }
        switch (tag.nodeKind) {
          case "scalar":
            if (tag.matchByTagPrefix) prefix.scalar.push(tag);
            else exact.scalar[tag.tagName] = tag;
            break;
          case "sequence":
            if (tag.matchByTagPrefix) prefix.sequence.push(tag);
            else exact.sequence[tag.tagName] = tag;
            break;
          case "mapping":
            if (tag.matchByTagPrefix) prefix.mapping.push(tag);
            else exact.mapping[tag.tagName] = tag;
            break;
        }
      }
      const implicitScalarAnyFirstChar = implicitScalarTags.filter((tag) => tag.implicitFirstChars === null);
      const keys = /* @__PURE__ */ new Set();
      for (const tag of implicitScalarTags) if (tag.implicitFirstChars !== null) for (const key of tag.implicitFirstChars) keys.add(key);
      const implicitScalarByFirstChar = /* @__PURE__ */ new Map();
      for (const key of keys) implicitScalarByFirstChar.set(key, implicitScalarTags.filter((tag) => tag.implicitFirstChars === null || tag.implicitFirstChars.indexOf(key) !== -1));
      const defaultScalarTag = exact.scalar["tag:yaml.org,2002:str"];
      if (!defaultScalarTag) throw new Error("schema does not define the default scalar tag (tag:yaml.org,2002:str)");
      this.tags = compiledTags;
      this.implicitScalarTags = implicitScalarTags;
      this.implicitScalarByFirstChar = implicitScalarByFirstChar;
      this.implicitScalarAnyFirstChar = implicitScalarAnyFirstChar;
      this.defaultScalarTag = defaultScalarTag;
      this.defaultSequenceTag = exact.sequence["tag:yaml.org,2002:seq"];
      this.defaultMappingTag = exact.mapping["tag:yaml.org,2002:map"];
      this.exact = exact;
      this.prefix = prefix;
    }
    /** @internal */
    lookupScalarTag(tagName) {
      const exactTag = this.exact.scalar[tagName];
      if (exactTag) return exactTag;
      for (const tag of this.prefix.scalar) if (tagName.startsWith(tag.tagName)) return tag;
    }
    /** @internal */
    lookupSequenceTag(tagName) {
      const exactTag = this.exact.sequence[tagName];
      if (exactTag) return exactTag;
      for (const tag of this.prefix.sequence) if (tagName.startsWith(tag.tagName)) return tag;
    }
    /** @internal */
    lookupMappingTag(tagName) {
      const exactTag = this.exact.mapping[tagName];
      if (exactTag) return exactTag;
      for (const tag of this.prefix.mapping) if (tagName.startsWith(tag.tagName)) return tag;
    }
    /** @internal */
    resolveImplicitScalarTag(source) {
      const candidates = this.implicitScalarByFirstChar.get(source.charAt(0)) ?? this.implicitScalarAnyFirstChar;
      for (const tag2 of candidates) {
        const value = tag2.resolve(source, false, tag2.tagName);
        if (value !== NOT_RESOLVED) return {
          value,
          tag: tag2
        };
      }
      const tag = this.defaultScalarTag;
      return {
        value: tag.resolve(source, false, tag.tagName),
        tag
      };
    }
    /**
    * Creates a new schema with the specified tags added. If a tag already
    * exists, it is replaced by the specified tag.
    *
    * @example
    *
    * ```javascript
    * import { CORE_SCHEMA, mergeTag, realMapTag } from 'js-yaml'
    *
    * const schema = CORE_SCHEMA.withTags(mergeTag, realMapTag)
    * ```
    */
    withTags(...tags) {
      let flatTags = [];
      for (const tag of tags) flatTags = flatTags.concat(tag);
      return new Schema2([...this.tags, ...flatTags]);
    }
  };
  var FAILSAFE_SCHEMA = new Schema([
    strTag,
    seqTag,
    mapTag
  ]);
  var JSON_SCHEMA = new Schema([
    ...FAILSAFE_SCHEMA.tags,
    nullJsonTag,
    boolJsonTag,
    intJsonTag,
    floatJsonTag
  ]);
  var CORE_SCHEMA = new Schema([
    ...FAILSAFE_SCHEMA.tags,
    nullCoreTag,
    boolCoreTag,
    intCoreTag,
    floatCoreTag
  ]);
  var YAML11_SCHEMA = new Schema([
    ...FAILSAFE_SCHEMA.tags,
    nullYaml11Tag,
    boolYaml11Tag,
    intYaml11Tag,
    floatYaml11Tag,
    timestampTag,
    mergeTag,
    binaryTag,
    omapTag,
    pairsTag,
    setTag
  ]);
  var DUMP_SCHEMA = YAML11_SCHEMA.withTags({
    ...intYaml11Tag,
    resolve: (source, isExplicit, tagName) => {
      const result = intYaml11Tag.resolve(source, isExplicit, tagName);
      return result === NOT_RESOLVED ? intCoreTag.resolve(source, isExplicit, tagName) : result;
    }
  }, {
    ...floatYaml11Tag,
    resolve: (source, isExplicit, tagName) => {
      const result = floatYaml11Tag.resolve(source, isExplicit, tagName);
      return result === NOT_RESOLVED ? floatCoreTag.resolve(source, isExplicit, tagName) : result;
    }
  });
  var realMapTag = defineMappingTag("tag:yaml.org,2002:map", {
    create: () => /* @__PURE__ */ new Map(),
    addPair: (container, key, value) => {
      container.set(key, value);
      return "";
    },
    has: (container, key) => container.has(key),
    keys: (container) => container.keys(),
    get: (container, key) => container.get(key),
    identify: (data) => data instanceof Map || isPlainObject(data),
    represent: (data) => {
      if (data instanceof Map) return data;
      const map = /* @__PURE__ */ new Map();
      const obj = data;
      for (const key of Object.keys(obj)) map.set(key, obj[key]);
      return map;
    }
  });
  function normalizeKey(key) {
    if (Array.isArray(key)) {
      const array = Array.prototype.slice.call(key);
      for (let index = 0; index < array.length; index++) {
        if (Array.isArray(array[index])) return null;
        if (typeof array[index] === "object" && Object.prototype.toString.call(array[index]) === "[object Object]") array[index] = "[object Object]";
      }
      return String(array);
    }
    if (typeof key === "object" && Object.prototype.toString.call(key) === "[object Object]") return "[object Object]";
    return String(key);
  }
  var legacyMapTag = defineMappingTag("tag:yaml.org,2002:map", {
    create: () => ({}),
    identify: isPlainObject,
    represent: (o) => {
      const map = /* @__PURE__ */ new Map();
      for (const key of Object.keys(o)) map.set(key, o[key]);
      return map;
    },
    addPair: (container, key, value) => {
      const normalizedKey = normalizeKey(key);
      if (normalizedKey === null) return "nested arrays are not supported inside keys";
      if (normalizedKey === "__proto__") Object.defineProperty(container, normalizedKey, {
        value,
        enumerable: true,
        configurable: true,
        writable: true
      });
      else container[normalizedKey] = value;
      return "";
    },
    has: (container, key) => {
      const normalizedKey = normalizeKey(key);
      return normalizedKey !== null && Object.prototype.hasOwnProperty.call(container, normalizedKey);
    },
    keys: (container) => Object.keys(container),
    get: (container, key) => {
      const normalizedKey = String(key);
      if (!Object.prototype.hasOwnProperty.call(container, normalizedKey)) return null;
      return container[normalizedKey];
    }
  });
  var DEFAULT_SNIPPET_OPTIONS = {
    maxLength: 79,
    indent: 1,
    linesBefore: 3,
    linesAfter: 2
  };
  function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
    let head = "";
    let tail = "";
    const maxHalfLength = Math.floor(maxLineLength / 2) - 1;
    if (position - lineStart > maxHalfLength) {
      head = " ... ";
      lineStart = position - maxHalfLength + head.length;
    }
    if (lineEnd - position > maxHalfLength) {
      tail = " ...";
      lineEnd = position + maxHalfLength - tail.length;
    }
    return {
      str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "→") + tail,
      pos: position - lineStart + head.length
    };
  }
  function padStart(string, max) {
    return " ".repeat(Math.max(max - string.length, 0)) + string;
  }
  function makeSnippet(mark, options) {
    if (!mark.buffer) return null;
    const opts = {
      ...DEFAULT_SNIPPET_OPTIONS,
      ...options
    };
    const re = /\r?\n|\r|\0/g;
    const lineStarts = [0];
    const lineEnds = [];
    let match;
    let foundLineNo = -1;
    while (match = re.exec(mark.buffer)) {
      lineEnds.push(match.index);
      lineStarts.push(match.index + match[0].length);
      if (mark.position <= match.index && foundLineNo < 0) foundLineNo = lineStarts.length - 2;
    }
    if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
    let result = "";
    const lineNoLength = Math.min(mark.line + opts.linesAfter, lineEnds.length).toString().length;
    const maxLineLength = opts.maxLength - (opts.indent + lineNoLength + 3);
    for (let i = 1; i <= opts.linesBefore; i++) {
      if (foundLineNo - i < 0) break;
      const line2 = getLine(mark.buffer, lineStarts[foundLineNo - i], lineEnds[foundLineNo - i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]), maxLineLength);
      result = `${" ".repeat(opts.indent)}${padStart((mark.line - i + 1).toString(), lineNoLength)} | ${line2.str}
${result}`;
    }
    const line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
    result += `${" ".repeat(opts.indent)}${padStart((mark.line + 1).toString(), lineNoLength)} | ${line.str}
`;
    result += `${"-".repeat(opts.indent + lineNoLength + 3 + line.pos)}^
`;
    for (let i = 1; i <= opts.linesAfter; i++) {
      if (foundLineNo + i >= lineEnds.length) break;
      const line2 = getLine(mark.buffer, lineStarts[foundLineNo + i], lineEnds[foundLineNo + i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]), maxLineLength);
      result += `${" ".repeat(opts.indent)}${padStart((mark.line + i + 1).toString(), lineNoLength)} | ${line2.str}
`;
    }
    return result.replace(/\n$/, "");
  }
  function formatError(exception, compact) {
    let where = "";
    if (!exception.mark) return exception.reason;
    if (exception.mark.name) where += `in "${exception.mark.name}" `;
    where += `(${exception.mark.line + 1}:${exception.mark.column + 1})`;
    if (!compact && exception.mark.snippet) where += `

${exception.mark.snippet}`;
    return `${exception.reason} ${where}`;
  }
  var YAMLException = class YAMLException2 extends Error {
    reason;
    mark;
    /**
    * Optional `mark` contains source snippet data. Usually, use
    * {@link YAMLException.throwAt} instead of passing it directly.
    */
    constructor(reason, mark) {
      super();
      this.name = "YAMLException";
      this.reason = reason;
      this.mark = mark;
      this.message = formatError(this, false);
      if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
    }
    /**
    * Returns the formatted error, omitting the source snippet in compact mode.
    */
    toString(compact) {
      return `${this.name}: ${formatError(this, compact)}`;
    }
    /**
    * Builds a YAMLException with a source snippet and throws it. `source` is
    * the raw input text; `position` is an offset into it.
    */
    static throwAt(source, position, message, filename = "") {
      let line = 0;
      let lineStart = 0;
      for (let index = 0; index < position; index++) {
        const ch = source.charCodeAt(index);
        if (ch === 10) {
          line++;
          lineStart = index + 1;
        } else if (ch === 13) {
          line++;
          if (source.charCodeAt(index + 1) === 10) index++;
          lineStart = index + 1;
        }
      }
      const mark = {
        name: filename,
        buffer: source,
        position,
        line,
        column: position - lineStart
      };
      mark.snippet = makeSnippet(mark);
      throw new YAMLException2(message, mark);
    }
  };
  var EVENT_ID = {
    DOCUMENT: 1,
    SEQUENCE: 2,
    MAPPING: 3,
    SCALAR: 4,
    ALIAS: 5,
    POP: 6
  };
  var SCALAR_STYLE = {
    PLAIN: 1,
    SINGLE_QUOTED: 2,
    DOUBLE_QUOTED: 3,
    LITERAL_BLOCK: 4,
    FOLDED_BLOCK: 5
  };
  var COLLECTION_STYLE = {
    BLOCK: 1,
    FLOW: 2
  };
  var CHOMPING_MODE = {
    CLIP: 1,
    STRIP: 2,
    KEEP: 3
  };
  var NO_RANGE$3 = -1;
  function simpleEscapeSequence(c) {
    switch (c) {
      case 48:
        return "\0";
      case 97:
        return "\x07";
      case 98:
        return "\b";
      case 116:
        return "	";
      case 9:
        return "	";
      case 110:
        return "\n";
      case 118:
        return "\v";
      case 102:
        return "\f";
      case 114:
        return "\r";
      case 101:
        return "\x1B";
      case 32:
        return " ";
      case 34:
        return '"';
      case 47:
        return "/";
      case 92:
        return "\\";
      case 78:
        return "";
      case 95:
        return " ";
      case 76:
        return "\u2028";
      case 80:
        return "\u2029";
      default:
        return "";
    }
  }
  var simpleEscapeCheck = new Array(256);
  var simpleEscapeMap = new Array(256);
  for (let i = 0; i < 256; i++) {
    simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
    simpleEscapeMap[i] = simpleEscapeSequence(i);
  }
  function charFromCodepoint(c) {
    if (c <= 65535) return String.fromCharCode(c);
    return String.fromCharCode((c - 65536 >> 10) + 55296, (c - 65536 & 1023) + 56320);
  }
  function fromHexCode$1(c) {
    if (c >= 48 && c <= 57) return c - 48;
    return (c | 32) - 97 + 10;
  }
  function escapedHexLen$1(c) {
    if (c === 120) return 2;
    if (c === 117) return 4;
    return 8;
  }
  function skipFoldedBreaks(input, position, end) {
    let breaks = 0;
    while (position < end) {
      const ch = input.charCodeAt(position);
      if (ch === 10) {
        breaks++;
        position++;
      } else if (ch === 13) {
        breaks++;
        position++;
        if (input.charCodeAt(position) === 10) position++;
      } else if (ch === 32 || ch === 9) position++;
      else break;
    }
    return {
      position,
      breaks
    };
  }
  function foldedBreaks(count) {
    if (count === 1) return " ";
    return "\n".repeat(count - 1);
  }
  function getPlainValue(input, start2, end) {
    let result = "";
    let position = start2;
    let captureStart = start2;
    let captureEnd = start2;
    while (position < end) {
      const ch = input.charCodeAt(position);
      if (ch === 10 || ch === 13) {
        result += input.slice(captureStart, captureEnd);
        const fold = skipFoldedBreaks(input, position, end);
        result += foldedBreaks(fold.breaks);
        position = captureStart = captureEnd = fold.position;
      } else {
        position++;
        if (ch !== 32 && ch !== 9) captureEnd = position;
      }
    }
    return result + input.slice(captureStart, captureEnd);
  }
  function getSingleQuotedValue(input, start2, end) {
    let result = "";
    let position = start2;
    let captureStart = start2;
    let captureEnd = start2;
    while (position < end) {
      const ch = input.charCodeAt(position);
      if (ch === 39) {
        result += input.slice(captureStart, position) + "'";
        position += 2;
        captureStart = captureEnd = position;
      } else if (ch === 10 || ch === 13) {
        result += input.slice(captureStart, captureEnd);
        const fold = skipFoldedBreaks(input, position, end);
        result += foldedBreaks(fold.breaks);
        position = captureStart = captureEnd = fold.position;
      } else {
        position++;
        if (ch !== 32 && ch !== 9) captureEnd = position;
      }
    }
    return result + input.slice(captureStart, end);
  }
  function getDoubleQuotedValue(input, start2, end) {
    let result = "";
    let position = start2;
    let captureStart = start2;
    let captureEnd = start2;
    while (position < end) {
      const ch = input.charCodeAt(position);
      if (ch === 92) {
        result += input.slice(captureStart, position);
        position++;
        const escaped = input.charCodeAt(position);
        if (escaped === 10 || escaped === 13) position = skipFoldedBreaks(input, position, end).position;
        else if (escaped < 256 && simpleEscapeCheck[escaped]) {
          result += simpleEscapeMap[escaped];
          position++;
        } else {
          let hexLength = escapedHexLen$1(escaped);
          let hexResult = 0;
          for (; hexLength > 0; hexLength--) {
            position++;
            const digit = fromHexCode$1(input.charCodeAt(position));
            hexResult = (hexResult << 4) + digit;
          }
          result += charFromCodepoint(hexResult);
          position++;
        }
        captureStart = captureEnd = position;
      } else if (ch === 10 || ch === 13) {
        result += input.slice(captureStart, captureEnd);
        const fold = skipFoldedBreaks(input, position, end);
        result += foldedBreaks(fold.breaks);
        position = captureStart = captureEnd = fold.position;
      } else {
        position++;
        if (ch !== 32 && ch !== 9) captureEnd = position;
      }
    }
    return result + input.slice(captureStart, end);
  }
  function getBlockValue(input, start2, end, indent, chomping, folded) {
    const textIndent = indent < 0 ? 0 : indent;
    const region = input.slice(start2, end).replace(/\r\n?/g, "\n");
    const lines = region === "" ? [] : (region.endsWith("\n") ? region.slice(0, -1) : region).split("\n");
    let result = "";
    let didReadContent = false;
    let emptyLines = 0;
    let atMoreIndented = false;
    for (const line of lines) {
      let column = 0;
      while (column < textIndent && line.charCodeAt(column) === 32) column++;
      if (indent < 0 || column >= line.length) {
        emptyLines++;
        continue;
      }
      const content = line.slice(textIndent);
      const first = content.charCodeAt(0);
      if (folded) if (first === 32 || first === 9) {
        atMoreIndented = true;
        result += "\n".repeat(didReadContent ? 1 + emptyLines : emptyLines);
      } else if (atMoreIndented) {
        atMoreIndented = false;
        result += "\n".repeat(emptyLines + 1);
      } else if (emptyLines === 0) {
        if (didReadContent) result += " ";
      } else result += "\n".repeat(emptyLines);
      else result += "\n".repeat(didReadContent ? 1 + emptyLines : emptyLines);
      result += content;
      didReadContent = true;
      emptyLines = 0;
    }
    if (chomping === CHOMPING_MODE.KEEP) result += "\n".repeat(didReadContent ? 1 + emptyLines : emptyLines);
    else if (chomping !== CHOMPING_MODE.STRIP) {
      if (didReadContent) result += "\n";
    }
    return result;
  }
  function getScalarValue(input, scalar) {
    if (scalar.valueStart === NO_RANGE$3) return "";
    const { valueStart, valueEnd } = scalar;
    if (scalar.fast) return input.slice(valueStart, valueEnd);
    switch (scalar.style) {
      case SCALAR_STYLE.SINGLE_QUOTED:
        return getSingleQuotedValue(input, valueStart, valueEnd);
      case SCALAR_STYLE.DOUBLE_QUOTED:
        return getDoubleQuotedValue(input, valueStart, valueEnd);
      case SCALAR_STYLE.LITERAL_BLOCK:
        return getBlockValue(input, valueStart, valueEnd, scalar.indent, scalar.chomping, false);
      case SCALAR_STYLE.FOLDED_BLOCK:
        return getBlockValue(input, valueStart, valueEnd, scalar.indent, scalar.chomping, true);
      default:
        return getPlainValue(input, valueStart, valueEnd);
    }
  }
  var DEFAULT_TAG_HANDLERS = Object.assign(/* @__PURE__ */ Object.create(null), {
    "!": "!",
    "!!": "tag:yaml.org,2002:"
  });
  function tagNameFull(rawTag, tagHandlers) {
    if (rawTag.startsWith("!<") && rawTag.endsWith(">")) return decodeURIComponent(rawTag.slice(2, -1));
    const handleEnd = rawTag.indexOf("!", 1);
    const handle = handleEnd === -1 ? "!" : rawTag.slice(0, handleEnd + 1);
    const prefix = tagHandlers?.[handle] ?? DEFAULT_TAG_HANDLERS[handle] ?? handle;
    return decodeURIComponent(prefix) + decodeURIComponent(rawTag.slice(handle.length));
  }
  var NO_RANGE$2 = -1;
  var MERGE_TAG_NAME = "tag:yaml.org,2002:merge";
  var DEFAULT_CONSTRUCTOR_OPTIONS = {
    filename: "",
    schema: CORE_SCHEMA,
    json: false,
    maxTotalMergeKeys: 1e4,
    maxAliases: -1
  };
  function eventPosition$1(event) {
    if ("tagStart" in event && event.tagStart !== NO_RANGE$2) return event.tagStart;
    if ("anchorStart" in event && event.anchorStart !== NO_RANGE$2) return event.anchorStart;
    if ("valueStart" in event && event.valueStart !== NO_RANGE$2) return event.valueStart;
    if ("start" in event) return event.start;
    return 0;
  }
  function throwError$1(state, message) {
    YAMLException.throwAt(state.source, state.position, message, state.filename);
  }
  function finalizeCollection(state, position, tag, carrier) {
    try {
      return tag.finalize(carrier);
    } catch (error) {
      if (error instanceof YAMLException) throw error;
      YAMLException.throwAt(state.source, position, error instanceof Error ? error.message : String(error), state.filename);
    }
  }
  function constructScalar(state, event) {
    const source = getScalarValue(state.source, event);
    const rawTag = event.tagStart === NO_RANGE$2 ? "" : state.source.slice(event.tagStart, event.tagEnd);
    const strTag2 = state.schema.defaultScalarTag;
    if (rawTag !== "") {
      if (rawTag === "!") return {
        value: source,
        tag: strTag2
      };
      const tagName = tagNameFull(rawTag, state.tagHandlers);
      const scalarTag = state.schema.lookupScalarTag(tagName);
      if (scalarTag) {
        const result = scalarTag.resolve(source, true, tagName);
        if (result === NOT_RESOLVED) throwError$1(state, `cannot resolve a node with !<${tagName}> explicit tag`);
        return {
          value: result,
          tag: scalarTag
        };
      }
      const collectionTagDef = state.schema.lookupMappingTag(tagName) ?? state.schema.lookupSequenceTag(tagName);
      if (collectionTagDef) {
        if (source !== "") throwError$1(state, `cannot resolve a node with !<${tagName}> explicit tag`);
        const carrier = collectionTagDef.create(tagName);
        return {
          value: collectionTagDef.carrierIsResult ? carrier : finalizeCollection(state, state.position, collectionTagDef, carrier),
          tag: collectionTagDef
        };
      }
      throwError$1(state, `unknown scalar tag !<${tagName}>`);
    }
    if (event.style === SCALAR_STYLE.PLAIN) return state.schema.resolveImplicitScalarTag(source);
    return {
      value: strTag2.resolve(source, false, strTag2.tagName),
      tag: strTag2
    };
  }
  function collectionTagName(state, event, defaultTagName) {
    const rawTag = event.tagStart === NO_RANGE$2 ? "" : state.source.slice(event.tagStart, event.tagEnd);
    return rawTag === "" || rawTag === "!" ? defaultTagName : tagNameFull(rawTag, state.tagHandlers);
  }
  function isMappingTag(tag) {
    return tag.nodeKind === "mapping";
  }
  function chargeMergeWork(state) {
    state.totalMergeKeys++;
    if (state.maxTotalMergeKeys !== -1 && state.totalMergeKeys > state.maxTotalMergeKeys) throwError$1(state, `merge keys exceeded maxTotalMergeKeys (${state.maxTotalMergeKeys})`);
  }
  function mergeKeys(state, frame, source, sourceTag) {
    chargeMergeWork(state);
    for (const sourceKey of sourceTag.keys(source)) {
      chargeMergeWork(state);
      if (frame.tag.has(frame.value, sourceKey)) continue;
      const err = frame.tag.addPair(frame.value, sourceKey, sourceTag.get(source, sourceKey));
      if (err) throwError$1(state, err);
      frame.overridable ??= /* @__PURE__ */ new Set();
      frame.overridable.add(sourceKey);
    }
  }
  function mergeSource(state, frame, source, sourceTag) {
    state.position = frame.keyPosition;
    if (isMappingTag(sourceTag)) mergeKeys(state, frame, source, sourceTag);
    else if (sourceTag.nodeKind === "sequence" && Array.isArray(source)) {
      if (source.length > 100) throwError$1(state, "abnormal merge sequence size");
      for (const element of source) {
        const elementTag = state.nodeTags.get(element);
        if (!elementTag) throwError$1(state, "cannot merge mappings; the provided source object is unacceptable");
        mergeKeys(state, frame, element, elementTag);
      }
    } else throwError$1(state, "cannot merge mappings; the provided source object is unacceptable");
  }
  function addMappingValue(state, frame, key, value, tag) {
    state.position = frame.keyPosition;
    if (frame.keyIsMerge) {
      mergeSource(state, frame, value, tag);
      return;
    }
    if (!state.json && frame.tag.has(frame.value, key) && !frame.overridable?.has(key)) throwError$1(state, "duplicated mapping key");
    const err = frame.tag.addPair(frame.value, key, value);
    if (err) throwError$1(state, err);
    frame.overridable?.delete(key);
  }
  function addValue(state, value, tag) {
    const frame = state.frames[state.frames.length - 1];
    if (frame.kind === "document") {
      frame.value = value;
      frame.hasValue = true;
    } else if (frame.kind === "sequence") {
      if (isMappingTag(tag)) state.nodeTags.set(value, tag);
      const err = frame.tag.addItem(frame.value, value, frame.index++);
      if (err) throwError$1(state, err);
    } else if (frame.hasKey) {
      const key = frame.key;
      frame.key = void 0;
      frame.hasKey = false;
      addMappingValue(state, frame, key, value, tag);
    } else {
      frame.key = value;
      frame.keyPosition = state.position;
      frame.hasKey = true;
      frame.keyIsMerge = tag.tagName === MERGE_TAG_NAME;
    }
  }
  function storeAnchor(state, event, value, tag, isValueFinal) {
    if (event.anchorStart !== NO_RANGE$2) {
      const anchor = {
        value,
        tag,
        isValueFinal
      };
      state.anchors.set(state.source.slice(event.anchorStart, event.anchorEnd), anchor);
      return anchor;
    }
    return null;
  }
  function constructFromEvents(events, options) {
    const state = {
      ...DEFAULT_CONSTRUCTOR_OPTIONS,
      ...options,
      events,
      documents: [],
      eventIndex: 0,
      position: 0,
      frames: [],
      anchors: /* @__PURE__ */ new Map(),
      nodeTags: /* @__PURE__ */ new Map(),
      tagHandlers: /* @__PURE__ */ Object.create(null),
      totalMergeKeys: 0,
      aliasCount: 0
    };
    while (state.eventIndex < state.events.length) {
      const event = state.events[state.eventIndex++];
      state.position = eventPosition$1(event);
      switch (event.type) {
        case EVENT_ID.DOCUMENT:
          state.anchors = /* @__PURE__ */ new Map();
          state.nodeTags = /* @__PURE__ */ new Map();
          state.aliasCount = 0;
          state.tagHandlers = /* @__PURE__ */ Object.create(null);
          for (const directive of event.directives) if (directive.kind === "tag") state.tagHandlers[directive.handle] = directive.prefix;
          state.frames.push({
            kind: "document",
            position: state.position,
            value: void 0,
            hasValue: false
          });
          break;
        case EVENT_ID.SCALAR: {
          const { value, tag } = constructScalar(state, event);
          storeAnchor(state, event, value, tag, true);
          addValue(state, value, tag);
          break;
        }
        case EVENT_ID.SEQUENCE: {
          const tagName = collectionTagName(state, event, "tag:yaml.org,2002:seq");
          const tag = state.schema.lookupSequenceTag(tagName);
          if (!tag) throwError$1(state, `unknown sequence tag !<${tagName}>`);
          const value = tag.create(tagName);
          const anchor = storeAnchor(state, event, value, tag, tag.carrierIsResult);
          state.frames.push({
            kind: "sequence",
            position: state.position,
            value,
            tag,
            anchor,
            index: 0
          });
          break;
        }
        case EVENT_ID.MAPPING: {
          const tagName = collectionTagName(state, event, "tag:yaml.org,2002:map");
          const tag = state.schema.lookupMappingTag(tagName);
          if (!tag) throwError$1(state, `unknown mapping tag !<${tagName}>`);
          const value = tag.create(tagName);
          const anchor = storeAnchor(state, event, value, tag, tag.carrierIsResult);
          state.frames.push({
            kind: "mapping",
            position: state.position,
            value,
            tag,
            anchor,
            key: void 0,
            keyPosition: state.position,
            hasKey: false,
            keyIsMerge: false,
            overridable: null
          });
          break;
        }
        case EVENT_ID.ALIAS: {
          if (state.maxAliases !== -1 && ++state.aliasCount > state.maxAliases) throwError$1(state, `aliases exceeded maxAliases (${state.maxAliases})`);
          const name = state.source.slice(event.anchorStart, event.anchorEnd);
          const anchor = state.anchors.get(name);
          if (!anchor) throwError$1(state, `unidentified alias "${name}"`);
          if (!anchor.isValueFinal) throwError$1(state, `recursive alias "${name}" is not supported for tag ${anchor.tag.tagName} because it uses finalize()`);
          addValue(state, anchor.value, anchor.tag);
          break;
        }
        case EVENT_ID.POP: {
          const frame = state.frames.pop();
          if (frame.kind === "mapping" && frame.hasKey) {
            state.position = frame.keyPosition;
            throwError$1(state, "incomplete mapping pair in event stream");
          }
          if (frame.kind === "document") state.documents.push(frame.value);
          else {
            const value = frame.tag.carrierIsResult ? frame.value : finalizeCollection(state, frame.position, frame.tag, frame.value);
            if (frame.anchor) {
              frame.anchor.value = value;
              frame.anchor.isValueFinal = true;
            }
            addValue(state, value, frame.tag);
          }
          break;
        }
      }
    }
    return state.documents;
  }
  var NO_RANGE$1 = -1;
  var HAS_OWN = Object.prototype.hasOwnProperty;
  var CONTEXT_FLOW_IN = 1;
  var CONTEXT_FLOW_OUT = 2;
  var CONTEXT_BLOCK_IN = 3;
  var CONTEXT_BLOCK_OUT = 4;
  var PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
  var PATTERN_FLOW_INDICATORS = /[,\[\]{}]/;
  var PATTERN_TAG_HANDLE = /^(?:!|!!|![0-9A-Za-z-]+!)$/;
  var NS_URI_CHAR = String.raw`(?:%[0-9A-Fa-f]{2}|[0-9A-Za-z\-#;/?:@&=+$,_.!~*'()\[\]])`;
  var NS_TAG_CHAR = String.raw`(?:%[0-9A-Fa-f]{2}|[0-9A-Za-z\-#;/?:@&=+$.~*'()_])`;
  var PATTERN_TAG_URI = new RegExp(`^(?:${NS_URI_CHAR})*$`);
  var PATTERN_TAG_SUFFIX = new RegExp(`^(?:${NS_TAG_CHAR})+$`);
  var PATTERN_TAG_PREFIX = new RegExp(`^(?:!(?:${NS_URI_CHAR})*|${NS_TAG_CHAR}(?:${NS_URI_CHAR})*)$`);
  var DEFAULT_PARSER_OPTIONS = {
    filename: "",
    maxDepth: 100
  };
  function addDocumentEvent(state, explicitStart, explicitEnd) {
    state.events.push({
      type: EVENT_ID.DOCUMENT,
      explicitStart,
      explicitEnd,
      directives: state.directives
    });
  }
  function addSequenceEvent(state, start2, anchorStart, anchorEnd, tagStart, tagEnd, style) {
    state.events.push({
      type: EVENT_ID.SEQUENCE,
      start: start2,
      anchorStart,
      anchorEnd,
      tagStart,
      tagEnd,
      style
    });
  }
  function addMappingEvent(state, start2, anchorStart, anchorEnd, tagStart, tagEnd, style) {
    state.events.push({
      type: EVENT_ID.MAPPING,
      start: start2,
      anchorStart,
      anchorEnd,
      tagStart,
      tagEnd,
      style
    });
  }
  function insertFlowPairMappingEvent(state, snapshot) {
    state.events.splice(snapshot.eventsLength, 0, {
      type: EVENT_ID.MAPPING,
      start: snapshot.position,
      anchorStart: NO_RANGE$1,
      anchorEnd: NO_RANGE$1,
      tagStart: NO_RANGE$1,
      tagEnd: NO_RANGE$1,
      style: COLLECTION_STYLE.FLOW
    });
  }
  function addScalarEvent(state, valueStart, valueEnd, anchorStart, anchorEnd, tagStart, tagEnd, style, chomping = CHOMPING_MODE.CLIP, indent = -1, fast = false) {
    state.events.push({
      type: EVENT_ID.SCALAR,
      valueStart,
      valueEnd,
      anchorStart,
      anchorEnd,
      tagStart,
      tagEnd,
      style,
      chomping,
      indent,
      fast
    });
  }
  function addAliasEvent(state, anchorStart, anchorEnd) {
    state.events.push({
      type: EVENT_ID.ALIAS,
      anchorStart,
      anchorEnd
    });
  }
  function addPopEvent(state) {
    state.events.push({ type: EVENT_ID.POP });
  }
  function addEmptyScalarEvent(state) {
    addScalarEvent(state, NO_RANGE$1, NO_RANGE$1, NO_RANGE$1, NO_RANGE$1, NO_RANGE$1, NO_RANGE$1, SCALAR_STYLE.PLAIN);
  }
  function emptyProperties() {
    return {
      anchorStart: NO_RANGE$1,
      anchorEnd: NO_RANGE$1,
      tagStart: NO_RANGE$1,
      tagEnd: NO_RANGE$1
    };
  }
  function snapshotState(state) {
    return {
      position: state.position,
      line: state.line,
      lineStart: state.lineStart,
      lineIndent: state.lineIndent,
      firstTabInLine: state.firstTabInLine,
      eventsLength: state.events.length
    };
  }
  function restoreState(state, snapshot) {
    state.position = snapshot.position;
    state.line = snapshot.line;
    state.lineStart = snapshot.lineStart;
    state.lineIndent = snapshot.lineIndent;
    state.firstTabInLine = snapshot.firstTabInLine;
    state.events.length = snapshot.eventsLength;
  }
  function throwError(state, message) {
    YAMLException.throwAt(state.input.slice(0, state.length), state.position, message, state.filename);
  }
  function isEol(c) {
    return c === 10 || c === 13;
  }
  function isWhiteSpace(c) {
    return c === 9 || c === 32;
  }
  function isWsOrEol(c) {
    return isWhiteSpace(c) || isEol(c);
  }
  function isWsOrEolOrEnd(c) {
    return c === 0 || isWsOrEol(c);
  }
  function isFlowIndicator(c) {
    return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
  }
  function fromDecimalCode(c) {
    return c >= 48 && c <= 57 ? c - 48 : -1;
  }
  function fromHexCode(c) {
    if (c >= 48 && c <= 57) return c - 48;
    const lc = c | 32;
    if (lc >= 97 && lc <= 102) return lc - 97 + 10;
    return -1;
  }
  function escapedHexLen(c) {
    if (c === 120) return 2;
    if (c === 117) return 4;
    if (c === 85) return 8;
    return 0;
  }
  function isSimpleEscape(c) {
    return c === 48 || c === 97 || c === 98 || c === 116 || c === 9 || c === 110 || c === 118 || c === 102 || c === 114 || c === 101 || c === 32 || c === 34 || c === 47 || c === 92 || c === 78 || c === 95 || c === 76 || c === 80;
  }
  function consumeLineBreak(state) {
    if (state.input.charCodeAt(state.position) === 10) state.position++;
    else {
      state.position++;
      if (state.input.charCodeAt(state.position) === 10) state.position++;
    }
    state.line++;
    state.lineStart = state.position;
    state.lineIndent = 0;
    state.firstTabInLine = -1;
  }
  function skipSeparationSpace(state, allowComments) {
    let lineBreaks = 0;
    let ch = state.input.charCodeAt(state.position);
    let hasSeparation = state.position === state.lineStart || isWsOrEol(state.input.charCodeAt(state.position - 1));
    while (ch !== 0) {
      while (isWhiteSpace(ch)) {
        hasSeparation = true;
        if (ch === 9 && state.firstTabInLine === -1) state.firstTabInLine = state.position;
        ch = state.input.charCodeAt(++state.position);
      }
      if (allowComments && hasSeparation && ch === 35) do
        ch = state.input.charCodeAt(++state.position);
      while (!isEol(ch) && ch !== 0);
      if (!isEol(ch)) break;
      consumeLineBreak(state);
      lineBreaks++;
      hasSeparation = true;
      ch = state.input.charCodeAt(state.position);
      while (ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
    }
    return lineBreaks;
  }
  function testDocumentSeparator(state, position = state.position) {
    const ch = state.input.charCodeAt(position);
    if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(position + 1) && ch === state.input.charCodeAt(position + 2)) {
      const following = state.input.charCodeAt(position + 3);
      return following === 0 || isWsOrEol(following);
    }
    return false;
  }
  function skipByteOrderMark(state) {
    if (state.position === state.lineStart && state.input.charCodeAt(state.position) === 65279) {
      state.position++;
      state.lineStart = state.position;
    }
  }
  function testDocumentBoundary(state) {
    if (state.position !== state.lineStart) return false;
    if (testDocumentSeparator(state)) return true;
    if (state.input.charCodeAt(state.position) !== 65279) return false;
    const snapshot = snapshotState(state);
    skipByteOrderMark(state);
    skipSeparationSpace(state, true);
    const ch = state.input.charCodeAt(state.position);
    const result = state.position === state.lineStart && (ch === 37 || ch === 45 && testDocumentSeparator(state));
    restoreState(state, snapshot);
    return result;
  }
  function skipUntilLineEnd(state) {
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0 && !isEol(ch)) ch = state.input.charCodeAt(++state.position);
  }
  function checkPrintable(state, start2, end) {
    if (PATTERN_NON_PRINTABLE.test(state.input.slice(start2, end))) throwError(state, "the stream contains non-printable characters");
  }
  function readTagProperty(state, props, inFlow) {
    if (state.input.charCodeAt(state.position) !== 33) return false;
    if (props.tagStart !== NO_RANGE$1) throwError(state, "duplication of a tag property");
    const start2 = state.position;
    let isVerbatim = false;
    let isNamed = false;
    let tagHandle = "!";
    let ch = state.input.charCodeAt(++state.position);
    if (ch === 60) {
      isVerbatim = true;
      ch = state.input.charCodeAt(++state.position);
    } else if (ch === 33) {
      isNamed = true;
      tagHandle = "!!";
      ch = state.input.charCodeAt(++state.position);
    }
    let suffixStart = state.position;
    let tagName;
    if (isVerbatim) {
      while (ch !== 0 && ch !== 62) ch = state.input.charCodeAt(++state.position);
      if (ch !== 62) throwError(state, "unexpected end of the stream within a verbatim tag");
      tagName = state.input.slice(suffixStart, state.position);
      state.position++;
    } else {
      while (ch !== 0 && !isWsOrEol(ch) && !(inFlow && isFlowIndicator(ch))) {
        if (ch === 33) if (!isNamed) {
          tagHandle = state.input.slice(suffixStart - 1, state.position + 1);
          if (!PATTERN_TAG_HANDLE.test(tagHandle)) throwError(state, "named tag handle cannot contain such characters");
          isNamed = true;
          suffixStart = state.position + 1;
        } else throwError(state, "tag suffix cannot contain exclamation marks");
        ch = state.input.charCodeAt(++state.position);
      }
      tagName = state.input.slice(suffixStart, state.position);
      if (PATTERN_FLOW_INDICATORS.test(tagName)) throwError(state, "tag suffix cannot contain flow indicator characters");
    }
    if (tagName && !(isVerbatim ? PATTERN_TAG_URI.test(tagName) : PATTERN_TAG_SUFFIX.test(tagName))) throwError(state, `tag name cannot contain such characters: ${tagName}`);
    if (!isVerbatim && tagHandle !== "!" && tagHandle !== "!!" && !HAS_OWN.call(state.tagHandlers, tagHandle)) throwError(state, `undeclared tag handle "${tagHandle}"`);
    props.tagStart = start2;
    props.tagEnd = state.position;
    return true;
  }
  function readAnchorProperty(state, props) {
    if (state.input.charCodeAt(state.position) !== 38) return false;
    if (props.anchorStart !== NO_RANGE$1) throwError(state, "duplication of an anchor property");
    state.position++;
    const start2 = state.position;
    while (state.input.charCodeAt(state.position) !== 0 && !isWsOrEol(state.input.charCodeAt(state.position)) && !isFlowIndicator(state.input.charCodeAt(state.position))) state.position++;
    if (state.position === start2) throwError(state, "name of an anchor node must contain at least one character");
    props.anchorStart = start2;
    props.anchorEnd = state.position;
    return true;
  }
  function readAlias(state, props) {
    if (state.input.charCodeAt(state.position) !== 42) return false;
    if (props.anchorStart !== NO_RANGE$1 || props.tagStart !== NO_RANGE$1) throwError(state, "alias node should not have any properties");
    state.position++;
    const start2 = state.position;
    while (state.input.charCodeAt(state.position) !== 0 && !isWsOrEol(state.input.charCodeAt(state.position)) && !isFlowIndicator(state.input.charCodeAt(state.position))) state.position++;
    if (state.position === start2) throwError(state, "name of an alias node must contain at least one character");
    addAliasEvent(state, start2, state.position);
    return true;
  }
  function readFlowScalarBreak(state, nodeIndent) {
    skipSeparationSpace(state, false);
    if (state.lineIndent < nodeIndent) throwError(state, "deficient indentation");
  }
  function readSingleQuotedScalar(state, nodeIndent, props) {
    if (state.input.charCodeAt(state.position) !== 39) return false;
    state.position++;
    const start2 = state.position;
    let simple = true;
    while (state.input.charCodeAt(state.position) !== 0) {
      const ch = state.input.charCodeAt(state.position);
      if (ch === 39) {
        if (state.input.charCodeAt(state.position + 1) === 39) {
          simple = false;
          state.position += 2;
          continue;
        }
        const end = state.position;
        state.position++;
        addScalarEvent(state, start2, end, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, SCALAR_STYLE.SINGLE_QUOTED, CHOMPING_MODE.CLIP, -1, simple);
        return true;
      }
      if (isEol(ch)) {
        simple = false;
        readFlowScalarBreak(state, nodeIndent);
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) throwError(state, "unexpected end of the document within a single quoted scalar");
      else if (ch !== 9 && ch < 32) throwError(state, "expected valid JSON character");
      else state.position++;
    }
    throwError(state, "unexpected end of the stream within a single quoted scalar");
  }
  function readDoubleQuotedScalar(state, nodeIndent, props) {
    if (state.input.charCodeAt(state.position) !== 34) return false;
    state.position++;
    const start2 = state.position;
    let simple = true;
    while (state.input.charCodeAt(state.position) !== 0) {
      const ch = state.input.charCodeAt(state.position);
      if (ch === 34) {
        const end = state.position;
        state.position++;
        addScalarEvent(state, start2, end, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, SCALAR_STYLE.DOUBLE_QUOTED, CHOMPING_MODE.CLIP, -1, simple);
        return true;
      }
      if (ch === 92) {
        simple = false;
        const escaped = state.input.charCodeAt(++state.position);
        if (isEol(escaped)) readFlowScalarBreak(state, nodeIndent);
        else if (isSimpleEscape(escaped)) state.position++;
        else {
          let hexLength = escapedHexLen(escaped);
          if (hexLength === 0) throwError(state, "unknown escape sequence");
          while (hexLength-- > 0) {
            state.position++;
            if (fromHexCode(state.input.charCodeAt(state.position)) < 0) throwError(state, "expected hexadecimal character");
          }
          state.position++;
        }
      } else if (isEol(ch)) {
        simple = false;
        readFlowScalarBreak(state, nodeIndent);
      } else if (state.position === state.lineStart && testDocumentSeparator(state)) throwError(state, "unexpected end of the document within a double quoted scalar");
      else if (ch !== 9 && ch < 32) throwError(state, "expected valid JSON character");
      else state.position++;
    }
    throwError(state, "unexpected end of the stream within a double quoted scalar");
  }
  function readBlockScalar(state, parentIndent, props) {
    const ch = state.input.charCodeAt(state.position);
    let chomping = CHOMPING_MODE.CLIP;
    let indent = -1;
    let detectedIndent = false;
    if (ch !== 124 && ch !== 62) return false;
    const style = ch === 124 ? SCALAR_STYLE.LITERAL_BLOCK : SCALAR_STYLE.FOLDED_BLOCK;
    state.position++;
    while (state.input.charCodeAt(state.position) !== 0) {
      const current = state.input.charCodeAt(state.position);
      const digit = fromDecimalCode(current);
      if (current === 43 || current === 45) {
        if (chomping !== CHOMPING_MODE.CLIP) throwError(state, "repeat of a chomping mode identifier");
        chomping = current === 43 ? CHOMPING_MODE.KEEP : CHOMPING_MODE.STRIP;
        state.position++;
      } else if (digit >= 0) {
        if (digit === 0) throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
        if (detectedIndent) throwError(state, "repeat of an indentation width identifier");
        indent = parentIndent + digit - 1;
        detectedIndent = true;
        state.position++;
      } else break;
    }
    let hadWhitespace = false;
    while (isWhiteSpace(state.input.charCodeAt(state.position))) {
      hadWhitespace = true;
      state.position++;
    }
    if (hadWhitespace && state.input.charCodeAt(state.position) === 35) skipUntilLineEnd(state);
    if (isEol(state.input.charCodeAt(state.position))) consumeLineBreak(state);
    else if (state.input.charCodeAt(state.position) !== 0) throwError(state, "a line break is expected");
    let contentIndent = detectedIndent ? indent : -1;
    let maxLeadingIndent = 0;
    const valueStart = state.position;
    let valueEnd = state.position;
    while (state.input.charCodeAt(state.position) !== 0) {
      const linePosition = state.position;
      let column = 0;
      while (state.input.charCodeAt(linePosition + column) === 32) column++;
      const first = state.input.charCodeAt(linePosition + column);
      if (first === 0) {
        if (contentIndent >= 0) {
          if (column > contentIndent) valueEnd = linePosition + column;
        } else if (column > 0) valueEnd = linePosition + column;
        break;
      }
      if (testDocumentBoundary(state)) break;
      if (!detectedIndent && contentIndent === -1 && isEol(first)) maxLeadingIndent = Math.max(maxLeadingIndent, column);
      if (!detectedIndent && contentIndent === -1 && !isEol(first)) {
        if (first === 9 && column < parentIndent) {
          state.position = linePosition + column;
          throwError(state, "tab characters must not be used in indentation");
        }
        if (column < maxLeadingIndent) {
          state.position = linePosition + column;
          throwError(state, "bad indentation of a mapping entry");
        }
      }
      if (contentIndent === -1 && first !== 0 && !isEol(first) && column < parentIndent) {
        state.lineIndent = column;
        state.position = linePosition + column;
        break;
      }
      if (!detectedIndent && first !== 0 && !isEol(first) && contentIndent === -1) contentIndent = column;
      const requiredIndent = contentIndent === -1 ? parentIndent + 1 : contentIndent;
      if (first !== 0 && !isEol(first) && column < requiredIndent) {
        state.lineIndent = column;
        state.position = linePosition + column;
        break;
      }
      skipUntilLineEnd(state);
      valueEnd = state.position;
      if (isEol(state.input.charCodeAt(state.position))) {
        consumeLineBreak(state);
        valueEnd = state.position;
      }
    }
    checkPrintable(state, valueStart, valueEnd);
    addScalarEvent(state, valueStart, valueEnd, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, style, chomping, contentIndent);
    return true;
  }
  function canStartPlainScalar(state, nodeContext) {
    const ch = state.input.charCodeAt(state.position);
    const inFlow = nodeContext === CONTEXT_FLOW_IN;
    if (ch === 0 || isWsOrEol(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96 || inFlow && isFlowIndicator(ch)) return false;
    if (ch === 63 || ch === 45) {
      const following = state.input.charCodeAt(state.position + 1);
      if (isWsOrEolOrEnd(following) || inFlow && isFlowIndicator(following)) return false;
    }
    return true;
  }
  function readPlainScalar(state, nodeIndent, nodeContext, props) {
    if (!canStartPlainScalar(state, nodeContext)) return false;
    const start2 = state.position;
    let end = state.position;
    let ch = state.input.charCodeAt(state.position);
    const inFlow = nodeContext === CONTEXT_FLOW_IN;
    let multiline = false;
    while (ch !== 0) {
      if (testDocumentBoundary(state)) break;
      if (ch === 58) {
        const following = state.input.charCodeAt(state.position + 1);
        if (isWsOrEolOrEnd(following) || inFlow && isFlowIndicator(following)) break;
      } else if (ch === 35) {
        if (isWsOrEol(state.input.charCodeAt(state.position - 1))) break;
      } else if (inFlow && isFlowIndicator(ch)) break;
      else if (isEol(ch)) {
        const savedPosition = state.position;
        const savedLine = state.line;
        const savedLineStart = state.lineStart;
        const savedLineIndent = state.lineIndent;
        skipSeparationSpace(state, false);
        if (state.lineIndent >= nodeIndent) {
          multiline = true;
          ch = state.input.charCodeAt(state.position);
          continue;
        }
        state.position = savedPosition;
        state.line = savedLine;
        state.lineStart = savedLineStart;
        state.lineIndent = savedLineIndent;
        break;
      }
      if (!isWhiteSpace(ch)) end = state.position + 1;
      ch = state.input.charCodeAt(++state.position);
    }
    if (end === start2) return false;
    checkPrintable(state, start2, end);
    addScalarEvent(state, start2, end, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, SCALAR_STYLE.PLAIN, CHOMPING_MODE.CLIP, -1, !multiline);
    return true;
  }
  function skipFlowSeparationSpace(state, nodeIndent) {
    const startLine = state.line;
    skipSeparationSpace(state, true);
    if (state.line > startLine && state.lineIndent < nodeIndent || state.firstTabInLine !== -1 && state.lineIndent < nodeIndent) throwError(state, "deficient indentation");
  }
  function readFlowCollection(state, nodeIndent, props) {
    const ch = state.input.charCodeAt(state.position);
    const isMapping = ch === 123;
    const start2 = state.position;
    let readNext = true;
    if (ch !== 91 && ch !== 123) return false;
    const terminator = isMapping ? 125 : 93;
    if (isMapping) addMappingEvent(state, start2, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, COLLECTION_STYLE.FLOW);
    else addSequenceEvent(state, start2, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, COLLECTION_STYLE.FLOW);
    state.position++;
    while (state.input.charCodeAt(state.position) !== 0) {
      skipFlowSeparationSpace(state, nodeIndent);
      let ch2 = state.input.charCodeAt(state.position);
      if (ch2 === terminator) {
        state.position++;
        addPopEvent(state);
        return true;
      } else if (!readNext) throwError(state, "missed comma between flow collection entries");
      else if (ch2 === 44) throwError(state, "expected the node content, but found ','");
      let isPair = false;
      let isExplicitPair = false;
      if (ch2 === 63 && isWsOrEol(state.input.charCodeAt(state.position + 1))) {
        isPair = isExplicitPair = true;
        state.position += 1;
        skipFlowSeparationSpace(state, nodeIndent);
      }
      const entryLine = state.line;
      const entryStart = snapshotState(state);
      const keyWasRead = parseNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      skipFlowSeparationSpace(state, nodeIndent);
      ch2 = state.input.charCodeAt(state.position);
      if ((isMapping || isExplicitPair || state.line === entryLine) && ch2 === 58) {
        isPair = true;
        state.position++;
        skipFlowSeparationSpace(state, nodeIndent);
        if (!isMapping) {
          insertFlowPairMappingEvent(state, entryStart);
          if (!keyWasRead) addEmptyScalarEvent(state);
        } else if (!keyWasRead) addEmptyScalarEvent(state);
        if (!parseNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true)) addEmptyScalarEvent(state);
        skipFlowSeparationSpace(state, nodeIndent);
        if (!isMapping) addPopEvent(state);
      } else if (isMapping && isPair) {
        if (!keyWasRead) addEmptyScalarEvent(state);
        addEmptyScalarEvent(state);
      } else if (isMapping) addEmptyScalarEvent(state);
      else if (isPair) {
        insertFlowPairMappingEvent(state, entryStart);
        if (!keyWasRead) addEmptyScalarEvent(state);
        addEmptyScalarEvent(state);
        addPopEvent(state);
      }
      ch2 = state.input.charCodeAt(state.position);
      if (ch2 === 44) {
        readNext = true;
        state.position++;
      } else readNext = false;
    }
    throwError(state, "unexpected end of the stream within a flow collection");
  }
  function readBlockSequence(state, nodeIndent, props) {
    if (state.firstTabInLine !== -1 || state.input.charCodeAt(state.position) !== 45 || !isWsOrEolOrEnd(state.input.charCodeAt(state.position + 1))) return false;
    addSequenceEvent(state, state.position, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, COLLECTION_STYLE.BLOCK);
    while (state.input.charCodeAt(state.position) === 45 && isWsOrEolOrEnd(state.input.charCodeAt(state.position + 1))) {
      if (state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      const entryLine = state.line;
      state.position++;
      const hadBreak = skipSeparationSpace(state, true) > 0;
      if (state.firstTabInLine !== -1 && state.input.charCodeAt(state.position) === 45 && isWsOrEolOrEnd(state.input.charCodeAt(state.position + 1))) throwError(state, "bad indentation of a sequence entry");
      if (hadBreak && state.lineIndent <= nodeIndent) addEmptyScalarEvent(state);
      else parseNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
      skipSeparationSpace(state, true);
      if (state.lineIndent < nodeIndent || state.position >= state.length) break;
      if (state.lineIndent > nodeIndent) throwError(state, "bad indentation of a sequence entry");
      if (state.line === entryLine && state.input.charCodeAt(state.position) === 45 && isWsOrEolOrEnd(state.input.charCodeAt(state.position + 1))) throwError(state, "bad indentation of a sequence entry");
    }
    addPopEvent(state);
    return true;
  }
  function readBlockMapping(state, nodeIndent, flowIndent, props) {
    let atExplicitKey = false;
    let detected = false;
    let mappingOpened = false;
    let pendingExplicitKey = false;
    if (state.firstTabInLine !== -1) return false;
    let ch = state.input.charCodeAt(state.position);
    while (ch !== 0) {
      if (!atExplicitKey && state.firstTabInLine !== -1) {
        state.position = state.firstTabInLine;
        throwError(state, "tab characters must not be used in indentation");
      }
      const following = state.input.charCodeAt(state.position + 1);
      const entryLine = state.line;
      if ((ch === 63 || ch === 58) && isWsOrEolOrEnd(following)) {
        if (!mappingOpened) {
          addMappingEvent(state, state.position, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, COLLECTION_STYLE.BLOCK);
          mappingOpened = true;
        }
        if (ch === 63) {
          if (atExplicitKey) addEmptyScalarEvent(state);
          detected = true;
          atExplicitKey = true;
        } else if (atExplicitKey) atExplicitKey = false;
        else {
          addEmptyScalarEvent(state);
          detected = true;
          atExplicitKey = false;
        }
        state.position += 1;
        pendingExplicitKey = true;
      } else {
        if (atExplicitKey) {
          addEmptyScalarEvent(state);
          atExplicitKey = false;
        }
        const beforeKey = snapshotState(state);
        if (!parseNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) break;
        if (state.line === entryLine) {
          ch = state.input.charCodeAt(state.position);
          while (isWhiteSpace(ch)) ch = state.input.charCodeAt(++state.position);
          if (ch === 58) {
            ch = state.input.charCodeAt(++state.position);
            if (!isWsOrEolOrEnd(ch)) throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
            if (!mappingOpened) {
              restoreState(state, beforeKey);
              addMappingEvent(state, beforeKey.position, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, COLLECTION_STYLE.BLOCK);
              mappingOpened = true;
              parseNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true);
              ch = state.input.charCodeAt(state.position);
              while (isWhiteSpace(ch)) ch = state.input.charCodeAt(++state.position);
              state.position++;
            }
            detected = true;
            atExplicitKey = false;
            pendingExplicitKey = false;
          } else if (detected) throwError(state, "expected ':' after a mapping key");
          else {
            if (props.anchorStart !== NO_RANGE$1 || props.tagStart !== NO_RANGE$1) {
              restoreState(state, beforeKey);
              return false;
            }
            return true;
          }
        } else if (detected) throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
        else {
          if (props.anchorStart !== NO_RANGE$1 || props.tagStart !== NO_RANGE$1) {
            restoreState(state, beforeKey);
            return false;
          }
          return true;
        }
      }
      if (parseNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, pendingExplicitKey)) pendingExplicitKey = false;
      if (!atExplicitKey) {
        if (pendingExplicitKey) {
          addEmptyScalarEvent(state);
          pendingExplicitKey = false;
        }
      }
      skipSeparationSpace(state, true);
      ch = state.input.charCodeAt(state.position);
      if ((state.line === entryLine || state.lineIndent > nodeIndent) && ch !== 0) throwError(state, "bad indentation of a mapping entry");
      else if (state.lineIndent < nodeIndent) break;
    }
    if (!detected) return false;
    if (atExplicitKey) addEmptyScalarEvent(state);
    if (mappingOpened) addPopEvent(state);
    return true;
  }
  function parseNode(state, parentIndent, nodeContext, allowToSeek, allowCompact, allowPropertyMapping = true) {
    if (state.depth >= state.maxDepth) throwError(state, `nesting exceeded maxDepth (${state.maxDepth})`);
    state.depth++;
    let indentStatus = 1;
    let atNewLine = false;
    let hasContent = false;
    let propertyStart = null;
    const props = emptyProperties();
    let allowBlockScalars = nodeContext === CONTEXT_BLOCK_OUT || nodeContext === CONTEXT_BLOCK_IN;
    let allowBlockCollections = allowBlockScalars;
    const allowBlockStyles = allowBlockScalars;
    if (allowToSeek && skipSeparationSpace(state, true)) {
      atNewLine = true;
      if (state.lineIndent > parentIndent) indentStatus = 1;
      else if (state.lineIndent === parentIndent) indentStatus = 0;
      else indentStatus = -1;
    }
    if (indentStatus === 1) while (true) {
      const ch = state.input.charCodeAt(state.position);
      const propertyState = snapshotState(state);
      if (atNewLine && indentStatus !== 1 && (ch === 33 || ch === 38)) break;
      if (atNewLine && allowBlockStyles && (props.tagStart !== NO_RANGE$1 || props.anchorStart !== NO_RANGE$1) && (ch === 33 || ch === 38)) {
        const fallbackState = snapshotState(state);
        const flowIndent = parentIndent + 1;
        if (readBlockMapping(state, state.position - state.lineStart, flowIndent, props) && state.events[fallbackState.eventsLength]?.type === EVENT_ID.MAPPING) {
          state.depth--;
          return true;
        }
        restoreState(state, fallbackState);
      }
      if (atNewLine && (ch === 33 && props.tagStart !== NO_RANGE$1 || ch === 38 && props.anchorStart !== NO_RANGE$1)) break;
      if (!readTagProperty(state, props, nodeContext === CONTEXT_FLOW_IN) && !readAnchorProperty(state, props)) break;
      if (propertyStart === null) propertyStart = propertyState;
      if (skipSeparationSpace(state, true)) {
        atNewLine = true;
        allowBlockCollections = allowBlockStyles;
        if (state.lineIndent > parentIndent) indentStatus = 1;
        else if (state.lineIndent === parentIndent) indentStatus = 0;
        else indentStatus = -1;
      } else allowBlockCollections = false;
    }
    if (allowBlockCollections) allowBlockCollections = atNewLine || allowCompact;
    if (indentStatus === 1 || nodeContext === CONTEXT_BLOCK_OUT) {
      const flowIndent = nodeContext === CONTEXT_FLOW_IN || nodeContext === CONTEXT_FLOW_OUT ? parentIndent : parentIndent + 1;
      const blockIndent = state.position - state.lineStart;
      if (indentStatus === 1) if (allowBlockCollections && (readBlockSequence(state, blockIndent, props) || readBlockMapping(state, blockIndent, flowIndent, props)) || readFlowCollection(state, flowIndent, props)) hasContent = true;
      else {
        const ch = state.input.charCodeAt(state.position);
        if (propertyStart !== null && allowPropertyMapping && allowBlockStyles && !allowBlockCollections && ch !== 124 && ch !== 62) {
          const fallbackState = snapshotState(state);
          const propertyIndent = propertyStart.position - propertyStart.lineStart;
          restoreState(state, propertyStart);
          if (readBlockMapping(state, propertyIndent, flowIndent, emptyProperties()) && state.events[fallbackState.eventsLength]?.type === EVENT_ID.MAPPING) hasContent = true;
          else restoreState(state, fallbackState);
        }
        if (!hasContent && (allowBlockScalars && readBlockScalar(state, flowIndent, props) || readSingleQuotedScalar(state, flowIndent, props) || readDoubleQuotedScalar(state, flowIndent, props) || readAlias(state, props) || readPlainScalar(state, flowIndent, nodeContext, props))) hasContent = true;
      }
      else if (indentStatus === 0) hasContent = allowBlockCollections && readBlockSequence(state, blockIndent, props);
    }
    allowBlockScalars = allowBlockScalars && !hasContent;
    if (!hasContent && (props.anchorStart !== NO_RANGE$1 || props.tagStart !== NO_RANGE$1 || allowBlockScalars)) {
      addScalarEvent(state, NO_RANGE$1, NO_RANGE$1, props.anchorStart, props.anchorEnd, props.tagStart, props.tagEnd, SCALAR_STYLE.PLAIN);
      hasContent = true;
    }
    state.depth--;
    return hasContent || props.anchorStart !== NO_RANGE$1 || props.tagStart !== NO_RANGE$1;
  }
  function readDirective(state) {
    if (state.lineIndent > 0 || state.input.charCodeAt(state.position) !== 37) return false;
    state.position++;
    const nameStart = state.position;
    while (state.input.charCodeAt(state.position) !== 0 && !isWsOrEol(state.input.charCodeAt(state.position))) state.position++;
    const name = state.input.slice(nameStart, state.position);
    const args = [];
    if (name.length === 0) throwError(state, "directive name must not be less than one character in length");
    while (state.input.charCodeAt(state.position) !== 0 && !isEol(state.input.charCodeAt(state.position))) {
      while (isWhiteSpace(state.input.charCodeAt(state.position))) state.position++;
      if (state.input.charCodeAt(state.position) === 35 || isEol(state.input.charCodeAt(state.position)) || state.input.charCodeAt(state.position) === 0) break;
      const start2 = state.position;
      while (state.input.charCodeAt(state.position) !== 0 && !isWsOrEol(state.input.charCodeAt(state.position))) state.position++;
      args.push(state.input.slice(start2, state.position));
    }
    if (isEol(state.input.charCodeAt(state.position))) consumeLineBreak(state);
    if (name === "YAML") {
      if (state.directives.some((directive) => directive.kind === "yaml")) throwError(state, "duplication of %YAML directive");
      if (args.length !== 1) throwError(state, "YAML directive accepts exactly one argument");
      const match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
      if (match === null) throwError(state, "ill-formed argument of the YAML directive");
      if (parseInt(match[1], 10) !== 1) throwError(state, "unacceptable YAML version of the document");
      state.directives.push({
        kind: "yaml",
        version: args[0]
      });
    } else if (name === "TAG") {
      if (args.length !== 2) throwError(state, "TAG directive accepts exactly two arguments");
      const [handle, prefix] = args;
      if (!PATTERN_TAG_HANDLE.test(handle)) throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
      if (HAS_OWN.call(state.tagHandlers, handle)) throwError(state, `there is a previously declared suffix for "${handle}" tag handle`);
      if (!PATTERN_TAG_PREFIX.test(prefix)) throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
      state.tagHandlers[handle] = prefix;
      state.directives.push({
        kind: "tag",
        handle,
        prefix
      });
    }
    return true;
  }
  function readDocument(state) {
    state.directives = [];
    state.tagHandlers = /* @__PURE__ */ Object.create(null);
    let hasDirectives = false;
    skipSeparationSpace(state, true);
    while (readDirective(state)) {
      hasDirectives = true;
      skipSeparationSpace(state, true);
    }
    let explicitStart = false;
    let explicitEnd = false;
    let allowCompact = true;
    if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45 && isWsOrEolOrEnd(state.input.charCodeAt(state.position + 3))) {
      explicitStart = true;
      const markerLine = state.line;
      state.position += 3;
      skipSeparationSpace(state, true);
      allowCompact = state.line > markerLine;
    } else if (hasDirectives) throwError(state, "directives end mark is expected");
    const documentEventIndex = state.events.length;
    if (!explicitStart && state.position === state.lineStart && state.input.charCodeAt(state.position) === 46 && testDocumentSeparator(state)) {
      state.position += 3;
      skipSeparationSpace(state, true);
      return;
    }
    addDocumentEvent(state, explicitStart, false);
    if (!parseNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, allowCompact, allowCompact)) addEmptyScalarEvent(state);
    skipSeparationSpace(state, true);
    if (state.position === state.lineStart && testDocumentSeparator(state)) {
      explicitEnd = state.input.charCodeAt(state.position) === 46;
      if (explicitEnd) {
        const markerLine = state.line;
        state.position += 3;
        skipSeparationSpace(state, true);
        if (state.line === markerLine && state.position < state.length) throwError(state, "end of the stream or a document separator is expected");
      }
    }
    const documentEvent = state.events[documentEventIndex];
    if (documentEvent?.type === EVENT_ID.DOCUMENT) documentEvent.explicitEnd = explicitEnd;
    addPopEvent(state);
    if (!explicitEnd && state.position < state.length && !testDocumentBoundary(state)) throwError(state, "end of the stream or a document separator is expected");
  }
  function parseEvents(input, options) {
    const length = input.length;
    const state = {
      ...DEFAULT_PARSER_OPTIONS,
      ...options,
      input: `${input}\0`,
      length,
      position: 0,
      line: 0,
      lineStart: 0,
      lineIndent: 0,
      firstTabInLine: -1,
      depth: 0,
      directives: [],
      tagHandlers: /* @__PURE__ */ Object.create(null),
      events: []
    };
    const nullpos = input.indexOf("\0");
    if (nullpos !== -1) YAMLException.throwAt(input, nullpos, "null byte is not allowed in input", state.filename);
    while (state.position < state.length) {
      skipByteOrderMark(state);
      skipSeparationSpace(state, true);
      if (state.position >= state.length) break;
      const documentStart = state.position;
      readDocument(state);
      if (state.position === documentStart)
        throwError(state, "can not read a document");
    }
    return state.events;
  }
  var DEFAULT_LOAD_OPTIONS = {
    ...DEFAULT_PARSER_OPTIONS,
    ...DEFAULT_CONSTRUCTOR_OPTIONS
  };
  function loadDocuments(input, options = {}) {
    const opts = {
      ...DEFAULT_LOAD_OPTIONS,
      ...options
    };
    const source = String(input);
    const PARSER_OPT_KEYS = Object.keys(DEFAULT_PARSER_OPTIONS);
    const CONSTRUCTOR_OPT_KEYS = Object.keys(DEFAULT_CONSTRUCTOR_OPTIONS);
    return constructFromEvents(parseEvents(source, pick(opts, PARSER_OPT_KEYS)), {
      ...pick(opts, CONSTRUCTOR_OPT_KEYS),
      source
    });
  }
  function load(input, options) {
    const documents = loadDocuments(input, options);
    if (documents.length === 0) throw new YAMLException("expected a document, but the input is empty");
    if (documents.length === 1) return documents[0];
    throw new YAMLException("expected a single document in the stream, but found more");
  }
  function hasBit(mask, bit) {
    return (mask & 1 << bit) !== 0;
  }
  var DEFAULT_SCALAR_STYLE_RULES = {
    applyQuoteFlowKeysOption,
    doubleQuoteForInvisibles,
    doubleQuoteWhitespaceOnly,
    applyForceQuotesOption,
    tryLongOrMultilineAsBlock,
    quoteInvalidPlain,
    fallbackToDoubleQuoted
  };
  function _preferredQuotedStyle(layout) {
    if (layout.presenterOptions.quoteStyle === "single" && hasBit(layout.allowedStylesMask, SCALAR_STYLE.SINGLE_QUOTED)) return SCALAR_STYLE.SINGLE_QUOTED;
    return SCALAR_STYLE.DOUBLE_QUOTED;
  }
  function applyQuoteFlowKeysOption(layout) {
    if (!layout.presenterOptions.quoteFlowKeys) return;
    if (!layout.isKey || !layout.flowOnly || layout.style !== SCALAR_STYLE.PLAIN) return;
    layout.style = SCALAR_STYLE.DOUBLE_QUOTED;
  }
  function doubleQuoteForInvisibles(layout) {
    if (layout.style === SCALAR_STYLE.PLAIN && /[\t\x7F-\xA0\u2028\u2029\uFEFF\uFFFE\uFFFF]/.test(layout.node.value)) layout.style = SCALAR_STYLE.DOUBLE_QUOTED;
  }
  function doubleQuoteWhitespaceOnly(layout) {
    if (layout.style === SCALAR_STYLE.PLAIN && /^\s+$/.test(layout.node.value)) layout.style = SCALAR_STYLE.DOUBLE_QUOTED;
  }
  function applyForceQuotesOption(layout) {
    if (!layout.presenterOptions.forceQuotes) return;
    if (layout.isKey || layout.style !== SCALAR_STYLE.PLAIN) return;
    if (layout.node.tag !== layout.presenterOptions.schema.defaultScalarTag.tagName) return;
    layout.style = layout.node.value.includes("\n") ? SCALAR_STYLE.DOUBLE_QUOTED : _preferredQuotedStyle(layout);
  }
  function tryLongOrMultilineAsBlock(layout) {
    if (layout.style !== SCALAR_STYLE.PLAIN || layout.isKey) return;
    const value = layout.node.value;
    const multiline = value.indexOf("\n") !== -1;
    if (!hasBit(layout.allowedStylesMask, SCALAR_STYLE.LITERAL_BLOCK)) {
      if (multiline) layout.style = SCALAR_STYLE.DOUBLE_QUOTED;
      return;
    }
    const w = layout.presenterOptions.lineWidth;
    if (w === -1) {
      if (multiline) layout.style = SCALAR_STYLE.LITERAL_BLOCK;
      return;
    }
    const availableWidth = Math.max(Math.min(w, 40), w - layout.shiftOfContent);
    let position = 0;
    let shouldFold = false;
    while (position <= value.length) {
      let lineEnd = value.length;
      const nextLineBreak = value.indexOf("\n", position);
      if (nextLineBreak !== -1) lineEnd = nextLineBreak;
      const line = value.slice(position, lineEnd);
      if (line.length > availableWidth && line[0] !== " " && / [^ \t]/.test(line)) shouldFold = true;
      if (nextLineBreak === -1) break;
      position = nextLineBreak + 1;
    }
    if (shouldFold) layout.style = SCALAR_STYLE.FOLDED_BLOCK;
    else if (multiline) layout.style = SCALAR_STYLE.LITERAL_BLOCK;
  }
  function quoteInvalidPlain(layout) {
    if (layout.style === SCALAR_STYLE.PLAIN && !hasBit(layout.allowedStylesMask, SCALAR_STYLE.PLAIN)) layout.style = _preferredQuotedStyle(layout);
  }
  function fallbackToDoubleQuoted(layout) {
    if (!hasBit(layout.allowedStylesMask, layout.style)) layout.style = SCALAR_STYLE.DOUBLE_QUOTED;
  }
  var SRC_C_PRINTABLE = "[\\x09\\x0A\\x0D\\x20-\\x7E\\x85\\xA0-\\uD7FF\\uE000-\\uFFFD\\u{10000}-\\u{10FFFF}]";
  var SRC_B_CHAR = "[\\n\\r]";
  var SRC_C_BYTE_ORDER_MARK = "\\uFEFF";
  var SRC_S_WHITE = "[ \\t]";
  var SRC_NB_CHAR = `(?:(?!(?:${SRC_B_CHAR}|${SRC_C_BYTE_ORDER_MARK}))${SRC_C_PRINTABLE})`;
  var SRC_NS_CHAR = `(?:(?!${SRC_S_WHITE})${SRC_NB_CHAR})`;
  var SRC_NB_JSON = "[\\x09\\x20-\\uD7FF\\uE000-\\uFFFF\\u{10000}-\\u{10FFFF}]";
  var SRC_C_INDICATOR = "[-?:,\\[\\]{}#&*!|>'\"%@`]";
  var SRC_C_FLOW_INDICATOR = "[,\\[\\]{}]";
  var SRC_NS_PLAIN_SAFE_FLOW_OUT = SRC_NS_CHAR;
  var SRC_NS_PLAIN_SAFE_FLOW_IN = `(?:(?!${SRC_C_FLOW_INDICATOR})${SRC_NS_CHAR})`;
  var SRC_NS_PLAIN_FIRST_FLOW_OUT = `(?:(?:(?!${SRC_C_INDICATOR})${SRC_NS_CHAR})|[?:-](?=${SRC_NS_PLAIN_SAFE_FLOW_OUT}))`;
  var SRC_NS_PLAIN_FIRST_FLOW_IN = `(?:(?:(?!${SRC_C_INDICATOR})${SRC_NS_CHAR})|[?:-](?=${SRC_NS_PLAIN_SAFE_FLOW_IN}))`;
  var SRC_NS_PLAIN_CHAR_FLOW_OUT = `(?:(?:(?![:#])${SRC_NS_PLAIN_SAFE_FLOW_OUT})|:(?=${SRC_NS_PLAIN_SAFE_FLOW_OUT}))#*`;
  var SRC_NS_PLAIN_CHAR_FLOW_IN = `(?:(?:(?![:#])${SRC_NS_PLAIN_SAFE_FLOW_IN})|:(?=${SRC_NS_PLAIN_SAFE_FLOW_IN}))#*`;
  var SRC_NB_NS_PLAIN_IN_LINE_FLOW_OUT = `(?:${SRC_S_WHITE}*${SRC_NS_PLAIN_CHAR_FLOW_OUT})*`;
  var SRC_NB_NS_PLAIN_IN_LINE_FLOW_IN = `(?:${SRC_S_WHITE}*${SRC_NS_PLAIN_CHAR_FLOW_IN})*`;
  var SRC_NS_PLAIN_ONE_LINE_FLOW_OUT = `${SRC_NS_PLAIN_FIRST_FLOW_OUT}#*${SRC_NB_NS_PLAIN_IN_LINE_FLOW_OUT}`;
  var SRC_NS_PLAIN_ONE_LINE_FLOW_IN = `${SRC_NS_PLAIN_FIRST_FLOW_IN}#*${SRC_NB_NS_PLAIN_IN_LINE_FLOW_IN}`;
  var SRC_NS_PLAIN_ONE_LINE_BLOCK_KEY = SRC_NS_PLAIN_ONE_LINE_FLOW_OUT;
  var SRC_NS_PLAIN_ONE_LINE_FLOW_KEY = SRC_NS_PLAIN_ONE_LINE_FLOW_IN;
  var SRC_S_NS_PLAIN_NEXT_LINE_FLOW_OUT = `\\n+${SRC_NS_PLAIN_CHAR_FLOW_OUT}${SRC_NB_NS_PLAIN_IN_LINE_FLOW_OUT}`;
  var SRC_S_NS_PLAIN_NEXT_LINE_FLOW_IN = `\\n+${SRC_NS_PLAIN_CHAR_FLOW_IN}${SRC_NB_NS_PLAIN_IN_LINE_FLOW_IN}`;
  var SRC_NS_PLAIN_MULTI_LINE_FLOW_OUT = `${SRC_NS_PLAIN_ONE_LINE_FLOW_OUT}(?:${SRC_S_NS_PLAIN_NEXT_LINE_FLOW_OUT})*`;
  var SRC_NS_PLAIN_MULTI_LINE_FLOW_IN = `${SRC_NS_PLAIN_ONE_LINE_FLOW_IN}(?:${SRC_S_NS_PLAIN_NEXT_LINE_FLOW_IN})*`;
  var NS_PLAIN_FLOW_OUT = new RegExp(`^(?:${SRC_NS_PLAIN_MULTI_LINE_FLOW_OUT})$`, "u");
  var NS_PLAIN_FLOW_IN = new RegExp(`^(?:${SRC_NS_PLAIN_MULTI_LINE_FLOW_IN})$`, "u");
  var NS_PLAIN_BLOCK_KEY = new RegExp(`^(?:${SRC_NS_PLAIN_ONE_LINE_BLOCK_KEY})$`, "u");
  var NS_PLAIN_FLOW_KEY = new RegExp(`^(?:${SRC_NS_PLAIN_ONE_LINE_FLOW_KEY})$`, "u");
  var NB_SINGLE_ONE_LINE = new RegExp(`^(?:${SRC_NB_JSON})*$`, "u");
  var NB_SINGLE_MULTI_LINE = new RegExp(`^(?:${SRC_NB_JSON}|\\n)*$`, "u");
  var BLOCK_SCALAR_CONTENT = new RegExp(`^(?:${SRC_NB_CHAR}|\\n)*$`, "u");
  var DEFAULT_PRESENTER_OPTIONS = {
    indent: 2,
    seqNoIndent: false,
    seqInlineFirst: true,
    lineWidth: 80,
    flowBracketPadding: false,
    flowSkipCommaSpace: false,
    flowSkipColonSpace: false,
    quoteFlowKeys: false,
    quoteStyle: "single",
    forceQuotes: false,
    scalarStyleRules: Object.keys(DEFAULT_SCALAR_STYLE_RULES).map((name) => Reflect.get(DEFAULT_SCALAR_STYLE_RULES, name)),
    tagBeforeAnchor: false
  };
  var DEFAULT_DUMP_OPTIONS = {
    ...DEFAULT_PRESENTER_OPTIONS,
    schema: DUMP_SCHEMA,
    skipInvalid: false,
    noRefs: false,
    flowLevel: -1,
    sortKeys: false,
    transform: () => {
    }
  };
  var EVENT_DOCUMENT = EVENT_ID.DOCUMENT;
  var EVENT_SEQUENCE = EVENT_ID.SEQUENCE;
  var EVENT_MAPPING = EVENT_ID.MAPPING;
  var EVENT_SCALAR = EVENT_ID.SCALAR;
  var EVENT_ALIAS = EVENT_ID.ALIAS;
  var EVENT_POP = EVENT_ID.POP;
  var SCALAR_STYLE_PLAIN = SCALAR_STYLE.PLAIN;
  var SCALAR_STYLE_SINGLE_QUOTED = SCALAR_STYLE.SINGLE_QUOTED;
  var SCALAR_STYLE_DOUBLE_QUOTED = SCALAR_STYLE.DOUBLE_QUOTED;
  var SCALAR_STYLE_LITERAL_BLOCK = SCALAR_STYLE.LITERAL_BLOCK;
  var SCALAR_STYLE_FOLDED_BLOCK = SCALAR_STYLE.FOLDED_BLOCK;
  var COLLECTION_STYLE_BLOCK = COLLECTION_STYLE.BLOCK;
  var COLLECTION_STYLE_FLOW = COLLECTION_STYLE.FLOW;
  var CHOMPING_CLIP = CHOMPING_MODE.CLIP;
  var CHOMPING_STRIP = CHOMPING_MODE.STRIP;
  var CHOMPING_KEEP = CHOMPING_MODE.KEEP;

  // src/model/plugins.ts
  var DOCS = "https://github.com/kubernetes-sigs/descheduler#";
  var NAMESPACES = {
    kind: "namespaces",
    path: "namespaces",
    label: "Namespaces",
    help: "Include only these, or exclude these. One list or the other, never both."
  };
  var LABEL_SELECTOR = {
    kind: "labels",
    path: "labelSelector.matchLabels",
    label: "Pod labels",
    help: "Only pods carrying these labels. Written as key=value, comma separated.",
    placeholder: "app=web,tier=frontend"
  };
  var POD_STATES = [
    "Running",
    "Pending",
    "Succeeded",
    "Failed",
    "Unknown",
    "NodeAffinity",
    "NodeLost",
    "Shutdown",
    "UnexpectedAdmissionError",
    "PodInitializing",
    "ContainerCreating",
    "ImagePullBackOff",
    "CrashLoopBackOff",
    "CreateContainerConfigError",
    "ErrImagePull",
    "CreateContainerError",
    "InvalidImageName",
    "OOMKilled",
    "Error",
    "Completed",
    "DeadlineExceeded",
    "Evicted",
    "ContainerCannotRun",
    "StartError"
  ];
  var OWNER_KINDS = ["ReplicaSet", "StatefulSet", "DaemonSet", "Job", "CronJob", "ReplicationController"];
  var PLUGINS = [
    {
      name: "LowNodeUtilization",
      point: "balance",
      title: "Spread off busy nodes",
      summary: "Evicts pods from nodes that are more loaded than the target thresholds, so the scheduler can place them on nodes below the low thresholds. Utilisation is counted from pod requests unless a metrics source is named.",
      caution: "It needs somewhere to put them: with no node under every low threshold, it evicts nothing. Do not run it together with Pack onto fewer nodes.",
      docs: `${DOCS}lownodeutilization`,
      fields: [
        {
          kind: "thresholds",
          path: "thresholds",
          label: "Under-used below",
          help: "A node under every one of these is a candidate to receive pods."
        },
        {
          kind: "thresholds",
          path: "targetThresholds",
          label: "Over-used above",
          help: "A node over any one of these has pods evicted from it, until it is back under."
        },
        {
          kind: "bool",
          path: "useDeviationThresholds",
          label: "Thresholds are deviations from the average",
          help: "Read the numbers as percentage points below and above the cluster average rather than as absolute utilisation."
        },
        {
          kind: "number",
          path: "numberOfNodes",
          label: "Only act above this many under-used nodes",
          help: "Nothing is evicted until at least this many nodes are under-used. 0 means act whenever there is one.",
          min: 0
        },
        {
          kind: "number",
          path: "evictionLimits.node",
          label: "At most this many evictions per node",
          help: "A ceiling for one pass over one node. Leave empty for no limit.",
          min: 0
        },
        {
          kind: "select",
          path: "metricsUtilization.source",
          label: "Measure with",
          help: "Requests are used when this is empty. KubernetesMetrics reads the metrics server; Prometheus reads the query below.",
          options: ["KubernetesMetrics", "Prometheus"]
        },
        {
          kind: "text",
          path: "metricsUtilization.prometheus.query",
          label: "Prometheus query",
          help: "Returns one value per node, labelled by instance. Only read when the source is Prometheus.",
          placeholder: "instance:node_cpu:rate:sum"
        },
        {
          kind: "namespaces",
          path: "evictableNamespaces",
          label: "Evictable namespaces",
          help: "Usually an exclude list: namespaces whose pods are counted but never moved."
        }
      ]
    },
    {
      name: "HighNodeUtilization",
      point: "balance",
      title: "Pack onto fewer nodes",
      summary: "The other direction: evicts everything off nodes that are barely used, so the scheduler can consolidate them and the empty nodes can go away.",
      caution: "Only useful with the scheduler scoring MostAllocated or RequestedToCapacityRatio, otherwise the pods come straight back. Never together with Spread off busy nodes.",
      docs: `${DOCS}highnodeutilization`,
      fields: [
        {
          kind: "thresholds",
          path: "thresholds",
          label: "Under-used below",
          help: "Nodes under every one of these are drained onto fuller nodes."
        },
        {
          kind: "number",
          path: "numberOfNodes",
          label: "Only act above this many under-used nodes",
          help: "Nothing is evicted until at least this many nodes are under-used.",
          min: 0
        },
        {
          kind: "choice",
          path: "evictionModes",
          label: "Eviction mode",
          help: "OnlyThresholdingResources evicts only pods that actually request one of the resources above.",
          options: ["OnlyThresholdingResources"]
        },
        {
          kind: "namespaces",
          path: "evictableNamespaces",
          label: "Evictable namespaces",
          help: "Usually an exclude list: namespaces whose pods are counted but never moved."
        }
      ]
    },
    {
      name: "RemoveDuplicates",
      point: "balance",
      title: "Spread copies of the same workload",
      summary: "Evicts a pod when another pod of the same ReplicaSet, ReplicationController, StatefulSet or Job is already running on that node — which is what you are left with after a node comes back from an outage.",
      docs: `${DOCS}removeduplicates`,
      fields: [
        NAMESPACES,
        {
          kind: "list",
          path: "excludeOwnerKinds",
          label: "Leave these owners alone",
          help: "Pods owned by one of these kinds are never treated as duplicates. Add ReplicaSet to exclude everything created by a Deployment.",
          suggest: OWNER_KINDS
        }
      ]
    },
    {
      name: "RemovePodsViolatingTopologySpreadConstraint",
      point: "balance",
      title: "Honour topology spread constraints",
      summary: "Evicts pods so that topologySpreadConstraints the scheduler could not satisfy at placement time are satisfied now — the zones and nodes filled up in the wrong order.",
      docs: `${DOCS}removepodsviolatingtopologyspreadconstraint`,
      fields: [
        NAMESPACES,
        LABEL_SELECTOR,
        {
          kind: "choice",
          path: "constraints",
          label: "Which constraints to act on",
          help: "By default only DoNotSchedule ones. Adding ScheduleAnyway acts on soft constraints too.",
          options: ["DoNotSchedule", "ScheduleAnyway"]
        },
        {
          kind: "bool",
          path: "topologyBalanceNodeFit",
          label: "Only evict when another node fits",
          help: "On by default. Turn it off and it evicts even when nothing else can take the pod."
        }
      ]
    },
    {
      name: "RemovePodsViolatingNodeTaints",
      point: "deschedule",
      title: "Evict pods that no longer tolerate their node",
      summary: "A taint added after a pod was placed does not move it. This evicts pods whose tolerations no longer cover the taints on the node they are running on.",
      docs: `${DOCS}removepodsviolatingnodetaints`,
      fields: [
        NAMESPACES,
        LABEL_SELECTOR,
        {
          kind: "bool",
          path: "includePreferNoSchedule",
          label: "Count PreferNoSchedule taints too",
          help: "Off by default: only NoSchedule and NoExecute taints are considered."
        },
        {
          kind: "list",
          path: "excludedTaints",
          label: "Ignore these taints",
          help: "A key, or key=value. Taints listed here never cause an eviction.",
          suggest: ["node.kubernetes.io/unreachable", "node.kubernetes.io/not-ready"]
        },
        {
          kind: "list",
          path: "includedTaints",
          label: "Only these taints",
          help: "A key, or key=value. Given, only these taints cause evictions."
        }
      ]
    },
    {
      name: "RemovePodsViolatingNodeAffinity",
      point: "deschedule",
      title: "Evict pods whose node affinity stopped holding",
      summary: "Evicts a pod when the node it is on no longer satisfies its nodeAffinity — because the node was relabelled, or because a preferred affinity can now be met somewhere better.",
      docs: `${DOCS}removepodsviolatingnodeaffinity`,
      fields: [
        NAMESPACES,
        LABEL_SELECTOR,
        {
          kind: "choice",
          path: "nodeAffinityType",
          label: "Which affinity to check",
          help: "Required by itself is the usual setting. This argument has no default: with nothing chosen the plugin does nothing.",
          options: [
            "requiredDuringSchedulingIgnoredDuringExecution",
            "preferredDuringSchedulingIgnoredDuringExecution",
            "requiredDuringSchedulingRequiredDuringExecution"
          ]
        }
      ]
    },
    {
      name: "RemovePodsViolatingInterPodAntiAffinity",
      point: "deschedule",
      title: "Break up pods that should not be neighbours",
      summary: "Evicts pods that violate another pod’s anti-affinity — two pods on one node that were never meant to share it, usually because the rule was added after both were placed.",
      docs: `${DOCS}removepodsviolatinginterpodantiaffinity`,
      fields: [NAMESPACES, LABEL_SELECTOR]
    },
    {
      name: "RemovePodsHavingTooManyRestarts",
      point: "deschedule",
      title: "Move pods that keep restarting",
      summary: "A pod restarting on one node may be the node’s fault. Past the restart threshold, this evicts it so it is scheduled somewhere else.",
      docs: `${DOCS}removepodshavingtoomanyrestarts`,
      fields: [
        {
          kind: "number",
          path: "podRestartThreshold",
          label: "Restarts before evicting",
          help: "Summed across the pod’s containers.",
          min: 1,
          placeholder: "100"
        },
        {
          kind: "bool",
          path: "includingInitContainers",
          label: "Count init container restarts",
          help: "Add init containers’ restarts into the total."
        },
        {
          kind: "choice",
          path: "states",
          label: "Only pods in these states",
          help: "Left empty, a pod in any state counts. These two are all this plugin accepts.",
          options: ["Running", "CrashLoopBackOff"]
        },
        NAMESPACES,
        LABEL_SELECTOR
      ]
    },
    {
      name: "RemoveFailedPods",
      point: "deschedule",
      title: "Clear out failed pods",
      summary: "Deletes pods that have ended up in Failed, optionally only those that failed for particular reasons — the tidying job that otherwise falls to a cron script.",
      docs: `${DOCS}removefailedpods`,
      fields: [
        {
          kind: "number",
          path: "minPodLifetimeSeconds",
          label: "Only pods older than",
          help: "Leaves a just-failed pod alone long enough for somebody to look at it.",
          min: 0,
          unit: "seconds",
          placeholder: "3600"
        },
        {
          kind: "list",
          path: "reasons",
          label: "Only these failure reasons",
          help: "The pod’s status reason, or a container’s waiting reason.",
          suggest: ["NodeAffinity", "Shutdown", "UnexpectedAdmissionError", "Evicted", "OutOfcpu", "OutOfmemory"]
        },
        {
          kind: "list",
          path: "exitCodes",
          label: "Only these exit codes",
          help: "A container’s terminated exit code.",
          numeric: true,
          suggest: ["1", "137", "143"]
        },
        {
          kind: "bool",
          path: "includingInitContainers",
          label: "Look at init containers too",
          help: "Match reasons and exit codes from init containers as well."
        },
        {
          kind: "list",
          path: "excludeOwnerKinds",
          label: "Leave these owners alone",
          help: "Pods owned by one of these kinds are never removed. Jobs are the common one to keep.",
          suggest: OWNER_KINDS
        },
        NAMESPACES,
        LABEL_SELECTOR
      ]
    },
    {
      name: "PodLifeTime",
      point: "deschedule",
      title: "Evict pods past an age",
      summary: "Evicts pods older than a given age, oldest first — for workloads that ought to be recycled, and for clearing pods stuck in a state that will not resolve.",
      caution: "On a Deployment with no other filter this restarts everything you run, on a rolling basis. Set the namespaces or labels first.",
      docs: `${DOCS}podlifetime`,
      fields: [
        {
          kind: "number",
          path: "maxPodLifeTimeSeconds",
          label: "Evict when older than",
          help: "86400 is a day. Pods are taken oldest first.",
          min: 0,
          unit: "seconds",
          placeholder: "86400"
        },
        {
          kind: "choice",
          path: "states",
          label: "Only pods in these states",
          help: "A pod phase, a pod status reason, or a container’s waiting or terminated reason.",
          options: POD_STATES
        },
        {
          kind: "list",
          path: "ownerKinds.include",
          label: "Only these owners",
          help: "Only pods owned by one of these kinds.",
          suggest: OWNER_KINDS
        },
        {
          kind: "list",
          path: "ownerKinds.exclude",
          label: "Leave these owners alone",
          help: "Never pods owned by one of these kinds.",
          suggest: OWNER_KINDS
        },
        {
          kind: "list",
          path: "exitCodes",
          label: "Only these exit codes",
          help: "A container’s terminated exit code.",
          numeric: true
        },
        {
          kind: "bool",
          path: "includingInitContainers",
          label: "Look at init containers too",
          help: "Match states and exit codes from init containers as well."
        },
        {
          kind: "bool",
          path: "includingEphemeralContainers",
          label: "Look at ephemeral containers too",
          help: "Match states and exit codes from debug containers as well."
        },
        NAMESPACES,
        LABEL_SELECTOR
      ]
    }
  ];
  var GLOBAL_FIELDS = [
    {
      kind: "text",
      path: "nodeSelector",
      label: "Only these nodes",
      help: "Restricts the whole run to nodes with these labels. key=value, comma separated.",
      placeholder: "node-role.kubernetes.io/worker="
    },
    {
      kind: "number",
      path: "maxNoOfPodsToEvictPerNode",
      label: "At most, per node",
      help: "A ceiling on one pass. Leave empty for no limit.",
      min: 0
    },
    {
      kind: "number",
      path: "maxNoOfPodsToEvictPerNamespace",
      label: "At most, per namespace",
      help: "A ceiling on one pass. Leave empty for no limit.",
      min: 0
    },
    {
      kind: "number",
      path: "maxNoOfPodsToEvictTotal",
      label: "At most, in total",
      help: "A ceiling on one pass over the whole cluster. The safest dial there is.",
      min: 0
    },
    {
      kind: "number",
      path: "gracePeriodSeconds",
      label: "Grace period",
      help: "Given to each evicted pod. Empty uses each pod’s own.",
      min: 0,
      unit: "seconds"
    },
    {
      kind: "bool",
      path: "evictionFailureEventNotification",
      label: "Record an event when an eviction fails",
      help: "Turn this on and refused evictions appear in Activity beside the successful ones. Off by default."
    }
  ];
  function pluginByName(name) {
    return PLUGINS.find((plugin) => plugin.name === name);
  }

  // src/model/policy.ts
  var KIND = "DeschedulerPolicy";
  function parsePolicy(text) {
    if (!text.trim()) return { doc: null, error: "the key is empty" };
    let value;
    try {
      value = load(text);
    } catch (err) {
      return { doc: null, error: err instanceof Error ? err.message : String(err) };
    }
    if (!isRecord(value)) return { doc: null, error: "the file is not a YAML mapping" };
    if (value["kind"] !== void 0 && value["kind"] !== KIND) {
      return { doc: null, error: `this is a ${String(value["kind"])}, not a ${KIND}` };
    }
    return { doc: value, error: "" };
  }
  function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  function profiles(doc) {
    const list = doc["profiles"];
    return Array.isArray(list) ? list.filter(isRecord) : [];
  }
  function profileNames(doc) {
    return profiles(doc).map((profile, index) => String(profile["name"] ?? `profile ${index + 1}`));
  }
  function pluginSet(profile, point, create) {
    let plugins = profile["plugins"];
    if (!isRecord(plugins)) {
      if (!create) return null;
      plugins = {};
      profile["plugins"] = plugins;
    }
    const holder = plugins;
    let set = holder[point];
    if (!isRecord(set)) {
      if (!create) return null;
      set = {};
      holder[point] = set;
    }
    return set;
  }
  function names(set, key) {
    const list = set?.[key];
    return Array.isArray(list) ? list.map(String) : [];
  }
  function enabledAt(profile, point) {
    return names(pluginSet(profile, point, false), "enabled");
  }
  function enabledPlugins(profile) {
    return [...enabledAt(profile, "balance"), ...enabledAt(profile, "deschedule")];
  }
  function configs(profile, create) {
    const list = profile["pluginConfig"];
    if (Array.isArray(list)) return list;
    if (!create) return null;
    const made = [];
    profile["pluginConfig"] = made;
    return made;
  }
  function argsOf(profile, name) {
    const entry = (configs(profile, false) ?? []).filter(isRecord).find((config) => String(config["name"] ?? "") === name);
    const args = entry?.["args"];
    return isRecord(args) ? args : {};
  }
  function getPath(root, path) {
    let here = root;
    for (const step of path.split(".")) {
      if (!isRecord(here)) return void 0;
      here = here[step];
    }
    return here;
  }

  // src/ui/policyfile.ts
  async function readPolicy(install) {
    const namespace = install?.policy?.namespace ?? "";
    const configMaps = await k8sdockside.list({ kind: "configmaps", namespace });
    const candidates = policyConfigMaps(configMaps, install);
    const configMap = candidates[0] ?? null;
    if (!configMap) {
      return {
        configMap: null,
        key: install?.policy?.key ?? "policy.yaml",
        text: "",
        doc: null,
        error: install?.policy ? `${install.policy.namespace}/${install.policy.configMap} is not in the cluster` : "no ConfigMap here holds a DeschedulerPolicy",
        guessed: !install?.policy
      };
    }
    const guessed = !install?.policy || install.policy.configMap !== configMap.metadata.name || install.policy.namespace !== configMap.metadata.namespace;
    const keys = Object.keys(configMap.data ?? {});
    const key = !guessed && install?.policy?.key && keys.includes(install.policy.key) ? install.policy.key : keys.find((name) => name.endsWith(".yaml") && (configMap.data?.[name] ?? "").includes("DeschedulerPolicy")) ?? keys[0] ?? "policy.yaml";
    const text = configMap.data?.[key] ?? "";
    const parsed = parsePolicy(text);
    return { configMap, key, text, doc: parsed.doc, error: parsed.error, guessed };
  }

  // src/model/activity.ts
  var RECORDER = "sigs.k8s.io.descheduler";
  var MARK = "sigs.k8s.io/descheduler";
  var SENTENCE = /pod eviction from (.+?) node by sigs\.k8s\.io\/descheduler(?:\s+failed:\s*([\s\S]*))?$/;
  function timeOf(event) {
    return event.lastTimestamp || event.eventTime || event.firstTimestamp || event.metadata.creationTimestamp || "";
  }
  function fromDescheduler(event) {
    if (event.reportingComponent === RECORDER) return true;
    if (event.source?.component === RECORDER) return true;
    if (event.action === "Descheduled") return true;
    return (event.message ?? event.note ?? "").includes(MARK);
  }
  function evictions(events) {
    const out = [];
    for (const event of events) {
      if (!fromDescheduler(event)) continue;
      const message = event.message ?? event.note ?? "";
      const target = event.involvedObject ?? event.regarding ?? {};
      const parsed = SENTENCE.exec(message);
      const refused = event.type === "Warning" || event.reason === "EvictionFailed" || Boolean(parsed?.[2]);
      const when = timeOf(event);
      const at = Date.parse(when);
      out.push({
        id: event.metadata.uid || `${event.metadata.namespace ?? ""}/${event.metadata.name}`,
        when,
        at: Number.isNaN(at) ? 0 : at,
        namespace: target.namespace ?? event.metadata.namespace ?? "",
        pod: target.name ?? "",
        node: parsed?.[1]?.trim() ?? "",
        strategy: event.reason && event.reason !== "EvictionFailed" ? event.reason : "",
        result: refused ? "refused" : "evicted",
        refusal: (parsed?.[2] ?? "").trim(),
        message,
        count: event.count ?? 1
      });
    }
    return out.sort((a, b) => b.at - a.at);
  }
  function since2(list, minutes, now = Date.now()) {
    const floor = now - minutes * 6e4;
    return list.filter((item) => item.at >= floor);
  }
  function totals(list) {
    const pods2 = /* @__PURE__ */ new Set();
    const nodes = /* @__PURE__ */ new Set();
    const strategies = /* @__PURE__ */ new Set();
    let evicted = 0;
    let refused = 0;
    for (const item of list) {
      if (item.result === "evicted") evicted += item.count;
      else refused += item.count;
      pods2.add(`${item.namespace}/${item.pod}`);
      if (item.node) nodes.add(item.node);
      if (item.strategy) strategies.add(item.strategy);
    }
    return { evicted, refused, pods: pods2.size, nodes: nodes.size, strategies: strategies.size };
  }
  function tally(list, pick2, unknown = "(no plugin named)") {
    const counts = /* @__PURE__ */ new Map();
    for (const item of list) {
      const key = pick2(item) || unknown;
      const row = counts.get(key) ?? { key, evicted: 0, refused: 0, total: 0 };
      if (item.result === "evicted") row.evicted += item.count;
      else row.refused += item.count;
      row.total += item.count;
      counts.set(key, row);
    }
    return [...counts.values()].sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
  }
  function buckets(list, minutes, count, now = Date.now()) {
    const span = minutes * 6e4 / count;
    const first = Math.floor((now - minutes * 6e4) / span) * span;
    const out = [];
    for (let i = 0; i < count; i++) out.push({ start: first + i * span, evicted: 0, refused: 0 });
    for (const item of list) {
      const index = Math.floor((item.at - first) / span);
      const bucket = out[index];
      if (!bucket) continue;
      if (item.result === "evicted") bucket.evicted += item.count;
      else bucket.refused += item.count;
    }
    return out;
  }

  // src/pages/overview.ts
  var WINDOW_MINUTES = 24 * 60;
  start("page", async () => {
    const [found, events] = await Promise.all([
      findDescheduler(),
      listOrNone({ kind: "events", namespace: "" })
    ]);
    const install = found.install;
    const all = evictions(events);
    const recent = since2(all, WINDOW_MINUTES);
    const counts = totals(recent);
    const policy = await readPolicy(install);
    const pods2 = install ? ownPods(await pods(install.namespace), install) : [];
    const jobs = install?.mode === "cronjob" ? ownJobs(await listOrNone({ kind: "jobs", namespace: install.namespace }), install) : [];
    byId("lead").textContent = install ? `${install.namespace}/${install.name} runs ${cadence(install)}. Everything below is read from the cluster: its workload, the policy it mounts, and the events it leaves on the pods it evicts.` : "The descheduler evicts running pods so the scheduler can place them again somewhere better. Nothing in this cluster runs it yet.";
    replace(byId("verdict"), verdictBanner(verdict(found.installs, pods2, counts.refused)));
    replace(
      byId("stats"),
      stat("Evicted, 24h", String(counts.evicted), counts.evicted ? "ok" : ""),
      stat("Refused, 24h", String(counts.refused), counts.refused ? "error" : ""),
      stat("Nodes touched", String(counts.nodes)),
      stat("Plugins that fired", String(counts.strategies)),
      stat("Runs", install ? cadence(install) : "—"),
      stat("Version", install?.version || "—")
    );
    const blocks = byId("blocks");
    replace(blocks);
    blocks.append(
      block(
        "The last day",
        "Every eviction the descheduler recorded, by the hour. Refusals are stacked on top in red — an eviction a PodDisruptionBudget turned down is the one worth reading.",
        timeline(buckets(recent, WINDOW_MINUTES, 48)),
        // Upstream gates every EvictionFailed event on this one field, so a
        // window with no refusals in it may mean nothing was refused -- or
        // that nothing is recorded when something is.
        policy.doc && getPath(policy.doc, "evictionFailureEventNotification") !== true ? el(
          "p",
          { class: "faint", style: "margin:6px 0 0" },
          "Refused evictions are not recorded in this cluster: the policy leaves evictionFailureEventNotification off, so only successful evictions appear here. ",
          button("Turn it on in Policy", () => void k8sdockside.openView("policy"), { class: "link" })
        ) : null,
        el(
          "div",
          { class: "columns" },
          el("div", {}, el("h3", {}, "By plugin"), bars(tally(recent, (item) => item.strategy))),
          el("div", {}, el("h3", {}, "By namespace"), bars(tally(recent, (item) => item.namespace))),
          el("div", {}, el("h3", {}, "By node"), bars(tally(recent, (item) => item.node)))
        ),
        el(
          "div",
          { class: "bar", style: "margin:10px 0 0" },
          button("Open Activity", () => void k8sdockside.openView("activity"), { class: "primary" }),
          el("span", { class: "faint" }, `${all.length} descheduler events are in the cluster's event history.`)
        )
      )
    );
    if (recent.length) {
      blocks.append(block("Most recent", "", evictionTable(recent.slice(0, 8))));
    }
    if (install) {
      const kind = install.mode === "cronjob" ? "cronjobs" : "deployments";
      const rows = [
        ["Runs as", el("span", {}, install.mode === "cronjob" ? "a CronJob, " : "a Deployment, ", cadence(install))],
        ["Workload", objectLink(kind, install.namespace, install.name, `${install.namespace}/${install.name}`)],
        ["Image", install.image || "—"],
        ["Dry run", install.dryRun ? el("span", { class: "tone-warn" }, "yes — it evicts nothing") : "no"]
      ];
      if (install.mode === "cronjob") {
        rows.push(["Schedule", install.schedule || "—"]);
        rows.push(["Last run", install.lastSchedule ? `${since(install.lastSchedule)} ago` : "never"]);
        rows.push(["Last success", install.lastSuccess ? `${since(install.lastSuccess)} ago` : "never"]);
        if (install.suspended) rows.push(["Suspended", el("span", { class: "tone-warn" }, "yes")]);
      } else {
        rows.push(["Replicas", `${install.ready} of ${install.desired} ready`]);
        rows.push(["Leader election", install.leaderElection ? "on" : "off"]);
      }
      rows.push([
        "Policy",
        install.policy ? objectLink(
          "configmaps",
          install.policy.namespace,
          install.policy.configMap,
          `${install.policy.namespace}/${install.policy.configMap} · ${install.policy.key}`
        ) : el("span", { class: "tone-warn" }, install.policyPath ? `mounted from ${install.policyPath}, source not found` : "no --policy-config-file")
      ]);
      rows.push(["Command", el("span", { class: "mono" }, install.command.join(" ") || "—")]);
      const podRows = pods2.slice().sort((a, b) => (b.metadata.creationTimestamp ?? "").localeCompare(a.metadata.creationTimestamp ?? "")).slice(0, 5);
      blocks.append(
        block(
          "How it runs",
          "Read from the workload itself — the flags it was started with are the whole of its configuration, beside the policy.",
          el(
            "div",
            { class: "columns" },
            facts(rows),
            el(
              "div",
              {},
              el("h3", {}, install.mode === "cronjob" ? "Its recent runs" : "Its pods"),
              install.mode === "cronjob" && jobs.length ? jobTable(jobs) : podTable(podRows),
              el(
                "div",
                { class: "bar", style: "margin-top:8px" },
                podRows[0] ? button(
                  "Its logs",
                  () => void k8sdockside.logs({ kind: "pods", namespace: podRows[0]?.metadata.namespace ?? "", name: podRows[0]?.metadata.name ?? "" }).catch(() => {
                  })
                ) : null,
                button(
                  "Open the workload",
                  () => void k8sdockside.open({ kind, namespace: install.namespace, name: install.name }).catch(() => {
                  })
                )
              )
            )
          )
        )
      );
    } else {
      blocks.append(
        block(
          "Putting one in",
          "The descheduler is one workload and one ConfigMap. The chart installs either shape:",
          el(
            "pre",
            { class: "yaml" },
            "helm repo add descheduler https://kubernetes-sigs.github.io/descheduler/\nhelm install descheduler descheduler/descheduler \\\n  --namespace kube-system --set kind=CronJob"
          ),
          el("p", { class: "faint" }, "This page fills in as soon as something here runs the descheduler image — it is found by its image and its flags, not by a name.")
        )
      );
    }
    if (policy.doc) {
      const doc = policy.doc;
      const cards = [];
      for (const profile of profiles(doc)) {
        const enabled = enabledPlugins(profile);
        cards.push(
          el(
            "div",
            {},
            el("h3", {}, String(profile["name"] ?? "unnamed profile")),
            el(
              "div",
              { class: "chips", style: "margin:4px 0 6px" },
              ...enabled.length ? enabled.map(
                (name) => el("span", { class: "tag tag-on", title: pluginByName(name)?.summary ?? "" }, pluginByName(name)?.title ?? name)
              ) : [el("span", { class: "faint" }, "no plugins enabled — this profile does nothing")]
            ),
            facts(evictorFacts(argsOf(profile, "DefaultEvictor")))
          )
        );
      }
      const limits = GLOBAL_FIELDS.map((field) => [field.label, getPath(doc, field.path)]).filter(
        ([, value]) => value !== void 0 && value !== null && value !== false
      );
      blocks.append(
        block(
          "What the policy asks for",
          `${policy.configMap?.metadata.namespace}/${policy.configMap?.metadata.name} · ${policy.key}${policy.guessed ? " — found by looking, not named by the workload" : ""}`,
          el("div", { class: "columns" }, ...cards),
          limits.length ? el("div", { style: "margin-top:10px" }, el("h3", {}, "Limits on a single pass"), facts(limits.map(([label, value]) => [label, String(value)]))) : null,
          el(
            "div",
            { class: "bar", style: "margin:10px 0 0" },
            button("Open Policy", () => void k8sdockside.openView("policy"), { class: "primary" }),
            el("span", { class: "faint" }, `${profileNames(doc).length} profile(s), apiVersion ${String(doc["apiVersion"] ?? "not set")}.`)
          )
        )
      );
    } else if (install) {
      blocks.append(
        block(
          "What the policy asks for",
          "",
          el("p", { class: "tone-warn" }, `The policy could not be read: ${policy.error}.`),
          button("Open Policy", () => void k8sdockside.openView("policy"))
        )
      );
    }
    await drawCharts(blocks);
    const ctx = await k8sdockside.ready();
    const links = ctx.plugin?.links ?? [];
    if (links.length) {
      blocks.append(
        block(
          "Read further",
          "These open in your browser — the page itself has no network, so it asks the app.",
          el("div", { class: "links" }, ...links.map((link) => button(link.label, () => void k8sdockside.openUrl(link.url))))
        )
      );
    }
  });
  function evictorFacts(evictor) {
    const rows = [];
    rows.push(["Only where another node fits", evictor["nodeFit"] === true ? "yes" : "no"]);
    if (evictor["minReplicas"] !== void 0) rows.push(["Leaves workloads under", `${String(evictor["minReplicas"])} replicas`]);
    if (evictor["minPodAge"] !== void 0) rows.push(["Leaves pods younger than", String(evictor["minPodAge"])]);
    const may = [];
    if (evictor["evictLocalStoragePods"] === true) may.push("local storage");
    if (evictor["evictDaemonSetPods"] === true) may.push("DaemonSet pods");
    if (evictor["evictSystemCriticalPods"] === true) may.push("system critical");
    if (evictor["evictFailedBarePods"] === true) may.push("failed bare pods");
    if (may.length) rows.push(["May also evict", may.join(", ")]);
    const never = [];
    if (evictor["ignorePvcPods"] === true) never.push("pods with a PVC");
    if (evictor["ignorePodsWithoutPDB"] === true) never.push("pods with no PDB");
    if (never.length) rows.push(["Never evicts", never.join(", ")]);
    return rows;
  }
  function podTable(pods2) {
    if (!pods2.length) return el("p", { class: "faint" }, "No pods of its own right now.");
    const body = el("tbody", {});
    for (const pod of pods2) {
      const restarts = (pod.status?.containerStatuses ?? []).reduce((sum, c) => sum + (c.restartCount ?? 0), 0);
      const phase = pod.status?.phase ?? "";
      body.append(
        el(
          "tr",
          {},
          el("td", {}, objectLink("pods", pod.metadata.namespace ?? "", pod.metadata.name)),
          el("td", {}, dot(phase === "Running" || phase === "Succeeded" ? "ok" : phase === "Failed" ? "error" : "warn"), " ", phase || "—"),
          el("td", { class: restarts > 3 ? "tone-warn" : "faint" }, `${restarts} restart${restarts === 1 ? "" : "s"}`),
          el("td", { class: "faint" }, since(pod.metadata.creationTimestamp))
        )
      );
    }
    return el("table", {}, body);
  }
  function jobTable(jobs) {
    const body = el("tbody", {});
    for (const job of jobs.slice(0, 6)) {
      const state = jobState(job);
      body.append(
        el(
          "tr",
          {},
          el("td", {}, objectLink("jobs", job.metadata.namespace ?? "", job.metadata.name)),
          el("td", {}, dot(state.tone), " ", state.text),
          el("td", { class: "faint" }, `${since(job.metadata.creationTimestamp)} ago`)
        )
      );
    }
    return el("table", {}, body);
  }
  async function drawCharts(blocks) {
    let panel;
    try {
      panel = await k8sdockside.charts({ minutes: 180 });
    } catch {
      return;
    }
    if (!panel.attached) return;
    if (!panel.source.available) {
      blocks.append(
        block(
          "From Prometheus",
          "The descheduler exports its own counters. No Prometheus was found in this cluster, so these are empty.",
          el("p", { class: "faint" }, panel.source.error || "Set one on the cluster in the sidebar’s settings panel to fill them in.")
        )
      );
      return;
    }
    const rows = el("div", { class: "bars" });
    for (const chart of panel.charts) {
      const series = chart.series[0];
      const last = series?.points[series.points.length - 1];
      rows.append(
        el(
          "div",
          { class: "bar-row" },
          el("div", { class: "bar-label", title: chart.description }, chart.label),
          el("div", {}, series ? sparkline(series.points) : el("span", { class: "faint" }, chart.error || "no data")),
          el("div", { class: "bar-value" }, last ? formatValue(chart.unit, last.v) : "—")
        )
      );
      for (const extra of chart.series.slice(1, 5)) {
        const tail = extra.points[extra.points.length - 1];
        rows.append(
          el(
            "div",
            { class: "bar-row" },
            el("div", { class: "bar-label faint", title: extra.name }, `  ${extra.name}`),
            el("div", {}, sparkline(extra.points)),
            el("div", { class: "bar-value" }, tail ? formatValue(chart.unit, tail.v) : "—")
          )
        );
      }
    }
    blocks.append(
      block("From Prometheus", `The last three hours, through ${panel.source.describe}.`, rows)
    );
  }
})();
