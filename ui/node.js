// Built by scripts/build.mjs from src/ -- edit the TypeScript there, not this file.
"use strict";
(() => {
  // src/ui/dom.ts
  function el(tag, attrs = {}, ...children) {
    const node2 = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) {
      if (value === void 0 || value === false) continue;
      if (name === "class") node2.className = String(value);
      else if (name === "text") node2.textContent = String(value);
      else node2.setAttribute(name, String(value));
    }
    for (const child of children) {
      if (child === null || child === void 0 || child === false) continue;
      node2.append(child);
    }
    return node2;
  }
  function button(label, onClick, attrs = {}) {
    const node2 = el("button", { type: "button", ...attrs }, label);
    node2.addEventListener("click", onClick);
    return node2;
  }
  function replace(parent, ...children) {
    parent.replaceChildren();
    for (const child of children) {
      if (child === null || child === void 0 || child === false) continue;
      parent.append(child);
    }
  }
  function byId(id) {
    const node2 = document.getElementById(id);
    if (!node2) throw new Error(`the page has no #${id}`);
    return node2;
  }
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
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }

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

  // src/ui/cluster.ts
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
  function since2(list, minutes, now = Date.now()) {
    const floor = now - minutes * 6e4;
    return list.filter((item) => item.at >= floor);
  }
  function totals(list) {
    const pods = /* @__PURE__ */ new Set();
    const nodes = /* @__PURE__ */ new Set();
    const strategies = /* @__PURE__ */ new Set();
    let evicted = 0;
    let refused = 0;
    for (const item of list) {
      if (item.result === "evicted") evicted += item.count;
      else refused += item.count;
      pods.add(`${item.namespace}/${item.pod}`);
      if (item.node) nodes.add(item.node);
      if (item.strategy) strategies.add(item.strategy);
    }
    return { evicted, refused, pods: pods.size, nodes: nodes.size, strategies: strategies.size };
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

  // src/pages/node.ts
  start("page", async (ctx) => {
    const node2 = ctx.object;
    if (!node2) return;
    const events = await listOrNone({ kind: "events", namespace: "" });
    const mine = evictions(events).filter((item) => item.node === node2.name);
    const day = since2(mine, 24 * 60);
    const counts = totals(day);
    byId("loading").remove();
    const body = byId("body");
    if (!mine.length) {
      replace(
        body,
        el(
          "p",
          { class: "note" },
          "The descheduler has not evicted anything from this node in the events the cluster still holds — which is about an hour’s worth, by default."
        )
      );
      return;
    }
    const byPlugin = tally(day, (item) => item.strategy);
    replace(
      body,
      el(
        "div",
        { class: "bar" },
        el("strong", {}, `${counts.evicted} evicted`),
        counts.refused ? el("span", { class: "tone-error" }, `${counts.refused} refused`) : null,
        el("span", { class: "faint" }, "in the last day"),
        el("span", { class: "faint" }, byPlugin.length ? `· mostly ${byPlugin[0]?.key}` : ""),
        el("span", { class: "spacer" }),
        button("Open Activity", () => void k8sdockside.openView("activity"))
      ),
      timeline(buckets(day, 24 * 60, 48), 52),
      evictionTable(mine.slice(0, 12), { showNode: false })
    );
  });
})();
