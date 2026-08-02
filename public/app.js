// @ts-check

/** @typedef {{i:string,a:string,b:string,p:number,r:number,z:number,u:string,k:string,n:string,s:string,m:number,c:string,la:number,lo:number}} LandPoint */
/** @typedef {{code:string,name:string,region:string,count:number,min:number,median:number,max:number,up:number,flat:number,down:number}} Prefecture */
/** @typedef {{year:number,date:string,total:number,prefectures:Prefecture[]}} DataIndex */

const DATA_INDEX = "/data/index.json";
const OFFICIAL_URL = "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-L01-2026.html";
const STORAGE_KEY = "chika-kohji-compared-v1";
const SESSION_KEY = "chika-kohji-session-v1";
const MAX_COMPARE = 4;
const PAGE_SIZE = 30;
const currency = new Intl.NumberFormat("ja-JP");

/** @param {string} id */
const byId = (id) => document.getElementById(id);
/** @param {keyof HTMLElementTagNameMap} tag @param {string} className @param {string} [text] */
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
/** @param {Element} parent @param {(Node|string)[]} children */
const append = (parent, ...children) => parent.append(...children);
const normalize = (value) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .replace(/[\s\-‐―ー]+/gu, "");
const price = (value) => `${currency.format(value)}円`;
const rate = (value) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
const distance = (value) =>
  value < 1000
    ? `${currency.format(value)}m`
    : `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}km`;
const rateClass = (value) => (value > 0 ? "up" : value < 0 ? "down" : "flat");

const loadCompared = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.i === "string" &&
          typeof item.a === "string" &&
          Number.isFinite(item.p),
      )
      .slice(0, MAX_COMPARE);
  } catch {
    return [];
  }
};

const state = {
  /** @type {DataIndex|null} */ index: null,
  /** @type {Prefecture|null} */ prefecture: null,
  /** @type {LandPoint[]} */ items: [],
  /** @type {LandPoint[]} */ compared: loadCompared(),
  query: "",
  use: "all",
  visible: PAGE_SIZE,
};

const qa = navigator.webdriver;
const privacyOptOut =
  navigator.doNotTrack === "1" ||
  /** @type {Navigator & {globalPrivacyControl?:boolean}} */ (navigator).globalPrivacyControl ===
    true;
let session = sessionStorage.getItem(SESSION_KEY);
if (!session) {
  session = crypto.randomUUID();
  sessionStorage.setItem(SESSION_KEY, session);
}
/** @param {string} name */
const emit = (name) => {
  if (privacyOptOut) return;
  void fetch("/api/telemetry", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-chika-kohji-session": session ?? "",
      "x-chika-kohji-qa": qa ? "1" : "0",
    },
    body: JSON.stringify({ name }),
    keepalive: true,
  }).catch(() => undefined);
};

const setButtonPressed = (selector, key, value) => {
  document.querySelectorAll(selector).forEach((button) => {
    button.setAttribute("aria-pressed", button.getAttribute(key) === value ? "true" : "false");
  });
};
const filterItems = () => {
  const needle = normalize(state.query);
  return state.items.filter((item) => {
    if (state.use !== "all" && item.k !== state.use) return false;
    if (!needle) return true;
    return normalize([item.i, item.a, item.b, item.u, item.n, item.s, item.c].join(" ")).includes(
      needle,
    );
  });
};

/** @param {LandPoint} item */
const pointSummary = (item) =>
  [
    `${item.a}${item.b ? `（${item.b}）` : ""}`,
    `公示価格 ${price(item.p)} / ㎡（前年比 ${rate(item.r)}）`,
    `利用 ${item.u} / 面積 ${currency.format(item.z)}㎡ / ${item.s}駅 ${distance(item.m)}`,
    `標準地番号 ${item.i}`,
  ].join("\n");

/** @param {string} value @param {HTMLButtonElement} button */
const copyText = async (value, button) => {
  const before = button.textContent;
  try {
    await navigator.clipboard.writeText(value);
    button.textContent = "コピーしました";
    emit("copied");
  } catch {
    button.textContent = "コピーできませんでした";
  }
  window.setTimeout(() => {
    button.textContent = before;
  }, 1600);
};

const saveCompared = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.compared.slice(0, MAX_COMPARE)));
};
/** @param {LandPoint} item */
const toggleCompared = (item) => {
  const index = state.compared.findIndex((entry) => entry.i === item.i);
  if (index >= 0) state.compared.splice(index, 1);
  else if (state.compared.length < MAX_COMPARE) {
    state.compared.push(item);
    emit("compared");
  }
  saveCompared();
  renderCompared();
  renderResults();
};

/** @param {LandPoint} item */
const resultCard = (item) => {
  const card = element("article", "land-card");
  const selected = state.compared.some((entry) => entry.i === item.i);
  const heading = element("header", "land-card-heading");
  const identity = element("div", "land-identity");
  append(identity, element("span", "point-id", item.i), element("h3", "", item.a));
  if (item.b) append(identity, element("p", "residential-display", item.b));
  const value = element("div", "price-stake");
  append(
    value,
    element("small", "", "1㎡あたり"),
    element("strong", "", price(item.p)),
    element("em", rateClass(item.r), rate(item.r)),
  );
  append(heading, identity, value);

  const conditions = element("dl", "land-conditions");
  for (const [label, text] of [
    ["現在の利用", item.u],
    ["敷地", `${currency.format(item.z)}㎡`],
    ["最寄駅", `${item.s}・${distance(item.m)}`],
    ["用途地域", item.c || "指定なし"],
  ]) {
    const group = element("div", "");
    append(group, element("dt", "", label), element("dd", "", text));
    conditions.append(group);
  }
  const neighborhood = element("p", "neighborhood", item.n);
  const actions = element("div", "card-actions");
  const compare = /** @type {HTMLButtonElement} */ (
    element("button", selected ? "selected" : "", selected ? "比較から外す" : "比べる")
  );
  compare.type = "button";
  compare.disabled = !selected && state.compared.length >= MAX_COMPARE;
  compare.addEventListener("click", () => toggleCompared(item));
  const copy = /** @type {HTMLButtonElement} */ (element("button", "copy-point", "地点をコピー"));
  copy.type = "button";
  copy.addEventListener("click", () => void copyText(pointSummary(item), copy));
  const officialLink = element("a", "official-link", "公式データの項目を見る");
  officialLink.setAttribute("href", OFFICIAL_URL);
  officialLink.setAttribute("rel", "noopener noreferrer");
  officialLink.addEventListener("click", () => emit("official_opened"));
  append(actions, compare, copy, officialLink);
  append(card, heading, conditions, neighborhood, actions);
  return card;
};

const renderResults = () => {
  const list = byId("land-list");
  const count = byId("result-count");
  const status = byId("search-status");
  const loadMore = /** @type {HTMLButtonElement|null} */ (byId("load-more"));
  if (!list || !count || !status || !loadMore) return;
  list.replaceChildren();
  if (!state.prefecture) {
    count.textContent = "地域未選択";
    status.textContent = "都道府県を選ぶと、公式データを開きます。";
    return;
  }
  const filtered = filterItems();
  count.textContent = `${currency.format(filtered.length)}地点`;
  status.textContent =
    state.query || state.use !== "all"
      ? `${state.prefecture.name}の${currency.format(state.items.length)}地点から絞り込みました。`
      : `${state.prefecture.name}を公示価格の高い順に表示しています。`;
  if (!filtered.length) {
    const empty = element("div", "no-results");
    append(
      empty,
      element("strong", "", "一致する標準地がありません"),
      element(
        "p",
        "",
        "町名を短くする、駅名だけにする、用途を「すべて」に戻す、を試してください。",
      ),
    );
    list.append(empty);
  } else filtered.slice(0, state.visible).forEach((item) => list.append(resultCard(item)));
  loadMore.hidden = filtered.length <= state.visible;
};

const renderCompared = () => {
  const container = byId("compared-items");
  const count = byId("compared-count");
  const copy = /** @type {HTMLButtonElement|null} */ (byId("copy-compared"));
  const clear = /** @type {HTMLButtonElement|null} */ (byId("clear-compared"));
  if (!container || !count || !copy || !clear) return;
  container.replaceChildren();
  count.textContent = `${state.compared.length} / ${MAX_COMPARE}`;
  copy.disabled = !state.compared.length;
  clear.disabled = !state.compared.length;
  if (!state.compared.length) {
    container.append(
      element("p", "", "地点票の「比べる」を押すと、都道府県をまたいで最大4地点を置けます。"),
    );
    return;
  }
  state.compared.forEach((item, index) => {
    const row = element("article", "compared-row");
    const marker = element(
      "span",
      `compare-marker marker-${index + 1}`,
      String.fromCharCode(65 + index),
    );
    const detail = element("div", "");
    append(
      detail,
      element("strong", "", item.a),
      element("b", "", `${price(item.p)} / ㎡`),
      element("small", rateClass(item.r), `${rate(item.r)} ・ ${item.s} ${distance(item.m)}`),
    );
    const remove = /** @type {HTMLButtonElement} */ (element("button", "", "外す"));
    remove.type = "button";
    remove.setAttribute("aria-label", `${item.a}を比較から外す`);
    remove.addEventListener("click", () => toggleCompared(item));
    append(row, marker, detail, remove);
    container.append(row);
  });
};

/** @param {string} code */
const selectPrefecture = async (code) => {
  if (!state.index) return;
  const prefecture = state.index.prefectures.find((entry) => entry.code === code);
  if (!prefecture) return;
  const status = byId("data-status");
  if (status) status.textContent = `${prefecture.name}を開いています…`;
  setButtonPressed("[data-pref]", "data-pref", code);
  try {
    const response = await fetch(`/data/pref/${code}.json`);
    if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.items) || data.items.length !== prefecture.count)
      throw new Error("Unexpected prefecture data");
    state.prefecture = prefecture;
    state.items = data.items;
    state.query = "";
    state.use = "all";
    state.visible = PAGE_SIZE;
    const input = /** @type {HTMLInputElement|null} */ (byId("land-search"));
    const clearSearch = /** @type {HTMLButtonElement|null} */ (byId("clear-search"));
    const useFilter = /** @type {HTMLFieldSetElement|null} */ (byId("use-filter"));
    if (input) {
      input.disabled = false;
      input.value = "";
      input.placeholder = "例 銀座、円山公園、住宅地域…";
    }
    if (clearSearch) clearSearch.disabled = true;
    if (useFilter) useFilter.disabled = false;
    setButtonPressed("[data-use]", "data-use", "all");
    const change = byId("change-prefecture");
    if (change) change.hidden = false;
    if (status) status.textContent = `${prefecture.name} ${currency.format(prefecture.count)}地点`;
    emit("prefecture_selected");
    renderResults();
    byId("search-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
    input?.focus({ preventScroll: true });
  } catch {
    if (status) status.textContent = "データを開けませんでした。再度お試しください。";
  }
};

let searchTimer = 0;
const scheduleSearchEvent = () => {
  window.clearTimeout(searchTimer);
  if (normalize(state.query).length < 2) return;
  searchTimer = window.setTimeout(() => emit(filterItems().length ? "searched" : "no_result"), 650);
};

document
  .querySelectorAll("[data-pref]")
  .forEach((button) =>
    button.addEventListener(
      "click",
      () => void selectPrefecture(button.getAttribute("data-pref") ?? ""),
    ),
  );
document.querySelectorAll("[data-use]").forEach((button) =>
  button.addEventListener("click", () => {
    state.use = button.getAttribute("data-use") ?? "all";
    state.visible = PAGE_SIZE;
    setButtonPressed("[data-use]", "data-use", state.use);
    emit("use_changed");
    renderResults();
  }),
);
const searchInput = /** @type {HTMLInputElement|null} */ (byId("land-search"));
searchInput?.addEventListener("input", () => {
  state.query = searchInput.value;
  state.visible = PAGE_SIZE;
  const clear = /** @type {HTMLButtonElement|null} */ (byId("clear-search"));
  if (clear) clear.disabled = !state.query;
  renderResults();
  scheduleSearchEvent();
});
byId("clear-search")?.addEventListener("click", () => {
  if (searchInput) searchInput.value = "";
  state.query = "";
  const clear = /** @type {HTMLButtonElement|null} */ (byId("clear-search"));
  if (clear) clear.disabled = true;
  renderResults();
  searchInput?.focus();
});
byId("change-prefecture")?.addEventListener("click", () =>
  byId("prefecture-heading")?.scrollIntoView({ behavior: "smooth", block: "start" }),
);
byId("load-more")?.addEventListener("click", () => {
  state.visible += PAGE_SIZE;
  renderResults();
});
byId("clear-compared")?.addEventListener("click", () => {
  state.compared = [];
  saveCompared();
  renderCompared();
  renderResults();
});
byId("copy-compared")?.addEventListener("click", (event) => {
  const button = /** @type {HTMLButtonElement} */ (event.currentTarget);
  void copyText(
    [
      "2026年 地価公示 比較",
      ...state.compared.flatMap((item, index) => [
        `\n${String.fromCharCode(65 + index)}. ${pointSummary(item)}`,
      ]),
      "\n出典: 国土交通省 国土数値情報 地価公示データ（2026年）",
    ].join("\n"),
    button,
  );
});
document
  .querySelectorAll(`a[href="${OFFICIAL_URL}"]`)
  .forEach((link) => link.addEventListener("click", () => emit("official_opened")));

const initialize = async () => {
  renderCompared();
  if (state.compared.length) emit("returned");
  emit("visited");
  try {
    const response = await fetch(DATA_INDEX);
    if (!response.ok) throw new Error(`Index request failed: ${response.status}`);
    state.index = await response.json();
    if (state.index?.total !== 25565 || state.index.prefectures.length !== 47)
      throw new Error("Unexpected data index");
  } catch {
    const status = byId("data-status");
    if (status) status.textContent = "地域一覧を確認できませんでした";
    document
      .querySelectorAll("[data-pref]")
      .forEach((button) => button.setAttribute("disabled", ""));
  }
};
void initialize();
