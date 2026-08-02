import { Hono } from "hono";
import type { Context } from "hono";
import { requestId } from "hono/request-id";

export type Bindings = { ASSETS: Fetcher; DB: D1Database };
type Variables = { requestId: string };
type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;

class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 403 | 413 | 415,
  ) {
    super(code);
  }
}

const origin = "https://chika-kohji.yhay81.com";
const official = "https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-L01-2026.html";
const sessionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const eventNames = new Set([
  "visited",
  "prefecture_selected",
  "searched",
  "no_result",
  "use_changed",
  "compared",
  "copied",
  "official_opened",
  "returned",
]);
const prefectureGroups = [
  ["北海道", [["01", "北海道", 1345]]],
  [
    "東北",
    [
      ["02", "青森", 261],
      ["03", "岩手", 183],
      ["04", "宮城", 565],
      ["05", "秋田", 190],
      ["06", "山形", 195],
      ["07", "福島", 436],
    ],
  ],
  [
    "関東",
    [
      ["08", "茨城", 676],
      ["09", "栃木", 458],
      ["10", "群馬", 385],
      ["11", "埼玉", 1280],
      ["12", "千葉", 1238],
      ["13", "東京", 2560],
      ["14", "神奈川", 1758],
    ],
  ],
  [
    "甲信越・北陸",
    [
      ["15", "新潟", 427],
      ["16", "富山", 228],
      ["17", "石川", 223],
      ["18", "福井", 133],
      ["19", "山梨", 164],
      ["20", "長野", 326],
    ],
  ],
  [
    "東海",
    [
      ["21", "岐阜", 376],
      ["22", "静岡", 661],
      ["23", "愛知", 1872],
      ["24", "三重", 425],
    ],
  ],
  [
    "近畿",
    [
      ["25", "滋賀", 340],
      ["26", "京都", 622],
      ["27", "大阪", 1687],
      ["28", "兵庫", 1175],
      ["29", "奈良", 398],
      ["30", "和歌山", 177],
    ],
  ],
  [
    "中国",
    [
      ["31", "鳥取", 126],
      ["32", "島根", 135],
      ["33", "岡山", 394],
      ["34", "広島", 628],
      ["35", "山口", 304],
    ],
  ],
  [
    "四国",
    [
      ["36", "徳島", 139],
      ["37", "香川", 176],
      ["38", "愛媛", 254],
      ["39", "高知", 144],
    ],
  ],
  [
    "九州・沖縄",
    [
      ["40", "福岡", 918],
      ["41", "佐賀", 134],
      ["42", "長崎", 258],
      ["43", "熊本", 247],
      ["44", "大分", 243],
      ["45", "宮崎", 226],
      ["46", "鹿児島", 286],
      ["47", "沖縄", 189],
    ],
  ],
] as const;
const nowSeconds = () => Math.floor(Date.now() / 1000);

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const sameOrigin = (c: AppContext) => {
  const site = c.req.header("sec-fetch-site");
  if (site && site !== "same-origin") throw new ApiError("cross_site_request", 403);
  const requestOrigin = c.req.header("origin");
  if (requestOrigin && requestOrigin !== new URL(c.req.url).origin)
    throw new ApiError("cross_site_request", 403);
};
const parseJson = async (c: AppContext) => {
  if (!(c.req.header("content-type") ?? "").toLowerCase().startsWith("application/json"))
    throw new ApiError("unsupported_media_type", 415);
  const raw = await c.req.text();
  if (new TextEncoder().encode(raw).byteLength > 256) throw new ApiError("payload_too_large", 413);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new ApiError("invalid_json", 400);
  }
};
const record = async (c: AppContext, name: string) => {
  const session = (c.req.header("x-chika-kohji-session") ?? "").toLowerCase();
  if (!sessionPattern.test(session)) return;
  await c.env.DB.prepare(
    "INSERT INTO product_events (session_hash,event_name,is_qa,created_at) VALUES (?,?,?,?)",
  )
    .bind(
      await sha256(session),
      name,
      c.req.header("x-chika-kohji-qa") === "1" ? 1 : 0,
      nowSeconds(),
    )
    .run();
};

const Layout = ({
  canonical,
  children,
  description,
  noindex = false,
  title,
}: {
  canonical: string;
  children: unknown;
  description: string;
  noindex?: boolean;
  title: string;
}) => (
  <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <meta content="width=device-width,initial-scale=1" name="viewport" />
      <title>{title}</title>
      <meta content={description} name="description" />
      {noindex ? <meta content="noindex,nofollow" name="robots" /> : null}
      <link href={canonical} rel="canonical" />
      <meta content="website" property="og:type" />
      <meta content="地価公示くらべ" property="og:site_name" />
      <meta content={title} property="og:title" />
      <meta content={description} property="og:description" />
      <meta content={canonical} property="og:url" />
      <meta content={`${origin}/og.svg`} property="og:image" />
      <meta content="summary_large_image" name="twitter:card" />
      <meta content="#153f38" name="theme-color" />
      <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      <link href="/manifest.webmanifest" rel="manifest" />
      <link href="/styles.css" rel="stylesheet" />
      <script defer src="/app.js" />
    </head>
    <body>
      <a class="skip-link" href="#main">
        本文へ
      </a>
      <header class="site-header">
        <a class="wordmark" href="/" aria-label="地価公示くらべ ホーム">
          <span class="parcel-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>地価公示くらべ</span>
        </a>
        <nav aria-label="案内">
          <a href="/guide">見方</a>
          <a href="/source">出典</a>
          <a href="/privacy">保存</a>
        </nav>
      </header>
      {children}
      <footer class="site-footer">
        <span>国土交通省「国土数値情報 地価公示データ」を加工して作成</span>
        <span>
          <a href="/source">出典と注意</a>
          <a href={official} rel="noopener noreferrer">
            公式データ
          </a>
        </span>
      </footer>
    </body>
  </html>
);

const ParcelScene = () => (
  <div class="parcel-scene" aria-hidden="true">
    <div class="street horizontal">
      <i />
      <i />
      <i />
    </div>
    <div class="street vertical">
      <i />
      <i />
    </div>
    <div class="parcel residential">
      <span class="building house" />
      <b>住宅地</b>
      <strong>45.9万</strong>
      <small>円 / ㎡</small>
      <em>+3.1%</em>
    </div>
    <div class="parcel commercial">
      <span class="building shop" />
      <b>商業地</b>
      <strong>67.1万</strong>
      <small>円 / ㎡</small>
      <em>+4.2%</em>
    </div>
    <div class="parcel station">
      <span class="station-sign">駅</span>
      <i>350m</i>
    </div>
    <div class="parcel compare">
      <span>A</span>
      <span>B</span>
      <span>C</span>
      <b>同じ物差しで比較</b>
    </div>
  </div>
);

const HomePage = () => (
  <Layout
    canonical={`${origin}/`}
    description="2026年地価公示25,565地点を、都道府県・住所・駅・用途から探し、1㎡価格や前年比を並べて比較できます。"
    title="2026年の地価公示を探して比較 | 地価公示くらべ"
  >
    <main class="home" id="main">
      <section class="intro" aria-labelledby="product-title">
        <div class="product-heading">
          <p class="eyebrow">2026 LAND PRICE PUBLICATION</p>
          <h1 id="product-title">場所を選ぶ。価格の根拠を並べる。</h1>
          <p>
            住所や駅から標準地を探し、1㎡価格・前年比・土地の使われ方を同じ物差しで見比べられます。
          </p>
          <div class="facts">
            <span>
              <strong>25,565</strong>
              <small>標準地</small>
            </span>
            <span>
              <strong>47</strong>
              <small>都道府県</small>
            </span>
            <span>
              <strong>2026.1.1</strong>
              <small>価格時点</small>
            </span>
          </div>
        </div>
        <ParcelScene />
      </section>

      <div class="meaning-ribbon">
        <strong>標準地の正常価格</strong>
        <span>個別の土地や建物の査定額ではありません。価格は1㎡あたり、2026年1月1日時点です。</span>
        <a href="/guide">見方を確認</a>
      </div>

      <section class="prefecture-board" aria-labelledby="prefecture-heading">
        <header class="section-heading">
          <div>
            <p>地域をひらく</p>
            <h2 id="prefecture-heading">都道府県を選ぶ</h2>
          </div>
          <output id="data-status">全国 25,565地点</output>
        </header>
        <div class="region-grid">
          {prefectureGroups.map(([region, entries]) => (
            <section class={`region region-${entries[0][0]}`}>
              <h3>{region}</h3>
              <div>
                {entries.map(([code, name, count]) => (
                  <button aria-pressed="false" data-pref={code} type="button">
                    <strong>{name}</strong>
                    <small>{count.toLocaleString("ja-JP")}地点</small>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section class="search-desk" aria-labelledby="search-heading">
        <header class="section-heading">
          <div>
            <p>標準地台帳</p>
            <h2 id="search-heading">住所・駅・地域の様子で探す</h2>
          </div>
          <button hidden id="change-prefecture" type="button">
            地域を選び直す
          </button>
        </header>
        <label class="land-search" for="land-search">
          <span>検索する</span>
          <span class="search-box">
            <i aria-hidden="true">⌕</i>
            <input
              autocomplete="off"
              disabled
              id="land-search"
              placeholder="先に都道府県を選んでください"
              type="search"
            />
            <button disabled id="clear-search" type="button">
              消す
            </button>
          </span>
        </label>
        <fieldset class="use-filter" disabled id="use-filter">
          <legend>土地の使われ方</legend>
          <div>
            <button aria-pressed="true" data-use="all" type="button">
              すべて
            </button>
            <button aria-pressed="false" data-use="residential" type="button">
              住宅系
            </button>
            <button aria-pressed="false" data-use="commercial" type="button">
              商業系
            </button>
            <button aria-pressed="false" data-use="industrial" type="button">
              工業系
            </button>
            <button aria-pressed="false" data-use="other" type="button">
              その他
            </button>
          </div>
        </fieldset>
        <p class="privacy-note">入力した住所や駅名はこの端末内で照合し、送信・保存しません。</p>
      </section>

      <section class="result-and-compare">
        <section class="land-results" aria-labelledby="result-heading">
          <header class="result-heading">
            <div>
              <p>地点票</p>
              <h2 id="result-heading">見つかった標準地</h2>
            </div>
            <output id="result-count">地域未選択</output>
          </header>
          <p id="search-status" role="status">
            都道府県を選ぶと、公式データを開きます。
          </p>
          <div class="land-list" id="land-list">
            <div class="empty-land" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
          <button class="load-more" hidden id="load-more" type="button">
            次の30地点を見る
          </button>
        </section>
        <aside class="compare-tray" aria-labelledby="compare-heading">
          <header>
            <div>
              <p>見比べる</p>
              <h2 id="compare-heading">価格の物差し</h2>
            </div>
            <output id="compared-count">0 / 4</output>
          </header>
          <div id="compared-items">
            <p>地点票の「比べる」を押すと、都道府県をまたいで最大4地点を置けます。</p>
          </div>
          <div class="compare-actions">
            <button disabled id="copy-compared" type="button">
              比較をまとめてコピー
            </button>
            <button class="clear-button" disabled id="clear-compared" type="button">
              物差しを空にする
            </button>
          </div>
        </aside>
      </section>
    </main>
  </Layout>
);

const GuidePage = () => (
  <Layout
    canonical={`${origin}/guide`}
    description="地価公示の価格時点、1㎡価格、前年比、標準地の用途と比較の見方。"
    title="地価公示の見方 | 地価公示くらべ"
  >
    <main class="content-page" id="main">
      <header class="content-heading">
        <span>読</span>
        <div>
          <p>見方</p>
          <h1>標準地を、同じ条件に揃えて読む</h1>
        </div>
      </header>
      <div class="instruction-grid">
        <section>
          <b>一</b>
          <h2>地域を選ぶ</h2>
          <p>都道府県を一つ選び、住所、駅名、土地の利用状況や周辺の様子から地点を絞ります。</p>
        </section>
        <section>
          <b>二</b>
          <h2>単位を揃える</h2>
          <p>
            価格は1㎡あたりの円、変動率は前年の公示価格からの増減です。敷地面積とは分けて読みます。
          </p>
        </section>
        <section>
          <b>三</b>
          <h2>条件ごと比べる</h2>
          <p>駅までの距離、現在の利用、用途地域、周辺の様子が似た地点を最大4件並べます。</p>
        </section>
      </div>
      <div class="price-anatomy">
        <span>
          <small>価格時点</small>
          <b>2026.1.1</b>
        </span>
        <i>÷</i>
        <span>
          <small>単位</small>
          <b>1㎡</b>
        </span>
        <i>↕</i>
        <span>
          <small>前年比</small>
          <b>+3.1%</b>
        </span>
      </div>
      <aside class="care-note">
        <strong>売買価格や固定資産税評価額とは異なります</strong>
        <p>
          地価公示は、国土交通省土地鑑定委員会が標準地について判定する正常価格です。建物価格を含まず、任意の土地の査定結果でもありません。
        </p>
      </aside>
      <a class="page-cta" href="/">
        標準地を探す
      </a>
    </main>
  </Layout>
);

const SourcePage = () => (
  <Layout
    canonical={`${origin}/source`}
    description="国土数値情報の2026年地価公示データ、収録範囲、加工、ライセンスと注意事項。"
    title="出典とデータ | 地価公示くらべ"
  >
    <main class="content-page" id="main">
      <header class="content-heading">
        <span>典</span>
        <div>
          <p>出典とデータ</p>
          <h1>全国の公式標準地を、地域別の台帳へ</h1>
        </div>
      </header>
      <div class="source-grid">
        <section>
          <h2>出典</h2>
          <p>
            国土交通省「
            <a href={official} rel="noopener noreferrer">
              国土数値情報 地価公示データ（2026年）
            </a>
            」の全国GeoJSONを使用します。原典は土地鑑定委員会の地価公示です。
          </p>
        </section>
        <section>
          <h2>収録範囲</h2>
          <p>
            2026年1月1日時点の全国25,565標準地。47都道府県すべてを収録し、価格、前年比、住所、利用状況、駅距離などを表示します。
          </p>
        </section>
        <section>
          <h2>表示の加工</h2>
          <p>
            公式属性を都道府県別に分割し、検索用の区分を付けました。価格、変動率、住所、説明などの値は要約・推計していません。
          </p>
        </section>
        <section>
          <h2>利用条件</h2>
          <p>
            2019年以降の地価公示データに適用される
            <a href="https://creativecommons.org/licenses/by/4.0/deed.ja" rel="noopener noreferrer">
              CC BY 4.0
            </a>
            に従います。国土交通省による保証や推奨を示しません。
          </p>
        </section>
      </div>
      <dl class="source-ledger">
        <div>
          <dt>取得日</dt>
          <dd>2026年8月2日</dd>
        </div>
        <div>
          <dt>配布ファイル</dt>
          <dd>20,898,568 bytes</dd>
        </div>
        <div>
          <dt>座標系</dt>
          <dd>JGD2011</dd>
        </div>
        <div>
          <dt>SHA-256</dt>
          <dd>
            <code>fad8bbe76d25b682ccf761a492ddc2de001e0345569e044481d62ea84233faf8</code>
          </dd>
        </div>
      </dl>
      <aside class="care-note warning">
        <strong>価格の意味を取り違えないために</strong>
        <p>
          公示価格は標準地の更地としての1㎡あたり正常価格です。実際の成約価格、建物を含む価格、路線価、基準地価とは目的・時点・対象が異なります。
        </p>
      </aside>
    </main>
  </Layout>
);

const PrivacyPage = () => (
  <Layout
    canonical={`${origin}/privacy`}
    description="地価公示くらべの検索語、比較地点、匿名利用計測の保存範囲。"
    title="保存と計測 | 地価公示くらべ"
  >
    <main class="content-page" id="main">
      <header class="content-heading">
        <span>守</span>
        <div>
          <p>保存と計測</p>
          <h1>検索条件は端末内。残すのは公開地点だけ。</h1>
        </div>
      </header>
      <div class="privacy-grid">
        <section>
          <h2>検索条件</h2>
          <p>入力した住所や駅名、用途の絞り込みはブラウザ内だけで処理し、計測へ送りません。</p>
        </section>
        <section>
          <h2>価格の物差し</h2>
          <p>
            選んだ公開標準地を最大4件、ブラウザのローカルストレージへ保存します。画面からいつでも消せます。
          </p>
        </section>
        <section>
          <h2>匿名の利用計測</h2>
          <p>
            訪問、地域選択、検索、比較、コピーなどの操作種別と匿名化したセッションだけを35日間保存します。地域名、住所、地点IDは記録しません。
          </p>
        </section>
        <section>
          <h2>アカウント</h2>
          <p>
            登録、ログイン、個人識別Cookieはありません。自動テストは利用者数から分けて数えます。
          </p>
        </section>
      </div>
    </main>
  </Layout>
);

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
app.use("*", requestId());
app.use("*", async (c, next) => {
  await next();
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'none'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self'; style-src 'self'",
  );
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Resource-Policy", "same-origin");
  c.header("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-Request-Id", c.get("requestId"));
});
app.get("/", (c) => {
  c.header("Cache-Control", "public,max-age=60,s-maxage=300");
  return c.html(<HomePage />);
});
app.get("/guide", (c) => c.html(<GuidePage />));
app.get("/source", (c) => c.html(<SourcePage />));
app.get("/privacy", (c) => c.html(<PrivacyPage />));
app.post("/api/telemetry", async (c) => {
  sameOrigin(c);
  const payload = await parseJson(c);
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new ApiError("invalid_request", 400);
  const name =
    typeof (payload as Record<string, unknown>).name === "string"
      ? (payload as Record<string, string>).name
      : "";
  if (!eventNames.has(name)) throw new ApiError("invalid_event", 400);
  await record(c, name);
  return c.body(null, 202);
});
app.get("/health", async (c) => {
  const row = await c.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
  return c.json({
    ok: row?.ok === 1,
    prefectures: 47,
    service: "chika-kohji",
    total: 25565,
    year: 2026,
  });
});
app.get("/sitemap.xml", (c) => {
  const paths = ["/", "/guide", "/source", "/privacy"];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join("")}</urlset>`;
  c.header("Cache-Control", "public,max-age=3600,s-maxage=86400");
  c.header("Content-Type", "application/xml; charset=utf-8");
  return c.body(xml);
});
app.notFound((c) => {
  c.status(404);
  return c.html(
    <Layout
      canonical={`${origin}/404`}
      description="指定されたページは見つかりません。"
      noindex
      title="ページが見つかりません | 地価公示くらべ"
    >
      <main class="not-found" id="main">
        <span>404</span>
        <h1>この地点票は見つかりません</h1>
        <p>標準地を探す画面へ戻ってください。</p>
        <a href="/">標準地を探す</a>
      </main>
    </Layout>,
  );
});
app.onError((error, c) => {
  if (error instanceof ApiError)
    return c.json({ error: error.code, requestId: c.get("requestId") }, error.status);
  console.error(
    "request_failed",
    c.get("requestId"),
    error instanceof Error ? error.message : "unknown",
  );
  return c.json({ error: "internal_error", requestId: c.get("requestId") }, 500);
});
export const scheduled = async (_event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) => {
  await env.DB.prepare("DELETE FROM product_events WHERE created_at < ?")
    .bind(nowSeconds() - 35 * 86400)
    .run();
};
export { app };
export default { fetch: app.fetch, scheduled };
