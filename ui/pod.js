// Built by k8sdockside-plugin from src/ -- edit the TypeScript there, not this file.
"use strict";
(() => {
  // node_modules/@k8sdockside/plugin-sdk/dom.js
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) {
      if (value === void 0 || value === false) continue;
      if (name === "class") node.className = String(value);
      else if (name === "text") node.textContent = String(value);
      else node.setAttribute(name, String(value));
    }
    append(node, children);
    return node;
  }
  function button(label, onClick, attrs = {}) {
    const node = el("button", { type: "button", ...attrs }, label);
    node.addEventListener("click", onClick);
    return node;
  }
  function replace(parent, ...children) {
    parent.replaceChildren();
    append(parent, children);
  }
  function byId(id) {
    const node = document.getElementById(id);
    if (!node) throw new Error(`the page has no #${id}`);
    return node;
  }
  function svg(markup, className = "icon") {
    const holder = document.createElement("span");
    holder.innerHTML = markup;
    const node = holder.firstElementChild;
    if (!node) throw new Error("svg() was given no element");
    node.setAttribute("class", className);
    return node;
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
  function since(timestamp2, now = Date.now()) {
    if (!timestamp2) return "—";
    const then = Date.parse(timestamp2);
    if (Number.isNaN(then)) return "—";
    const seconds2 = Math.max(0, Math.round((now - then) / 1e3));
    if (seconds2 < 60) return `${seconds2}s`;
    const minutes = Math.floor(seconds2 / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }

  // src/ui/icons.ts
  var CHECK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 8.4l3 3 6.6-6.8"/></svg>';
  var CROSS = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
  var QUESTION = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5.8 5.8a2.3 2.3 0 114 1.6c-.9.8-1.8 1.2-1.8 2.3"/><path d="M8 12.6v.01"/></svg>';
  function forOutcome(outcome) {
    if (outcome === "blocked") return CROSS;
    if (outcome === "allowed") return CHECK;
    return QUESTION;
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
  function checkRow(check) {
    return el(
      "div",
      { class: "check" },
      svg(forOutcome(check.outcome), `icon check-${check.outcome}`),
      el("span", { class: "check-label" }, check.label),
      el("span", { class: "check-detail" }, check.detail)
    );
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
  function controller(object) {
    const owners = object.metadata.ownerReferences ?? [];
    return owners.find((o) => o.controller) ?? owners[0];
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

  // src/ui/cluster.ts
  async function findDescheduler() {
    const [deployments, cronJobs] = await Promise.all([
      k8sdockside.list({ kind: "deployments", namespace: "" }),
      k8sdockside.list({ kind: "cronjobs", namespace: "" })
    ]);
    const installs = findInstalls(deployments, cronJobs);
    return { installs, install: installs[0] ?? null, deployments, cronJobs };
  }
  function budgets(namespace) {
    return k8sdockside.list({ kind: "poddisruptionbudgets", namespace });
  }
  async function listOrNone(query) {
    try {
      return await k8sdockside.list(query);
    } catch {
      return [];
    }
  }
  async function ownerOf(pod) {
    const reference = (pod.metadata.ownerReferences ?? []).find((owner) => owner.controller) ?? (pod.metadata.ownerReferences ?? [])[0];
    if (!reference) return null;
    const kinds = {
      ReplicaSet: "replicasets",
      Deployment: "deployments",
      StatefulSet: "statefulsets",
      DaemonSet: "daemonsets",
      Job: "jobs"
    };
    const kind = kinds[reference.kind];
    if (!kind) return { kind: reference.kind, replicas: null };
    try {
      const owner = await k8sdockside.get({
        kind,
        namespace: pod.metadata.namespace ?? "",
        name: reference.name
      });
      const spec = owner.spec;
      const status = owner.status;
      const replicas = spec?.replicas ?? status?.desiredNumberScheduled ?? null;
      return { kind: reference.kind, replicas: typeof replicas === "number" ? replicas : null };
    } catch {
      return { kind: reference.kind, replicas: null };
    }
  }

  // node_modules/js-yaml/dist/js-yaml.mjs
  function getDefaultExportFromCjs(x) {
    return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
  }
  var jsYaml = {};
  var loader = {};
  var common = {};
  var hasRequiredCommon;
  function requireCommon() {
    if (hasRequiredCommon) return common;
    hasRequiredCommon = 1;
    function isNothing(subject) {
      return typeof subject === "undefined" || subject === null;
    }
    function isObject(subject) {
      return typeof subject === "object" && subject !== null;
    }
    function toArray(sequence) {
      if (Array.isArray(sequence)) return sequence;
      else if (isNothing(sequence)) return [];
      return [sequence];
    }
    function extend(target, source) {
      if (source) {
        const sourceKeys = Object.keys(source);
        for (let index = 0, length = sourceKeys.length; index < length; index += 1) {
          const key = sourceKeys[index];
          target[key] = source[key];
        }
      }
      return target;
    }
    function repeat(string, count) {
      let result = "";
      for (let cycle = 0; cycle < count; cycle += 1) {
        result += string;
      }
      return result;
    }
    function isNegativeZero(number) {
      return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
    }
    common.isNothing = isNothing;
    common.isObject = isObject;
    common.toArray = toArray;
    common.repeat = repeat;
    common.isNegativeZero = isNegativeZero;
    common.extend = extend;
    return common;
  }
  var exception;
  var hasRequiredException;
  function requireException() {
    if (hasRequiredException) return exception;
    hasRequiredException = 1;
    function formatError(exception2, compact) {
      let where = "";
      const message = exception2.reason || "(unknown reason)";
      if (!exception2.mark) return message;
      if (exception2.mark.name) {
        where += 'in "' + exception2.mark.name + '" ';
      }
      where += "(" + (exception2.mark.line + 1) + ":" + (exception2.mark.column + 1) + ")";
      if (!compact && exception2.mark.snippet) {
        where += "\n\n" + exception2.mark.snippet;
      }
      return message + " " + where;
    }
    function YAMLException2(reason, mark) {
      Error.call(this);
      this.name = "YAMLException";
      this.reason = reason;
      this.mark = mark;
      this.message = formatError(this, false);
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
      } else {
        this.stack = new Error().stack || "";
      }
    }
    YAMLException2.prototype = Object.create(Error.prototype);
    YAMLException2.prototype.constructor = YAMLException2;
    YAMLException2.prototype.toString = function toString(compact) {
      return this.name + ": " + formatError(this, compact);
    };
    exception = YAMLException2;
    return exception;
  }
  var snippet;
  var hasRequiredSnippet;
  function requireSnippet() {
    if (hasRequiredSnippet) return snippet;
    hasRequiredSnippet = 1;
    const common2 = requireCommon();
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
        // relative position
      };
    }
    function padStart(string, max) {
      return common2.repeat(" ", max - string.length) + string;
    }
    function makeSnippet(mark, options) {
      options = Object.create(options || null);
      if (!mark.buffer) return null;
      if (!options.maxLength) options.maxLength = 79;
      if (typeof options.indent !== "number") options.indent = 1;
      if (typeof options.linesBefore !== "number") options.linesBefore = 3;
      if (typeof options.linesAfter !== "number") options.linesAfter = 2;
      const re = /\r?\n|\r|\0/g;
      const lineStarts = [0];
      const lineEnds = [];
      let match;
      let foundLineNo = -1;
      while (match = re.exec(mark.buffer)) {
        lineEnds.push(match.index);
        lineStarts.push(match.index + match[0].length);
        if (mark.position <= match.index && foundLineNo < 0) {
          foundLineNo = lineStarts.length - 2;
        }
      }
      if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
      let result = "";
      const lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
      const maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
      for (let i = 1; i <= options.linesBefore; i++) {
        if (foundLineNo - i < 0) break;
        const line2 = getLine(
          mark.buffer,
          lineStarts[foundLineNo - i],
          lineEnds[foundLineNo - i],
          mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]),
          maxLineLength
        );
        result = common2.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line2.str + "\n" + result;
      }
      const line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
      result += common2.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + "\n";
      result += common2.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^\n";
      for (let i = 1; i <= options.linesAfter; i++) {
        if (foundLineNo + i >= lineEnds.length) break;
        const line2 = getLine(
          mark.buffer,
          lineStarts[foundLineNo + i],
          lineEnds[foundLineNo + i],
          mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]),
          maxLineLength
        );
        result += common2.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line2.str + "\n";
      }
      return result.replace(/\n$/, "");
    }
    snippet = makeSnippet;
    return snippet;
  }
  var type;
  var hasRequiredType;
  function requireType() {
    if (hasRequiredType) return type;
    hasRequiredType = 1;
    const YAMLException2 = requireException();
    const TYPE_CONSTRUCTOR_OPTIONS = [
      "kind",
      "multi",
      "resolve",
      "construct",
      "instanceOf",
      "predicate",
      "represent",
      "representName",
      "defaultStyle",
      "styleAliases"
    ];
    const YAML_NODE_KINDS = [
      "scalar",
      "sequence",
      "mapping"
    ];
    function compileStyleAliases(map2) {
      const result = {};
      if (map2 !== null) {
        Object.keys(map2).forEach(function(style) {
          map2[style].forEach(function(alias) {
            result[String(alias)] = style;
          });
        });
      }
      return result;
    }
    function Type2(tag, options) {
      options = options || {};
      Object.keys(options).forEach(function(name) {
        if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
          throw new YAMLException2('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
        }
      });
      this.options = options;
      this.tag = tag;
      this.kind = options["kind"] || null;
      this.resolve = options["resolve"] || function() {
        return true;
      };
      this.construct = options["construct"] || function(data) {
        return data;
      };
      this.instanceOf = options["instanceOf"] || null;
      this.predicate = options["predicate"] || null;
      this.represent = options["represent"] || null;
      this.representName = options["representName"] || null;
      this.defaultStyle = options["defaultStyle"] || null;
      this.multi = options["multi"] || false;
      this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
      if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
        throw new YAMLException2('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
      }
    }
    type = Type2;
    return type;
  }
  var schema;
  var hasRequiredSchema;
  function requireSchema() {
    if (hasRequiredSchema) return schema;
    hasRequiredSchema = 1;
    const YAMLException2 = requireException();
    const Type2 = requireType();
    function compileList(schema2, name) {
      const result = [];
      schema2[name].forEach(function(currentType) {
        let newIndex = result.length;
        result.forEach(function(previousType, previousIndex) {
          if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) {
            newIndex = previousIndex;
          }
        });
        result[newIndex] = currentType;
      });
      return result;
    }
    function compileMap() {
      const result = {
        scalar: {},
        sequence: {},
        mapping: {},
        fallback: {},
        multi: {
          scalar: [],
          sequence: [],
          mapping: [],
          fallback: []
        }
      };
      function collectType(type2) {
        if (type2.multi) {
          result.multi[type2.kind].push(type2);
          result.multi["fallback"].push(type2);
        } else {
          result[type2.kind][type2.tag] = result["fallback"][type2.tag] = type2;
        }
      }
      for (let index = 0, length = arguments.length; index < length; index += 1) {
        arguments[index].forEach(collectType);
      }
      return result;
    }
    function Schema2(definition) {
      return this.extend(definition);
    }
    Schema2.prototype.extend = function extend(definition) {
      let implicit = [];
      let explicit = [];
      if (definition instanceof Type2) {
        explicit.push(definition);
      } else if (Array.isArray(definition)) {
        explicit = explicit.concat(definition);
      } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
        if (definition.implicit) implicit = implicit.concat(definition.implicit);
        if (definition.explicit) explicit = explicit.concat(definition.explicit);
      } else {
        throw new YAMLException2("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
      }
      implicit.forEach(function(type2) {
        if (!(type2 instanceof Type2)) {
          throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
        }
        if (type2.loadKind && type2.loadKind !== "scalar") {
          throw new YAMLException2("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
        }
        if (type2.multi) {
          throw new YAMLException2("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
        }
      });
      explicit.forEach(function(type2) {
        if (!(type2 instanceof Type2)) {
          throw new YAMLException2("Specified list of YAML types (or a single Type object) contains a non-Type object.");
        }
      });
      const result = Object.create(Schema2.prototype);
      result.implicit = (this.implicit || []).concat(implicit);
      result.explicit = (this.explicit || []).concat(explicit);
      result.compiledImplicit = compileList(result, "implicit");
      result.compiledExplicit = compileList(result, "explicit");
      result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
      return result;
    };
    schema = Schema2;
    return schema;
  }
  var str;
  var hasRequiredStr;
  function requireStr() {
    if (hasRequiredStr) return str;
    hasRequiredStr = 1;
    const Type2 = requireType();
    str = new Type2("tag:yaml.org,2002:str", {
      kind: "scalar",
      construct: function(data) {
        return data !== null ? data : "";
      }
    });
    return str;
  }
  var seq;
  var hasRequiredSeq;
  function requireSeq() {
    if (hasRequiredSeq) return seq;
    hasRequiredSeq = 1;
    const Type2 = requireType();
    seq = new Type2("tag:yaml.org,2002:seq", {
      kind: "sequence",
      construct: function(data) {
        return data !== null ? data : [];
      }
    });
    return seq;
  }
  var map;
  var hasRequiredMap;
  function requireMap() {
    if (hasRequiredMap) return map;
    hasRequiredMap = 1;
    const Type2 = requireType();
    map = new Type2("tag:yaml.org,2002:map", {
      kind: "mapping",
      construct: function(data) {
        return data !== null ? data : {};
      }
    });
    return map;
  }
  var failsafe;
  var hasRequiredFailsafe;
  function requireFailsafe() {
    if (hasRequiredFailsafe) return failsafe;
    hasRequiredFailsafe = 1;
    const Schema2 = requireSchema();
    failsafe = new Schema2({
      explicit: [
        requireStr(),
        requireSeq(),
        requireMap()
      ]
    });
    return failsafe;
  }
  var _null;
  var hasRequired_null;
  function require_null() {
    if (hasRequired_null) return _null;
    hasRequired_null = 1;
    const Type2 = requireType();
    function resolveYamlNull(data) {
      if (data === null) return true;
      const max = data.length;
      return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
    }
    function constructYamlNull() {
      return null;
    }
    function isNull(object) {
      return object === null;
    }
    _null = new Type2("tag:yaml.org,2002:null", {
      kind: "scalar",
      resolve: resolveYamlNull,
      construct: constructYamlNull,
      predicate: isNull,
      represent: {
        canonical: function() {
          return "~";
        },
        lowercase: function() {
          return "null";
        },
        uppercase: function() {
          return "NULL";
        },
        camelcase: function() {
          return "Null";
        },
        empty: function() {
          return "";
        }
      },
      defaultStyle: "lowercase"
    });
    return _null;
  }
  var bool;
  var hasRequiredBool;
  function requireBool() {
    if (hasRequiredBool) return bool;
    hasRequiredBool = 1;
    const Type2 = requireType();
    function resolveYamlBoolean(data) {
      if (data === null) return false;
      const max = data.length;
      return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
    }
    function constructYamlBoolean(data) {
      return data === "true" || data === "True" || data === "TRUE";
    }
    function isBoolean(object) {
      return Object.prototype.toString.call(object) === "[object Boolean]";
    }
    bool = new Type2("tag:yaml.org,2002:bool", {
      kind: "scalar",
      resolve: resolveYamlBoolean,
      construct: constructYamlBoolean,
      predicate: isBoolean,
      represent: {
        lowercase: function(object) {
          return object ? "true" : "false";
        },
        uppercase: function(object) {
          return object ? "TRUE" : "FALSE";
        },
        camelcase: function(object) {
          return object ? "True" : "False";
        }
      },
      defaultStyle: "lowercase"
    });
    return bool;
  }
  var int;
  var hasRequiredInt;
  function requireInt() {
    if (hasRequiredInt) return int;
    hasRequiredInt = 1;
    const common2 = requireCommon();
    const Type2 = requireType();
    function isHexCode(c) {
      return c >= 48 && c <= 57 || c >= 65 && c <= 70 || c >= 97 && c <= 102;
    }
    function isOctCode(c) {
      return c >= 48 && c <= 55;
    }
    function isDecCode(c) {
      return c >= 48 && c <= 57;
    }
    function resolveYamlInteger(data) {
      if (data === null) return false;
      const max = data.length;
      let index = 0;
      let hasDigits = false;
      if (!max) return false;
      let ch = data[index];
      if (ch === "-" || ch === "+") {
        ch = data[++index];
      }
      if (ch === "0") {
        if (index + 1 === max) return true;
        ch = data[++index];
        if (ch === "b") {
          index++;
          for (; index < max; index++) {
            ch = data[index];
            if (ch !== "0" && ch !== "1") return false;
            hasDigits = true;
          }
          return hasDigits && isFinite(parseYamlInteger(data));
        }
        if (ch === "x") {
          index++;
          for (; index < max; index++) {
            if (!isHexCode(data.charCodeAt(index))) return false;
            hasDigits = true;
          }
          return hasDigits && isFinite(parseYamlInteger(data));
        }
        if (ch === "o") {
          index++;
          for (; index < max; index++) {
            if (!isOctCode(data.charCodeAt(index))) return false;
            hasDigits = true;
          }
          return hasDigits && isFinite(parseYamlInteger(data));
        }
      }
      for (; index < max; index++) {
        if (!isDecCode(data.charCodeAt(index))) {
          return false;
        }
        hasDigits = true;
      }
      if (!hasDigits) return false;
      return isFinite(parseYamlInteger(data));
    }
    function parseYamlInteger(data) {
      let value = data;
      let sign = 1;
      let ch = value[0];
      if (ch === "-" || ch === "+") {
        if (ch === "-") sign = -1;
        value = value.slice(1);
        ch = value[0];
      }
      if (value === "0") return 0;
      if (ch === "0") {
        if (value[1] === "b") return sign * parseInt(value.slice(2), 2);
        if (value[1] === "x") return sign * parseInt(value.slice(2), 16);
        if (value[1] === "o") return sign * parseInt(value.slice(2), 8);
      }
      return sign * parseInt(value, 10);
    }
    function constructYamlInteger(data) {
      return parseYamlInteger(data);
    }
    function isInteger(object) {
      return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 === 0 && !common2.isNegativeZero(object));
    }
    int = new Type2("tag:yaml.org,2002:int", {
      kind: "scalar",
      resolve: resolveYamlInteger,
      construct: constructYamlInteger,
      predicate: isInteger,
      represent: {
        binary: function(obj) {
          return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
        },
        octal: function(obj) {
          return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
        },
        decimal: function(obj) {
          return obj.toString(10);
        },
        hexadecimal: function(obj) {
          return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
        }
      },
      defaultStyle: "decimal",
      styleAliases: {
        binary: [2, "bin"],
        octal: [8, "oct"],
        decimal: [10, "dec"],
        hexadecimal: [16, "hex"]
      }
    });
    return int;
  }
  var float;
  var hasRequiredFloat;
  function requireFloat() {
    if (hasRequiredFloat) return float;
    hasRequiredFloat = 1;
    const common2 = requireCommon();
    const Type2 = requireType();
    const YAML_FLOAT_PATTERN = new RegExp(
      // 2.5e4, 2.5 and integers
      "^(?:[-+]?(?:[0-9]+)(?:\\.[0-9]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
    );
    const YAML_FLOAT_SPECIAL_PATTERN = new RegExp(
      "^(?:[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
    );
    function resolveYamlFloat(data) {
      if (data === null) return false;
      if (!YAML_FLOAT_PATTERN.test(data)) {
        return false;
      }
      if (isFinite(parseFloat(data, 10))) {
        return true;
      }
      return YAML_FLOAT_SPECIAL_PATTERN.test(data);
    }
    function constructYamlFloat(data) {
      let value = data.toLowerCase();
      const sign = value[0] === "-" ? -1 : 1;
      if ("+-".indexOf(value[0]) >= 0) {
        value = value.slice(1);
      }
      if (value === ".inf") {
        return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      } else if (value === ".nan") {
        return NaN;
      }
      return sign * parseFloat(value, 10);
    }
    const SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
    function representYamlFloat(object, style) {
      if (isNaN(object)) {
        switch (style) {
          case "lowercase":
            return ".nan";
          case "uppercase":
            return ".NAN";
          case "camelcase":
            return ".NaN";
        }
      } else if (Number.POSITIVE_INFINITY === object) {
        switch (style) {
          case "lowercase":
            return ".inf";
          case "uppercase":
            return ".INF";
          case "camelcase":
            return ".Inf";
        }
      } else if (Number.NEGATIVE_INFINITY === object) {
        switch (style) {
          case "lowercase":
            return "-.inf";
          case "uppercase":
            return "-.INF";
          case "camelcase":
            return "-.Inf";
        }
      } else if (common2.isNegativeZero(object)) {
        return "-0.0";
      }
      const res = object.toString(10);
      return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
    }
    function isFloat(object) {
      return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common2.isNegativeZero(object));
    }
    float = new Type2("tag:yaml.org,2002:float", {
      kind: "scalar",
      resolve: resolveYamlFloat,
      construct: constructYamlFloat,
      predicate: isFloat,
      represent: representYamlFloat,
      defaultStyle: "lowercase"
    });
    return float;
  }
  var json;
  var hasRequiredJson;
  function requireJson() {
    if (hasRequiredJson) return json;
    hasRequiredJson = 1;
    json = requireFailsafe().extend({
      implicit: [
        require_null(),
        requireBool(),
        requireInt(),
        requireFloat()
      ]
    });
    return json;
  }
  var core;
  var hasRequiredCore;
  function requireCore() {
    if (hasRequiredCore) return core;
    hasRequiredCore = 1;
    core = requireJson();
    return core;
  }
  var timestamp;
  var hasRequiredTimestamp;
  function requireTimestamp() {
    if (hasRequiredTimestamp) return timestamp;
    hasRequiredTimestamp = 1;
    const Type2 = requireType();
    const YAML_DATE_REGEXP = new RegExp(
      "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
    );
    const YAML_TIMESTAMP_REGEXP = new RegExp(
      "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
    );
    function resolveYamlTimestamp(data) {
      if (data === null) return false;
      if (YAML_DATE_REGEXP.exec(data) !== null) return true;
      if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
      return false;
    }
    function constructYamlTimestamp(data) {
      let fraction = 0;
      let delta = null;
      let match = YAML_DATE_REGEXP.exec(data);
      if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
      if (match === null) throw new Error("Date resolve error");
      const year = +match[1];
      const month = +match[2] - 1;
      const day = +match[3];
      if (!match[4]) {
        return new Date(Date.UTC(year, month, day));
      }
      const hour = +match[4];
      const minute = +match[5];
      const second = +match[6];
      if (match[7]) {
        fraction = match[7].slice(0, 3);
        while (fraction.length < 3) {
          fraction += "0";
        }
        fraction = +fraction;
      }
      if (match[9]) {
        const tzHour = +match[10];
        const tzMinute = +(match[11] || 0);
        delta = (tzHour * 60 + tzMinute) * 6e4;
        if (match[9] === "-") delta = -delta;
      }
      const date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
      if (delta) date.setTime(date.getTime() - delta);
      return date;
    }
    function representYamlTimestamp(object) {
      return object.toISOString();
    }
    timestamp = new Type2("tag:yaml.org,2002:timestamp", {
      kind: "scalar",
      resolve: resolveYamlTimestamp,
      construct: constructYamlTimestamp,
      instanceOf: Date,
      represent: representYamlTimestamp
    });
    return timestamp;
  }
  var merge;
  var hasRequiredMerge;
  function requireMerge() {
    if (hasRequiredMerge) return merge;
    hasRequiredMerge = 1;
    const Type2 = requireType();
    function resolveYamlMerge(data) {
      return data === "<<" || data === null;
    }
    merge = new Type2("tag:yaml.org,2002:merge", {
      kind: "scalar",
      resolve: resolveYamlMerge
    });
    return merge;
  }
  var binary;
  var hasRequiredBinary;
  function requireBinary() {
    if (hasRequiredBinary) return binary;
    hasRequiredBinary = 1;
    const Type2 = requireType();
    const BASE64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
    function resolveYamlBinary(data) {
      if (data === null) return false;
      let bitlen = 0;
      const max = data.length;
      const map2 = BASE64_MAP;
      for (let idx = 0; idx < max; idx++) {
        const code = map2.indexOf(data.charAt(idx));
        if (code > 64) continue;
        if (code < 0) return false;
        bitlen += 6;
      }
      return bitlen % 8 === 0;
    }
    function constructYamlBinary(data) {
      const input = data.replace(/[\r\n=]/g, "");
      const max = input.length;
      const map2 = BASE64_MAP;
      let bits = 0;
      const result = [];
      for (let idx = 0; idx < max; idx++) {
        if (idx % 4 === 0 && idx) {
          result.push(bits >> 16 & 255);
          result.push(bits >> 8 & 255);
          result.push(bits & 255);
        }
        bits = bits << 6 | map2.indexOf(input.charAt(idx));
      }
      const tailbits = max % 4 * 6;
      if (tailbits === 0) {
        result.push(bits >> 16 & 255);
        result.push(bits >> 8 & 255);
        result.push(bits & 255);
      } else if (tailbits === 18) {
        result.push(bits >> 10 & 255);
        result.push(bits >> 2 & 255);
      } else if (tailbits === 12) {
        result.push(bits >> 4 & 255);
      }
      return new Uint8Array(result);
    }
    function representYamlBinary(object) {
      let result = "";
      let bits = 0;
      const max = object.length;
      const map2 = BASE64_MAP;
      for (let idx = 0; idx < max; idx++) {
        if (idx % 3 === 0 && idx) {
          result += map2[bits >> 18 & 63];
          result += map2[bits >> 12 & 63];
          result += map2[bits >> 6 & 63];
          result += map2[bits & 63];
        }
        bits = (bits << 8) + object[idx];
      }
      const tail = max % 3;
      if (tail === 0) {
        result += map2[bits >> 18 & 63];
        result += map2[bits >> 12 & 63];
        result += map2[bits >> 6 & 63];
        result += map2[bits & 63];
      } else if (tail === 2) {
        result += map2[bits >> 10 & 63];
        result += map2[bits >> 4 & 63];
        result += map2[bits << 2 & 63];
        result += map2[64];
      } else if (tail === 1) {
        result += map2[bits >> 2 & 63];
        result += map2[bits << 4 & 63];
        result += map2[64];
        result += map2[64];
      }
      return result;
    }
    function isBinary(obj) {
      return Object.prototype.toString.call(obj) === "[object Uint8Array]";
    }
    binary = new Type2("tag:yaml.org,2002:binary", {
      kind: "scalar",
      resolve: resolveYamlBinary,
      construct: constructYamlBinary,
      predicate: isBinary,
      represent: representYamlBinary
    });
    return binary;
  }
  var omap;
  var hasRequiredOmap;
  function requireOmap() {
    if (hasRequiredOmap) return omap;
    hasRequiredOmap = 1;
    const Type2 = requireType();
    const _hasOwnProperty = Object.prototype.hasOwnProperty;
    const _toString = Object.prototype.toString;
    function resolveYamlOmap(data) {
      if (data === null) return true;
      const objectKeys = {};
      const object = data;
      for (let index = 0, length = object.length; index < length; index += 1) {
        const pair = object[index];
        let pairHasKey = false;
        if (_toString.call(pair) !== "[object Object]") return false;
        let pairKey;
        for (pairKey in pair) {
          if (_hasOwnProperty.call(pair, pairKey)) {
            if (!pairHasKey) pairHasKey = true;
            else return false;
          }
        }
        if (!pairHasKey) return false;
        if (_hasOwnProperty.call(objectKeys, pairKey)) return false;
        Object.defineProperty(objectKeys, pairKey, { value: true });
      }
      return true;
    }
    function constructYamlOmap(data) {
      return data !== null ? data : [];
    }
    omap = new Type2("tag:yaml.org,2002:omap", {
      kind: "sequence",
      resolve: resolveYamlOmap,
      construct: constructYamlOmap
    });
    return omap;
  }
  var pairs;
  var hasRequiredPairs;
  function requirePairs() {
    if (hasRequiredPairs) return pairs;
    hasRequiredPairs = 1;
    const Type2 = requireType();
    const _toString = Object.prototype.toString;
    function resolveYamlPairs(data) {
      if (data === null) return true;
      const object = data;
      const result = new Array(object.length);
      for (let index = 0, length = object.length; index < length; index += 1) {
        const pair = object[index];
        if (_toString.call(pair) !== "[object Object]") return false;
        const keys = Object.keys(pair);
        if (keys.length !== 1) return false;
        result[index] = [keys[0], pair[keys[0]]];
      }
      return true;
    }
    function constructYamlPairs(data) {
      if (data === null) return [];
      const object = data;
      const result = new Array(object.length);
      for (let index = 0, length = object.length; index < length; index += 1) {
        const pair = object[index];
        const keys = Object.keys(pair);
        result[index] = [keys[0], pair[keys[0]]];
      }
      return result;
    }
    pairs = new Type2("tag:yaml.org,2002:pairs", {
      kind: "sequence",
      resolve: resolveYamlPairs,
      construct: constructYamlPairs
    });
    return pairs;
  }
  var set;
  var hasRequiredSet;
  function requireSet() {
    if (hasRequiredSet) return set;
    hasRequiredSet = 1;
    const Type2 = requireType();
    const _hasOwnProperty = Object.prototype.hasOwnProperty;
    function resolveYamlSet(data) {
      if (data === null) return true;
      const object = data;
      for (const key in object) {
        if (_hasOwnProperty.call(object, key)) {
          if (object[key] !== null) return false;
        }
      }
      return true;
    }
    function constructYamlSet(data) {
      return data !== null ? data : {};
    }
    set = new Type2("tag:yaml.org,2002:set", {
      kind: "mapping",
      resolve: resolveYamlSet,
      construct: constructYamlSet
    });
    return set;
  }
  var _default;
  var hasRequired_default;
  function require_default() {
    if (hasRequired_default) return _default;
    hasRequired_default = 1;
    _default = requireCore().extend({
      implicit: [
        requireTimestamp(),
        requireMerge()
      ],
      explicit: [
        requireBinary(),
        requireOmap(),
        requirePairs(),
        requireSet()
      ]
    });
    return _default;
  }
  var hasRequiredLoader;
  function requireLoader() {
    if (hasRequiredLoader) return loader;
    hasRequiredLoader = 1;
    const common2 = requireCommon();
    const YAMLException2 = requireException();
    const makeSnippet = requireSnippet();
    const DEFAULT_SCHEMA2 = require_default();
    const _hasOwnProperty = Object.prototype.hasOwnProperty;
    const CONTEXT_FLOW_IN = 1;
    const CONTEXT_FLOW_OUT = 2;
    const CONTEXT_BLOCK_IN = 3;
    const CONTEXT_BLOCK_OUT = 4;
    const CHOMPING_CLIP = 1;
    const CHOMPING_STRIP = 2;
    const CHOMPING_KEEP = 3;
    const PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
    const PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
    const PATTERN_FLOW_INDICATORS = /[,\[\]{}]/;
    const PATTERN_TAG_HANDLE = /^(?:!|!!|![0-9A-Za-z-]+!)$/;
    const PATTERN_TAG_URI = /^(?:!|[^,\[\]{}])(?:%[0-9a-f]{2}|[0-9a-z\-#;/?:@&=+$,_.!~*'()\[\]])*$/i;
    function _class(obj) {
      return Object.prototype.toString.call(obj);
    }
    function isEol(c) {
      return c === 10 || c === 13;
    }
    function isWhiteSpace(c) {
      return c === 9 || c === 32;
    }
    function isWsOrEol(c) {
      return c === 9 || c === 32 || c === 10 || c === 13;
    }
    function isFlowIndicator(c) {
      return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
    }
    function fromHexCode(c) {
      if (c >= 48 && c <= 57) {
        return c - 48;
      }
      const lc = c | 32;
      if (lc >= 97 && lc <= 102) {
        return lc - 97 + 10;
      }
      return -1;
    }
    function escapedHexLen(c) {
      if (c === 120) {
        return 2;
      }
      if (c === 117) {
        return 4;
      }
      if (c === 85) {
        return 8;
      }
      return 0;
    }
    function fromDecimalCode(c) {
      if (c >= 48 && c <= 57) {
        return c - 48;
      }
      return -1;
    }
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
    function charFromCodepoint(c) {
      if (c <= 65535) {
        return String.fromCharCode(c);
      }
      return String.fromCharCode(
        (c - 65536 >> 10) + 55296,
        (c - 65536 & 1023) + 56320
      );
    }
    function setProperty(object, key, value) {
      if (key === "__proto__") {
        Object.defineProperty(object, key, {
          configurable: true,
          enumerable: true,
          writable: true,
          value
        });
      } else {
        object[key] = value;
      }
    }
    const simpleEscapeCheck = new Array(256);
    const simpleEscapeMap = new Array(256);
    for (let i = 0; i < 256; i++) {
      simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
      simpleEscapeMap[i] = simpleEscapeSequence(i);
    }
    function State(input, options) {
      this.input = input;
      this.filename = options["filename"] || null;
      this.schema = options["schema"] || DEFAULT_SCHEMA2;
      this.onWarning = options["onWarning"] || null;
      this.legacy = options["legacy"] || false;
      this.json = options["json"] || false;
      this.listener = options["listener"] || null;
      this.maxDepth = typeof options["maxDepth"] === "number" ? options["maxDepth"] : 100;
      this.maxTotalMergeKeys = typeof options["maxTotalMergeKeys"] === "number" ? options["maxTotalMergeKeys"] : 1e4;
      this.implicitTypes = this.schema.compiledImplicit;
      this.typeMap = this.schema.compiledTypeMap;
      this.length = input.length;
      this.position = 0;
      this.line = 0;
      this.lineStart = 0;
      this.lineIndent = 0;
      this.depth = 0;
      this.totalMergeKeys = 0;
      this.firstTabInLine = -1;
      this.documents = [];
      this.anchorMapTransactions = [];
    }
    function generateError(state, message) {
      const mark = {
        name: state.filename,
        buffer: state.input.slice(0, -1),
        // omit trailing \0
        position: state.position,
        line: state.line,
        column: state.position - state.lineStart
      };
      mark.snippet = makeSnippet(mark);
      return new YAMLException2(message, mark);
    }
    function throwError(state, message) {
      throw generateError(state, message);
    }
    function throwWarning(state, message) {
      if (state.onWarning) {
        state.onWarning.call(null, generateError(state, message));
      }
    }
    function storeAnchor(state, name, value) {
      const transactions = state.anchorMapTransactions;
      if (transactions.length !== 0) {
        const transaction = transactions[transactions.length - 1];
        if (!_hasOwnProperty.call(transaction, name)) {
          transaction[name] = {
            existed: _hasOwnProperty.call(state.anchorMap, name),
            value: state.anchorMap[name]
          };
        }
      }
      state.anchorMap[name] = value;
    }
    function beginAnchorTransaction(state) {
      state.anchorMapTransactions.push(/* @__PURE__ */ Object.create(null));
    }
    function commitAnchorTransaction(state) {
      const transaction = state.anchorMapTransactions.pop();
      const transactions = state.anchorMapTransactions;
      if (transactions.length === 0) return;
      const parent = transactions[transactions.length - 1];
      const names = Object.keys(transaction);
      for (let index = 0, length = names.length; index < length; index += 1) {
        const name = names[index];
        if (!_hasOwnProperty.call(parent, name)) {
          parent[name] = transaction[name];
        }
      }
    }
    function rollbackAnchorTransaction(state) {
      const transaction = state.anchorMapTransactions.pop();
      const names = Object.keys(transaction);
      for (let index = names.length - 1; index >= 0; index -= 1) {
        const entry = transaction[names[index]];
        if (entry.existed) {
          state.anchorMap[names[index]] = entry.value;
        } else {
          delete state.anchorMap[names[index]];
        }
      }
    }
    function snapshotState(state) {
      return {
        position: state.position,
        line: state.line,
        lineStart: state.lineStart,
        lineIndent: state.lineIndent,
        firstTabInLine: state.firstTabInLine,
        tag: state.tag,
        anchor: state.anchor,
        kind: state.kind,
        result: state.result
      };
    }
    function restoreState(state, snapshot) {
      state.position = snapshot.position;
      state.line = snapshot.line;
      state.lineStart = snapshot.lineStart;
      state.lineIndent = snapshot.lineIndent;
      state.firstTabInLine = snapshot.firstTabInLine;
      state.tag = snapshot.tag;
      state.anchor = snapshot.anchor;
      state.kind = snapshot.kind;
      state.result = snapshot.result;
    }
    const directiveHandlers = {
      YAML: function handleYamlDirective(state, name, args) {
        if (state.version !== null) {
          throwError(state, "duplication of %YAML directive");
        }
        if (args.length !== 1) {
          throwError(state, "YAML directive accepts exactly one argument");
        }
        const match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
        if (match === null) {
          throwError(state, "ill-formed argument of the YAML directive");
        }
        const major = parseInt(match[1], 10);
        const minor = parseInt(match[2], 10);
        if (major !== 1) {
          throwError(state, "unacceptable YAML version of the document");
        }
        state.version = args[0];
        state.checkLineBreaks = minor < 2;
        if (minor !== 1 && minor !== 2) {
          throwWarning(state, "unsupported YAML version of the document");
        }
      },
      TAG: function handleTagDirective(state, name, args) {
        let prefix;
        if (args.length !== 2) {
          throwError(state, "TAG directive accepts exactly two arguments");
        }
        const handle = args[0];
        prefix = args[1];
        if (!PATTERN_TAG_HANDLE.test(handle)) {
          throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
        }
        if (_hasOwnProperty.call(state.tagMap, handle)) {
          throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
        }
        if (!PATTERN_TAG_URI.test(prefix)) {
          throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
        }
        try {
          prefix = decodeURIComponent(prefix);
        } catch (err) {
          throwError(state, "tag prefix is malformed: " + prefix);
        }
        state.tagMap[handle] = prefix;
      }
    };
    function captureSegment(state, start2, end, checkJson) {
      if (start2 < end) {
        const _result = state.input.slice(start2, end);
        if (checkJson) {
          for (let _position = 0, _length = _result.length; _position < _length; _position += 1) {
            const _character = _result.charCodeAt(_position);
            if (!(_character === 9 || _character >= 32 && _character <= 1114111)) {
              throwError(state, "expected valid JSON character");
            }
          }
        } else if (PATTERN_NON_PRINTABLE.test(_result)) {
          throwError(state, "the stream contains non-printable characters");
        }
        state.result += _result;
      }
    }
    function chargeMergeWork(state) {
      state.totalMergeKeys++;
      if (state.maxTotalMergeKeys !== -1 && state.totalMergeKeys > state.maxTotalMergeKeys) {
        throwError(state, "merge keys exceeded maxTotalMergeKeys (" + state.maxTotalMergeKeys + ")");
      }
    }
    function mergeMappings(state, destination, source, overridableKeys) {
      if (!common2.isObject(source)) {
        throwError(state, "cannot merge mappings; the provided source object is unacceptable");
      }
      chargeMergeWork(state);
      const sourceKeys = Object.keys(source);
      for (let index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
        const key = sourceKeys[index];
        chargeMergeWork(state);
        if (!_hasOwnProperty.call(destination, key)) {
          setProperty(destination, key, source[key]);
          overridableKeys[key] = true;
        }
      }
    }
    function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
      if (Array.isArray(keyNode)) {
        keyNode = Array.prototype.slice.call(keyNode);
        for (let index = 0, quantity = keyNode.length; index < quantity; index += 1) {
          if (Array.isArray(keyNode[index])) {
            throwError(state, "nested arrays are not supported inside keys");
          }
          if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") {
            keyNode[index] = "[object Object]";
          }
        }
      }
      if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
        keyNode = "[object Object]";
      }
      keyNode = String(keyNode);
      if (_result === null) {
        _result = {};
      }
      if (keyTag === "tag:yaml.org,2002:merge") {
        if (Array.isArray(valueNode)) {
          if (valueNode.length > 100) {
            throwError(state, "abnormal merge sequence size");
          }
          for (let index = 0, quantity = valueNode.length; index < quantity; index += 1) {
            mergeMappings(state, _result, valueNode[index], overridableKeys);
          }
        } else {
          mergeMappings(state, _result, valueNode, overridableKeys);
        }
      } else {
        if (!state.json && !_hasOwnProperty.call(overridableKeys, keyNode) && _hasOwnProperty.call(_result, keyNode)) {
          state.line = startLine || state.line;
          state.lineStart = startLineStart || state.lineStart;
          state.position = startPos || state.position;
          throwError(state, "duplicated mapping key");
        }
        setProperty(_result, keyNode, valueNode);
        delete overridableKeys[keyNode];
      }
      return _result;
    }
    function readLineBreak(state) {
      const ch = state.input.charCodeAt(state.position);
      if (ch === 10) {
        state.position++;
      } else if (ch === 13) {
        state.position++;
        if (state.input.charCodeAt(state.position) === 10) {
          state.position++;
        }
      } else {
        throwError(state, "a line break is expected");
      }
      state.line += 1;
      state.lineStart = state.position;
      state.firstTabInLine = -1;
    }
    function skipSeparationSpace(state, allowComments, checkIndent) {
      let lineBreaks = 0;
      let ch = state.input.charCodeAt(state.position);
      while (ch !== 0) {
        while (isWhiteSpace(ch)) {
          if (ch === 9 && state.firstTabInLine === -1) {
            state.firstTabInLine = state.position;
          }
          ch = state.input.charCodeAt(++state.position);
        }
        if (allowComments && ch === 35) {
          do {
            ch = state.input.charCodeAt(++state.position);
          } while (ch !== 10 && ch !== 13 && ch !== 0);
        }
        if (isEol(ch)) {
          readLineBreak(state);
          ch = state.input.charCodeAt(state.position);
          lineBreaks++;
          state.lineIndent = 0;
          while (ch === 32) {
            state.lineIndent++;
            ch = state.input.charCodeAt(++state.position);
          }
        } else {
          break;
        }
      }
      if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
        throwWarning(state, "deficient indentation");
      }
      return lineBreaks;
    }
    function testDocumentSeparator(state) {
      let _position = state.position;
      let ch = state.input.charCodeAt(_position);
      if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
        _position += 3;
        ch = state.input.charCodeAt(_position);
        if (ch === 0 || isWsOrEol(ch)) {
          return true;
        }
      }
      return false;
    }
    function writeFoldedLines(state, count) {
      if (count === 1) {
        state.result += " ";
      } else if (count > 1) {
        state.result += common2.repeat("\n", count - 1);
      }
    }
    function readPlainScalar(state, nodeIndent, withinFlowCollection) {
      let captureStart;
      let captureEnd;
      let hasPendingContent;
      let _line;
      let _lineStart;
      let _lineIndent;
      const _kind = state.kind;
      const _result = state.result;
      let ch = state.input.charCodeAt(state.position);
      if (isWsOrEol(ch) || isFlowIndicator(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) {
        return false;
      }
      if (ch === 63 || ch === 45) {
        const following = state.input.charCodeAt(state.position + 1);
        if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) {
          return false;
        }
      }
      state.kind = "scalar";
      state.result = "";
      captureStart = captureEnd = state.position;
      hasPendingContent = false;
      while (ch !== 0) {
        if (ch === 58) {
          const following = state.input.charCodeAt(state.position + 1);
          if (isWsOrEol(following) || withinFlowCollection && isFlowIndicator(following)) {
            break;
          }
        } else if (ch === 35) {
          const preceding = state.input.charCodeAt(state.position - 1);
          if (isWsOrEol(preceding)) {
            break;
          }
        } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && isFlowIndicator(ch)) {
          break;
        } else if (isEol(ch)) {
          _line = state.line;
          _lineStart = state.lineStart;
          _lineIndent = state.lineIndent;
          skipSeparationSpace(state, false, -1);
          if (state.lineIndent >= nodeIndent) {
            hasPendingContent = true;
            ch = state.input.charCodeAt(state.position);
            continue;
          } else {
            state.position = captureEnd;
            state.line = _line;
            state.lineStart = _lineStart;
            state.lineIndent = _lineIndent;
            break;
          }
        }
        if (hasPendingContent) {
          captureSegment(state, captureStart, captureEnd, false);
          writeFoldedLines(state, state.line - _line);
          captureStart = captureEnd = state.position;
          hasPendingContent = false;
        }
        if (!isWhiteSpace(ch)) {
          captureEnd = state.position + 1;
        }
        ch = state.input.charCodeAt(++state.position);
      }
      captureSegment(state, captureStart, captureEnd, false);
      if (state.result) {
        return true;
      }
      state.kind = _kind;
      state.result = _result;
      return false;
    }
    function readSingleQuotedScalar(state, nodeIndent) {
      let captureStart;
      let captureEnd;
      let ch = state.input.charCodeAt(state.position);
      if (ch !== 39) {
        return false;
      }
      state.kind = "scalar";
      state.result = "";
      state.position++;
      captureStart = captureEnd = state.position;
      while ((ch = state.input.charCodeAt(state.position)) !== 0) {
        if (ch === 39) {
          captureSegment(state, captureStart, state.position, true);
          ch = state.input.charCodeAt(++state.position);
          if (ch === 39) {
            captureStart = state.position;
            state.position++;
            captureEnd = state.position;
          } else {
            return true;
          }
        } else if (isEol(ch)) {
          captureSegment(state, captureStart, captureEnd, true);
          writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
          captureStart = captureEnd = state.position;
        } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
          throwError(state, "unexpected end of the document within a single quoted scalar");
        } else {
          state.position++;
          if (!isWhiteSpace(ch)) {
            captureEnd = state.position;
          }
        }
      }
      throwError(state, "unexpected end of the stream within a single quoted scalar");
    }
    function readDoubleQuotedScalar(state, nodeIndent) {
      let captureStart;
      let captureEnd;
      let tmp;
      let ch = state.input.charCodeAt(state.position);
      if (ch !== 34) {
        return false;
      }
      state.kind = "scalar";
      state.result = "";
      state.position++;
      captureStart = captureEnd = state.position;
      while ((ch = state.input.charCodeAt(state.position)) !== 0) {
        if (ch === 34) {
          captureSegment(state, captureStart, state.position, true);
          state.position++;
          return true;
        } else if (ch === 92) {
          captureSegment(state, captureStart, state.position, true);
          ch = state.input.charCodeAt(++state.position);
          if (isEol(ch)) {
            skipSeparationSpace(state, false, nodeIndent);
          } else if (ch < 256 && simpleEscapeCheck[ch]) {
            state.result += simpleEscapeMap[ch];
            state.position++;
          } else if ((tmp = escapedHexLen(ch)) > 0) {
            let hexLength = tmp;
            let hexResult = 0;
            for (; hexLength > 0; hexLength--) {
              ch = state.input.charCodeAt(++state.position);
              if ((tmp = fromHexCode(ch)) >= 0) {
                hexResult = (hexResult << 4) + tmp;
              } else {
                throwError(state, "expected hexadecimal character");
              }
            }
            state.result += charFromCodepoint(hexResult);
            state.position++;
          } else {
            throwError(state, "unknown escape sequence");
          }
          captureStart = captureEnd = state.position;
        } else if (isEol(ch)) {
          captureSegment(state, captureStart, captureEnd, true);
          writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
          captureStart = captureEnd = state.position;
        } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
          throwError(state, "unexpected end of the document within a double quoted scalar");
        } else {
          state.position++;
          if (!isWhiteSpace(ch)) {
            captureEnd = state.position;
          }
        }
      }
      throwError(state, "unexpected end of the stream within a double quoted scalar");
    }
    function readFlowCollection(state, nodeIndent) {
      let readNext = true;
      let _line;
      let _lineStart;
      let _pos;
      const _tag = state.tag;
      let _result;
      const _anchor = state.anchor;
      let terminator;
      let isPair;
      let isExplicitPair;
      let isMapping;
      const overridableKeys = /* @__PURE__ */ Object.create(null);
      let keyNode;
      let keyTag;
      let valueNode;
      let ch = state.input.charCodeAt(state.position);
      if (ch === 91) {
        terminator = 93;
        isMapping = false;
        _result = [];
      } else if (ch === 123) {
        terminator = 125;
        isMapping = true;
        _result = {};
      } else {
        return false;
      }
      if (state.anchor !== null) {
        storeAnchor(state, state.anchor, _result);
      }
      ch = state.input.charCodeAt(++state.position);
      while (ch !== 0) {
        skipSeparationSpace(state, true, nodeIndent);
        ch = state.input.charCodeAt(state.position);
        if (ch === terminator) {
          state.position++;
          state.tag = _tag;
          state.anchor = _anchor;
          state.kind = isMapping ? "mapping" : "sequence";
          state.result = _result;
          return true;
        } else if (!readNext) {
          throwError(state, "missed comma between flow collection entries");
        } else if (ch === 44) {
          throwError(state, "expected the node content, but found ','");
        }
        keyTag = keyNode = valueNode = null;
        isPair = isExplicitPair = false;
        if (ch === 63) {
          const following = state.input.charCodeAt(state.position + 1);
          if (isWsOrEol(following)) {
            isPair = isExplicitPair = true;
            state.position++;
            skipSeparationSpace(state, true, nodeIndent);
          }
        }
        _line = state.line;
        _lineStart = state.lineStart;
        _pos = state.position;
        composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
        keyTag = state.tag;
        keyNode = state.result;
        skipSeparationSpace(state, true, nodeIndent);
        ch = state.input.charCodeAt(state.position);
        if ((isExplicitPair || state.line === _line) && ch === 58) {
          isPair = true;
          ch = state.input.charCodeAt(++state.position);
          skipSeparationSpace(state, true, nodeIndent);
          composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
          valueNode = state.result;
        }
        if (isMapping) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
        } else if (isPair) {
          _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
        } else {
          _result.push(keyNode);
        }
        skipSeparationSpace(state, true, nodeIndent);
        ch = state.input.charCodeAt(state.position);
        if (ch === 44) {
          readNext = true;
          ch = state.input.charCodeAt(++state.position);
        } else {
          readNext = false;
        }
      }
      throwError(state, "unexpected end of the stream within a flow collection");
    }
    function readBlockScalar(state, nodeIndent) {
      let folding;
      let chomping = CHOMPING_CLIP;
      let didReadContent = false;
      let detectedIndent = false;
      let textIndent = nodeIndent;
      let emptyLines = 0;
      let atMoreIndented = false;
      let tmp;
      let ch = state.input.charCodeAt(state.position);
      if (ch === 124) {
        folding = false;
      } else if (ch === 62) {
        folding = true;
      } else {
        return false;
      }
      state.kind = "scalar";
      state.result = "";
      while (ch !== 0) {
        ch = state.input.charCodeAt(++state.position);
        if (ch === 43 || ch === 45) {
          if (CHOMPING_CLIP === chomping) {
            chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
          } else {
            throwError(state, "repeat of a chomping mode identifier");
          }
        } else if ((tmp = fromDecimalCode(ch)) >= 0) {
          if (tmp === 0) {
            throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
          } else if (!detectedIndent) {
            textIndent = nodeIndent + tmp - 1;
            detectedIndent = true;
          } else {
            throwError(state, "repeat of an indentation width identifier");
          }
        } else {
          break;
        }
      }
      if (isWhiteSpace(ch)) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (isWhiteSpace(ch));
        if (ch === 35) {
          do {
            ch = state.input.charCodeAt(++state.position);
          } while (!isEol(ch) && ch !== 0);
        }
      }
      while (ch !== 0) {
        readLineBreak(state);
        state.lineIndent = 0;
        ch = state.input.charCodeAt(state.position);
        while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
          state.lineIndent++;
          ch = state.input.charCodeAt(++state.position);
        }
        if (!detectedIndent && state.lineIndent > textIndent) {
          textIndent = state.lineIndent;
        }
        if (isEol(ch)) {
          emptyLines++;
          continue;
        }
        if (!detectedIndent && textIndent === 0) {
          throwError(state, "missing indentation for block scalar");
        }
        if (state.lineIndent < textIndent) {
          if (chomping === CHOMPING_KEEP) {
            state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
          } else if (chomping === CHOMPING_CLIP) {
            if (didReadContent) {
              state.result += "\n";
            }
          }
          break;
        }
        if (folding) {
          if (isWhiteSpace(ch)) {
            atMoreIndented = true;
            state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
          } else if (atMoreIndented) {
            atMoreIndented = false;
            state.result += common2.repeat("\n", emptyLines + 1);
          } else if (emptyLines === 0) {
            if (didReadContent) {
              state.result += " ";
            }
          } else {
            state.result += common2.repeat("\n", emptyLines);
          }
        } else {
          state.result += common2.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
        }
        didReadContent = true;
        detectedIndent = true;
        emptyLines = 0;
        const captureStart = state.position;
        while (!isEol(ch) && ch !== 0) {
          ch = state.input.charCodeAt(++state.position);
        }
        captureSegment(state, captureStart, state.position, false);
      }
      return true;
    }
    function readBlockSequence(state, nodeIndent) {
      const _tag = state.tag;
      const _anchor = state.anchor;
      const _result = [];
      let detected = false;
      if (state.firstTabInLine !== -1) return false;
      if (state.anchor !== null) {
        storeAnchor(state, state.anchor, _result);
      }
      let ch = state.input.charCodeAt(state.position);
      while (ch !== 0) {
        if (state.firstTabInLine !== -1) {
          state.position = state.firstTabInLine;
          throwError(state, "tab characters must not be used in indentation");
        }
        if (ch !== 45) {
          break;
        }
        const following = state.input.charCodeAt(state.position + 1);
        if (!isWsOrEol(following)) {
          break;
        }
        detected = true;
        state.position++;
        if (skipSeparationSpace(state, true, -1)) {
          if (state.lineIndent <= nodeIndent) {
            _result.push(null);
            ch = state.input.charCodeAt(state.position);
            continue;
          }
        }
        const _line = state.line;
        composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
        _result.push(state.result);
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
        if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
          throwError(state, "bad indentation of a sequence entry");
        } else if (state.lineIndent < nodeIndent) {
          break;
        }
      }
      if (detected) {
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = "sequence";
        state.result = _result;
        return true;
      }
      return false;
    }
    function readBlockMapping(state, nodeIndent, flowIndent) {
      let allowCompact;
      let _keyLine;
      let _keyLineStart;
      let _keyPos;
      const _tag = state.tag;
      const _anchor = state.anchor;
      const _result = {};
      const overridableKeys = /* @__PURE__ */ Object.create(null);
      let keyTag = null;
      let keyNode = null;
      let valueNode = null;
      let atExplicitKey = false;
      let detected = false;
      if (state.firstTabInLine !== -1) return false;
      if (state.anchor !== null) {
        storeAnchor(state, state.anchor, _result);
      }
      let ch = state.input.charCodeAt(state.position);
      while (ch !== 0) {
        if (!atExplicitKey && state.firstTabInLine !== -1) {
          state.position = state.firstTabInLine;
          throwError(state, "tab characters must not be used in indentation");
        }
        const following = state.input.charCodeAt(state.position + 1);
        const _line = state.line;
        if ((ch === 63 || ch === 58) && isWsOrEol(following)) {
          if (ch === 63) {
            if (atExplicitKey) {
              storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
              keyTag = keyNode = valueNode = null;
            }
            detected = true;
            atExplicitKey = true;
            allowCompact = true;
          } else if (atExplicitKey) {
            atExplicitKey = false;
            allowCompact = true;
          } else {
            throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
          }
          state.position += 1;
          ch = following;
        } else {
          _keyLine = state.line;
          _keyLineStart = state.lineStart;
          _keyPos = state.position;
          if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
            break;
          }
          if (state.line === _line) {
            ch = state.input.charCodeAt(state.position);
            while (isWhiteSpace(ch)) {
              ch = state.input.charCodeAt(++state.position);
            }
            if (ch === 58) {
              ch = state.input.charCodeAt(++state.position);
              if (!isWsOrEol(ch)) {
                throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
              }
              if (atExplicitKey) {
                storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
                keyTag = keyNode = valueNode = null;
              }
              detected = true;
              atExplicitKey = false;
              allowCompact = false;
              keyTag = state.tag;
              keyNode = state.result;
            } else if (detected) {
              throwError(state, "can not read an implicit mapping pair; a colon is missed");
            } else {
              state.tag = _tag;
              state.anchor = _anchor;
              return true;
            }
          } else if (detected) {
            throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
          } else {
            state.tag = _tag;
            state.anchor = _anchor;
            return true;
          }
        }
        if (state.line === _line || state.lineIndent > nodeIndent) {
          if (atExplicitKey) {
            _keyLine = state.line;
            _keyLineStart = state.lineStart;
            _keyPos = state.position;
          }
          if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
            if (atExplicitKey) {
              keyNode = state.result;
            } else {
              valueNode = state.result;
            }
          }
          if (!atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          skipSeparationSpace(state, true, -1);
          ch = state.input.charCodeAt(state.position);
        }
        if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
          throwError(state, "bad indentation of a mapping entry");
        } else if (state.lineIndent < nodeIndent) {
          break;
        }
      }
      if (atExplicitKey) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
      }
      if (detected) {
        state.tag = _tag;
        state.anchor = _anchor;
        state.kind = "mapping";
        state.result = _result;
      }
      return detected;
    }
    function readTagProperty(state) {
      let isVerbatim = false;
      let isNamed = false;
      let tagHandle;
      let tagName;
      let ch = state.input.charCodeAt(state.position);
      if (ch !== 33) return false;
      if (state.tag !== null) {
        throwError(state, "duplication of a tag property");
      }
      ch = state.input.charCodeAt(++state.position);
      if (ch === 60) {
        isVerbatim = true;
        ch = state.input.charCodeAt(++state.position);
      } else if (ch === 33) {
        isNamed = true;
        tagHandle = "!!";
        ch = state.input.charCodeAt(++state.position);
      } else {
        tagHandle = "!";
      }
      let _position = state.position;
      if (isVerbatim) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 0 && ch !== 62);
        if (state.position < state.length) {
          tagName = state.input.slice(_position, state.position);
          ch = state.input.charCodeAt(++state.position);
        } else {
          throwError(state, "unexpected end of the stream within a verbatim tag");
        }
      } else {
        while (ch !== 0 && !isWsOrEol(ch)) {
          if (ch === 33) {
            if (!isNamed) {
              tagHandle = state.input.slice(_position - 1, state.position + 1);
              if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
                throwError(state, "named tag handle cannot contain such characters");
              }
              isNamed = true;
              _position = state.position + 1;
            } else {
              throwError(state, "tag suffix cannot contain exclamation marks");
            }
          }
          ch = state.input.charCodeAt(++state.position);
        }
        tagName = state.input.slice(_position, state.position);
        if (PATTERN_FLOW_INDICATORS.test(tagName)) {
          throwError(state, "tag suffix cannot contain flow indicator characters");
        }
      }
      if (tagName && !PATTERN_TAG_URI.test(tagName)) {
        throwError(state, "tag name cannot contain such characters: " + tagName);
      }
      try {
        tagName = decodeURIComponent(tagName);
      } catch (err) {
        throwError(state, "tag name is malformed: " + tagName);
      }
      if (isVerbatim) {
        state.tag = tagName;
      } else if (_hasOwnProperty.call(state.tagMap, tagHandle)) {
        state.tag = state.tagMap[tagHandle] + tagName;
      } else if (tagHandle === "!") {
        state.tag = "!" + tagName;
      } else if (tagHandle === "!!") {
        state.tag = "tag:yaml.org,2002:" + tagName;
      } else {
        throwError(state, 'undeclared tag handle "' + tagHandle + '"');
      }
      return true;
    }
    function readAnchorProperty(state) {
      let ch = state.input.charCodeAt(state.position);
      if (ch !== 38) return false;
      if (state.anchor !== null) {
        throwError(state, "duplication of an anchor property");
      }
      ch = state.input.charCodeAt(++state.position);
      const _position = state.position;
      while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      if (state.position === _position) {
        throwError(state, "name of an anchor node must contain at least one character");
      }
      state.anchor = state.input.slice(_position, state.position);
      return true;
    }
    function readAlias(state) {
      let ch = state.input.charCodeAt(state.position);
      if (ch !== 42) return false;
      ch = state.input.charCodeAt(++state.position);
      const _position = state.position;
      while (ch !== 0 && !isWsOrEol(ch) && !isFlowIndicator(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      if (state.position === _position) {
        throwError(state, "name of an alias node must contain at least one character");
      }
      const alias = state.input.slice(_position, state.position);
      if (!_hasOwnProperty.call(state.anchorMap, alias)) {
        throwError(state, 'unidentified alias "' + alias + '"');
      }
      state.result = state.anchorMap[alias];
      skipSeparationSpace(state, true, -1);
      return true;
    }
    function tryReadBlockMappingFromProperty(state, propertyStart, nodeIndent, flowIndent) {
      const fallbackState = snapshotState(state);
      beginAnchorTransaction(state);
      restoreState(state, propertyStart);
      state.tag = null;
      state.anchor = null;
      state.kind = null;
      state.result = null;
      if (readBlockMapping(state, nodeIndent, flowIndent) && state.kind === "mapping") {
        commitAnchorTransaction(state);
        return true;
      }
      rollbackAnchorTransaction(state);
      restoreState(state, fallbackState);
      return false;
    }
    function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
      let allowBlockScalars;
      let allowBlockCollections;
      let indentStatus = 1;
      let atNewLine = false;
      let hasContent = false;
      let propertyStart = null;
      let type2;
      let flowIndent;
      let blockIndent;
      if (state.depth >= state.maxDepth) {
        throwError(state, "nesting exceeded maxDepth (" + state.maxDepth + ")");
      }
      state.depth += 1;
      if (state.listener !== null) {
        state.listener("open", state);
      }
      state.tag = null;
      state.anchor = null;
      state.kind = null;
      state.result = null;
      const allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
      if (allowToSeek) {
        if (skipSeparationSpace(state, true, -1)) {
          atNewLine = true;
          if (state.lineIndent > parentIndent) {
            indentStatus = 1;
          } else if (state.lineIndent === parentIndent) {
            indentStatus = 0;
          } else if (state.lineIndent < parentIndent) {
            indentStatus = -1;
          }
        }
      }
      if (indentStatus === 1) {
        while (true) {
          const ch = state.input.charCodeAt(state.position);
          const propertyState = snapshotState(state);
          if (atNewLine && (ch === 33 && state.tag !== null || ch === 38 && state.anchor !== null)) {
            break;
          }
          if (!readTagProperty(state) && !readAnchorProperty(state)) {
            break;
          }
          if (propertyStart === null) {
            propertyStart = propertyState;
          }
          if (skipSeparationSpace(state, true, -1)) {
            atNewLine = true;
            allowBlockCollections = allowBlockStyles;
            if (state.lineIndent > parentIndent) {
              indentStatus = 1;
            } else if (state.lineIndent === parentIndent) {
              indentStatus = 0;
            } else if (state.lineIndent < parentIndent) {
              indentStatus = -1;
            }
          } else {
            allowBlockCollections = false;
          }
        }
      }
      if (allowBlockCollections) {
        allowBlockCollections = atNewLine || allowCompact;
      }
      if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
        if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
          flowIndent = parentIndent;
        } else {
          flowIndent = parentIndent + 1;
        }
        blockIndent = state.position - state.lineStart;
        if (indentStatus === 1) {
          if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) {
            hasContent = true;
          } else {
            const ch = state.input.charCodeAt(state.position);
            if (propertyStart !== null && allowBlockStyles && !allowBlockCollections && ch !== 124 && ch !== 62 && tryReadBlockMappingFromProperty(
              state,
              propertyStart,
              propertyStart.position - propertyStart.lineStart,
              flowIndent
            )) {
              hasContent = true;
            } else if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) {
              hasContent = true;
            } else if (readAlias(state)) {
              hasContent = true;
              if (state.tag !== null || state.anchor !== null) {
                throwError(state, "alias node should not have any properties");
              }
            } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
              hasContent = true;
              if (state.tag === null) {
                state.tag = "?";
              }
            }
            if (state.anchor !== null) {
              storeAnchor(state, state.anchor, state.result);
            }
          }
        } else if (indentStatus === 0) {
          hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
        }
      }
      if (state.tag === null) {
        if (state.anchor !== null) {
          storeAnchor(state, state.anchor, state.result);
        }
      } else if (state.tag === "?") {
        if (state.result !== null && state.kind !== "scalar") {
          throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
        }
        for (let typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
          type2 = state.implicitTypes[typeIndex];
          if (type2.resolve(state.result)) {
            state.result = type2.construct(state.result);
            state.tag = type2.tag;
            if (state.anchor !== null) {
              storeAnchor(state, state.anchor, state.result);
            }
            break;
          }
        }
      } else if (state.tag !== "!") {
        if (_hasOwnProperty.call(state.typeMap[state.kind || "fallback"], state.tag)) {
          type2 = state.typeMap[state.kind || "fallback"][state.tag];
        } else {
          type2 = null;
          const typeList = state.typeMap.multi[state.kind || "fallback"];
          for (let typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) {
            if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
              type2 = typeList[typeIndex];
              break;
            }
          }
        }
        if (!type2) {
          throwError(state, "unknown tag !<" + state.tag + ">");
        }
        if (state.result !== null && type2.kind !== state.kind) {
          throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type2.kind + '", not "' + state.kind + '"');
        }
        if (!type2.resolve(state.result, state.tag)) {
          throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
        } else {
          state.result = type2.construct(state.result, state.tag);
          if (state.anchor !== null) {
            storeAnchor(state, state.anchor, state.result);
          }
        }
      }
      if (state.listener !== null) {
        state.listener("close", state);
      }
      state.depth -= 1;
      return state.tag !== null || state.anchor !== null || hasContent;
    }
    function readDocument(state) {
      const documentStart = state.position;
      let hasDirectives = false;
      let ch;
      state.version = null;
      state.checkLineBreaks = state.legacy;
      state.tagMap = /* @__PURE__ */ Object.create(null);
      state.anchorMap = /* @__PURE__ */ Object.create(null);
      while ((ch = state.input.charCodeAt(state.position)) !== 0) {
        skipSeparationSpace(state, true, -1);
        ch = state.input.charCodeAt(state.position);
        if (state.lineIndent > 0 || ch !== 37) {
          break;
        }
        hasDirectives = true;
        ch = state.input.charCodeAt(++state.position);
        let _position = state.position;
        while (ch !== 0 && !isWsOrEol(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        const directiveName = state.input.slice(_position, state.position);
        const directiveArgs = [];
        if (directiveName.length < 1) {
          throwError(state, "directive name must not be less than one character in length");
        }
        while (ch !== 0) {
          while (isWhiteSpace(ch)) {
            ch = state.input.charCodeAt(++state.position);
          }
          if (ch === 35) {
            do {
              ch = state.input.charCodeAt(++state.position);
            } while (ch !== 0 && !isEol(ch));
            break;
          }
          if (isEol(ch)) break;
          _position = state.position;
          while (ch !== 0 && !isWsOrEol(ch)) {
            ch = state.input.charCodeAt(++state.position);
          }
          directiveArgs.push(state.input.slice(_position, state.position));
        }
        if (ch !== 0) readLineBreak(state);
        if (_hasOwnProperty.call(directiveHandlers, directiveName)) {
          directiveHandlers[directiveName](state, directiveName, directiveArgs);
        } else {
          throwWarning(state, 'unknown document directive "' + directiveName + '"');
        }
      }
      skipSeparationSpace(state, true, -1);
      if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
        state.position += 3;
        skipSeparationSpace(state, true, -1);
      } else if (hasDirectives) {
        throwError(state, "directives end mark is expected");
      }
      composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
      skipSeparationSpace(state, true, -1);
      if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
        throwWarning(state, "non-ASCII line breaks are interpreted as content");
      }
      state.documents.push(state.result);
      if (state.position === state.lineStart && testDocumentSeparator(state)) {
        if (state.input.charCodeAt(state.position) === 46) {
          state.position += 3;
          skipSeparationSpace(state, true, -1);
        }
        return;
      }
      if (state.position < state.length - 1) {
        throwError(state, "end of the stream or a document separator is expected");
      }
    }
    function loadDocuments(input, options) {
      input = String(input);
      options = options || {};
      if (input.length !== 0) {
        if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
          input += "\n";
        }
        if (input.charCodeAt(0) === 65279) {
          input = input.slice(1);
        }
      }
      const state = new State(input, options);
      const nullpos = input.indexOf("\0");
      if (nullpos !== -1) {
        state.position = nullpos;
        throwError(state, "null byte is not allowed in input");
      }
      state.input += "\0";
      while (state.input.charCodeAt(state.position) === 32) {
        state.lineIndent += 1;
        state.position += 1;
      }
      while (state.position < state.length - 1) {
        readDocument(state);
      }
      return state.documents;
    }
    function loadAll2(input, iterator, options) {
      if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
        options = iterator;
        iterator = null;
      }
      const documents = loadDocuments(input, options);
      if (typeof iterator !== "function") {
        return documents;
      }
      for (let index = 0, length = documents.length; index < length; index += 1) {
        iterator(documents[index]);
      }
    }
    function load2(input, options) {
      const documents = loadDocuments(input, options);
      if (documents.length === 0) {
        return void 0;
      } else if (documents.length === 1) {
        return documents[0];
      }
      throw new YAMLException2("expected a single document in the stream, but found more");
    }
    loader.loadAll = loadAll2;
    loader.load = load2;
    return loader;
  }
  var dumper = {};
  var hasRequiredDumper;
  function requireDumper() {
    if (hasRequiredDumper) return dumper;
    hasRequiredDumper = 1;
    const common2 = requireCommon();
    const YAMLException2 = requireException();
    const DEFAULT_SCHEMA2 = require_default();
    const _toString = Object.prototype.toString;
    const _hasOwnProperty = Object.prototype.hasOwnProperty;
    const CHAR_BOM = 65279;
    const CHAR_TAB = 9;
    const CHAR_LINE_FEED = 10;
    const CHAR_CARRIAGE_RETURN = 13;
    const CHAR_SPACE = 32;
    const CHAR_EXCLAMATION = 33;
    const CHAR_DOUBLE_QUOTE = 34;
    const CHAR_SHARP = 35;
    const CHAR_PERCENT = 37;
    const CHAR_AMPERSAND = 38;
    const CHAR_SINGLE_QUOTE = 39;
    const CHAR_ASTERISK = 42;
    const CHAR_COMMA = 44;
    const CHAR_MINUS = 45;
    const CHAR_COLON = 58;
    const CHAR_EQUALS = 61;
    const CHAR_GREATER_THAN = 62;
    const CHAR_QUESTION = 63;
    const CHAR_COMMERCIAL_AT = 64;
    const CHAR_LEFT_SQUARE_BRACKET = 91;
    const CHAR_RIGHT_SQUARE_BRACKET = 93;
    const CHAR_GRAVE_ACCENT = 96;
    const CHAR_LEFT_CURLY_BRACKET = 123;
    const CHAR_VERTICAL_LINE = 124;
    const CHAR_RIGHT_CURLY_BRACKET = 125;
    const ESCAPE_SEQUENCES = {};
    ESCAPE_SEQUENCES[0] = "\\0";
    ESCAPE_SEQUENCES[7] = "\\a";
    ESCAPE_SEQUENCES[8] = "\\b";
    ESCAPE_SEQUENCES[9] = "\\t";
    ESCAPE_SEQUENCES[10] = "\\n";
    ESCAPE_SEQUENCES[11] = "\\v";
    ESCAPE_SEQUENCES[12] = "\\f";
    ESCAPE_SEQUENCES[13] = "\\r";
    ESCAPE_SEQUENCES[27] = "\\e";
    ESCAPE_SEQUENCES[34] = '\\"';
    ESCAPE_SEQUENCES[92] = "\\\\";
    ESCAPE_SEQUENCES[133] = "\\N";
    ESCAPE_SEQUENCES[160] = "\\_";
    ESCAPE_SEQUENCES[8232] = "\\L";
    ESCAPE_SEQUENCES[8233] = "\\P";
    const DEPRECATED_BOOLEANS_SYNTAX = [
      "y",
      "Y",
      "yes",
      "Yes",
      "YES",
      "on",
      "On",
      "ON",
      "n",
      "N",
      "no",
      "No",
      "NO",
      "off",
      "Off",
      "OFF"
    ];
    const DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
    function compileStyleMap(schema2, map2) {
      if (map2 === null) return {};
      const result = {};
      const keys = Object.keys(map2);
      for (let index = 0, length = keys.length; index < length; index += 1) {
        let tag = keys[index];
        let style = String(map2[tag]);
        if (tag.slice(0, 2) === "!!") {
          tag = "tag:yaml.org,2002:" + tag.slice(2);
        }
        const type2 = schema2.compiledTypeMap["fallback"][tag];
        if (type2 && _hasOwnProperty.call(type2.styleAliases, style)) {
          style = type2.styleAliases[style];
        }
        result[tag] = style;
      }
      return result;
    }
    function encodeHex(character) {
      let handle;
      let length;
      const string = character.toString(16).toUpperCase();
      if (character <= 255) {
        handle = "x";
        length = 2;
      } else if (character <= 65535) {
        handle = "u";
        length = 4;
      } else if (character <= 4294967295) {
        handle = "U";
        length = 8;
      } else {
        throw new YAMLException2("code point within a string may not be greater than 0xFFFFFFFF");
      }
      return "\\" + handle + common2.repeat("0", length - string.length) + string;
    }
    const QUOTING_TYPE_SINGLE = 1;
    const QUOTING_TYPE_DOUBLE = 2;
    function State(options) {
      this.schema = options["schema"] || DEFAULT_SCHEMA2;
      this.indent = Math.max(1, options["indent"] || 2);
      this.noArrayIndent = options["noArrayIndent"] || false;
      this.skipInvalid = options["skipInvalid"] || false;
      this.flowLevel = common2.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
      this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
      this.sortKeys = options["sortKeys"] || false;
      this.lineWidth = options["lineWidth"] || 80;
      this.noRefs = options["noRefs"] || false;
      this.noCompatMode = options["noCompatMode"] || false;
      this.condenseFlow = options["condenseFlow"] || false;
      this.quotingType = options["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
      this.forceQuotes = options["forceQuotes"] || false;
      this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
      this.implicitTypes = this.schema.compiledImplicit;
      this.explicitTypes = this.schema.compiledExplicit;
      this.tag = null;
      this.result = "";
      this.duplicates = [];
      this.usedDuplicates = null;
    }
    function indentString(string, spaces) {
      const ind = common2.repeat(" ", spaces);
      let position = 0;
      let result = "";
      const length = string.length;
      while (position < length) {
        let line;
        const next = string.indexOf("\n", position);
        if (next === -1) {
          line = string.slice(position);
          position = length;
        } else {
          line = string.slice(position, next + 1);
          position = next + 1;
        }
        if (line.length && line !== "\n") result += ind;
        result += line;
      }
      return result;
    }
    function generateNextLine(state, level) {
      return "\n" + common2.repeat(" ", state.indent * level);
    }
    function testImplicitResolving(state, str2) {
      for (let index = 0, length = state.implicitTypes.length; index < length; index += 1) {
        const type2 = state.implicitTypes[index];
        if (type2.resolve(str2)) {
          return true;
        }
      }
      return false;
    }
    function isWhitespace(c) {
      return c === CHAR_SPACE || c === CHAR_TAB;
    }
    function isPrintable(c) {
      return c >= 32 && c <= 126 || c >= 161 && c <= 55295 && c !== 8232 && c !== 8233 || c >= 57344 && c <= 65533 && c !== CHAR_BOM || c >= 65536 && c <= 1114111;
    }
    function isNsCharOrWhitespace(c) {
      return isPrintable(c) && c !== CHAR_BOM && // - b-char
      c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
    }
    function isPlainSafe(c, prev, inblock) {
      const cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
      const cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
      return (
        // ns-plain-safe
        (inblock ? cIsNsCharOrWhitespace : cIsNsCharOrWhitespace && // - c-flow-indicator
        c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && // ns-plain-char
        c !== CHAR_SHARP && // false on '#'
        !(prev === CHAR_COLON && !cIsNsChar) || // false on ': '
        isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || // change to true on '[^ ]#'
        prev === CHAR_COLON && cIsNsChar
      );
    }
    function isPlainSafeFirst(c) {
      return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && // - s-white
      // - (c-indicator ::=
      // “-” | “?” | “:” | “,” | “[” | “]” | “{” | “}”
      c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && // | “#” | “&” | “*” | “!” | “|” | “=” | “>” | “'” | “"”
      c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && // | “%” | “@” | “`”)
      c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
    }
    function isPlainSafeLast(c) {
      return !isWhitespace(c) && c !== CHAR_COLON;
    }
    function codePointAt(string, pos) {
      const first = string.charCodeAt(pos);
      let second;
      if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
        second = string.charCodeAt(pos + 1);
        if (second >= 56320 && second <= 57343) {
          return (first - 55296) * 1024 + second - 56320 + 65536;
        }
      }
      return first;
    }
    function needIndentIndicator(string) {
      const leadingSpaceRe = /^\n* /;
      return leadingSpaceRe.test(string);
    }
    const STYLE_PLAIN = 1;
    const STYLE_SINGLE = 2;
    const STYLE_LITERAL = 3;
    const STYLE_FOLDED = 4;
    const STYLE_DOUBLE = 5;
    function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
      let i;
      let char = 0;
      let prevChar = null;
      let hasLineBreak = false;
      let hasFoldableLine = false;
      const shouldTrackWidth = lineWidth !== -1;
      let previousLineBreak = -1;
      let plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
      if (singleLineOnly || forceQuotes) {
        for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
          char = codePointAt(string, i);
          if (!isPrintable(char)) {
            return STYLE_DOUBLE;
          }
          plain = plain && isPlainSafe(char, prevChar, inblock);
          prevChar = char;
        }
      } else {
        for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
          char = codePointAt(string, i);
          if (char === CHAR_LINE_FEED) {
            hasLineBreak = true;
            if (shouldTrackWidth) {
              hasFoldableLine = hasFoldableLine || // Foldable line = too long, and not more-indented.
              i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
              previousLineBreak = i;
            }
          } else if (!isPrintable(char)) {
            return STYLE_DOUBLE;
          }
          plain = plain && isPlainSafe(char, prevChar, inblock);
          prevChar = char;
        }
        hasFoldableLine = hasFoldableLine || shouldTrackWidth && (i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
      }
      if (!hasLineBreak && !hasFoldableLine) {
        if (plain && !forceQuotes && !testAmbiguousType(string)) {
          return STYLE_PLAIN;
        }
        return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
      }
      if (indentPerLevel > 9 && needIndentIndicator(string)) {
        return STYLE_DOUBLE;
      }
      if (!forceQuotes) {
        return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
      }
      return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
    }
    function writeScalar(state, string, level, iskey, inblock) {
      state.dump = (function() {
        if (string.length === 0) {
          return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
        }
        if (!state.noCompatMode) {
          if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
            return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
          }
        }
        const indent = state.indent * Math.max(1, level);
        const lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
        const singleLineOnly = iskey || // No block styles in flow mode.
        state.flowLevel > -1 && level >= state.flowLevel;
        function testAmbiguity(string2) {
          return testImplicitResolving(state, string2);
        }
        switch (chooseScalarStyle(
          string,
          singleLineOnly,
          state.indent,
          lineWidth,
          testAmbiguity,
          state.quotingType,
          state.forceQuotes && !iskey,
          inblock
        )) {
          case STYLE_PLAIN:
            return string;
          case STYLE_SINGLE:
            return "'" + string.replace(/'/g, "''") + "'";
          case STYLE_LITERAL:
            return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
          case STYLE_FOLDED:
            return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
          case STYLE_DOUBLE:
            return '"' + escapeString(string) + '"';
          default:
            throw new YAMLException2("impossible error: invalid scalar style");
        }
      })();
    }
    function blockHeader(string, indentPerLevel) {
      const indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
      const clip = string[string.length - 1] === "\n";
      const keep = clip && (string[string.length - 2] === "\n" || string === "\n");
      const chomp = keep ? "+" : clip ? "" : "-";
      return indentIndicator + chomp + "\n";
    }
    function dropEndingNewline(string) {
      return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
    }
    function foldString(string, width) {
      const lineRe = /(\n+)([^\n]*)/g;
      let result = (function() {
        let nextLF = string.indexOf("\n");
        nextLF = nextLF !== -1 ? nextLF : string.length;
        lineRe.lastIndex = nextLF;
        return foldLine(string.slice(0, nextLF), width);
      })();
      let prevMoreIndented = string[0] === "\n" || string[0] === " ";
      let moreIndented;
      let match;
      while (match = lineRe.exec(string)) {
        const prefix = match[1];
        const line = match[2];
        moreIndented = line[0] === " ";
        result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") + foldLine(line, width);
        prevMoreIndented = moreIndented;
      }
      return result;
    }
    function foldLine(line, width) {
      if (line === "" || line[0] === " ") return line;
      const breakRe = / [^ ]/g;
      let match;
      let start2 = 0;
      let end;
      let curr = 0;
      let next = 0;
      let result = "";
      while (match = breakRe.exec(line)) {
        next = match.index;
        if (next - start2 > width) {
          end = curr > start2 ? curr : next;
          result += "\n" + line.slice(start2, end);
          start2 = end + 1;
        }
        curr = next;
      }
      result += "\n";
      if (line.length - start2 > width && curr > start2) {
        result += line.slice(start2, curr) + "\n" + line.slice(curr + 1);
      } else {
        result += line.slice(start2);
      }
      return result.slice(1);
    }
    function escapeString(string) {
      let result = "";
      let char = 0;
      for (let i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
        char = codePointAt(string, i);
        const escapeSeq = ESCAPE_SEQUENCES[char];
        if (!escapeSeq && isPrintable(char)) {
          result += string[i];
          if (char >= 65536) result += string[i + 1];
        } else {
          result += escapeSeq || encodeHex(char);
        }
      }
      return result;
    }
    function writeFlowSequence(state, level, object) {
      let _result = "";
      const _tag = state.tag;
      for (let index = 0, length = object.length; index < length; index += 1) {
        let value = object[index];
        if (state.replacer) {
          value = state.replacer.call(object, String(index), value);
        }
        if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
          if (_result !== "") _result += "," + (!state.condenseFlow ? " " : "");
          _result += state.dump;
        }
      }
      state.tag = _tag;
      state.dump = "[" + _result + "]";
    }
    function writeBlockSequence(state, level, object, compact) {
      let _result = "";
      const _tag = state.tag;
      for (let index = 0, length = object.length; index < length; index += 1) {
        let value = object[index];
        if (state.replacer) {
          value = state.replacer.call(object, String(index), value);
        }
        if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
          if (!compact || _result !== "") {
            _result += generateNextLine(state, level);
          }
          if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
            _result += "-";
          } else {
            _result += "- ";
          }
          _result += state.dump;
        }
      }
      state.tag = _tag;
      state.dump = _result || "[]";
    }
    function writeFlowMapping(state, level, object) {
      let _result = "";
      const _tag = state.tag;
      const objectKeyList = Object.keys(object);
      for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
        let pairBuffer = "";
        if (_result !== "") pairBuffer += ", ";
        if (state.condenseFlow) pairBuffer += '"';
        const objectKey = objectKeyList[index];
        let objectValue = object[objectKey];
        if (state.replacer) {
          objectValue = state.replacer.call(object, objectKey, objectValue);
        }
        if (!writeNode(state, level, objectKey, false, false)) {
          continue;
        }
        if (state.dump.length > 1024) pairBuffer += "? ";
        pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
        if (!writeNode(state, level, objectValue, false, false)) {
          continue;
        }
        pairBuffer += state.dump;
        _result += pairBuffer;
      }
      state.tag = _tag;
      state.dump = "{" + _result + "}";
    }
    function writeBlockMapping(state, level, object, compact) {
      let _result = "";
      const _tag = state.tag;
      const objectKeyList = Object.keys(object);
      if (state.sortKeys === true) {
        objectKeyList.sort();
      } else if (typeof state.sortKeys === "function") {
        objectKeyList.sort(state.sortKeys);
      } else if (state.sortKeys) {
        throw new YAMLException2("sortKeys must be a boolean or a function");
      }
      for (let index = 0, length = objectKeyList.length; index < length; index += 1) {
        let pairBuffer = "";
        if (!compact || _result !== "") {
          pairBuffer += generateNextLine(state, level);
        }
        const objectKey = objectKeyList[index];
        let objectValue = object[objectKey];
        if (state.replacer) {
          objectValue = state.replacer.call(object, objectKey, objectValue);
        }
        if (!writeNode(state, level + 1, objectKey, true, true, true)) {
          continue;
        }
        const explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
        if (explicitPair) {
          if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
            pairBuffer += "?";
          } else {
            pairBuffer += "? ";
          }
        }
        pairBuffer += state.dump;
        if (explicitPair) {
          pairBuffer += generateNextLine(state, level);
        }
        if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
          continue;
        }
        if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
          pairBuffer += ":";
        } else {
          pairBuffer += ": ";
        }
        pairBuffer += state.dump;
        _result += pairBuffer;
      }
      state.tag = _tag;
      state.dump = _result || "{}";
    }
    function detectType(state, object, explicit) {
      const typeList = explicit ? state.explicitTypes : state.implicitTypes;
      for (let index = 0, length = typeList.length; index < length; index += 1) {
        const type2 = typeList[index];
        if ((type2.instanceOf || type2.predicate) && (!type2.instanceOf || typeof object === "object" && object instanceof type2.instanceOf) && (!type2.predicate || type2.predicate(object))) {
          if (explicit) {
            if (type2.multi && type2.representName) {
              state.tag = type2.representName(object);
            } else {
              state.tag = type2.tag;
            }
          } else {
            state.tag = "?";
          }
          if (type2.represent) {
            const style = state.styleMap[type2.tag] || type2.defaultStyle;
            let _result;
            if (_toString.call(type2.represent) === "[object Function]") {
              _result = type2.represent(object, style);
            } else if (_hasOwnProperty.call(type2.represent, style)) {
              _result = type2.represent[style](object, style);
            } else {
              throw new YAMLException2("!<" + type2.tag + '> tag resolver accepts not "' + style + '" style');
            }
            state.dump = _result;
          }
          return true;
        }
      }
      return false;
    }
    function writeNode(state, level, object, block, compact, iskey, isblockseq) {
      state.tag = null;
      state.dump = object;
      if (!detectType(state, object, false)) {
        detectType(state, object, true);
      }
      const type2 = _toString.call(state.dump);
      const inblock = block;
      if (block) {
        block = state.flowLevel < 0 || state.flowLevel > level;
      }
      const objectOrArray = type2 === "[object Object]" || type2 === "[object Array]";
      let duplicateIndex;
      let duplicate;
      if (objectOrArray) {
        duplicateIndex = state.duplicates.indexOf(object);
        duplicate = duplicateIndex !== -1;
      }
      if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) {
        compact = false;
      }
      if (duplicate && state.usedDuplicates[duplicateIndex]) {
        state.dump = "*ref_" + duplicateIndex;
      } else {
        if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
          state.usedDuplicates[duplicateIndex] = true;
        }
        if (type2 === "[object Object]") {
          if (block && Object.keys(state.dump).length !== 0) {
            writeBlockMapping(state, level, state.dump, compact);
            if (duplicate) {
              state.dump = "&ref_" + duplicateIndex + state.dump;
            }
          } else {
            writeFlowMapping(state, level, state.dump);
            if (duplicate) {
              state.dump = "&ref_" + duplicateIndex + " " + state.dump;
            }
          }
        } else if (type2 === "[object Array]") {
          if (block && state.dump.length !== 0) {
            if (state.noArrayIndent && !isblockseq && level > 0) {
              writeBlockSequence(state, level - 1, state.dump, compact);
            } else {
              writeBlockSequence(state, level, state.dump, compact);
            }
            if (duplicate) {
              state.dump = "&ref_" + duplicateIndex + state.dump;
            }
          } else {
            writeFlowSequence(state, level, state.dump);
            if (duplicate) {
              state.dump = "&ref_" + duplicateIndex + " " + state.dump;
            }
          }
        } else if (type2 === "[object String]") {
          if (state.tag !== "?") {
            writeScalar(state, state.dump, level, iskey, inblock);
          }
        } else if (type2 === "[object Undefined]") {
          return false;
        } else {
          if (state.skipInvalid) return false;
          throw new YAMLException2("unacceptable kind of an object to dump " + type2);
        }
        if (state.tag !== null && state.tag !== "?") {
          let tagStr = encodeURI(
            state.tag[0] === "!" ? state.tag.slice(1) : state.tag
          ).replace(/!/g, "%21");
          if (state.tag[0] === "!") {
            tagStr = "!" + tagStr;
          } else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") {
            tagStr = "!!" + tagStr.slice(18);
          } else {
            tagStr = "!<" + tagStr + ">";
          }
          state.dump = tagStr + " " + state.dump;
        }
      }
      return true;
    }
    function getDuplicateReferences(object, state) {
      const objects = [];
      const duplicatesIndexes = [];
      inspectNode(object, objects, duplicatesIndexes);
      const length = duplicatesIndexes.length;
      for (let index = 0; index < length; index += 1) {
        state.duplicates.push(objects[duplicatesIndexes[index]]);
      }
      state.usedDuplicates = new Array(length);
    }
    function inspectNode(object, objects, duplicatesIndexes) {
      if (object !== null && typeof object === "object") {
        const index = objects.indexOf(object);
        if (index !== -1) {
          if (duplicatesIndexes.indexOf(index) === -1) {
            duplicatesIndexes.push(index);
          }
        } else {
          objects.push(object);
          if (Array.isArray(object)) {
            for (let i = 0, length = object.length; i < length; i += 1) {
              inspectNode(object[i], objects, duplicatesIndexes);
            }
          } else {
            const objectKeyList = Object.keys(object);
            for (let i = 0, length = objectKeyList.length; i < length; i += 1) {
              inspectNode(object[objectKeyList[i]], objects, duplicatesIndexes);
            }
          }
        }
      }
    }
    function dump2(input, options) {
      options = options || {};
      const state = new State(options);
      if (!state.noRefs) getDuplicateReferences(input, state);
      let value = input;
      if (state.replacer) {
        value = state.replacer.call({ "": value }, "", value);
      }
      if (writeNode(state, 0, value, true, true)) return state.dump + "\n";
      return "";
    }
    dumper.dump = dump2;
    return dumper;
  }
  var hasRequiredJsYaml;
  function requireJsYaml() {
    if (hasRequiredJsYaml) return jsYaml;
    hasRequiredJsYaml = 1;
    const loader2 = requireLoader();
    const dumper2 = requireDumper();
    function renamed(from, to) {
      return function() {
        throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
      };
    }
    jsYaml.Type = requireType();
    jsYaml.Schema = requireSchema();
    jsYaml.FAILSAFE_SCHEMA = requireFailsafe();
    jsYaml.JSON_SCHEMA = requireJson();
    jsYaml.CORE_SCHEMA = requireCore();
    jsYaml.DEFAULT_SCHEMA = require_default();
    jsYaml.load = loader2.load;
    jsYaml.loadAll = loader2.loadAll;
    jsYaml.dump = dumper2.dump;
    jsYaml.YAMLException = requireException();
    jsYaml.types = {
      binary: requireBinary(),
      float: requireFloat(),
      map: requireMap(),
      null: require_null(),
      pairs: requirePairs(),
      set: requireSet(),
      timestamp: requireTimestamp(),
      bool: requireBool(),
      int: requireInt(),
      merge: requireMerge(),
      omap: requireOmap(),
      seq: requireSeq(),
      str: requireStr()
    };
    jsYaml.safeLoad = renamed("safeLoad", "load");
    jsYaml.safeLoadAll = renamed("safeLoadAll", "loadAll");
    jsYaml.safeDump = renamed("safeDump", "dump");
    return jsYaml;
  }
  var jsYamlExports = requireJsYaml();
  var yaml = /* @__PURE__ */ getDefaultExportFromCjs(jsYamlExports);
  var {
    Type,
    Schema,
    FAILSAFE_SCHEMA,
    JSON_SCHEMA,
    CORE_SCHEMA,
    DEFAULT_SCHEMA,
    load,
    loadAll,
    dump,
    YAMLException,
    types,
    safeLoad,
    safeLoadAll,
    safeDump
  } = yaml;

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
  var DEFAULT_EVICTOR = "DefaultEvictor";

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
  function profileNamed(doc, name) {
    return profiles(doc).find((profile) => String(profile["name"] ?? "") === name) ?? null;
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

  // src/model/protect.ts
  var EVICT_ANNOTATION = "descheduler.alpha.kubernetes.io/evict";
  var NO_EVICTION_ANNOTATION = "descheduler.alpha.kubernetes.io/prefer-no-eviction";
  var REQUEST_EVICT_ONLY_ANNOTATION = "descheduler.alpha.kubernetes.io/request-evict-only";
  var SYSTEM_CRITICAL_PRIORITY = 2e9;
  var DEFAULT_PROTECTIONS = [
    "PodsWithLocalStorage",
    "DaemonSetPods",
    "SystemCriticalPods",
    "FailedBarePods"
  ];
  function effectiveProtections(evictorArgs) {
    const protections = getPath(evictorArgs, "podProtections");
    const extraEnabled = asList(getPath(evictorArgs, "podProtections.extraEnabled"));
    const defaultDisabled = asList(getPath(evictorArgs, "podProtections.defaultDisabled"));
    if (isRecord(protections) && (extraEnabled.length || defaultDisabled.length)) {
      const set3 = new Set(DEFAULT_PROTECTIONS.filter((p) => !defaultDisabled.includes(p)));
      for (const extra of extraEnabled) set3.add(extra);
      return set3;
    }
    const set2 = /* @__PURE__ */ new Set();
    if (evictorArgs["evictLocalStoragePods"] !== true) set2.add("PodsWithLocalStorage");
    if (evictorArgs["evictDaemonSetPods"] !== true) set2.add("DaemonSetPods");
    if (evictorArgs["evictSystemCriticalPods"] !== true) set2.add("SystemCriticalPods");
    if (evictorArgs["evictFailedBarePods"] !== true) set2.add("FailedBarePods");
    if (evictorArgs["ignorePvcPods"] === true) set2.add("PodsWithPVC");
    if (evictorArgs["ignorePodsWithoutPDB"] === true) set2.add("PodsWithoutPDB");
    return set2;
  }
  function asList(value) {
    return Array.isArray(value) ? value.map(String) : [];
  }
  function seconds(duration) {
    const matches = [...duration.matchAll(/(\d+(?:\.\d+)?)\s*(h|m|s|ms)/g)];
    if (!matches.length) return null;
    let total = 0;
    for (const match of matches) {
      const value = Number(match[1]);
      switch (match[2]) {
        case "h":
          total += value * 3600;
          break;
        case "m":
          total += value * 60;
          break;
        case "s":
          total += value;
          break;
        case "ms":
          total += value / 1e3;
          break;
      }
    }
    return total;
  }
  function labelsMatch(pod, selector) {
    if (!isRecord(selector)) return null;
    const matchLabels = selector["matchLabels"];
    if (selector["matchExpressions"] !== void 0) return null;
    if (!isRecord(matchLabels)) return null;
    const labels = pod.metadata.labels ?? {};
    return Object.entries(matchLabels).every(([key, value]) => labels[key] === String(value));
  }
  function coveredByPDB(pod, pdbs) {
    const labels = pod.metadata.labels ?? {};
    let sure = true;
    for (const pdb of pdbs) {
      if (pdb.metadata.namespace !== pod.metadata.namespace) continue;
      const selector = pdb.spec?.selector;
      if (!selector) continue;
      if (selector.matchLabels === void 0) {
        sure = false;
        continue;
      }
      const wanted = Object.entries(selector.matchLabels);
      if (wanted.length && wanted.every(([key, value]) => labels[key] === value)) return true;
    }
    return sure ? false : null;
  }
  function evaluate(pod, where) {
    const { evictor } = where;
    const now = where.now ?? Date.now();
    const annotations = pod.metadata.annotations ?? {};
    const checks = [];
    if (annotations[EVICT_ANNOTATION] !== void 0) {
      return {
        evictable: true,
        headline: "Marked for eviction, whatever the rules say",
        checks: [
          {
            label: "The evict annotation",
            outcome: "allowed",
            detail: `${EVICT_ANNOTATION} is set, and the evictor stops checking there — every protection below is skipped for this pod.`
          }
        ]
      };
    }
    const protections = effectiveProtections(evictor);
    const blocked = (label, detail) => checks.push({ label, outcome: "blocked", detail });
    const fine = (label, detail) => checks.push({ label, outcome: "allowed", detail });
    const unsure = (label, detail) => checks.push({ label, outcome: "unknown", detail });
    if (evictor["noEvictionPolicy"] === "Mandatory" && annotations[NO_EVICTION_ANNOTATION] !== void 0) {
      blocked("Asked not to be evicted", `${NO_EVICTION_ANNOTATION} is set and the policy reads it as mandatory.`);
    }
    if (annotations["kubernetes.io/config.mirror"] !== void 0) {
      blocked("Mirror pod", "A mirror pod is the API server’s copy of a static pod; evicting it does nothing.");
    }
    const source = annotations["kubernetes.io/config.source"];
    if (source !== void 0 && source !== "api") {
      blocked("Static pod", `This pod comes from ${source}, not from the API server, so the kubelet owns it.`);
    }
    if (pod.metadata.deletionTimestamp) {
      blocked("Terminating", "The pod is already on its way out.");
    }
    const owner = where.owner ?? ownerOf2(pod);
    if (protections.has("DaemonSetPods")) {
      if (owner?.kind === "DaemonSet") {
        blocked("DaemonSet pod", "DaemonSet pods are protected. They would come straight back to the same node.");
      } else {
        fine("DaemonSet pod", "Not owned by a DaemonSet.");
      }
    }
    if (protections.has("PodsWithLocalStorage")) {
      const volumes = pod.spec?.volumes ?? [];
      const local = volumes.filter((volume) => volume.emptyDir !== void 0 || volume.hostPath !== void 0);
      if (local.length) {
        blocked(
          "Local storage",
          `${local.length} volume(s) are emptyDir or hostPath, whose contents do not survive a move.`
        );
      } else {
        fine("Local storage", "No emptyDir or hostPath volume.");
      }
    }
    if (protections.has("PodsWithPVC")) {
      const claims = (pod.spec?.volumes ?? []).filter((volume) => volume.persistentVolumeClaim !== void 0);
      if (claims.length) blocked("Persistent volume", `${claims.length} PersistentVolumeClaim(s), and those are protected here.`);
      else fine("Persistent volume", "No PersistentVolumeClaim.");
    }
    const ownerRefs = pod.metadata.ownerReferences ?? [];
    if (protections.has("FailedBarePods")) {
      if (!ownerRefs.length) {
        blocked("No owner", "Nothing would recreate this pod, so bare pods are protected.");
      } else {
        fine("No owner", `Owned by ${owner?.kind ?? "something"}, so it would be recreated.`);
      }
    } else if (!ownerRefs.length && pod.status?.phase !== "Failed") {
      blocked(
        "No owner",
        "Bare pods may be evicted here, but only once they have failed, and this one has not."
      );
    }
    const priority = pod.spec?.priority;
    if (protections.has("SystemCriticalPods")) {
      if (priority !== void 0 && priority >= SYSTEM_CRITICAL_PRIORITY) {
        blocked(
          "System critical",
          `Priority ${priority}${pod.spec?.priorityClassName ? ` (${pod.spec.priorityClassName})` : ""} is at or above the system-critical mark.`
        );
      } else {
        fine("System critical", `Priority ${priority ?? 0} is below the system-critical mark.`);
      }
      const threshold = thresholdValue(evictor);
      if (threshold.value !== null) {
        if ((priority ?? 0) >= threshold.value) {
          blocked("Priority threshold", `Priority ${priority ?? 0} is at or above the threshold of ${threshold.value}.`);
        } else {
          fine("Priority threshold", `Priority ${priority ?? 0} is under the threshold of ${threshold.value}.`);
        }
      } else if (threshold.byName) {
        unsure(
          "Priority threshold",
          `The threshold is the PriorityClass ${threshold.byName}, whose value is not read here.`
        );
      }
    } else if (thresholdValue(evictor).value !== null || thresholdValue(evictor).byName) {
      unsure(
        "Priority threshold",
        "A threshold is configured, but system-critical protection is off, and the descheduler only applies the threshold while that protection is on."
      );
    }
    if (protections.has("PodsWithoutPDB")) {
      const covered = coveredByPDB(pod, where.pdbs ?? []);
      if (covered === null) {
        unsure("PodDisruptionBudget", "A budget here selects pods by expression, which is not evaluated on this page.");
      } else if (covered) {
        fine("PodDisruptionBudget", "A budget covers this pod.");
      } else {
        blocked("PodDisruptionBudget", "No budget covers this pod, and the policy protects pods without one.");
      }
    }
    if (protections.has("PodsWithResourceClaims")) {
      unsure("Resource claims", "Pods with resource claims are protected; the claims are not read on this page.");
    }
    const minReplicas = Number(evictor["minReplicas"] ?? 0);
    if (minReplicas > 0) {
      const replicas = where.owner?.replicas ?? null;
      if (replicas === null) {
        unsure("Owner size", `Workloads under ${minReplicas} replicas are protected; this pod's owner was not read.`);
      } else if (replicas < minReplicas) {
        blocked("Owner size", `Its owner runs ${replicas} replica(s), and the floor is ${minReplicas}.`);
      } else {
        fine("Owner size", `Its owner runs ${replicas} replicas, at or above the floor of ${minReplicas}.`);
      }
    }
    const minPodAge = String(evictor["minPodAge"] ?? "");
    if (minPodAge) {
      const floor = seconds(minPodAge);
      const started = Date.parse(pod.status?.startTime ?? pod.metadata.creationTimestamp ?? "");
      if (floor === null || Number.isNaN(started)) {
        unsure("Pod age", `Pods younger than ${minPodAge} are protected; this pod's age could not be worked out.`);
      } else if ((now - started) / 1e3 < floor) {
        blocked("Pod age", `Younger than ${minPodAge}.`);
      } else {
        fine("Pod age", `Older than ${minPodAge}.`);
      }
    }
    const selector = evictor["labelSelector"];
    if (selector !== void 0) {
      const matched = labelsMatch(pod, selector);
      if (matched === null) unsure("Evictor label selector", "The selector uses expressions, which are not evaluated here.");
      else if (matched) fine("Evictor label selector", "The pod carries the labels the evictor asks for.");
      else blocked("Evictor label selector", "The pod does not carry the labels the evictor asks for.");
    }
    if (evictor["nodeFit"] === true) {
      unsure(
        "Somewhere to go",
        "nodeFit is on, so the pod is only evicted when another node could actually take it. That needs every node’s free capacity, which is not worked out here."
      );
    }
    if (annotations[REQUEST_EVICT_ONLY_ANNOTATION] !== void 0) {
      unsure(
        "Eviction request only",
        `${REQUEST_EVICT_ONLY_ANNOTATION} is set: the descheduler asks, and something else — an operator, usually — decides.`
      );
    }
    const blockers = checks.filter((check) => check.outcome === "blocked");
    const unknowns = checks.filter((check) => check.outcome === "unknown");
    if (blockers.length) {
      return {
        evictable: false,
        headline: blockers.length === 1 ? `Protected: ${blockers[0]?.label.toLowerCase()}` : `Protected, ${blockers.length} ways`,
        checks
      };
    }
    if (unknowns.length) {
      return {
        evictable: null,
        headline: "Nothing here protects it",
        checks
      };
    }
    return { evictable: true, headline: "The evictor would let this pod go", checks };
  }
  function ownerOf2(pod) {
    const reference = controller(pod);
    return reference ? { kind: reference.kind, replicas: null } : null;
  }
  function thresholdValue(evictor) {
    const raw = getPath(evictor, "priorityThreshold.value");
    const name = getPath(evictor, "priorityThreshold.name");
    const value = raw === void 0 || raw === null ? null : Number(raw);
    return {
      value: value !== null && Number.isFinite(value) ? value : null,
      byName: typeof name === "string" ? name : ""
    };
  }

  // src/pages/pod.ts
  start("page", async (ctx) => {
    const target = ctx.object;
    if (!target) return;
    const pod = await k8sdockside.object();
    const [found, events] = await Promise.all([
      findDescheduler(),
      listOrNone({ kind: "events", namespace: target.namespace })
    ]);
    const file = await readPolicy(found.install);
    const mine = evictions(events).filter((item) => item.pod === target.name && item.namespace === target.namespace);
    byId("loading").remove();
    const body = byId("body");
    if (!file.doc) {
      replace(
        body,
        el(
          "p",
          { class: "note" },
          found.install ? `The descheduler runs here, but its policy could not be read (${file.error}), so what it would do with this pod cannot be worked out.` : "Nothing in this cluster runs the descheduler, so nothing here evicts this pod."
        ),
        mine.length ? evictionTable(mine, { showNamespace: false, showPod: false }) : null
      );
      return;
    }
    const names = profileNames(file.doc);
    const profile = profileNamed(file.doc, names[0] ?? "") ?? null;
    const evictor = profile ? argsOf(profile, DEFAULT_EVICTOR) : {};
    const protections = effectiveProtections(evictor);
    const owner = await ownerOf(pod);
    const pdbs = protections.has("PodsWithoutPDB") ? await budgets(target.namespace).catch(() => []) : [];
    const answer = evaluate(pod, { profile: names[0] ?? "", evictor, owner, pdbs });
    const tone = answer.evictable === false ? "ok" : answer.evictable === true ? "info" : "none";
    replace(
      body,
      el(
        "div",
        { class: "bar" },
        dot(tone),
        el("strong", {}, answer.headline),
        el("span", { class: "faint" }, `by the DefaultEvictor in profile ${names[0] || "(unnamed)"}`),
        el("span", { class: "spacer" }),
        ...await actionButtons()
      ),
      el("div", { class: "checks" }, ...answer.checks.map(checkRow)),
      mine.length ? el(
        "div",
        { style: "margin-top:10px" },
        el("h3", {}, "What the descheduler did with it"),
        evictionTable(mine, { showNamespace: false, showPod: false })
      ) : null
    );
  });
  async function actionButtons() {
    let offered = [];
    try {
      offered = await k8sdockside.actions();
    } catch {
      return [];
    }
    return offered.map(
      (action) => button(action.label, () => {
        void k8sdockside.run(action.id).catch(() => {
        });
      })
    );
  }
})();
