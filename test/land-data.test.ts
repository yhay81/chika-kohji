import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Point = {
  a: string;
  b: string;
  c: string;
  i: string;
  k: string;
  la: number;
  lo: number;
  m: number;
  n: string;
  p: number;
  r: number;
  s: string;
  u: string;
  z: number;
};
type PrefectureData = { code: string; name: string; year: number; items: Point[] };
type Index = {
  total: number;
  year: number;
  date: string;
  prefectures: Array<{ code: string; count: number; name: string }>;
  source: Record<string, string | number>;
};
const root = process.cwd();
const index = JSON.parse(readFileSync(resolve(root, "public/data/index.json"), "utf8")) as Index;
const load = (code: string) =>
  JSON.parse(
    readFileSync(resolve(root, `public/data/pref/${code}.json`), "utf8"),
  ) as PrefectureData;

describe("official 2026 land price publication data", () => {
  it("retains verified national metadata", () => {
    expect(index).toMatchObject({ year: 2026, date: "2026-01-01", total: 25565 });
    expect(index.source).toMatchObject({
      bytes: 20898568,
      coordinateSystem: "JGD2011",
      license: "CC BY 4.0",
      retrievedAt: "2026-08-02",
      sha256: "fad8bbe76d25b682ccf761a492ddc2de001e0345569e044481d62ea84233faf8",
    });
    expect(index.prefectures).toHaveLength(47);
    expect(index.prefectures.reduce((sum, pref) => sum + pref.count, 0)).toBe(25565);
  });
  it("retains all Tokyo points and the known highest Ginza point", () => {
    const tokyo = load("13");
    expect(tokyo).toMatchObject({ code: "13", name: "東京都", year: 2026 });
    expect(tokyo.items).toHaveLength(2560);
    expect(tokyo.items.find((point) => point.a.includes("中央区銀座４丁目２番４"))).toMatchObject({
      p: 67100000,
      r: 10.9,
      u: "店舗",
    });
  });
  it("retains the known Sapporo residence point", () => {
    expect(load("01").items.find((point) => point.i === "01101-000-001")).toMatchObject({
      p: 459000,
      r: 3.1,
      s: "円山公園",
      m: 200,
      z: 495,
    });
  });
  it("uses compact validated records and bounded delivery files", () => {
    for (const pref of index.prefectures) {
      const data = load(pref.code);
      expect(data.items).toHaveLength(pref.count);
      expect(statSync(resolve(root, `public/data/pref/${pref.code}.json`)).size).toBeLessThan(
        1200000,
      );
      for (const point of data.items) {
        expect(Object.keys(point).sort()).toEqual([
          "a",
          "b",
          "c",
          "i",
          "k",
          "la",
          "lo",
          "m",
          "n",
          "p",
          "r",
          "s",
          "u",
          "z",
        ]);
        expect(point.i).toMatch(/^\d{5}-\d{3}-\d{3}$/u);
        expect(point.a.length).toBeGreaterThan(3);
        expect(point.p).toBeGreaterThan(0);
        expect(point.la).toBeGreaterThan(20);
        expect(point.lo).toBeGreaterThan(120);
      }
    }
  });
});
