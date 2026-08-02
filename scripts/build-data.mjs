import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { unzipSync } from "fflate";

const DOWNLOAD = "https://nlftp.mlit.go.jp/ksj/gml/data/L01/L01-26/L01-26_GML.zip";
const SOURCE_PAGE = "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-L01-2026.html";
const EXPECTED_BYTES = 20_898_568;
const EXPECTED_SHA256 = "fad8bbe76d25b682ccf761a492ddc2de001e0345569e044481d62ea84233faf8";
const EXPECTED_POINTS = 25_565;
const prefectures = [
  ["01", "北海道", "北海道"],
  ["02", "青森県", "東北"],
  ["03", "岩手県", "東北"],
  ["04", "宮城県", "東北"],
  ["05", "秋田県", "東北"],
  ["06", "山形県", "東北"],
  ["07", "福島県", "東北"],
  ["08", "茨城県", "関東"],
  ["09", "栃木県", "関東"],
  ["10", "群馬県", "関東"],
  ["11", "埼玉県", "関東"],
  ["12", "千葉県", "関東"],
  ["13", "東京都", "関東"],
  ["14", "神奈川県", "関東"],
  ["15", "新潟県", "甲信越・北陸"],
  ["16", "富山県", "甲信越・北陸"],
  ["17", "石川県", "甲信越・北陸"],
  ["18", "福井県", "甲信越・北陸"],
  ["19", "山梨県", "甲信越・北陸"],
  ["20", "長野県", "甲信越・北陸"],
  ["21", "岐阜県", "東海"],
  ["22", "静岡県", "東海"],
  ["23", "愛知県", "東海"],
  ["24", "三重県", "東海"],
  ["25", "滋賀県", "近畿"],
  ["26", "京都府", "近畿"],
  ["27", "大阪府", "近畿"],
  ["28", "兵庫県", "近畿"],
  ["29", "奈良県", "近畿"],
  ["30", "和歌山県", "近畿"],
  ["31", "鳥取県", "中国"],
  ["32", "島根県", "中国"],
  ["33", "岡山県", "中国"],
  ["34", "広島県", "中国"],
  ["35", "山口県", "中国"],
  ["36", "徳島県", "四国"],
  ["37", "香川県", "四国"],
  ["38", "愛媛県", "四国"],
  ["39", "高知県", "四国"],
  ["40", "福岡県", "九州・沖縄"],
  ["41", "佐賀県", "九州・沖縄"],
  ["42", "長崎県", "九州・沖縄"],
  ["43", "熊本県", "九州・沖縄"],
  ["44", "大分県", "九州・沖縄"],
  ["45", "宮崎県", "九州・沖縄"],
  ["46", "鹿児島県", "九州・沖縄"],
  ["47", "沖縄県", "九州・沖縄"],
];
const prefectureByCode = new Map(
  prefectures.map(([code, name, region]) => [code, { code, name, region }]),
);
const clean = (value) =>
  value === "_"
    ? ""
    : String(value ?? "")
        .replace(/[\u3000\s]+/gu, " ")
        .trim();
const number = (value) => Number(value);
const category = (use) => {
  if (/工場|倉庫|作業場/u.test(use)) return "industrial";
  if (/店舗|事務所|銀行|旅館|ホテル/u.test(use)) return "commercial";
  if (/住宅/u.test(use)) return "residential";
  return "other";
};
const median = (values) => {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const response = await fetch(DOWNLOAD, {
  headers: { "user-agent": "chika-kohji-data-builder/0.1" },
});
if (!response.ok) throw new Error(`Download failed: ${response.status}`);
const archive = new Uint8Array(await response.arrayBuffer());
const sha256 = createHash("sha256").update(archive).digest("hex");
if (archive.byteLength !== EXPECTED_BYTES)
  throw new Error(`Unexpected archive size: ${archive.byteLength}`);
if (sha256 !== EXPECTED_SHA256) throw new Error(`Unexpected archive hash: ${sha256}`);
const entries = unzipSync(archive, { filter: (entry) => entry.name.endsWith("L01-26.geojson") });
const geojsonEntry = Object.entries(entries).find(([name]) => name.endsWith("L01-26.geojson"));
if (!geojsonEntry) throw new Error("GeoJSON was not found in the official archive");
const geojson = JSON.parse(new TextDecoder().decode(geojsonEntry[1]));
if (geojson.type !== "FeatureCollection" || geojson.features.length !== EXPECTED_POINTS)
  throw new Error(`Unexpected feature count: ${geojson.features?.length}`);

const grouped = new Map(prefectures.map(([code]) => [code, []]));
const ids = new Set();
for (const feature of geojson.features) {
  const properties = feature.properties;
  const code = String(properties.L01_001).slice(0, 2);
  const pref = prefectureByCode.get(code);
  const coordinates = feature.geometry?.coordinates;
  const id = `${properties.L01_001}-${properties.L01_002}-${properties.L01_003}`;
  const use = clean(properties.L01_028);
  if (
    !pref ||
    properties.L01_007 !== 2026 ||
    !Array.isArray(coordinates) ||
    coordinates.length !== 2
  )
    throw new Error(`Invalid official feature: ${id}`);
  if (ids.has(id)) throw new Error(`Duplicate point id: ${id}`);
  ids.add(id);
  const item = {
    i: id,
    a: clean(properties.L01_025),
    b: clean(properties.L01_026),
    p: number(properties.L01_008),
    r: number(properties.L01_009),
    z: number(properties.L01_027),
    u: use,
    k: category(use),
    n: clean(properties.L01_047),
    s: clean(properties.L01_048),
    m: number(properties.L01_050),
    c: clean(properties.L01_051),
    la: Math.round(number(coordinates[1]) * 1e6) / 1e6,
    lo: Math.round(number(coordinates[0]) * 1e6) / 1e6,
  };
  if (
    !item.a ||
    !item.p ||
    !item.s ||
    item.m < 0 ||
    item.la < 20 ||
    item.la > 50 ||
    item.lo < 120 ||
    item.lo > 155
  )
    throw new Error(`Incomplete point: ${id}`);
  grouped.get(code).push(item);
}
if (ids.size !== EXPECTED_POINTS) throw new Error(`Unexpected unique id count: ${ids.size}`);

const output = resolve(process.cwd(), "public", "data");
await mkdir(resolve(output, "pref"), { recursive: true });
const index = {
  year: 2026,
  date: "2026-01-01",
  total: EXPECTED_POINTS,
  source: {
    title: "国土数値情報 地価公示データ（2026年）",
    sourcePage: SOURCE_PAGE,
    download: DOWNLOAD,
    retrievedAt: "2026-08-02",
    bytes: EXPECTED_BYTES,
    sha256,
    license: "CC BY 4.0",
    coordinateSystem: "JGD2011",
  },
  prefectures: [],
};
for (const [code, name, region] of prefectures) {
  const items = grouped.get(code).toSorted((a, b) => b.p - a.p || a.i.localeCompare(b.i, "ja"));
  const values = items.map((item) => item.p);
  index.prefectures.push({
    code,
    name,
    region,
    count: items.length,
    min: Math.min(...values),
    median: median(values),
    max: Math.max(...values),
    up: items.filter((item) => item.r > 0).length,
    flat: items.filter((item) => item.r === 0).length,
    down: items.filter((item) => item.r < 0).length,
  });
  await writeFile(
    resolve(output, "pref", `${code}.json`),
    `${JSON.stringify({ code, name, year: 2026, items }, null, 2)}\n`,
    "utf8",
  );
}
const tokyo = grouped.get("13");
const ginza = tokyo.find((item) => item.a.includes("中央区銀座４丁目２番４"));
if (!ginza || ginza.p !== 67_100_000 || ginza.r !== 10.9)
  throw new Error("Known Ginza point mismatch");
const sapporo = grouped.get("01").find((item) => item.i === "01101-000-001");
if (!sapporo || sapporo.p !== 459_000 || sapporo.s !== "円山公園")
  throw new Error("Known Sapporo point mismatch");
await writeFile(resolve(output, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
console.log(
  `Built ${EXPECTED_POINTS.toLocaleString("ja-JP")} points in ${prefectures.length} files (${sha256})`,
);
