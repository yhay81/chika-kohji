# 地価公示くらべ

2026年地価公示の標準地を住所、駅、利用状況から探し、1㎡価格、前年比、条件を比較する匿名Webサービスです。

- Production: <https://chika-kohji.yhay81.com>
- Source: 国土交通省「国土数値情報 地価公示データ（2026年）」
- Dataset: 25,565 points / 47 prefectures
- Stack: Cloudflare Workers, Hono JSX, Vite+, D1, static JSON

```powershell
npm install
npm run data:build
npm run release:check
npm run check
npm test
npm run build
npm run dev
```

`npm run data:build` は公式全国GeoJSONを取得し、SHA-256、件数、座標、価格、既知地点を検証したうえで都道府県別JSONを生成します。検索と比較はブラウザ内で行い、住所や選択地点をWorkerへ送りません。

```powershell
npx wrangler d1 migrations apply chika-kohji --local
npx wrangler d1 migrations apply chika-kohji --remote
npm run deploy
npm run metrics
npm run indexnow
```
