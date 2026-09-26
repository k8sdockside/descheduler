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
  function svg(markup, className = "icon") {
    const holder = document.createElement("span");
    holder.innerHTML = markup;
    const node2 = holder.firstElementChild;
    if (!node2) throw new Error("svg() was given no element");
    node2.setAttribute("class", className);
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
  function since(timestamp, now = Date.now()) {
    if (!timestamp) return "—";
    const then = Date.parse(timestamp);
    if (Number.isNaN(then)) return "—";
    const seconds = Math.max(0, Math.round((now - then) / 1e3));
    if (seconds < 60) return `${seconds}s`;
    const minutes2 = Math.floor(seconds / 60);
    if (minutes2 < 60) return `${minutes2}m`;
    const hours = Math.floor(minutes2 / 60);
    if (hours < 48) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }

  // src/ui/icons.ts
  var SEARCH = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="7" cy="7" r="4.3"/><path d="M10.2 10.2L14 14"/></svg>';
  var TERMINAL = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5l3 3.5-3 3.5M8 11.5h5"/></svg>';

  // src/ui/parts.ts
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
  function block(title2, note, ...children) {
    return el(
      "section",
      { class: "block" },
      el("h2", {}, title2),
      note ? el("p", { class: "note" }, note) : null,
      ...children.filter((child) => child !== null)
    );
  }
  function picker(label, options, value, onPick) {
    const select = el("select", { "aria-label": label });
    for (const option of options) {
      select.append(el("option", { value: option.value, ...option.value === value ? { selected: "selected" } : {} }, option.label));
    }
    select.addEventListener("change", () => onPick(select.value));
    return select;
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

  // src/ui/cluster.ts
  async function findDescheduler() {
    const [deployments, cronJobs] = await Promise.all([
      k8sdockside.list({ kind: "deployments", namespace: "" }),
      k8sdockside.list({ kind: "cronjobs", namespace: "" })
    ]);
    const installs = findInstalls(deployments, cronJobs);
    return { installs, install: installs[0] ?? null, deployments, cronJobs };
  }
  function watchEvents(onItems, onError, interval = 1e4) {
    return k8sdockside.watch({ kind: "events", namespace: "", interval }, onItems, onError);
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
  function since2(list, minutes2, now = Date.now()) {
    const floor = now - minutes2 * 6e4;
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
  function tally(list, pick, unknown = "(no plugin named)") {
    const counts = /* @__PURE__ */ new Map();
    for (const item of list) {
      const key = pick(item) || unknown;
      const row = counts.get(key) ?? { key, evicted: 0, refused: 0, total: 0 };
      if (item.result === "evicted") row.evicted += item.count;
      else row.refused += item.count;
      row.total += item.count;
      counts.set(key, row);
    }
    return [...counts.values()].sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
  }
  function buckets(list, minutes2, count, now = Date.now()) {
    const span = minutes2 * 6e4 / count;
    const first = Math.floor((now - minutes2 * 6e4) / span) * span;
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
  var NO_FILTER = { text: "", namespace: "", node: "", strategy: "", result: "" };
  function apply(list, filter2) {
    const text = filter2.text.trim().toLowerCase();
    return list.filter((item) => {
      if (filter2.namespace && item.namespace !== filter2.namespace) return false;
      if (filter2.node && item.node !== filter2.node) return false;
      if (filter2.strategy && item.strategy !== filter2.strategy) return false;
      if (filter2.result && item.result !== filter2.result) return false;
      if (!text) return true;
      return `${item.namespace} ${item.pod} ${item.node} ${item.strategy} ${item.message}`.toLowerCase().includes(text);
    });
  }
  function values(list, pick) {
    return [...new Set(list.map(pick).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  // src/pages/activity.ts
  var WINDOWS = [
    { value: "60", label: "last hour" },
    { value: "360", label: "last 6 hours" },
    { value: "1440", label: "last day" },
    { value: "10080", label: "last week" },
    { value: "0", label: "everything kept" }
  ];
  var filter = { ...NO_FILTER };
  var minutes = 360;
  var all = [];
  var logPod = null;
  start("page", async () => {
    const remembered = await k8sdockside.storage?.get("window").catch(() => null);
    if (typeof remembered === "number" && WINDOWS.some((option) => option.value === String(remembered))) {
      minutes = remembered;
    }
    void findDescheduler().then(async (found) => {
      if (!found.install) return;
      const pods2 = ownPods(await pods(found.install.namespace), found.install);
      logPod = pods2.slice().sort((a, b) => (b.metadata.creationTimestamp ?? "").localeCompare(a.metadata.creationTimestamp ?? ""))[0] ?? null;
      drawFilters();
    }).catch(() => {
    });
    drawFilters();
    replace(byId("rows"), el("p", { class: "loading" }, "Reading the cluster’s events…"));
    const stop = watchEvents(
      (events) => {
        all = evictions(events);
        draw();
      },
      (err) => {
        replace(byId("rows"), el("div", { class: "failure" }, `Events could not be read: ${err.message}`));
      }
    );
    window.addEventListener("pagehide", () => stop());
    all = evictions(await listOrNone({ kind: "events", namespace: "" }));
    draw();
  });
  function windowed() {
    return minutes > 0 ? since2(all, minutes) : all;
  }
  function drawFilters() {
    const search = el("input", {
      type: "search",
      placeholder: "pod, node, message…",
      value: filter.text,
      "aria-label": "Search"
    });
    search.addEventListener("input", () => {
      filter = { ...filter, text: search.value };
      draw();
    });
    const list = windowed();
    replace(
      byId("filters"),
      svg(SEARCH, "icon"),
      search,
      picker("Window", WINDOWS, String(minutes), (value) => {
        minutes = Number(value);
        void k8sdockside.storage?.set("window", minutes).catch(() => {
        });
        drawFilters();
        draw();
      }),
      picker(
        "Plugin",
        [{ value: "", label: "every plugin" }, ...values(list, (item) => item.strategy).map((name) => ({ value: name, label: name }))],
        filter.strategy,
        (value) => {
          filter = { ...filter, strategy: value };
          draw();
        }
      ),
      picker(
        "Namespace",
        [{ value: "", label: "every namespace" }, ...values(list, (item) => item.namespace).map((name) => ({ value: name, label: name }))],
        filter.namespace,
        (value) => {
          filter = { ...filter, namespace: value };
          draw();
        }
      ),
      picker(
        "Node",
        [{ value: "", label: "every node" }, ...values(list, (item) => item.node).map((name) => ({ value: name, label: name }))],
        filter.node,
        (value) => {
          filter = { ...filter, node: value };
          draw();
        }
      ),
      picker(
        "Result",
        [
          { value: "", label: "evicted and refused" },
          { value: "evicted", label: "evicted only" },
          { value: "refused", label: "refused only" }
        ],
        filter.result,
        (value) => {
          filter = { ...filter, result: value };
          draw();
        }
      ),
      el("span", { class: "spacer" }),
      logButton()
    );
  }
  function logButton() {
    const pod = logPod;
    if (!pod) return null;
    const made = button(
      "Descheduler’s log",
      () => void k8sdockside.logs({ kind: "pods", namespace: pod.metadata.namespace ?? "", name: pod.metadata.name }).catch(() => {
      })
    );
    made.prepend(svg(TERMINAL, "icon"));
    return made;
  }
  function draw() {
    const list = windowed();
    const shown = apply(list, filter);
    const counts = totals(shown);
    const span = minutes > 0 ? minutes : 24 * 60;
    replace(
      byId("summary"),
      el(
        "div",
        { class: "stats" },
        el("div", { class: "stat" }, el("div", { class: "stat-value tone-ok" }, String(counts.evicted)), el("div", { class: "stat-label" }, "Evicted")),
        el("div", { class: "stat" }, el("div", { class: `stat-value ${counts.refused ? "tone-error" : ""}` }, String(counts.refused)), el("div", { class: "stat-label" }, "Refused")),
        el("div", { class: "stat" }, el("div", { class: "stat-value" }, String(counts.pods)), el("div", { class: "stat-label" }, "Pods")),
        el("div", { class: "stat" }, el("div", { class: "stat-value" }, String(counts.nodes)), el("div", { class: "stat-label" }, "Nodes"))
      ),
      block(
        "Over time",
        "",
        timeline(buckets(shown, span, 60)),
        el(
          "div",
          { class: "columns", style: "margin-top:10px" },
          el("div", {}, el("h3", {}, "By plugin"), bars(tally(shown, (item) => item.strategy))),
          el("div", {}, el("h3", {}, "By namespace"), bars(tally(shown, (item) => item.namespace))),
          el("div", {}, el("h3", {}, "By node"), bars(tally(shown, (item) => item.node)))
        )
      )
    );
    replace(
      byId("rows"),
      block(
        `${shown.length} eviction${shown.length === 1 ? "" : "s"}`,
        shown.length === list.length ? "" : `Filtered from ${list.length} in this window.`,
        el("div", { class: "scroll" }, evictionTable(shown.slice(0, 500))),
        shown.length > 500 ? el("p", { class: "faint" }, "Showing the newest 500.") : null
      )
    );
  }
})();
