import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { isShareUsable } from "../lib/share-rules.ts";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  assert.match(await response.text(), developmentPreviewMeta);
});

test("급식 NEXT의 핵심 사용자 흐름이 소스에 포함된다", async () => {
  const source = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  for (const text of [
    "급식 기록 입력",
    "식수 인원 예측",
    "맞춤 변수 관리",
    "데이터 공유 요청",
    "공유 권한 회수",
    "외부 데이터셋",
    "데이터 기반 참고 예측",
  ])
    assert.match(source, new RegExp(text));
});

test("Supabase 스키마에 필수 엔터티와 RLS가 포함된다", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/202607180001_initial.sql", import.meta.url),
    "utf8",
  );
  for (const entity of [
    "meal_records",
    "custom_variable_templates",
    "data_share_requests",
    "data_share_permissions",
    "external_dataset_blocks",
    "predictions",
    "prediction_references",
  ])
    assert.match(sql, new RegExp(`create table public\\.${entity}`));
  assert.match(sql, /enable row level security/);
});

test("저장한 학교 프로필을 학교 전환 목록에 즉시 반영한다", async () => {
  const source = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /effectiveSchools=schools\.map/);
  assert.match(source, /effectiveSchools\.map\(s=><option/);
});

test("맞춤 변수 값을 급식 기록에 저장하고 누적 건수를 다시 계산한다", async () => {
  const source = await readFile(
    new URL("../app/Records.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /학교 맞춤 변수/);
  assert.match(source, /customValues/);
  assert.match(source, /recount/);
  assert.match(source, /mealTimes\.includes\(form\.mealTime\)/);
  assert.match(source, /기타 상황 내용/);
  assert.match(source, /otherTagText/);
  assert.doesNotMatch(source, /open-meteo|지역 날씨 자동 조회/);
  assert.match(source, /수동 입력/);
});

test("외부 데이터 권한은 승인·동의·활성·기간 조건을 모두 충족해야 한다", () => {
  const active = {
    status: "승인됨",
    agreed: true,
    blockActive: true,
    validStart: "2026-07-01",
    validEnd: "2026-07-31",
  };
  assert.equal(isShareUsable(active, "2026-07-18"), true);
  assert.equal(
    isShareUsable({ ...active, status: "회수됨" }, "2026-07-18"),
    false,
  );
  assert.equal(
    isShareUsable({ ...active, status: "만료됨" }, "2026-07-18"),
    false,
  );
  assert.equal(
    isShareUsable({ ...active, validEnd: "2026-07-17" }, "2026-07-18"),
    false,
  );
  assert.equal(
    isShareUsable({ ...active, validStart: "2026-07-19" }, "2026-07-18"),
    false,
  );
  assert.equal(
    isShareUsable({ ...active, agreed: false }, "2026-07-18"),
    false,
  );
  assert.equal(
    isShareUsable({ ...active, blockActive: false }, "2026-07-18"),
    false,
  );
  assert.equal(
    isShareUsable({ ...active, deleted: true }, "2026-07-18"),
    false,
  );
  assert.equal(
    isShareUsable(active, "2026-07-31"),
    true,
    "만료일 당일까지 사용 가능해야 한다",
  );
});

test("공유함에서도 기간이 지난 승인을 만료 상태로 표시한다", async () => {
  const source = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /const displayStatus=r\.status===\"승인됨\".*\?\"만료됨\":r\.status/,
  );
});

test("대회 시연용 핵심 정보와 상태 시각화가 포함된다", async () => {
  const source = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const styles = await readFile(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
  );
  for (const text of [
    "기후위기 × 학교 급식",
    "음식물과 조리 에너지 낭비를 줄입니다",
    "예상 식수 인원",
    "source-ratio",
    "share-timeline",
    "progress-label-row",
  ])
    assert.match(source, new RegExp(text));
  assert.match(styles, /max-height:800px/);
  assert.match(styles, /@media\(max-width:760px\)/);
});

test("Google 로그인과 설정 누락 시 데모 대체 흐름을 제공한다", async () => {
  const auth = await readFile(
    new URL("../app/AuthEntry.tsx", import.meta.url),
    "utf8",
  );
  const client = await readFile(
    new URL("../lib/supabase/client.ts", import.meta.url),
    "utf8",
  );
  assert.match(auth, /Google 계정으로 로그인/);
  assert.match(auth, /데모로 둘러보기/);
  assert.match(
    auth,
    /Google 로그인을 사용하려면 Supabase 인증 설정이 필요합니다/,
  );
  assert.match(auth, /signInWithGoogle/);
  assert.match(client, /detectSessionInUrl: true/);
});

test("운영 모드는 Supabase 공유 RPC와 10초 동기화를 사용한다", async () => {
  const app = await readFile(
    new URL("../app/LiveApp.tsx", import.meta.url),
    "utf8",
  );
  const service = await readFile(
    new URL("../lib/supabase/live-service.ts", import.meta.url),
    "utf8",
  );
  assert.match(app, /setInterval\(\(\) => refresh\(true\), 10000\)/);
  assert.match(app, /상태 새로고침/);
  assert.match(app, /동의 후 예측에 사용/);
  assert.match(app, /자체 데이터 사용/);
  assert.match(app, /외부 데이터 사용/);
  assert.match(
    app,
    /공유 권한을 회수하면 요청 학교는 즉시 해당 데이터를 사용할 수 없으며/,
  );
  for (const rpc of [
    "request_data_share",
    "approve_data_share",
    "reject_data_share",
    "revoke_data_share",
    "accept_and_activate_dataset",
    "get_authorized_external_meals",
  ])
    assert.match(service, new RegExp(rpc));
  assert.doesNotMatch(service, /localStorage/);
  assert.doesNotMatch(service, /requested_by/);
});

test("다중 학교 공유 migration이 원자적 승인·회수와 RLS 제한을 포함한다", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/202607190001_google_auth_multitenant.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const fn of [
    "register_my_school",
    "request_data_share",
    "approve_data_share",
    "reject_data_share",
    "revoke_data_share",
    "expire_data_shares",
    "accept_and_activate_dataset",
    "get_authorized_external_meals",
  ])
    assert.match(sql, new RegExp(`function public\\.${fn}`));
  assert.match(sql, /drop policy if exists provider_update/);
  assert.match(sql, /schools_member_update/);
  assert.match(sql, /own_variable_values/);
  assert.match(
    sql,
    /r\.status='approved'.*p\.terms_accepted_at is not null.*p\.revoked_at is null.*now\(\) between p\.valid_from and p\.valid_until.*b\.active.*b\.prediction_enabled/s,
  );
  assert.match(
    sql,
    /update external_dataset_blocks b set active=false,prediction_enabled=false,revoked_at=now\(\)/,
  );
  assert.doesNotMatch(sql, /returns table\([^;]*private_note/s);
});

test("운영 급식 기록은 맞춤 변수 값과 기타 태그 설명을 Supabase에 저장한다", async () => {
  const app = await readFile(
    new URL("../app/LiveApp.tsx", import.meta.url),
    "utf8",
  );
  const service = await readFile(
    new URL("../lib/supabase/live-service.ts", import.meta.url),
    "utf8",
  );
  assert.match(app, /학교 맞춤 변수/);
  assert.match(app, /기타 상황 내용/);
  assert.match(app, /customValues/);
  assert.match(service, /custom_variable_values/);
  assert.match(service, /other_tag_text/);
});

test("통합 Supabase 설치 SQL은 재실행 안전장치와 최종 RLS를 포함한다", async () => {
  const sql = await readFile(new URL("../supabase-setup.sql", import.meta.url), "utf8");
  assert.match(sql, /begin;[\s\S]*commit;/i);
  assert.equal((sql.match(/create table if not exists/gi) || []).length, 17);
  assert.match(sql, /exception when duplicate_object then null/);
  assert.match(sql, /create index if not exists meal_records_school_date_idx/);
  assert.match(sql, /drop trigger if exists meal_record_count_refresh/);
  assert.match(sql, /drop policy if exists provider_update/);
  assert.match(sql, /create or replace function public\.approve_data_share/);
  assert.match(sql, /revoke all on function public\.get_authorized_external_meals\(uuid\) from public/);
  assert.doesNotMatch(sql, /service_role\s*=|client_secret\s*=|database_password\s*=/i);
});

test("비개발자 설정 안내서는 최신 메뉴와 비밀정보 보호 절차를 포함한다", async () => {
  const guide = await readFile(new URL("../SETUP_GUIDE.md", import.meta.url), "utf8");
  for (const text of [
    "SQL Editor",
    "Sign In / Providers",
    "Google Auth Platform",
    "Authorized JavaScript origins",
    "Authorized redirect URIs",
    "URL Configuration",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SITE_URL",
    "service_role",
    "Client Secret",
  ]) assert.match(guide, new RegExp(text));
  assert.match(guide, /https:\/\/geupsik-next\.iou6901\.chatgpt\.site/);
});

test("세 데모 학교에 충분하고 변동성 있는 급식 기록을 제공한다", async () => {
  const app = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(app, /addSchool\("haksan",120,29/);
  assert.match(app, /addSchool\("mirae",144,445/);
  assert.match(app, /addSchool\("saebom",168,82/);
  assert.match(app, /const participation=\[\.94,\.82,\.89,\.76/);
  assert.match(app, /rain\?\.045:0/);
  assert.match(app, /exam\?\.065:0/);
  assert.match(app, /geupsik-next-demo-v3/);
});
