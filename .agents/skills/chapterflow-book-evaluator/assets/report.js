(function () {
  "use strict";

  var dataElement = document.getElementById("chapterflow-report-data");
  if (!dataElement) return;

  var report;
  try {
    report = JSON.parse(dataElement.textContent || "{}");
  } catch (error) {
    var main = document.getElementById("main-content");
    if (main) {
      var warning = document.createElement("p");
      warning.className = "notice";
      warning.textContent = "Interactive controls could not start because the embedded report data is invalid. Static content remains available.";
      main.insertBefore(warning, main.firstChild);
    }
    return;
  }
  var runMetadata = report.run && typeof report.run === "object" ? report.run : {};
  var samplingMetadata = runMetadata.sampling && typeof runMetadata.sampling === "object" ? runMetadata.sampling : {};
  var sampleMode = runMetadata.evaluation_mode === "chapter_sample" || samplingMetadata.mode === "chapter_sample";

  var DOMAIN_ORDER = [
    "epistemic_integrity", "audience_fit", "mental_model_coherence",
    "learning_architecture", "retention_retrieval", "transfer_action_judgment",
    "motivation_autonomy", "engagement_momentum", "whole_book_coherence"
  ];

  var DOMAIN_LABELS = {
    epistemic_integrity: "Epistemic integrity",
    audience_fit: "Audience fit",
    mental_model_coherence: "Mental-model coherence",
    learning_architecture: "Learning architecture",
    retention_retrieval: "Retention & retrieval",
    transfer_action_judgment: "Transfer & practical judgment",
    motivation_autonomy: "Motivation & autonomy",
    engagement_momentum: "Aligned engagement",
    whole_book_coherence: "Whole-book coherence"
  };

  var SUBCRITERION_LABELS = {
    claim_support_fit: "Claim-support fit",
    uncertainty_limitations: "Uncertainty and limitations",
    internal_consistency_qa: "Internal consistency and instructional QA",
    misuse_safeguards: "Misuse safeguards",
    language_clarity: "Language clarity",
    beginner_onboarding: "Beginner onboarding",
    signal_noise_framework_load: "Signal-to-noise and framework load",
    audience_context_accessibility: "Audience and context accessibility",
    central_model: "Central model",
    mechanism_causal_explanation: "Mechanism and causal explanation",
    cross_concept_integration: "Cross-concept integration",
    nuance_diagnostic_power: "Nuance and diagnostic power",
    sequencing_scaffolding: "Sequencing and scaffolding",
    worked_examples_contrasts: "Worked examples and contrasts",
    active_processing: "Active processing",
    feedback_metacognitive_calibration: "Feedback and metacognitive calibration",
    meaningful_retrieval_cues: "Meaningful retrieval cues",
    cumulative_reinforcement: "Cumulative reinforcement",
    quiz_retrieval_depth: "Quiz and retrieval depth",
    interference_control_consolidation: "Interference control and consolidation",
    concrete_actions: "Concrete actions",
    cross_context_transfer: "Cross-context transfer",
    implementation_feedback_support: "Implementation and feedback support",
    boundaries_adaptation_tradeoffs: "Boundaries, adaptation, and tradeoffs",
    personal_relevance: "Personal relevance",
    achievable_progress: "Achievable progress",
    autonomy_non_shaming_tone: "Autonomy and non-shaming tone",
    calibrated_confidence: "Calibrated confidence",
    curiosity_momentum: "Curiosity and momentum",
    narrative_example_vividness: "Narrative and example vividness",
    emotional_relevance: "Emotional relevance",
    instructional_alignment: "Instructional alignment and absence of decoration",
    chapter_necessity_order: "Chapter necessity and order",
    quality_consistency_pacing: "Quality consistency and pacing",
    redundancy_cumulative_load: "Redundancy and cumulative load",
    synthesis_completion_value: "Synthesis and completion value"
  };

  var SUBCRITERION_ORDER = {
    epistemic_integrity: ["claim_support_fit", "uncertainty_limitations", "internal_consistency_qa", "misuse_safeguards"],
    audience_fit: ["language_clarity", "beginner_onboarding", "signal_noise_framework_load", "audience_context_accessibility"],
    mental_model_coherence: ["central_model", "mechanism_causal_explanation", "cross_concept_integration", "nuance_diagnostic_power"],
    learning_architecture: ["sequencing_scaffolding", "worked_examples_contrasts", "active_processing", "feedback_metacognitive_calibration"],
    retention_retrieval: ["meaningful_retrieval_cues", "cumulative_reinforcement", "quiz_retrieval_depth", "interference_control_consolidation"],
    transfer_action_judgment: ["concrete_actions", "cross_context_transfer", "implementation_feedback_support", "boundaries_adaptation_tradeoffs"],
    motivation_autonomy: ["personal_relevance", "achievable_progress", "autonomy_non_shaming_tone", "calibrated_confidence"],
    engagement_momentum: ["curiosity_momentum", "narrative_example_vividness", "emotional_relevance", "instructional_alignment"],
    whole_book_coherence: ["chapter_necessity_order", "quality_consistency_pacing", "redundancy_cumulative_load", "synthesis_completion_value"]
  };

  function parseRubricAnchors(markdown) {
    var result = {};
    var current = "";
    String(markdown || "").split(/\r?\n/).forEach(function (line) {
      var heading = line.match(/^####\s+\d+\.\d+\s+`([^`]+)`\s+[—-]\s+(.+?)\s*$/);
      if (heading) {
        current = heading[1];
        result[current] = { name: heading[2], anchors: {} };
        return;
      }
      var anchor = line.match(/^-\s+\*\*([0-4]):\*\*\s*(.+?)\s*$/);
      if (anchor && current && result[current]) result[current].anchors[anchor[1]] = anchor[2];
    });
    return result;
  }

  var RUBRIC_ANCHORS = parseRubricAnchors(report.rubric && report.rubric.markdown);

  var SERIES_COLORS = ["#075985", "#9a3412", "#166534", "#6b21a8"];
  var books = Array.isArray(report.books) ? report.books.slice() : [];
  var chapterFilterIndex = report.chapter_filter_index && typeof report.chapter_filter_index === "object" ? report.chapter_filter_index : {};
  var state = {
    comparisonBooks: [],
    scale: "domain",
    visibleDomains: [],
    chapterQuery: "",
    chapterBook: "all",
    chapterDomain: "all",
    chapterSeverity: "all",
    chapterStatus: "all",
    chapterLimit: 24,
    onlyDisagreements: false,
    showEvidence: false
  };

  function own(object, key) {
    return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
  }

  function objectEntries(value) {
    if (Array.isArray(value)) {
      return value.map(function (item, index) {
        var key = item && (item.key || item.id || item.slug || item.domain_id || item.subcriterion_id);
        return [String(key || index), item || {}];
      });
    }
    if (value && typeof value === "object") return Object.keys(value).map(function (key) { return [key, value[key]]; });
    return [];
  }

  function meta(book) { return book && book.book && typeof book.book === "object" ? book.book : (book || {}); }
  function bookId(book, index) { return String(meta(book).book_id || meta(book).slug || book.slug || "book-" + String(index + 1)); }
  function bookTitle(book) { return String(meta(book).title || book.title || meta(book).book_id || "Untitled book"); }
  function bookRank(book, index) { return Number(book.rank || meta(book).rank || index + 1); }
  function domainMap(book) { return book && book.domains && typeof book.domains === "object" ? book.domains : {}; }

  function keyOf(entry, fallback) {
    var value = entry && (entry.key || entry.id || entry.slug || entry.domain_id || entry.subcriterion_id);
    return String(value || fallback || "");
  }

  function labelOf(entry, key, fallbackMap) {
    return String((entry && (entry.name || entry.label || entry.title)) || fallbackMap[key] || key.replace(/_/g, " "));
  }

  function number(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : (fallback === undefined ? 0 : fallback);
  }

  function rating(value) {
    if (typeof value === "number") return value;
    if (value && typeof value === "object") return number(value.rating, NaN);
    return number(value, NaN);
  }

  function getRubricDomain(key) {
    var domains = report.rubric && report.rubric.domains;
    var matches = objectEntries(domains).filter(function (pair) { return keyOf(pair[1], pair[0]) === key; });
    return matches.length ? matches[0][1] : {};
  }

  function domainCatalog() {
    var source = report.rubric && report.rubric.domains;
    var entries = objectEntries(source);
    if (!entries.length && books.length) entries = objectEntries(domainMap(books[0]));
    return entries.map(function (pair, index) {
      var key = keyOf(pair[1], pair[0]);
      var item = pair[1] || {};
      var bookDomain = books.length ? domainMap(books[0])[key] || {} : {};
      return {
        key: key,
        label: labelOf(item, key, DOMAIN_LABELS),
        shortLabel: String(item.short_label || item.shortLabel || DOMAIN_LABELS[key] || labelOf(item, key, DOMAIN_LABELS)),
        weight: number(item.weight, number(bookDomain.weight, 0)),
        purpose: String(item.purpose || item.description || ""),
        index: DOMAIN_ORDER.indexOf(key) >= 0 ? DOMAIN_ORDER.indexOf(key) + 1 : number(item.order, index + 1),
        source: item
      };
    }).sort(function (a, b) { return a.index - b.index || a.key.localeCompare(b.key); });
  }

  var domains = domainCatalog();
  state.visibleDomains = domains.map(function (item) { return item.key; });

  function subcriteriaFor(domain) {
    var source = domain.source && (domain.source.subcriteria || domain.source.criteria);
    var entries = objectEntries(source);
    if (!entries.length && books.length) {
      var bookDomain = domainMap(books[0])[domain.key] || {};
      entries = objectEntries(bookDomain.subcriteria);
    }
    return entries.map(function (pair, index) {
      var key = keyOf(pair[1], pair[0]);
      var item = pair[1] && typeof pair[1] === "object" ? pair[1] : {};
      var anchorReference = RUBRIC_ANCHORS[key] || { anchors: {} };
      var orderedKeys = SUBCRITERION_ORDER[domain.key] || [];
      var definition = item.definition || item.purpose || item.description || "";
      if (!definition && anchorReference.anchors) {
        definition = Object.keys(anchorReference.anchors).sort().map(function (ratingKey) {
          return "Anchor " + ratingKey + ": " + anchorReference.anchors[ratingKey];
        }).join(" ");
      }
      return {
        key: key,
        label: String(typeof pair[1] === "string" ? pair[1] : (item.name || item.label || item.title || anchorReference.name || SUBCRITERION_LABELS[key] || key.replace(/_/g, " "))),
        definition: String(definition),
        anchors: item.anchors || anchorReference.anchors,
        index: orderedKeys.indexOf(key) >= 0 ? orderedKeys.indexOf(key) + 1 : number(item.order, index + 1),
        source: item
      };
    }).sort(function (a, b) { return a.index - b.index || a.key.localeCompare(b.key); });
  }

  function domainRecord(book, key) { return domainMap(book)[key] || {}; }
  function domainScore(book, domain) {
    var record = domainRecord(book, domain.key);
    if (Number.isFinite(Number(record.domain_score))) return Number(record.domain_score);
    var values = objectEntries(record.subcriteria).map(function (pair) { return rating(pair[1]); }).filter(Number.isFinite);
    return values.length ? values.reduce(function (sum, value) { return sum + value; }, 0) / values.length : 0;
  }

  function domainValue(book, domain, scale) {
    var score = domainScore(book, domain);
    if (scale === "weighted") {
      var stored = Number(domainRecord(book, domain.key).weighted_points);
      return Number.isFinite(stored) ? stored : score / 4 * domain.weight;
    }
    if (scale === "percent") return score / 4 * 100;
    return score;
  }

  function scaleMaximum(domain, scale) {
    if (scale === "weighted") return domain.weight || 1;
    if (scale === "percent") return 100;
    return 4;
  }

  function formatValue(value, scale) {
    if (!Number.isFinite(value)) return "—";
    if (scale === "percent") return value.toFixed(1) + "%";
    return value.toFixed(2);
  }

  function disagreementFor(book, domainKey, subcriterionKey) {
    var disagreements = book && book.rater_agreement && Array.isArray(book.rater_agreement.disagreements) ? book.rater_agreement.disagreements : [];
    var suffix = domainKey + ".subcriteria." + subcriterionKey;
    return disagreements.find(function (item) { return String(item.path || "").indexOf(suffix) >= 0; }) || null;
  }

  function subcriterionRecord(book, domainKey, subcriterionKey) {
    var record = domainRecord(book, domainKey);
    return record.subcriteria && record.subcriteria[subcriterionKey] ? record.subcriteria[subcriterionKey] : {};
  }

  function evidenceText(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map(evidenceText).filter(Boolean).join("; ");
    if (typeof value === "object") {
      var locator = [value.chapter, value.section, value.item_id || value.itemId, value.locator].filter(Boolean).join(" · ");
      var text = value.paraphrase || value.description || value.rationale || value.summary || value.text || "";
      return locator && text ? locator + ": " + text : String(text || locator);
    }
    return String(value);
  }

  function node(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  }

  function clearNode(element) {
    while (element && element.firstChild) element.removeChild(element.firstChild);
  }

  function option(value, label) {
    var element = document.createElement("option");
    element.value = value;
    element.textContent = label;
    return element;
  }

  function svgNode(tag, attributes, text) {
    var element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attributes || {}).forEach(function (key) { element.setAttribute(key, String(attributes[key])); });
    if (text !== undefined) element.textContent = String(text);
    return element;
  }

  function safeFilename(value) {
    return String(value || "chapterflow-data").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "chapterflow-data";
  }

  function downloadText(filename, text, type) {
    var blob = new Blob([text], { type: type || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = safeFilename(filename);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function csvCell(value) {
    var text = value === null || value === undefined ? "" : String(value);
    return /[",\r\n]/.test(text) ? "\"" + text.replace(/\"/g, "\"\"") + "\"" : text;
  }

  function csv(rows) {
    return rows.map(function (row) { return row.map(csvCell).join(","); }).join("\r\n") + "\r\n";
  }

  function parseHashState() {
    var raw = window.location.hash.slice(1);
    var marker = raw.indexOf("?");
    if (marker < 0) return;
    var params = new URLSearchParams(raw.slice(marker + 1));
    if (params.has("compare")) state.comparisonBooks = params.get("compare").split(",").filter(Boolean);
    if (["domain", "weighted", "percent"].indexOf(params.get("scale")) >= 0) state.scale = params.get("scale");
    if (params.has("domains")) state.visibleDomains = params.get("domains").split(",").filter(Boolean);
    state.chapterQuery = params.get("q") || "";
    state.chapterBook = params.get("book") || "all";
    state.chapterDomain = params.get("domain") || "all";
    state.chapterSeverity = params.get("severity") || "all";
    state.chapterStatus = params.get("status") || "all";
    state.onlyDisagreements = params.get("disagreements") === "1";
    state.showEvidence = params.get("evidence") === "1";
  }

  function saveHashState() {
    var raw = window.location.hash.slice(1);
    var anchor = raw.split("?")[0] || "main-content";
    var params = new URLSearchParams();
    if (state.comparisonBooks.length) params.set("compare", state.comparisonBooks.join(","));
    if (state.scale !== "domain") params.set("scale", state.scale);
    if (state.visibleDomains.length !== domains.length) params.set("domains", state.visibleDomains.join(","));
    if (state.chapterQuery) params.set("q", state.chapterQuery);
    if (state.chapterBook !== "all") params.set("book", state.chapterBook);
    if (state.chapterDomain !== "all") params.set("domain", state.chapterDomain);
    if (state.chapterSeverity !== "all") params.set("severity", state.chapterSeverity);
    if (state.chapterStatus !== "all") params.set("status", state.chapterStatus);
    if (state.onlyDisagreements) params.set("disagreements", "1");
    if (state.showEvidence) params.set("evidence", "1");
    var query = params.toString();
    window.history.replaceState(null, "", "#" + anchor + (query ? "?" + query : ""));
  }

  function clearHighlights(root) {
    if (!root) return;
    Array.prototype.slice.call(root.querySelectorAll("mark[data-search-highlight]")).forEach(function (mark) {
      var parent = mark.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
      parent.normalize();
    });
  }

  function highlightText(root, query) {
    clearHighlights(root);
    var needle = String(query || "").trim().toLocaleLowerCase();
    if (!needle || !root) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (textNode) {
        var parent = textNode.parentElement;
        if (!parent || ["SCRIPT", "STYLE", "MARK", "INPUT", "SELECT", "OPTION", "BUTTON"].indexOf(parent.tagName) >= 0) return NodeFilter.FILTER_REJECT;
        return (textNode.nodeValue || "").toLocaleLowerCase().indexOf(needle) >= 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var matches = [];
    while (walker.nextNode()) matches.push(walker.currentNode);
    matches.forEach(function (textNode) {
      var original = textNode.nodeValue || "";
      var lower = original.toLocaleLowerCase();
      var fragment = document.createDocumentFragment();
      var start = 0;
      var index = lower.indexOf(needle, start);
      while (index >= 0) {
        if (index > start) fragment.appendChild(document.createTextNode(original.slice(start, index)));
        var mark = node("mark", "", original.slice(index, index + needle.length));
        mark.setAttribute("data-search-highlight", "true");
        fragment.appendChild(mark);
        start = index + needle.length;
        index = lower.indexOf(needle, start);
      }
      if (start < original.length) fragment.appendChild(document.createTextNode(original.slice(start)));
      if (textNode.parentNode) textNode.parentNode.replaceChild(fragment, textNode);
    });
  }

  function initSortableTables() {
    Array.prototype.slice.call(document.querySelectorAll("table[data-sortable]")).forEach(function (table) {
      Array.prototype.slice.call(table.querySelectorAll("thead th[data-sort-key]")).forEach(function (header) {
        var button = header.querySelector("button");
        if (!button) return;
        button.addEventListener("click", function () {
          var key = header.getAttribute("data-sort-key");
          var type = header.getAttribute("data-sort-type") || "text";
          var direction = header.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
          Array.prototype.slice.call(header.parentNode.children).forEach(function (cell) { cell.removeAttribute("aria-sort"); });
          header.setAttribute("aria-sort", direction);
          var body = table.tBodies[0];
          var rows = Array.prototype.slice.call(body.rows);
          rows.sort(function (a, b) {
            var aCell = a.querySelector('[data-key="' + key + '"]');
            var bCell = b.querySelector('[data-key="' + key + '"]');
            var aValue = aCell ? aCell.getAttribute("data-sort-value") || aCell.textContent || "" : "";
            var bValue = bCell ? bCell.getAttribute("data-sort-value") || bCell.textContent || "" : "";
            var comparison = type === "number" ? number(aValue, -Infinity) - number(bValue, -Infinity) : aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: "base" });
            return direction === "ascending" ? comparison : -comparison;
          });
          rows.forEach(function (row) { body.appendChild(row); });
        });
      });
    });
  }

  function addLegend(container, selectedBooks) {
    var legend = node("div", "chart-legend");
    selectedBooks.forEach(function (book, index) {
      var item = node("span", "");
      var swatch = node("span", "legend-swatch");
      swatch.style.backgroundColor = SERIES_COLORS[index];
      swatch.setAttribute("aria-hidden", "true");
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(bookTitle(book)));
      legend.appendChild(item);
    });
    container.appendChild(legend);
  }

  function chartDataTable(selectedBooks, visibleDomains) {
    var details = node("details", "");
    details.appendChild(node("summary", "", "View chart data table"));
    var wrapper = node("div", "table-scroll");
    var table = node("table", "");
    var thead = node("thead", "");
    var headerRow = node("tr", "");
    headerRow.appendChild(node("th", "", "Domain"));
    selectedBooks.forEach(function (book) { headerRow.appendChild(node("th", "numeric", bookTitle(book))); });
    thead.appendChild(headerRow);
    table.appendChild(thead);
    var tbody = node("tbody", "");
    visibleDomains.forEach(function (domain) {
      var row = node("tr", "");
      row.appendChild(node("th", "", domain.label));
      selectedBooks.forEach(function (book) { row.appendChild(node("td", "numeric", formatValue(domainValue(book, domain, state.scale), state.scale))); });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    details.appendChild(wrapper);
    return details;
  }

  function renderParallel(selectedBooks, visibleDomains) {
    var container = document.getElementById("parallel-chart");
    clearNode(container);
    if (!selectedBooks.length || !visibleDomains.length) return;
    var width = Math.max(700, visibleDomains.length * 90);
    var height = 330;
    var pad = { top: 35, right: 35, bottom: 85, left: 35 };
    var plotHeight = height - pad.top - pad.bottom;
    var svg = svgNode("svg", { viewBox: "0 0 " + width + " " + height, role: "img", "aria-label": sampleMode ? "Parallel-coordinate chart comparing selected-chapter estimates by domain" : "Parallel-coordinate chart comparing selected books by domain" });
    visibleDomains.forEach(function (domain, index) {
      var x = visibleDomains.length === 1 ? width / 2 : pad.left + index * (width - pad.left - pad.right) / (visibleDomains.length - 1);
      svg.appendChild(svgNode("line", { x1: x, y1: pad.top, x2: x, y2: height - pad.bottom, class: "axis" }));
      [0, 0.5, 1].forEach(function (fraction) {
        var y = pad.top + plotHeight * (1 - fraction);
        svg.appendChild(svgNode("line", { x1: x - 4, y1: y, x2: x + 4, y2: y, class: "axis" }));
        svg.appendChild(svgNode("text", { x: x + 6, y: y + 4 }, formatValue(scaleMaximum(domain, state.scale) * fraction, state.scale)));
      });
      var label = svgNode("text", { x: x, y: height - pad.bottom + 22, "text-anchor": "end", transform: "rotate(-38 " + x + " " + (height - pad.bottom + 22) + ")" }, domain.shortLabel);
      svg.appendChild(label);
    });
    selectedBooks.forEach(function (book, bookIndex) {
      var points = visibleDomains.map(function (domain, index) {
        var x = visibleDomains.length === 1 ? width / 2 : pad.left + index * (width - pad.left - pad.right) / (visibleDomains.length - 1);
        var fraction = domainValue(book, domain, state.scale) / scaleMaximum(domain, state.scale);
        var y = pad.top + plotHeight * (1 - Math.max(0, Math.min(1, fraction)));
        return [x, y];
      });
      var line = svgNode("polyline", { points: points.map(function (point) { return point.join(","); }).join(" "), class: "series", stroke: SERIES_COLORS[bookIndex] });
      line.appendChild(svgNode("title", {}, bookTitle(book)));
      svg.appendChild(line);
      points.forEach(function (point, index) {
        var circle = svgNode("circle", { cx: point[0], cy: point[1], r: 4, fill: SERIES_COLORS[bookIndex], stroke: "#17212b" });
        circle.appendChild(svgNode("title", {}, bookTitle(book) + " · " + visibleDomains[index].label + ": " + formatValue(domainValue(book, visibleDomains[index], state.scale), state.scale)));
        svg.appendChild(circle);
      });
    });
    container.appendChild(svg);
    addLegend(container, selectedBooks);
    container.appendChild(chartDataTable(selectedBooks, visibleDomains));
  }

  function renderBars(selectedBooks, visibleDomains) {
    var container = document.getElementById("bar-chart");
    clearNode(container);
    if (!selectedBooks.length || !visibleDomains.length) return;
    var width = Math.max(700, visibleDomains.length * 100);
    var height = 330;
    var pad = { top: 25, right: 20, bottom: 90, left: 50 };
    var plotHeight = height - pad.top - pad.bottom;
    var globalMax = state.scale === "weighted" ? Math.max.apply(null, visibleDomains.map(function (domain) { return scaleMaximum(domain, state.scale); })) : scaleMaximum(visibleDomains[0], state.scale);
    var svg = svgNode("svg", { viewBox: "0 0 " + width + " " + height, role: "img", "aria-label": "Grouped bar chart comparing selected books' domain values" });
    [0, 0.25, 0.5, 0.75, 1].forEach(function (fraction) {
      var y = pad.top + plotHeight * (1 - fraction);
      svg.appendChild(svgNode("line", { x1: pad.left, y1: y, x2: width - pad.right, y2: y, class: "grid-line" }));
      svg.appendChild(svgNode("text", { x: pad.left - 6, y: y + 4, "text-anchor": "end" }, formatValue(globalMax * fraction, state.scale)));
    });
    var groupWidth = (width - pad.left - pad.right) / visibleDomains.length;
    var barWidth = Math.min(22, groupWidth / Math.max(selectedBooks.length + 1, 3));
    visibleDomains.forEach(function (domain, domainIndex) {
      var center = pad.left + groupWidth * (domainIndex + 0.5);
      selectedBooks.forEach(function (book, bookIndex) {
        var value = domainValue(book, domain, state.scale);
        var barHeight = Math.max(0, value / globalMax * plotHeight);
        var x = center - selectedBooks.length * barWidth / 2 + bookIndex * barWidth;
        var rect = svgNode("rect", { x: x, y: pad.top + plotHeight - barHeight, width: Math.max(2, barWidth - 2), height: barHeight, class: "bar", fill: SERIES_COLORS[bookIndex] });
        rect.appendChild(svgNode("title", {}, bookTitle(book) + " · " + domain.label + ": " + formatValue(value, state.scale)));
        svg.appendChild(rect);
      });
      svg.appendChild(svgNode("text", { x: center, y: height - pad.bottom + 22, "text-anchor": "end", transform: "rotate(-38 " + center + " " + (height - pad.bottom + 22) + ")" }, domain.shortLabel));
    });
    container.appendChild(svg);
    addLegend(container, selectedBooks);
    container.appendChild(chartDataTable(selectedBooks, visibleDomains));
  }

  function subcriterionTooltip(book, domain, criterion) {
    var record = subcriterionRecord(book, domain.key, criterion.key);
    var pieces = [domain.label + " · " + criterion.label];
    if (criterion.definition) pieces.push(criterion.definition);
    if (record.rationale) pieces.push("Rationale: " + String(record.rationale));
    var evidence = evidenceText(record.strength_evidence || record.evidence || record.limitation_evidence);
    if (evidence) pieces.push("Evidence: " + evidence.slice(0, 500));
    return pieces.join("\n");
  }

  function renderHeatmap(selectedBooks, visibleDomains) {
    var container = document.getElementById("heatmap");
    clearNode(container);
    var table = node("table", "heatmap-table");
    var caption = node("caption", "", "Final adjudicated subcriterion ratings on the 0–4 scale");
    table.appendChild(caption);
    var thead = node("thead", "");
    var header = node("tr", "");
    header.appendChild(node("th", "sticky-column", "Subcriterion"));
    selectedBooks.forEach(function (book) { header.appendChild(node("th", "numeric", bookTitle(book))); });
    thead.appendChild(header);
    table.appendChild(thead);
    var tbody = node("tbody", "");
    visibleDomains.forEach(function (domain) {
      subcriteriaFor(domain).forEach(function (criterion) {
        var row = node("tr", "");
        row.appendChild(node("th", "sticky-column", domain.label + " · " + criterion.label));
        selectedBooks.forEach(function (book) {
          var value = rating(subcriterionRecord(book, domain.key, criterion.key));
          var cell = node("td", "heat-cell");
          var button = node("button", "heat-button heat-" + String(Math.max(0, Math.min(4, Math.round(number(value, 0))))), Number.isFinite(value) ? value.toFixed(1) : "—");
          button.type = "button";
          button.title = subcriterionTooltip(book, domain, criterion);
          button.setAttribute("aria-label", bookTitle(book) + ", " + criterion.label + ", rating " + (Number.isFinite(value) ? value.toFixed(1) : "not available") + ". " + subcriterionTooltip(book, domain, criterion));
          cell.appendChild(button);
          row.appendChild(cell);
        });
        tbody.appendChild(row);
      });
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  function selectedComparisonBooks() {
    return state.comparisonBooks.map(function (id) {
      return books.find(function (book, index) { return bookId(book, index) === id; });
    }).filter(Boolean).slice(0, 4);
  }

  function renderComparison() {
    var message = document.getElementById("comparison-message");
    var selected = selectedComparisonBooks();
    var visible = domains.filter(function (domain) { return state.visibleDomains.indexOf(domain.key) >= 0; });
    if (selected.length < 2) {
      message.textContent = sampleMode ? "Select at least two sampled books to compare." : "Select at least two books to compare.";
      clearNode(document.getElementById("parallel-chart"));
      clearNode(document.getElementById("bar-chart"));
      clearNode(document.getElementById("heatmap"));
      return;
    }
    message.textContent = "Comparing " + String(selected.length) + (sampleMode ? " selected-chapter estimates" : " books") + " across " + String(visible.length) + " visible domains.";
    renderParallel(selected, visible);
    renderBars(selected, visible);
    renderHeatmap(selected, visible);
  }

  function initComparison() {
    var app = document.getElementById("comparison-app");
    var controls = document.getElementById("comparison-controls");
    if (!app || !controls || books.length < 2) return;
    if (!state.comparisonBooks.length) state.comparisonBooks = books.slice(0, Math.min(3, books.length)).map(bookId);
    state.comparisonBooks = state.comparisonBooks.filter(function (id) { return books.some(function (book, index) { return bookId(book, index) === id; }); }).slice(0, 4);
    if (state.comparisonBooks.length < 2) state.comparisonBooks = books.slice(0, Math.min(2, books.length)).map(bookId);

    var bookFieldset = node("fieldset", "control-group");
    bookFieldset.appendChild(node("legend", "", sampleMode ? "Sampled books (select 2–4)" : "Books (select 2–4)"));
    var bookOptions = node("div", "control-options");
    books.forEach(function (book, index) {
      var id = bookId(book, index);
      var label = node("label", "book-option");
      var input = document.createElement("input");
      input.type = "checkbox";
      input.value = id;
      input.checked = state.comparisonBooks.indexOf(id) >= 0;
      input.addEventListener("change", function () {
        if (input.checked && state.comparisonBooks.length >= 4) {
          input.checked = false;
          document.getElementById("comparison-message").textContent = "A maximum of four books can be compared at once.";
          return;
        }
        if (input.checked) state.comparisonBooks.push(id);
        else state.comparisonBooks = state.comparisonBooks.filter(function (value) { return value !== id; });
        saveHashState();
        renderComparison();
      });
      label.appendChild(input);
      label.appendChild(document.createTextNode(bookTitle(book)));
      bookOptions.appendChild(label);
    });
    bookFieldset.appendChild(bookOptions);
    controls.appendChild(bookFieldset);

    var settings = node("div", "");
    var scaleLabel = node("label", "", "Scale");
    scaleLabel.setAttribute("for", "comparison-scale");
    var scale = document.createElement("select");
    scale.id = "comparison-scale";
    scale.appendChild(option("domain", sampleMode ? "Sample domain score (0–4)" : "Domain score (0–4)"));
    scale.appendChild(option("weighted", "Weighted points"));
    scale.appendChild(option("percent", "Normalized percentage"));
    scale.value = state.scale;
    scale.addEventListener("change", function () { state.scale = scale.value; saveHashState(); renderComparison(); });
    settings.appendChild(scaleLabel);
    settings.appendChild(scale);

    var domainFieldset = node("fieldset", "control-group");
    domainFieldset.appendChild(node("legend", "", "Visible domains"));
    var domainOptions = node("div", "control-options");
    domains.forEach(function (domain) {
      var label = node("label", "domain-option");
      var input = document.createElement("input");
      input.type = "checkbox";
      input.value = domain.key;
      input.checked = state.visibleDomains.indexOf(domain.key) >= 0;
      input.addEventListener("change", function () {
        if (input.checked) state.visibleDomains.push(domain.key);
        else state.visibleDomains = state.visibleDomains.filter(function (key) { return key !== domain.key; });
        saveHashState();
        renderComparison();
      });
      label.appendChild(input);
      label.appendChild(document.createTextNode(domain.shortLabel));
      domainOptions.appendChild(label);
    });
    domainFieldset.appendChild(domainOptions);
    settings.appendChild(domainFieldset);
    controls.appendChild(settings);

    document.getElementById("export-comparison").addEventListener("click", function () {
      var selected = selectedComparisonBooks();
      var visible = domains.filter(function (domain) { return state.visibleDomains.indexOf(domain.key) >= 0; });
      var rows = [["book_id", "title", "domain", "subcriterion", "scale", "value"]];
      selected.forEach(function (book, index) {
        visible.forEach(function (domain) {
          rows.push([bookId(book, index), bookTitle(book), domain.label, "Domain total", state.scale, formatValue(domainValue(book, domain, state.scale), state.scale)]);
          subcriteriaFor(domain).forEach(function (criterion) {
            rows.push([bookId(book, index), bookTitle(book), domain.label, criterion.label, "0-4", rating(subcriterionRecord(book, domain.key, criterion.key))]);
          });
        });
      });
      downloadText(sampleMode ? "chapterflow-sample-comparison.csv" : "chapterflow-visible-comparison.csv", csv(rows), "text/csv;charset=utf-8");
    });
    app.hidden = false;
    renderComparison();
  }

  function chapterRows() {
    var rows = [];
    var indexed = {};
    (Array.isArray(chapterFilterIndex.chapters) ? chapterFilterIndex.chapters : []).forEach(function (item) {
      if (item && item.chapter_key) indexed[String(item.chapter_key)] = item;
    });
    books.forEach(function (book, bookIndex) {
      var chapters = Array.isArray(book.chapter_evidence) ? book.chapter_evidence : [];
      chapters.forEach(function (chapter, chapterIndex) {
        chapter = chapter || {};
        var index = chapter.chapter_index !== undefined ? chapter.chapter_index : chapterIndex + 1;
        var key = bookId(book, bookIndex) + "::" + String(index);
        rows.push({
          book: book,
          bookIndex: bookIndex,
          chapter: chapter,
          chapterIndex: chapterIndex,
          filterMetadata: indexed[key] || {
            chapter_key: key,
            domain_keys: [],
            domain_associations: [],
            max_issue_severity: "none",
            issue_associations: [],
            untyped_observation_count: 0
          }
        });
      });
    });
    return rows;
  }

  function chapterSeverity(row) {
    var severity = String(row.filterMetadata.max_issue_severity || "none").toLowerCase();
    return ["error", "warning", "info", "none"].indexOf(severity) >= 0 ? severity : "none";
  }

  function structuredChapterFindings(row) {
    var findings = Array.isArray(row.book.technical_findings) ? row.book.technical_findings : [];
    return (Array.isArray(row.filterMetadata.issue_associations) ? row.filterMetadata.issue_associations : []).map(function (association) {
      var finding = findings[Number(association.technical_finding_index)] || {};
      return {
        severity: association.severity || finding.severity,
        type: association.type || finding.type,
        locator: finding.locator || "",
        description: finding.description || "",
        scoring_treatment: finding.scoring_treatment || ""
      };
    });
  }

  function searchableText(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return value.map(searchableText).filter(Boolean).join(" ");
    if (typeof value === "object") return Object.keys(value).sort().map(function (key) { return searchableText(value[key]); }).filter(Boolean).join(" ");
    return "";
  }

  function chapterHaystack(row) {
    var chapter = row.chapter;
    var improvements = row.book.analysis && row.book.analysis.highest_impact_improvements;
    var choices = report.cross_book_analysis && report.cross_book_analysis.choose_this_book_if;
    var recommendation = choices && choices[bookId(row.book, row.bookIndex)];
    var domainLabels = (Array.isArray(row.filterMetadata.domain_keys) ? row.filterMetadata.domain_keys : []).map(function (key) {
      var domain = domains.find(function (item) { return item.key === key; });
      return domain ? domain.label : key;
    });
    return [
      bookTitle(row.book),
      chapter.title,
      chapter.chapter_id,
      chapter.central_ideas,
      chapter.mental_model_contribution,
      chapter.engagement_and_pacing,
      chapter.learning_support,
      chapter.retention_support,
      chapter.retention_retrieval_support,
      chapter.transfer_support,
      chapter.transfer_action_support,
      chapter.trust_qa_safety_issues,
      chapter.evidence,
      structuredChapterFindings(row),
      domainLabels,
      improvements,
      recommendation
    ].map(searchableText).join(" ").toLocaleLowerCase();
  }

  function filterChapterRows(filters) {
    filters = filters || {};
    var query = String(own(filters, "chapterQuery") ? filters.chapterQuery : (filters.q || "")).trim().toLocaleLowerCase();
    var selectedBook = String(own(filters, "chapterBook") ? filters.chapterBook : (filters.book || "all"));
    var selectedDomain = String(own(filters, "chapterDomain") ? filters.chapterDomain : (filters.domain || "all"));
    var selectedSeverity = String(own(filters, "chapterSeverity") ? filters.chapterSeverity : (filters.severity || "all"));
    var selectedStatus = String(own(filters, "chapterStatus") ? filters.chapterStatus : (filters.status || "all"));
    return chapterRows().filter(function (row) {
      var id = bookId(row.book, row.bookIndex);
      if (selectedBook !== "all" && selectedBook !== id) return false;
      if (selectedStatus !== "all" && String(row.chapter.read_status || "").toLowerCase() !== selectedStatus) return false;
      if (selectedSeverity !== "all" && chapterSeverity(row) !== selectedSeverity) return false;
      if (selectedDomain !== "all" && (Array.isArray(row.filterMetadata.domain_keys) ? row.filterMetadata.domain_keys : []).indexOf(selectedDomain) < 0) return false;
      return !query || chapterHaystack(row).indexOf(query) >= 0;
    });
  }

  function filteredChapters() {
    return filterChapterRows(state);
  }

  function addChapterField(parent, title, value) {
    var section = node("section", "");
    section.appendChild(node("h4", "", title));
    if (Array.isArray(value)) {
      var list = node("ul", "");
      value.forEach(function (item) { list.appendChild(node("li", "", evidenceText(item) || "None recorded")); });
      section.appendChild(list);
    } else {
      section.appendChild(node("p", "", evidenceText(value) || "Not recorded."));
    }
    parent.appendChild(section);
  }

  function renderChapterCard(row) {
    var chapter = row.chapter;
    var details = node("details", "chapter-card");
    var summary = node("summary", "");
    var index = chapter.chapter_index !== undefined ? chapter.chapter_index : row.chapterIndex + 1;
    summary.appendChild(document.createTextNode(bookTitle(row.book) + " · Chapter " + String(index) + ": " + String(chapter.title || chapter.chapter_id || "Untitled")));
    details.appendChild(summary);
    var body = node("div", "chapter-card-body");
    var metaRow = node("p", "chapter-meta");
    metaRow.appendChild(node("span", "badge " + String(chapter.read_status || "not_assessed"), "Read: " + String(chapter.read_status || "not assessed")));
    metaRow.appendChild(node("span", "badge " + chapterSeverity(row), "Structured finding severity: " + chapterSeverity(row)));
    var associatedDomains = Array.isArray(row.filterMetadata.domain_keys) ? row.filterMetadata.domain_keys : [];
    if (associatedDomains.length) {
      metaRow.appendChild(node("span", "", "Cited by final evidence: " + associatedDomains.map(function (key) { return DOMAIN_LABELS[key] || key; }).join(", ")));
    }
    metaRow.appendChild(node("span", "", "Untyped QA/safety observations: " + String(Number(row.filterMetadata.untyped_observation_count) || 0)));
    if (chapter.chapter_id) metaRow.appendChild(node("span", "", "ID: " + String(chapter.chapter_id)));
    body.appendChild(metaRow);
    var fields = node("div", "chapter-fields");
    addChapterField(fields, "Central ideas", chapter.central_ideas);
    addChapterField(fields, "Mental-model contribution", chapter.mental_model_contribution);
    addChapterField(fields, "Engagement and pacing", chapter.engagement_and_pacing);
    addChapterField(fields, "Learning support", chapter.learning_support);
    addChapterField(fields, "Retention and retrieval support", chapter.retention_support || chapter.retention_retrieval_support);
    addChapterField(fields, "Transfer and action support", chapter.transfer_support || chapter.transfer_action_support);
    addChapterField(fields, "QA, trust, or safety issues", chapter.trust_qa_safety_issues);
    addChapterField(fields, "Structured chapter-scoped findings", structuredChapterFindings(row));
    addChapterField(fields, "Paraphrased evidence and locators", chapter.evidence);
    body.appendChild(fields);
    details.appendChild(body);
    return details;
  }

  function renderChapters() {
    var container = document.getElementById("chapter-results");
    var count = document.getElementById("chapter-result-count");
    var loadMore = document.getElementById("load-more-chapters");
    var matches = filteredChapters();
    clearNode(container);
    matches.slice(0, state.chapterLimit).forEach(function (row) { container.appendChild(renderChapterCard(row)); });
    if (!matches.length) container.appendChild(node("p", "empty-state", "No chapter evidence matches the current filters."));
    count.textContent = String(matches.length) + " matching chapter" + (matches.length === 1 ? "" : "s") + "; " + String(Math.min(matches.length, state.chapterLimit)) + " shown.";
    loadMore.hidden = matches.length <= state.chapterLimit;
    highlightText(container, state.chapterQuery);
  }

  function initChapterBrowser() {
    var browser = document.getElementById("chapter-browser");
    if (!browser) return;
    var search = document.getElementById("chapter-search");
    var bookFilter = document.getElementById("chapter-book-filter");
    var domainFilter = document.getElementById("chapter-domain-filter");
    var severityFilter = document.getElementById("chapter-severity-filter");
    var statusFilter = document.getElementById("chapter-status-filter");
    bookFilter.appendChild(option("all", "All books"));
    books.forEach(function (book, index) { bookFilter.appendChild(option(bookId(book, index), bookTitle(book))); });
    domainFilter.appendChild(option("all", "All domains"));
    domains.forEach(function (domain) { domainFilter.appendChild(option(domain.key, domain.label)); });
    search.value = state.chapterQuery;
    bookFilter.value = state.chapterBook;
    domainFilter.value = state.chapterDomain;
    severityFilter.value = state.chapterSeverity;
    statusFilter.value = state.chapterStatus;
    search.addEventListener("input", function () { state.chapterQuery = search.value; state.chapterLimit = 24; saveHashState(); renderChapters(); });
    bookFilter.addEventListener("change", function () { state.chapterBook = bookFilter.value; state.chapterLimit = 24; saveHashState(); renderChapters(); });
    domainFilter.addEventListener("change", function () { state.chapterDomain = domainFilter.value; state.chapterLimit = 24; saveHashState(); renderChapters(); });
    severityFilter.addEventListener("change", function () { state.chapterSeverity = severityFilter.value; state.chapterLimit = 24; saveHashState(); renderChapters(); });
    statusFilter.addEventListener("change", function () { state.chapterStatus = statusFilter.value; state.chapterLimit = 24; saveHashState(); renderChapters(); });
    document.getElementById("reset-filters").addEventListener("click", function () {
      state.chapterQuery = ""; state.chapterBook = "all"; state.chapterDomain = "all"; state.chapterSeverity = "all"; state.chapterStatus = "all"; state.chapterLimit = 24;
      search.value = ""; bookFilter.value = "all"; domainFilter.value = "all"; severityFilter.value = "all"; statusFilter.value = "all";
      saveHashState(); renderChapters(); search.focus();
    });
    document.getElementById("load-more-chapters").addEventListener("click", function () { state.chapterLimit += 24; renderChapters(); });
    browser.hidden = false;
    renderChapters();
  }

  function initRubricSearch() {
    var toolbar = document.getElementById("rubric-toolbar");
    var search = document.getElementById("rubric-search");
    var explorer = document.getElementById("rubric-explorer");
    if (!toolbar || !search || !explorer) return;
    toolbar.hidden = false;
    search.addEventListener("input", function () {
      var query = search.value.trim().toLocaleLowerCase();
      clearHighlights(explorer);
      Array.prototype.slice.call(explorer.querySelectorAll("details.rubric-domain")).forEach(function (details) {
        var match = !query || (details.textContent || "").toLocaleLowerCase().indexOf(query) >= 0;
        details.hidden = !match;
        if (match && query) details.open = true;
      });
      highlightText(explorer, query);
    });
    document.getElementById("rubric-expand").addEventListener("click", function () { Array.prototype.slice.call(explorer.querySelectorAll("details.rubric-domain:not([hidden])")).forEach(function (details) { details.open = true; }); });
    document.getElementById("rubric-collapse").addEventListener("click", function () { Array.prototype.slice.call(explorer.querySelectorAll("details.rubric-domain")).forEach(function (details) { details.open = false; }); });
  }

  function initBookToggles() {
    var toolbar = document.getElementById("score-table-toolbar");
    var disagreements = document.getElementById("show-disagreements");
    var evidence = document.getElementById("show-evidence");
    if (!toolbar || !disagreements || !evidence) return;
    toolbar.hidden = false;
    disagreements.checked = state.onlyDisagreements;
    evidence.checked = state.showEvidence;
    function apply() {
      document.body.classList.toggle("disagreements-only", state.onlyDisagreements);
      document.body.classList.toggle("evidence-visible", state.showEvidence);
      saveHashState();
    }
    disagreements.addEventListener("change", function () { state.onlyDisagreements = disagreements.checked; apply(); });
    evidence.addEventListener("change", function () { state.showEvidence = evidence.checked; apply(); });
    apply();
  }

  function remediationBook(id) {
    return books.find(function (book, index) { return bookId(book, index) === id; }) || null;
  }

  function remediationMarkdown() {
    var prompts = books.map(function (book) {
      return book.remediation && typeof book.remediation.prompt_markdown === "string" ? book.remediation.prompt_markdown : "";
    }).filter(Boolean);
    var summary = report.remediation_summary || {};
    return [
      "# ChapterFlow below-80 remediation prompt pack",
      "",
      "Books: " + String(summary.books || books.length),
      "Books below 80 overall: " + String(summary.books_below_80_overall || 0),
      "Strict-below-80 conditions: " + String(summary.conditions && summary.conditions.total || 0),
      "",
      prompts.join("\n\n---\n\n"),
      ""
    ].join("\n");
  }

  function initRemediation() {
    var toolbar = document.getElementById("remediation-toolbar");
    var container = document.getElementById("remediation-books");
    var search = document.getElementById("remediation-search");
    var priority = document.getElementById("remediation-priority");
    var domain = document.getElementById("remediation-domain");
    var count = document.getElementById("remediation-result-count");
    if (!toolbar || !container || !search || !priority || !domain || !count) return;
    domains.forEach(function (item) { domain.appendChild(option(item.key, item.label)); });
    var cards = Array.prototype.slice.call(container.querySelectorAll(".remediation-book"));
    var matrixRows = Array.prototype.slice.call(document.querySelectorAll("[data-remediation-matrix-book]"));

    function apply() {
      var query = search.value.trim().toLocaleLowerCase();
      var priorityValue = priority.value;
      var domainValue = domain.value;
      var visibleIds = {};
      var visible = 0;
      cards.forEach(function (card) {
        var queryMatch = !query || String(card.getAttribute("data-search") || "").indexOf(query) >= 0;
        var priorityMatch = priorityValue === "all" || String(card.getAttribute("data-priorities") || "").split(/\s+/).indexOf(priorityValue) >= 0;
        var domainMatch = domainValue === "all" || String(card.getAttribute("data-domains") || "").split(/\s+/).indexOf(domainValue) >= 0;
        var show = queryMatch && priorityMatch && domainMatch;
        card.hidden = !show;
        if (show) {
          visible += 1;
          visibleIds[String(card.getAttribute("data-book-id") || "")] = true;
        }
        Array.prototype.slice.call(card.querySelectorAll(".remediation-ledger tbody tr")).forEach(function (row) {
          var rowPriority = String(row.getAttribute("data-priority") || "");
          var rowDomain = String(row.getAttribute("data-domain") || "");
          row.hidden = (priorityValue !== "all" && rowPriority !== priorityValue) || (domainValue !== "all" && rowDomain !== domainValue);
        });
      });
      matrixRows.forEach(function (row) { row.hidden = !visibleIds[String(row.getAttribute("data-remediation-matrix-book") || "")]; });
      count.textContent = String(visible) + " of " + String(cards.length) + " books shown.";
    }

    search.addEventListener("input", apply);
    priority.addEventListener("change", apply);
    domain.addEventListener("change", apply);
    document.getElementById("remediation-reset").addEventListener("click", function () {
      search.value = ""; priority.value = "all"; domain.value = "all"; apply(); search.focus();
    });
    document.getElementById("download-remediation-prompts").addEventListener("click", function () {
      downloadText("remediation-prompts.md", remediationMarkdown(), "text/markdown;charset=utf-8");
    });
    Array.prototype.slice.call(container.querySelectorAll(".remediation-copy")).forEach(function (button) {
      button.addEventListener("click", function () {
        var book = remediationBook(String(button.getAttribute("data-book-id") || ""));
        var prompt = book && book.remediation ? String(book.remediation.prompt_markdown || "") : "";
        if (!prompt) { count.textContent = "No prompt is available for this book."; return; }
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          navigator.clipboard.writeText(prompt).then(function () { count.textContent = "Prompt copied."; }).catch(function () { count.textContent = "Copy was blocked; select the prompt text instead."; });
        } else {
          count.textContent = "Clipboard access is unavailable; select the prompt text instead.";
        }
      });
    });
    Array.prototype.slice.call(container.querySelectorAll(".remediation-download")).forEach(function (button) {
      button.addEventListener("click", function () {
        var id = String(button.getAttribute("data-book-id") || "");
        var book = remediationBook(id);
        var prompt = book && book.remediation ? String(book.remediation.prompt_markdown || "") : "";
        if (prompt) downloadText(id + "-remediation-prompt.md", prompt + "\n", "text/markdown;charset=utf-8");
      });
    });
    toolbar.hidden = false;
    apply();
  }

  function initDownloads() {
    var container = document.getElementById("downloads");
    if (!container) return;
    var jsonButton = node("button", "button", "Download report-data.json");
    jsonButton.type = "button";
    jsonButton.addEventListener("click", function () { downloadText("report-data.json", JSON.stringify(report, null, 2) + "\n", "application/json;charset=utf-8"); });
    container.appendChild(jsonButton);
    if (report.remediation_summary) {
      var remediationJson = node("button", "button secondary", "Download remediation-prompts.json");
      remediationJson.type = "button";
      remediationJson.addEventListener("click", function () {
        var pack = {
          schema_version: "1.0.0",
          summary: report.remediation_summary,
          books: books.map(function (book, index) {
            return { book_id: bookId(book, index), title: bookTitle(book), overall_score: number(book.overall_score), remediation: book.remediation || {} };
          })
        };
        downloadText("remediation-prompts.json", JSON.stringify(pack, null, 2) + "\n", "application/json;charset=utf-8");
      });
      container.appendChild(remediationJson);
      var remediationMarkdownButton = node("button", "button secondary", "Download remediation-prompts.md");
      remediationMarkdownButton.type = "button";
      remediationMarkdownButton.addEventListener("click", function () { downloadText("remediation-prompts.md", remediationMarkdown(), "text/markdown;charset=utf-8"); });
      container.appendChild(remediationMarkdownButton);
    }
    var downloads = report.csv_downloads && typeof report.csv_downloads === "object" ? report.csv_downloads : {};
    Object.keys(downloads).sort().forEach(function (filename) {
      var value = downloads[filename];
      var text = typeof value === "string" ? value : (value && typeof value.content === "string" ? value.content : "");
      var button = node("button", "button secondary", "Download " + filename);
      button.type = "button";
      button.addEventListener("click", function () { downloadText(filename, text, "text/csv;charset=utf-8"); });
      container.appendChild(button);
    });
    container.hidden = false;
  }

  if (typeof globalThis !== "undefined" && typeof globalThis.__chapterflowFilterTestHook === "function") {
    globalThis.__chapterflowFilterTestHook({
      filterChapterKeys: function (filters) {
        return filterChapterRows(filters).map(function (row) {
          return bookId(row.book, row.bookIndex) + "/" + String(row.chapter.chapter_id || row.chapter.chapter_index || row.chapterIndex + 1);
        });
      }
    });
  }

  parseHashState();
  initSortableTables();
  initComparison();
  initRubricSearch();
  initBookToggles();
  initRemediation();
  initChapterBrowser();
  initDownloads();
}());
