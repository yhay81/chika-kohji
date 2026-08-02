import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("product surface", () => {
  const worker = read("src/worker.tsx");
  const client = read("public/app.js");
  const css = read("public/styles.css");
  const migration = read("migrations/0001_telemetry.sql");
  const source = read("SOURCE.md");
  const surface = `${worker}\n${client}`;
  it("communicates through parcels, roads, stations, point cards, and comparison measures", () => {
    expect(worker).toContain('class="parcel-scene"');
    expect(worker).toContain('class="street horizontal"');
    expect(worker).toContain('class="station-sign"');
    expect(worker).toContain('class="region-grid"');
    expect(worker).toContain('class="compare-tray"');
    expect(client).toContain('element("article", "land-card")');
    expect(client).toContain('element("article", "compared-row")');
    expect(css.toLowerCase()).not.toContain("gradient");
  });
  it("keeps address searches and compared public points in the browser", () => {
    expect(worker).toContain('app.post("/api/telemetry"');
    expect(worker).not.toContain('app.post("/api/search"');
    expect(client).toContain("fetch(`/data/pref/${code}.json`)");
    expect(client).toContain("localStorage");
    expect(client).toContain("state.compared.length < MAX_COMPARE");
    expect(client).toContain("slice(0, MAX_COMPARE)");
    expect(migration).not.toMatch(
      /prefecture_(?:name|code)|point_id|address|station|coordinates|query|search_term|email|phone|advertising/iu,
    );
    expect(client).not.toMatch(/history\.(?:pushState|replaceState)|location\.search\s*=/u);
  });
  it("explains the price boundary and links the official dataset", () => {
    expect(worker).toContain("個別の土地や建物の査定額ではありません");
    expect(worker).toContain("標準地の更地としての1㎡あたり正常価格");
    expect(client).toContain("nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-L01-2026.html");
    expect(client).toContain('emit("official_opened")');
    expect(client).not.toContain("innerHTML");
    expect(worker).not.toContain("dangerouslySetInnerHTML");
  });
  it("states date, dimensions, terms, transformation, and interpretation boundary", () => {
    expect(source).toContain("2026-01-01");
    expect(source).toContain("25,565");
    expect(source).toContain("CC BY 4.0");
    expect(source).toContain("Transformation / 加工");
    expect(source).toContain("not an appraisal of an arbitrary parcel");
  });
  it("separates automated QA, honors privacy signals, and needs no account", () => {
    expect(client).toContain("navigator.webdriver");
    expect(client).toContain("navigator.doNotTrack");
    expect(client).toContain("globalPrivacyControl");
    expect(client).toContain('"x-chika-kohji-qa"');
    expect(migration).toContain("is_qa");
    expect(surface).not.toMatch(/better-auth|betterAuth/iu);
  });
  it("contains no internal evaluation language", () => {
    expect(surface).not.toMatch(
      /public validation|success criteria|experiment|仮説|成功条件|市場スコア|移行候補|収益性/iu,
    );
  });
});
