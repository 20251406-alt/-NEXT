"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  LiveContext,
  LiveMeal,
  LiveSchool,
  LiveShare,
  LiveVariable,
  MealTime,
} from "../lib/live-types";
import {
  activateDataset,
  approveShare,
  createVariable,
  deleteDataset,
  deleteVariable,
  deleteMeal,
  getExternalMeals,
  listMeals,
  listSchools,
  listShares,
  listVariables,
  rejectShare,
  requestShare,
  revokeShare,
  saveMeal,
  setDatasetActive,
  signOut,
  toggleVariable,
  updateSchool,
} from "../lib/supabase/live-service";
import { Onboarding } from "./Onboarding";

const menuItems = [
  "대시보드",
  "급식 기록 입력",
  "식수 인원 예측",
  "맞춤 변수 관리",
  "비슷한 학교 찾기",
  "데이터 공유함",
  "외부 데이터셋",
  "학교 설정",
];
const iconMap: Record<string, string> = {
  대시보드: "▦",
  "급식 기록 입력": "＋",
  "식수 인원 예측": "⌁",
  "맞춤 변수 관리": "⚙",
  "비슷한 학교 찾기": "◎",
  "데이터 공유함": "⇄",
  "외부 데이터셋": "▣",
  "학교 설정": "◉",
};
const categories = [
  "밥류",
  "국·찌개류",
  "육류",
  "생선·해산물",
  "면류",
  "분식",
  "채식",
  "디저트",
  "특별식",
  "기타",
];
const tags = [
  "시험",
  "체험학습",
  "체육대회",
  "축제",
  "방학 전후",
  "학생 대회 참가",
  "외출 인원 증가",
  "결석 증가",
  "운동부 경기",
  "학교 행사",
  "기타",
];
const mealTimes: MealTime[] = ["아침", "점심", "저녁"];
const ownership =
  "공유 데이터의 소유권과 통제 권한은 제공 학교에 있습니다. 요청 학교는 제공 학교가 승인한 목적과 유효기간 안에서만 데이터를 사용할 수 있습니다. 승인받은 데이터를 무단 복제·다운로드·외부 반출·재공유하거나 유효기간 이후 사용하는 행위는 금지됩니다.";
const dateOnly = (value?: string) => (value ? value.slice(0, 10) : "-");
const errorText = (e: unknown) =>
  e instanceof Error
    ? e.message
    : "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`chip ${selected ? "selected" : ""}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty">
      <b>데이터 없음</b>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

export function LiveApp({
  context,
  onContext,
  onExit,
}: {
  context: LiveContext;
  onContext: (c: LiveContext | null) => void;
  onExit: () => void;
}) {
  const [view, setView] = useState("대시보드");
  const [mobileNav, setMobileNav] = useState(false);
  const [meals, setMeals] = useState<LiveMeal[]>([]);
  const [variables, setVariables] = useState<LiveVariable[]>([]);
  const [shares, setShares] = useState<LiveShare[]>([]);
  const [schools, setSchools] = useState<LiveSchool[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{
    text: string;
    tone: "success" | "warning" | "danger";
  } | null>(null);
  const [lastSync, setLastSync] = useState<Date>();
  const flash = (
    text: string,
    tone: "success" | "warning" | "danger" = "success",
  ) => {
    setNotice({ text, tone });
    setTimeout(() => setNotice(null), 3500);
  };
  const refresh = useCallback(
    async (silent = false) => {
      if (!context.school) return;
      try {
        if (!silent) setLoading(true);
        const [m, v, h, sc] = await Promise.all([
          listMeals(context.school.id),
          listVariables(context.school.id),
          listShares(),
          listSchools(),
        ]);
        setMeals(m);
        setVariables(v);
        setShares(h);
        setSchools(sc);
        setLastSync(new Date());
      } catch (e) {
        if (!silent) flash(errorText(e), "danger");
      } finally {
        setLoading(false);
      }
    },
    [context.school],
  );
  useEffect(() => {
    queueMicrotask(() => refresh());
    const timer = setInterval(() => refresh(true), 10000);
    return () => clearInterval(timer);
  }, [refresh]);
  if (!context.school)
    return (
      <Onboarding
        context={context}
        onComplete={async () => {
          const { loadContext } = await import("../lib/supabase/live-service");
          onContext(await loadContext());
        }}
        onLogout={async () => {
          await signOut();
          onContext(null);
          onExit();
        }}
      />
    );
  const school = context.school;
  const logout = async () => {
    try {
      await signOut();
      onContext(null);
      onExit();
    } catch (e) {
      flash(errorText(e), "danger");
    }
  };
  const go = (v: string) => {
    setView(v);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <div className="app-shell live-shell">
      {notice && (
        <div className={`toast ${notice.tone}`} role="status">
          <span>
            {notice.tone === "success"
              ? "✓"
              : notice.tone === "danger"
                ? "!"
                : "i"}
          </span>
          <div>
            <b>
              {notice.tone === "success"
                ? "처리 완료"
                : notice.tone === "danger"
                  ? "문제가 발생했습니다"
                  : "확인 필요"}
            </b>
            <p>{notice.text}</p>
          </div>
        </div>
      )}
      <div className="mode-ribbon live-mode">
        <b>실제 운영 모드</b>
        <span>Supabase에 안전하게 저장됩니다.</span>
        <button onClick={() => refresh()}>↻ 상태 새로고침</button>
      </div>
      <aside className={mobileNav ? "open" : ""}>
        <div className="brand">
          <span className="logo">N</span>
          <div>
            <b>급식 NEXT</b>
            <small>지속가능한 급식 데이터</small>
          </div>
        </div>
        <nav>
          {menuItems.map((x) => (
            <button
              key={x}
              className={view === x ? "active" : ""}
              onClick={() => go(x)}
            >
              <span>{iconMap[x]}</span>
              {x}
              {x === "데이터 공유함" &&
                shares.some(
                  (s) => s.providerId === school.id && s.status === "대기 중",
                ) && <i className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <span className="demo-badge live">LIVE DATA</span>
          <p>
            마지막 동기화{" "}
            {lastSync
              ? lastSync.toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : "확인 중"}
          </p>
        </div>
      </aside>
      <div className="main">
        <header className="live-header">
          <button
            className="hamb"
            onClick={() => setMobileNav(!mobileNav)}
            aria-label="메뉴 열기"
          >
            ☰
          </button>
          <div>
            <p>오늘의 데이터를,</p>
            <b>내일의 지속가능한 급식으로.</b>
          </div>
          <div className="user-profile">
            {context.user.avatar ? (
              // Google OAuth가 제공한 외부 프로필 이미지 URL입니다.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={context.user.avatar} alt="Google 프로필" />
            ) : (
              <span className="avatar-fallback">
                {context.user.name.slice(0, 1)}
              </span>
            )}
            <div>
              <b>{context.user.name}</b>
              <small>{context.user.email}</small>
              <em>{school.name}</em>
            </div>
            <button className="ghost" onClick={logout}>
              로그아웃
            </button>
          </div>
        </header>
        <main className="content">
          <div className="page-head">
            <div>
              <span className="eyebrow">
                {school.name} · {school.schoolCode}
              </span>
              <h1>{view}</h1>
              <p>{subtitle(view)}</p>
            </div>
            {loading && (
              <span className="syncing">
                <i />
                데이터 동기화 중
              </span>
            )}
          </div>
          {view === "대시보드" && (
            <LiveDashboard school={school} meals={meals} shares={shares} />
          )}{" "}
          {view === "급식 기록 입력" && (
            <LiveRecords
              school={school}
              meals={meals}
              variables={variables}
              refresh={refresh}
              flash={flash}
            />
          )}{" "}
          {view === "식수 인원 예측" && (
            <LivePrediction
              school={school}
              own={meals}
              shares={shares}
              variables={variables}
            />
          )}{" "}
          {view === "맞춤 변수 관리" && (
            <LiveVariables
              school={school}
              variables={variables}
              refresh={refresh}
              flash={flash}
            />
          )}{" "}
          {view === "비슷한 학교 찾기" && (
            <LiveSimilar
              school={school}
              schools={schools}
              shares={shares}
              refresh={refresh}
              flash={flash}
              goShare={() => go("데이터 공유함")}
            />
          )}{" "}
          {view === "데이터 공유함" && (
            <LiveSharing
              school={school}
              shares={shares}
              variables={variables}
              refresh={refresh}
              flash={flash}
            />
          )}{" "}
          {view === "외부 데이터셋" && (
            <LiveExternal
              school={school}
              shares={shares}
              refresh={refresh}
              flash={flash}
            />
          )}{" "}
          {view === "학교 설정" && (
            <LiveSettings
              school={school}
              onSaved={async () => {
                const { loadContext } = await import(
                  "../lib/supabase/live-service"
                );
                onContext(await loadContext());
                await refresh();
              }}
              flash={flash}
            />
          )}
        </main>
      </div>
      {mobileNav && (
        <button
          className="scrim"
          aria-label="메뉴 닫기"
          onClick={() => setMobileNav(false)}
        />
      )}
    </div>
  );
}

function subtitle(v: string) {
  return (
    {
      대시보드: "급식 운영 현황과 데이터 학습 상태를 한눈에 확인하세요.",
      "급식 기록 입력": "우리 학교 급식 기록을 Supabase에 저장하고 관리하세요.",
      "식수 인원 예측": "자체 기록과 활성 외부 데이터를 구분해 참고합니다.",
      "맞춤 변수 관리": "100건 이상 쌓인 활성 변수를 예측에 활용합니다.",
      "비슷한 학교 찾기":
        "학교 특성이 비슷한 학교에 익명 데이터 공유를 요청하세요.",
      "데이터 공유함": "보낸 요청과 받은 요청의 승인·거절·회수를 관리하세요.",
      "외부 데이터셋":
        "승인받은 익명 데이터의 활성 상태와 유효기간을 관리하세요.",
      "학교 설정": "내 소속 학교의 기본 정보만 수정할 수 있습니다.",
    } as Record<string, string>
  )[v];
}

function LiveDashboard({
  school,
  meals,
  shares,
}: {
  school: LiveSchool;
  meals: LiveMeal[];
  shares: LiveShare[];
}) {
  const latest = meals[0];
  const active = shares.filter(
    (s) =>
      s.requesterId === school.id &&
      s.status === "승인됨" &&
      s.blockActive &&
      s.predictionEnabled &&
      !s.deleted,
  );
  const prep = meals.reduce((a, b) => a + b.prepared, 0),
    actual = meals.reduce((a, b) => a + b.actual, 0),
    waste = meals.reduce((a, b) => a + b.waste, 0);
  return (
    <>
      <section className="demo-hero">
        <div>
          <span>기후위기 × 학교 급식</span>
          <h2>급식 NEXT</h2>
          <p>
            우리 학교 기록과 승인된 익명 데이터를 활용해 급식 낭비를 줄입니다.
          </p>
        </div>
        <div className="hero-features">
          <b>① 실제 계정</b>
          <b>② 학교별 데이터</b>
          <b>③ 승인 기반 공유</b>
        </div>
      </section>
      <section className="metrics">
        <article className="metric">
          <p>최근 준비 인분</p>
          <strong>{latest ? `${latest.prepared}명` : "-"}</strong>
          <span>
            {latest
              ? `${latest.date} ${latest.mealTime}`
              : "기록을 입력해 주세요"}
          </span>
        </article>
        <article className="metric teal">
          <p>최근 실제 식사</p>
          <strong>{latest ? `${latest.actual}명` : "-"}</strong>
          <span>
            {latest
              ? `참여율 ${Math.round((latest.actual / latest.target) * 100)}%`
              : "기록을 입력해 주세요"}
          </span>
        </article>
        <article className="metric amber">
          <p>누적 잔반량</p>
          <strong>{waste.toFixed(1)}kg</strong>
          <span>
            준비 {prep.toLocaleString()} · 식사 {actual.toLocaleString()}
          </span>
        </article>
        <article className="metric blue">
          <p>활성 데이터</p>
          <strong>
            {meals.length + active.reduce((n, s) => n + (s.maxRecords || 0), 0)}
            건
          </strong>
          <span>
            자체 {meals.length} · 외부 최대{" "}
            {active.reduce((n, s) => n + (s.maxRecords || 0), 0)}
          </span>
        </article>
      </section>
      <section className="grid two">
        <article className="card span">
          <div className="card-head">
            <div>
              <h2>최근 급식 참여율</h2>
              <p>대상 인원 대비 실제 식사 인원</p>
            </div>
          </div>
          {meals.length ? (
            <div className="live-bars">
              {meals
                .slice(0, 8)
                .reverse()
                .map((m) => (
                  <div key={m.id}>
                    <span
                      style={{
                        height: `${Math.max(5, (m.actual / m.target) * 100)}%`,
                      }}
                      title={`${Math.round((m.actual / m.target) * 100)}%`}
                    />
                    <small>{m.date.slice(5)}</small>
                  </div>
                ))}
            </div>
          ) : (
            <Empty
              title="급식 기록이 없습니다"
              body="첫 급식 기록을 입력하면 차트가 표시됩니다."
            />
          )}
        </article>
        <article className="card">
          <div className="card-head">
            <div>
              <h2>데이터 학습 상태</h2>
              <p>자체 기록 100건을 목표로 합니다.</p>
            </div>
          </div>
          <strong className="learning-number">
            {Math.min(meals.length, 100)}
            <small>/100건</small>
          </strong>
          <div className="progress">
            <i style={{ width: `${Math.min(meals.length, 100)}%` }} />
          </div>
          <p>
            {meals.length >= 100
              ? "자체 데이터 학습 기반이 충분합니다."
              : `앞으로 ${100 - meals.length}건을 더 입력하면 맞춤 변수 활용 범위가 넓어집니다.`}
          </p>
        </article>
        <article className="card">
          <div className="card-head">
            <div>
              <h2>공유 상태</h2>
              <p>현재 학교의 요청과 승인 현황</p>
            </div>
          </div>
          <div className="stack-stats">
            <div>
              <span>보낸 요청</span>
              <b>
                {shares.filter((s) => s.requesterId === school.id).length}건
              </b>
            </div>
            <div>
              <span>받은 요청</span>
              <b>{shares.filter((s) => s.providerId === school.id).length}건</b>
            </div>
            <div>
              <span>활성 외부 데이터</span>
              <b>{active.length}개</b>
            </div>
          </div>
        </article>
      </section>
    </>
  );
}

const blankMeal = (school: LiveSchool): Omit<LiveMeal, "id" | "schoolId"> => ({
  date: new Date().toISOString().slice(0, 10),
  mealTime: school.meals[0] || "점심",
  target: school.targets,
  menu: "",
  categories: [],
  weather: "맑음",
  temp: 20,
  rain: false,
  tags: [],
  otherTagText: "",
  prepared: school.targets,
  actual: 0,
  waste: 0,
  note: "",
});
function LiveRecords({
  school,
  meals,
  variables,
  refresh,
  flash,
}: {
  school: LiveSchool;
  meals: LiveMeal[];
  variables: LiveVariable[];
  refresh: () => Promise<void>;
  flash: (t: string, tone?: "success" | "warning" | "danger") => void;
}) {
  const [form, setForm] = useState(blankMeal(school));
  const [editId, setEditId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const toggle = (key: "categories" | "tags", v: string) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(v)
        ? f[key].filter((x) => x !== v)
        : [...f[key], v],
    }));
  const setCustomValue = (
    id: string,
    value: string | string[] | number | boolean,
  ) =>
    setForm((f) => ({
      ...f,
      customValues: { ...f.customValues, [id]: value },
    }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.categories.length) {
      flash("메뉴 카테고리를 한 개 이상 선택해 주세요.", "warning");
      return;
    }
    try {
      setSaving(true);
      await saveMeal(school.id, form, editId);
      setForm(blankMeal(school));
      setEditId(undefined);
      await refresh();
      flash(editId ? "급식 기록을 수정했습니다." : "급식 기록을 저장했습니다.");
    } catch (e) {
      flash(errorText(e), "danger");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="records-layout">
      <form className="card form-card" onSubmit={submit}>
        <div className="card-head">
          <div>
            <h2>{editId ? "급식 기록 수정" : "새 급식 기록"}</h2>
            <p>날씨는 급식 시간대 기준으로 직접 입력해 주세요.</p>
          </div>
          {editId && (
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setEditId(undefined);
                setForm(blankMeal(school));
              }}
            >
              수정 취소
            </button>
          )}
        </div>
        <div className="form-grid">
          <label>
            날짜 *
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </label>
          <label>
            급식 시간대 *
            <select
              value={form.mealTime}
              onChange={(e) =>
                setForm({ ...form, mealTime: e.target.value as MealTime })
              }
            >
              {school.meals.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            급식 대상 인원 *
            <input
              type="number"
              min="1"
              required
              value={form.target}
              onChange={(e) => setForm({ ...form, target: +e.target.value })}
            />
          </label>
          <label className="wide">
            전체 메뉴 *
            <textarea
              required
              value={form.menu}
              onChange={(e) => setForm({ ...form, menu: e.target.value })}
              placeholder="예: 쌀밥, 된장국, 제육볶음, 배추김치"
            />
          </label>
        </div>
        <fieldset>
          <legend>메뉴 카테고리 *</legend>
          <div className="chips">
            {categories.map((x) => (
              <Chip
                key={x}
                selected={form.categories.includes(x)}
                onClick={() => toggle("categories", x)}
              >
                {x}
              </Chip>
            ))}
          </div>
        </fieldset>
        <div className="section-title">
          <div>
            <h3>날씨 정보</h3>
            <p>자동 조회 없이 담당자가 확인한 날씨를 입력합니다.</p>
          </div>
          <span className="status gray">수동 입력</span>
        </div>
        <div className="form-grid three">
          <label>
            날씨 상태
            <select
              value={form.weather}
              onChange={(e) => setForm({ ...form, weather: e.target.value })}
            >
              <option>맑음</option>
              <option>흐림</option>
              <option>비</option>
              <option>눈</option>
            </select>
          </label>
          <label>
            기온
            <input
              type="number"
              value={form.temp}
              onChange={(e) => setForm({ ...form, temp: +e.target.value })}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={form.rain}
              onChange={(e) => setForm({ ...form, rain: e.target.checked })}
            />{" "}
            강수 있음
          </label>
        </div>
        <fieldset>
          <legend>학사 및 상황 태그</legend>
          <div className="chips">
            {tags.map((x) => (
              <Chip
                key={x}
                selected={form.tags.includes(x)}
                onClick={() => toggle("tags", x)}
              >
                {x}
              </Chip>
            ))}
          </div>
          {form.tags.includes("기타") && (
            <label className="other-tag-input">
              기타 상황 내용 *
              <input
                required
                value={form.otherTagText || ""}
                onChange={(e) =>
                  setForm({ ...form, otherTagText: e.target.value })
                }
                placeholder="예: 단축수업, 학년별 귀가 시간 변경"
              />
              <small>
                기록용 설명이며 예측에는 표준 태그 ‘기타’만 반영됩니다.
              </small>
            </label>
          )}
        </fieldset>
        <section className="custom-record-section">
          <div className="section-title">
            <div>
              <h3>학교 맞춤 변수</h3>
              <p>값이 입력된 기록 수를 합산해 100건 학습률에 반영합니다.</p>
            </div>
          </div>
          {variables.filter(
            (v) => v.active && v.mealTimes.includes(form.mealTime),
          ).length ? (
            <div className="form-grid">
              {variables
                .filter((v) => v.active && v.mealTimes.includes(form.mealTime))
                .map((v) => {
                  const current = form.customValues?.[v.id];
                  return (
                    <label key={v.id}>
                      {v.name}
                      {v.required && " *"}
                      <small>
                        {v.description} · 현재 {v.count}/100건
                      </small>
                      {v.type === "숫자" ? (
                        <input
                          type="number"
                          required={v.required}
                          value={current === undefined ? "" : String(current)}
                          onChange={(e) =>
                            setCustomValue(
                              v.id,
                              e.target.value === "" ? "" : +e.target.value,
                            )
                          }
                        />
                      ) : v.type === "예·아니요" ? (
                        <select
                          required={v.required}
                          value={current === undefined ? "" : String(current)}
                          onChange={(e) => setCustomValue(v.id, e.target.value)}
                        >
                          <option value="">선택</option>
                          <option>예</option>
                          <option>아니요</option>
                        </select>
                      ) : v.type === "단일 선택" ? (
                        <select
                          required={v.required}
                          value={current === undefined ? "" : String(current)}
                          onChange={(e) => setCustomValue(v.id, e.target.value)}
                        >
                          <option value="">선택</option>
                          {v.options.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="chips">
                          {v.options.map((o) => {
                            const selected =
                              Array.isArray(current) && current.includes(o);
                            return (
                              <Chip
                                key={o}
                                selected={selected}
                                onClick={() => {
                                  const values = Array.isArray(current)
                                    ? current
                                    : [];
                                  setCustomValue(
                                    v.id,
                                    selected
                                      ? values.filter((x) => x !== o)
                                      : [...values, o],
                                  );
                                }}
                              >
                                {o}
                              </Chip>
                            );
                          })}
                        </div>
                      )}
                    </label>
                  );
                })}
            </div>
          ) : (
            <div className="alert blue">
              이 시간대에 적용되는 활성 맞춤 변수가 없습니다.
            </div>
          )}
        </section>
        <label>
          특이사항
          <textarea
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="다른 학교에 공유되지 않는 내부 기록입니다."
          />
        </label>
        <div className="result-box">
          <h3>급식 후 결과</h3>
          <div className="form-grid three">
            <label>
              준비한 급식량 *
              <input
                type="number"
                min="0"
                required
                value={form.prepared}
                onChange={(e) =>
                  setForm({ ...form, prepared: +e.target.value })
                }
              />
            </label>
            <label>
              실제 식사 인원 *
              <input
                type="number"
                min="0"
                required
                value={form.actual}
                onChange={(e) => setForm({ ...form, actual: +e.target.value })}
              />
            </label>
            <label>
              총 잔반량(kg) *
              <input
                type="number"
                min="0"
                step="0.1"
                required
                value={form.waste}
                onChange={(e) => setForm({ ...form, waste: +e.target.value })}
              />
            </label>
          </div>
        </div>
        <button className="primary full" disabled={saving}>
          {saving ? "저장 중…" : editId ? "수정 내용 저장" : "급식 기록 저장"}
        </button>
      </form>
      <article className="card record-list">
        <div className="card-head">
          <div>
            <h2>저장된 기록</h2>
            <p>Supabase 저장 · 총 {meals.length}건</p>
          </div>
        </div>
        {meals.length ? (
          meals.map((m) => (
            <div className="record" key={m.id}>
              <div>
                <b>
                  {m.date} · {m.mealTime}
                </b>
                <p>{m.menu}</p>
                <span>
                  {m.weather} {m.temp}°C · 실제 {m.actual}/{m.target}명
                </span>
              </div>
              <div>
                <button
                  onClick={() => {
                    setEditId(m.id);
                    setForm({ ...m });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  수정
                </button>
                <button
                  className="danger-text"
                  onClick={async () => {
                    if (
                      !confirm("이 급식 기록을 삭제할까요? 복구할 수 없습니다.")
                    )
                      return;
                    try {
                      await deleteMeal(m.id);
                      await refresh();
                      flash("급식 기록을 삭제했습니다.");
                    } catch (e) {
                      flash(errorText(e), "danger");
                    }
                  }}
                >
                  삭제
                </button>
              </div>
            </div>
          ))
        ) : (
          <Empty
            title="저장된 급식 기록이 없습니다"
            body="첫 기록을 입력해 주세요."
          />
        )}
      </article>
    </section>
  );
}

function LiveVariables({
  school,
  variables,
  refresh,
  flash,
}: {
  school: LiveSchool;
  variables: LiveVariable[];
  refresh: () => Promise<void>;
  flash: (t: string, tone?: "success" | "warning" | "danger") => void;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: "",
    description: "",
    type: "숫자" as LiveVariable["type"],
    unit: "명",
    options: "",
    mealTimes: ["점심"] as MealTime[],
    required: false,
    predictive: true,
  });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createVariable(school.id, {
        ...f,
        options: f.options
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        active: true,
      });
      setOpen(false);
      await refresh();
      flash("맞춤 변수를 생성했습니다.");
    } catch (e) {
      flash(errorText(e), "danger");
    }
  };
  return (
    <>
      <div className="toolbar">
        <div className="alert blue grow">
          맞춤 변수는 아침·점심·저녁 합산 100건부터 예측에 활용됩니다.
        </div>
        <button className="primary" onClick={() => setOpen(!open)}>
          ＋ 맞춤 변수 만들기
        </button>
      </div>
      {open && (
        <form className="card compact-form" onSubmit={submit}>
          <div className="form-grid">
            <label>
              변수명 *
              <input
                required
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </label>
            <label>
              입력 형식
              <select
                value={f.type}
                onChange={(e) =>
                  setF({ ...f, type: e.target.value as LiveVariable["type"] })
                }
              >
                <option>숫자</option>
                <option>예·아니요</option>
                <option>단일 선택</option>
                <option>복수 선택</option>
              </select>
            </label>
            <label className="wide">
              설명
              <textarea
                value={f.description}
                onChange={(e) => setF({ ...f, description: e.target.value })}
              />
            </label>
            {f.type === "숫자" ? (
              <label>
                단위
                <input
                  value={f.unit}
                  onChange={(e) => setF({ ...f, unit: e.target.value })}
                />
              </label>
            ) : (
              f.type.includes("선택") && (
                <label className="wide">
                  선택지(쉼표로 구분)
                  <input
                    value={f.options}
                    onChange={(e) => setF({ ...f, options: e.target.value })}
                  />
                </label>
              )
            )}
          </div>
          <fieldset>
            <legend>적용할 급식 시간대</legend>
            <div className="chips">
              {mealTimes.map((x) => (
                <Chip
                  key={x}
                  selected={f.mealTimes.includes(x)}
                  onClick={() =>
                    setF({
                      ...f,
                      mealTimes: f.mealTimes.includes(x)
                        ? f.mealTimes.filter((t) => t !== x)
                        : [...f.mealTimes, x],
                    })
                  }
                >
                  {x}
                </Chip>
              ))}
            </div>
          </fieldset>
          <div className="check-row">
            <label>
              <input
                type="checkbox"
                checked={f.required}
                onChange={(e) => setF({ ...f, required: e.target.checked })}
              />{" "}
              필수 입력
            </label>
            <label>
              <input
                type="checkbox"
                checked={f.predictive}
                onChange={(e) => setF({ ...f, predictive: e.target.checked })}
              />{" "}
              예측 변수로 사용
            </label>
          </div>
          <button className="primary">변수 생성</button>
        </form>
      )}
      <section className="variable-grid">
        {variables.length ? (
          variables.map((v) => (
            <article
              className={`card variable ${!v.active ? "muted" : ""}`}
              key={v.id}
            >
              <div className="variable-top">
                <span
                  className={`status ${!v.active ? "gray" : v.count >= 100 ? "green" : "amber"}`}
                >
                  {!v.active
                    ? "비활성화됨"
                    : v.count >= 100
                      ? "예측 활용 중"
                      : `학습 준비 중 · ${v.count}/100건`}
                </span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={v.active}
                    onChange={async () => {
                      try {
                        await toggleVariable(v.id, !v.active);
                        await refresh();
                        flash(
                          v.active
                            ? "변수를 비활성화했습니다."
                            : "변수를 다시 활성화했습니다.",
                        );
                      } catch (e) {
                        flash(errorText(e), "danger");
                      }
                    }}
                  />
                  <i />
                </label>
              </div>
              <h2>{v.name}</h2>
              <p>{v.description || "설명이 없습니다."}</p>
              <dl>
                <div>
                  <dt>입력 형식</dt>
                  <dd>
                    {v.type}
                    {v.unit && ` (${v.unit})`}
                  </dd>
                </div>
                <div>
                  <dt>적용 시간대</dt>
                  <dd>{v.mealTimes.join(", ")}</dd>
                </div>
              </dl>
              <div className="progress-label-row">
                <span>학습 데이터</span>
                <b>{Math.min(v.count, 100)}%</b>
              </div>
              <div className="progress">
                <i style={{ width: `${Math.min(v.count, 100)}%` }} />
              </div>
              <button
                className="danger-outline"
                onClick={async () => {
                  if (
                    !confirm(
                      `‘${v.name}’ 변수를 완전히 삭제하면 연결된 과거 값도 함께 삭제되며 복구할 수 없습니다. 정말 삭제할까요?`,
                    )
                  )
                    return;
                  try {
                    await deleteVariable(v.id);
                    await refresh();
                    flash(
                      "맞춤 변수와 연결된 과거 값을 삭제했습니다.",
                      "warning",
                    );
                  } catch (e) {
                    flash(errorText(e), "danger");
                  }
                }}
              >
                완전 삭제
              </button>
            </article>
          ))
        ) : (
          <Empty
            title="맞춤 변수가 없습니다"
            body="우리 학교의 고유한 변수를 만들어 보세요."
          />
        )}
      </section>
    </>
  );
}

function similarity(a: LiveSchool, b: LiveSchool) {
  let s = a.level === b.level ? 25 : 5;
  s += Math.max(0, 25 - Math.abs(a.students - b.students) / 20);
  s += a.genderType === b.genderType ? 15 : 5;
  s +=
    a.commute === b.commute
      ? 15
      : a.commute === "혼합형" || b.commute === "혼합형"
        ? 9
        : 3;
  s += a.province === b.province ? 10 : 3;
  s += a.meals.filter((x) => b.meals.includes(x)).length * 4;
  return Math.min(100, Math.round(s));
}
function LiveSimilar({
  school,
  schools,
  shares,
  refresh,
  flash,
  goShare,
}: {
  school: LiveSchool;
  schools: LiveSchool[];
  shares: LiveShare[];
  refresh: () => Promise<void>;
  flash: (t: string, tone?: "success" | "warning" | "danger") => void;
  goShare: () => void;
}) {
  const [target, setTarget] = useState<LiveSchool>();
  const [purpose, setPurpose] = useState("급식 수요 예측 정확도 개선");
  const [message, setMessage] = useState(
    "유사한 학교의 익명 급식 기록을 예측 참고자료로 활용하고 싶습니다.",
  );
  const [times, setTimes] = useState<MealTime[]>(["점심"]);
  const [start, setStart] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return date.toISOString().slice(0, 10);
  });
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const others = schools
    .filter((s) => s.id !== school.id)
    .sort((a, b) => similarity(school, b) - similarity(school, a));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    try {
      await requestShare(target.id, {
        purpose,
        message,
        meals: times,
        start,
        end,
      });
      setTarget(undefined);
      await refresh();
      flash("데이터 공유 요청을 보냈습니다.");
      goShare();
    } catch (e) {
      flash(errorText(e), "danger");
    }
  };
  return (
    <>
      <div className="alert ownership">
        담당자 이메일·Google 프로필·학생 개인정보는 다른 학교에 표시되지
        않습니다.
      </div>
      <section className="school-grid">
        {others.length ? (
          others.map((s) => {
            const pending = shares.some(
              (x) =>
                x.requesterId === school.id &&
                x.providerId === s.id &&
                (x.status === "대기 중" || x.status === "승인됨"),
            );
            return (
              <article className="card school-card" key={s.id}>
                <div className="score">
                  <b>{similarity(school, s)}</b>
                  <span>유사도</span>
                </div>
                <span className="anon">학교 코드 {s.schoolCode}</span>
                <h2>{s.name}</h2>
                <div className="school-facts">
                  <span>{s.level}</span>
                  <span>{s.students}명</span>
                  <span>{s.genderType}</span>
                  <span>{s.commute}</span>
                  <span>
                    {s.province} {s.district}
                  </span>
                  <span>급식 기록 {s.recordCount || 0}건</span>
                </div>
                <button
                  className="primary full"
                  disabled={pending}
                  onClick={() => setTarget(s)}
                >
                  {pending ? "요청 진행 중" : "데이터 공유 요청"}
                </button>
              </article>
            );
          })
        ) : (
          <Empty
            title="등록된 다른 학교가 없습니다"
            body="다른 Google 계정으로 학교를 등록하면 여기에 나타납니다."
          />
        )}
      </section>
      {target && (
        <div className="modal-back">
          <form className="modal" onSubmit={submit}>
            <button
              type="button"
              className="close"
              onClick={() => setTarget(undefined)}
            >
              ×
            </button>
            <span className="eyebrow">{target.name}</span>
            <h2>데이터 공유 요청</h2>
            <label>
              요청 목적 *
              <input
                required
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </label>
            <fieldset>
              <legend>필요한 급식 시간대 *</legend>
              <div className="chips">
                {mealTimes.map((x) => (
                  <Chip
                    key={x}
                    selected={times.includes(x)}
                    onClick={() =>
                      setTimes(
                        times.includes(x)
                          ? times.filter((t) => t !== x)
                          : [...times, x],
                      )
                    }
                  >
                    {x}
                  </Chip>
                ))}
              </div>
            </fieldset>
            <div className="form-grid">
              <label>
                필요 데이터 시작일 *
                <input
                  type="date"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <label>
                필요 데이터 종료일 *
                <input
                  type="date"
                  required
                  min={start}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
            </div>
            <label>
              요청 메시지 *
              <textarea
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <div className="alert ownership small">{ownership}</div>
            <div className="modal-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => setTarget(undefined)}
              >
                취소
              </button>
              <button className="primary">요청 보내기</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function StatusTimeline({ share }: { share: LiveShare }) {
  const ended = ["거절됨", "회수됨", "만료됨"].includes(share.status);
  return (
    <div className="share-timeline">
      <span className="done">요청</span>
      <i />
      <span className={share.status !== "대기 중" ? "done" : ""}>검토</span>
      <i />
      <span
        className={share.status === "승인됨" ? "done" : ended ? "ended" : ""}
      >
        {share.status === "승인됨"
          ? share.predictionEnabled
            ? "예측 사용 중"
            : share.termsAcceptedAt
              ? "비활성"
              : "동의 대기"
          : share.status}
      </span>
    </div>
  );
}
function LiveSharing({
  school,
  shares,
  variables,
  refresh,
  flash,
}: {
  school: LiveSchool;
  shares: LiveShare[];
  variables: LiveVariable[];
  refresh: () => Promise<void>;
  flash: (t: string, tone?: "success" | "warning" | "danger") => void;
}) {
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [approve, setApprove] = useState<LiveShare>();
  const rows = shares.filter((s) =>
    tab === "received"
      ? s.providerId === school.id
      : s.requesterId === school.id,
  );
  return (
    <>
      <div className="tabs">
        <button
          className={tab === "received" ? "active" : ""}
          onClick={() => setTab("received")}
        >
          받은 요청{" "}
          <b>
            {
              shares.filter(
                (s) => s.providerId === school.id && s.status === "대기 중",
              ).length
            }
          </b>
        </button>
        <button
          className={tab === "sent" ? "active" : ""}
          onClick={() => setTab("sent")}
        >
          보낸 요청
        </button>
        <button className="refresh-tab" onClick={() => refresh()}>
          ↻ 새로고침
        </button>
      </div>
      <section className="card share-list">
        <div className="card-head">
          <div>
            <h2>
              {tab === "received"
                ? "우리 학교가 받은 요청"
                : "우리 학교가 보낸 요청"}
            </h2>
            <p>화면 진입 시와 10초마다 상태를 자동으로 확인합니다.</p>
          </div>
        </div>
        {rows.length ? (
          rows.map((r) => (
            <div className="share-row" key={r.id}>
              <div className={`state-icon ${r.status.replace(" ", "")}`}>
                {r.status === "승인됨"
                  ? "✓"
                  : r.status === "대기 중"
                    ? "…"
                    : r.status === "거절됨"
                      ? "×"
                      : "!"}
              </div>
              <div className="share-main">
                <div>
                  <b>{tab === "received" ? r.requesterName : r.providerName}</b>
                  <span className={`status ${r.status}`}>{r.status}</span>
                </div>
                <StatusTimeline share={r} />
                <p>
                  <b>요청 목적</b> · {r.purpose}
                </p>
                <p>{r.message}</p>
                <small>
                  요청 시간대 {r.requestedMeals.join(", ")} · 요청 데이터{" "}
                  {r.requestedStart}~{r.requestedEnd}
                </small>
                <small className="request-time">
                  요청 시각 {new Date(r.createdAt).toLocaleString("ko-KR")}
                </small>
                {r.status === "승인됨" && (
                  <div className="grant-summary">
                    승인 시간대 {r.grantedMeals.join(", ")} · 데이터{" "}
                    {dateOnly(r.dataStart)}~{dateOnly(r.dataEnd)} · 유효기간{" "}
                    {dateOnly(r.validStart)}~{dateOnly(r.validEnd)} · 최대{" "}
                    {r.maxRecords}건
                    {r.additionalTerms && (
                      <>
                        <br />
                        추가 조건: {r.additionalTerms}
                      </>
                    )}
                  </div>
                )}
                {r.status === "회수됨" && (
                  <div className="alert red small">
                    {r.revokedAt
                      ? `${new Date(r.revokedAt).toLocaleString("ko-KR")}에 `
                      : ""}
                    공유 권한이 회수되어 예측에서 제외되었습니다.
                  </div>
                )}
              </div>
              <div className="share-actions">
                {tab === "received" && r.status === "대기 중" && (
                  <>
                    <button className="primary" onClick={() => setApprove(r)}>
                      조건 설정 후 승인
                    </button>
                    <button
                      className="danger-outline"
                      onClick={async () => {
                        if (!confirm("이 데이터 공유 요청을 거절할까요?"))
                          return;
                        try {
                          await rejectShare(r.id);
                          await refresh();
                          flash("공유 요청을 거절했습니다.", "warning");
                        } catch (e) {
                          flash(errorText(e), "danger");
                        }
                      }}
                    >
                      거절
                    </button>
                  </>
                )}
                {tab === "received" && r.status === "승인됨" && (
                  <button
                    className="danger-outline"
                    onClick={async () => {
                      if (
                        !confirm(
                          "공유 권한을 회수하면 요청 학교는 즉시 해당 데이터를 사용할 수 없으며, 데이터는 식수 인원 예측에서 제외됩니다.",
                        )
                      )
                        return;
                      try {
                        await revokeShare(r.id);
                        await refresh();
                        flash("공유 권한을 즉시 회수했습니다.", "warning");
                      } catch (e) {
                        flash(errorText(e), "danger");
                      }
                    }}
                  >
                    공유 권한 회수
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <Empty
            title="표시할 공유 요청이 없습니다"
            body="비슷한 학교 찾기에서 첫 요청을 보낼 수 있습니다."
          />
        )}
      </section>
      {approve && (
        <LiveApproveModal
          share={approve}
          variables={variables}
          close={() => setApprove(undefined)}
          done={async () => {
            setApprove(undefined);
            await refresh();
            flash("승인 조건을 저장하고 외부 데이터셋을 생성했습니다.");
          }}
          flash={flash}
        />
      )}
    </>
  );
}

function LiveApproveModal({
  share,
  variables,
  close,
  done,
  flash,
}: {
  share: LiveShare;
  variables: LiveVariable[];
  close: () => void;
  done: () => Promise<void>;
  flash: (t: string, tone?: "success" | "warning" | "danger") => void;
}) {
  const [f, setF] = useState(() => {
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 30);
    return {
      meals: share.requestedMeals,
      dataStart: share.requestedStart,
      dataEnd: share.requestedEnd,
      validStart: start.toISOString().slice(0, 10),
      validEnd: end.toISOString().slice(0, 10),
      maxRecords: 30,
      variableIds: [] as string[],
      terms: "승인 목적 범위 안에서만 예측 참고자료로 사용",
    };
  });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await approveShare(share.id, f);
      await done();
    } catch (e) {
      flash(errorText(e), "danger");
    }
  };
  return (
    <div className="modal-back">
      <form className="modal approval-modal" onSubmit={submit}>
        <button type="button" className="close" onClick={close}>
          ×
        </button>
        <span className="eyebrow">제공 학교가 승인 조건을 결정합니다</span>
        <h2>공유 조건 설정</h2>
        <fieldset>
          <legend>공유할 급식 시간대 *</legend>
          <div className="chips">
            {mealTimes.map((x) => (
              <Chip
                key={x}
                selected={f.meals.includes(x)}
                onClick={() =>
                  setF({
                    ...f,
                    meals: f.meals.includes(x)
                      ? f.meals.filter((t) => t !== x)
                      : [...f.meals, x],
                  })
                }
              >
                {x}
              </Chip>
            ))}
          </div>
        </fieldset>
        <div className="form-grid">
          <label>
            제공 데이터 시작일 *
            <input
              type="date"
              required
              value={f.dataStart}
              onChange={(e) => setF({ ...f, dataStart: e.target.value })}
            />
          </label>
          <label>
            제공 데이터 종료일 *
            <input
              type="date"
              required
              min={f.dataStart}
              value={f.dataEnd}
              onChange={(e) => setF({ ...f, dataEnd: e.target.value })}
            />
          </label>
          <label>
            사용 유효기간 시작일 *
            <input
              type="date"
              required
              value={f.validStart}
              onChange={(e) => setF({ ...f, validStart: e.target.value })}
            />
          </label>
          <label>
            사용 유효기간 종료일 *
            <input
              type="date"
              required
              min={f.validStart}
              value={f.validEnd}
              onChange={(e) => setF({ ...f, validEnd: e.target.value })}
            />
          </label>
          <label>
            최대 제공 기록 수 *
            <input
              type="number"
              min="1"
              required
              value={f.maxRecords}
              onChange={(e) => setF({ ...f, maxRecords: +e.target.value })}
            />
          </label>
        </div>
        <fieldset>
          <legend>제공할 맞춤 변수</legend>
          <div className="chips">
            {variables.length ? (
              variables.map((v) => (
                <Chip
                  key={v.id}
                  selected={f.variableIds.includes(v.id)}
                  onClick={() =>
                    setF({
                      ...f,
                      variableIds: f.variableIds.includes(v.id)
                        ? f.variableIds.filter((x) => x !== v.id)
                        : [...f.variableIds, v.id],
                    })
                  }
                >
                  {v.name}
                </Chip>
              ))
            ) : (
              <span className="muted-copy">
                공유 가능한 맞춤 변수가 없습니다.
              </span>
            )}
          </div>
        </fieldset>
        <label>
          추가 승인 조건
          <textarea
            value={f.terms}
            onChange={(e) => setF({ ...f, terms: e.target.value })}
          />
        </label>
        <div className="alert ownership small">
          승인 조건은 요청 학교가 수정할 수 없습니다. {ownership}
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={close}>
            취소
          </button>
          <button className="primary">요청 승인</button>
        </div>
      </form>
    </div>
  );
}

function daysLeft(end?: string) {
  if (!end) return 0;
  return Math.max(
    0,
    Math.ceil((new Date(end).getTime() - Date.now()) / 86400000),
  );
}
function LiveExternal({
  school,
  shares,
  refresh,
  flash,
}: {
  school: LiveSchool;
  shares: LiveShare[];
  refresh: () => Promise<void>;
  flash: (t: string, tone?: "success" | "warning" | "danger") => void;
}) {
  const rows = shares.filter(
    (s) => s.requesterId === school.id && s.permissionId && !s.deleted,
  );
  return (
    <>
      <div className="alert ownership">
        {ownership}
        <small>다운로드·내보내기 기능은 제공하지 않습니다.</small>
      </div>
      <section className="dataset-grid">
        {rows.length ? (
          rows.map((s) => (
            <article
              className={`card dataset ${!s.predictionEnabled ? "muted" : ""}`}
              key={s.id}
            >
              <div className="dataset-head">
                <div>
                  <span className="anon">제공 학교</span>
                  <h2>{s.providerName}</h2>
                </div>
                <span className={`status ${s.status}`}>{s.status}</span>
              </div>
              <div className="dataset-number">
                <b>{s.recordCount || 0}</b>
                <span>승인 데이터 기록</span>
              </div>
              <dl>
                <div>
                  <dt>공유 시간대</dt>
                  <dd>{s.grantedMeals.join(", ")}</dd>
                </div>
                <div>
                  <dt>데이터 기간</dt>
                  <dd>
                    {dateOnly(s.dataStart)}~{dateOnly(s.dataEnd)}
                  </dd>
                </div>
                <div>
                  <dt>승인일</dt>
                  <dd>{dateOnly(s.decidedAt)}</dd>
                </div>
                <div>
                  <dt>만료일</dt>
                  <dd>{dateOnly(s.validEnd)}</dd>
                </div>
                <div>
                  <dt>남은 사용 기간</dt>
                  <dd>
                    {s.status === "승인됨"
                      ? `${daysLeft(s.validEnd)}일`
                      : "사용 불가"}
                  </dd>
                </div>
                <div>
                  <dt>활성화 상태</dt>
                  <dd>{s.blockActive ? "활성" : "비활성"}</dd>
                </div>
                <div>
                  <dt>예측 사용 여부</dt>
                  <dd>{s.predictionEnabled ? "사용" : "사용 안 함"}</dd>
                </div>
              </dl>
              {s.status === "승인됨" && !s.termsAcceptedAt && (
                <div className="alert amber small">
                  제공 학교의 조건을 확인하고 동의해야 활성화할 수 있습니다.
                </div>
              )}
              {s.status === "회수됨" && (
                <div className="alert red small">
                  제공 학교가 권한을 회수했습니다. 새 요청이 필요합니다.
                </div>
              )}
              <div className="dataset-actions">
                {s.status === "승인됨" && !s.termsAcceptedAt && s.blockId && (
                  <button
                    className="primary"
                    onClick={async () => {
                      if (
                        !confirm(
                          "제공 학교가 정한 조건과 데이터 이용 제한에 동의하고 예측에 사용할까요?",
                        )
                      )
                        return;
                      try {
                        await activateDataset(s.blockId!);
                        await refresh();
                        flash(
                          "외부 데이터를 예측에 사용하도록 활성화했습니다.",
                        );
                      } catch (e) {
                        flash(errorText(e), "danger");
                      }
                    }}
                  >
                    동의 후 예측에 사용
                  </button>
                )}
                {s.status === "승인됨" && s.termsAcceptedAt && s.blockId && (
                  <button
                    className="ghost"
                    onClick={async () => {
                      try {
                        await setDatasetActive(
                          s.blockId!,
                          !s.predictionEnabled,
                        );
                        await refresh();
                        flash(
                          s.predictionEnabled
                            ? "외부 데이터 예측 사용을 중지했습니다."
                            : "외부 데이터를 다시 활성화했습니다.",
                        );
                      } catch (e) {
                        flash(errorText(e), "danger");
                      }
                    }}
                  >
                    {s.predictionEnabled ? "비활성화" : "예측에 사용"}
                  </button>
                )}
                {s.blockId && (
                  <button
                    className="danger-outline"
                    onClick={async () => {
                      if (
                        !confirm(
                          "외부 데이터셋 블록을 삭제하면 복구하려면 새 요청이 필요합니다. 삭제할까요?",
                        )
                      )
                        return;
                      try {
                        await deleteDataset(s.blockId!);
                        await refresh();
                        flash("외부 데이터셋 블록을 삭제했습니다.", "warning");
                      } catch (e) {
                        flash(errorText(e), "danger");
                      }
                    }}
                  >
                    삭제
                  </button>
                )}
              </div>
            </article>
          ))
        ) : (
          <Empty
            title="승인받은 외부 데이터가 없습니다"
            body="공유 요청이 승인되면 이곳에서 조건 동의 후 활성화할 수 있습니다."
          />
        )}
      </section>
    </>
  );
}

type PredictionResult = {
  expected: number;
  rate: number;
  low: number;
  high: number;
  confidence: string;
  ownCount: number;
  externalCount: number;
  rows: LiveMeal[];
  popularity: { label: string; basis: string; count: number };
};
function menuPopularity(
  records: LiveMeal[],
  menu: string,
  categories: string[],
  mealTime: MealTime,
) {
  let rows = records.filter(
    (r) => r.menu.trim().toLowerCase() === menu.trim().toLowerCase(),
  );
  let basis = "동일 메뉴";
  if (!rows.length) {
    rows = records.filter((r) =>
      r.categories.some((c) => categories.includes(c)),
    );
    basis = "동일 메뉴 카테고리";
  }
  if (!rows.length) {
    rows = records.filter((r) => r.mealTime === mealTime);
    basis = "동일 급식 시간대";
  }
  if (!rows.length) {
    rows = records;
    basis = "학교 전체 평균";
  }
  const rate = rows.length
    ? rows.reduce((sum, r) => sum + r.actual / r.target, 0) / rows.length
    : 0.82;
  return {
    label:
      rate < 0.6
        ? "매우 낮음"
        : rate < 0.72
          ? "낮음"
          : rate < 0.84
            ? "보통"
            : rate < 0.92
              ? "높음"
              : "매우 높음",
    basis,
    count: rows.length,
  };
}
function runPrediction(
  own: LiveMeal[],
  external: LiveMeal[],
  input: {
    mealTime: MealTime;
    menu: string;
    target: number;
    categories: string[];
    weather: string;
    rain: boolean;
    tags: string[];
    customValues: Record<string, string | string[] | number | boolean>;
  },
) {
  const all = [
    ...own.map((r) => ({ ...r, source: "자체" as const })),
    ...external.map((r) => ({ ...r, source: "외부" as const })),
  ];
  const scored = all
    .map((r) => {
      let score = r.source === "자체" ? 1.5 : 1;
      score += r.mealTime === input.mealTime ? 3 : 0;
      score += r.weather === input.weather ? 1 : 0;
      score += r.rain === input.rain ? 0.7 : 0;
      score +=
        r.categories.filter((c) => input.categories.includes(c)).length * 0.7;
      score += r.tags.filter((t) => input.tags.includes(t)).length * 0.8;
      if (
        r.menu.toLowerCase().includes(input.menu.toLowerCase()) ||
        input.menu.toLowerCase().includes(r.menu.toLowerCase())
      )
        score += 1.2;
      score += Object.entries(input.customValues).reduce(
        (total, [id, value]) => {
          const recorded = r.customValues?.[id];
          if (recorded === undefined || value === "") return total;
          if (Array.isArray(value) && Array.isArray(recorded)) {
            return (
              total + value.filter((x) => recorded.includes(x)).length * 0.5
            );
          }
          return total + (String(recorded) === String(value) ? 0.8 : 0);
        },
        0,
      );
      return { r, score };
    })
    .filter((x) => x.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  const rate = scored.length
    ? scored.reduce((n, x) => n + (x.r.actual / x.r.target) * x.score, 0) /
      scored.reduce((n, x) => n + x.score, 0)
    : own.length
      ? own.reduce((n, x) => n + x.actual / x.target, 0) / own.length
      : external.length
        ? external.reduce((n, x) => n + x.actual / x.target, 0) /
          external.length
        : 0.82;
  const expected = Math.min(input.target, Math.round(input.target * rate));
  const ownCount = scored.filter((x) => x.r.source === "자체").length;
  return {
    expected,
    rate,
    low: Math.max(0, expected - Math.max(2, Math.round(input.target * 0.07))),
    high: Math.min(
      input.target,
      expected + Math.max(2, Math.round(input.target * 0.07)),
    ),
    confidence:
      scored.length >= 8 ? "높음" : scored.length >= 4 ? "보통" : "낮음",
    ownCount,
    externalCount: scored.length - ownCount,
    rows: scored.map((x) => x.r),
    popularity: menuPopularity(
      own,
      input.menu,
      input.categories,
      input.mealTime,
    ),
  };
}
function LivePrediction({
  school,
  own,
  shares,
  variables,
}: {
  school: LiveSchool;
  own: LiveMeal[];
  shares: LiveShare[];
  variables: LiveVariable[];
}) {
  const [input, setInput] = useState({
    mealTime: "점심" as MealTime,
    target: school.targets,
    menu: "",
    categories: ["밥류", "육류"],
    weather: "비",
    rain: true,
    tags: ["시험"],
    customValues: {} as Record<string, string | string[] | number | boolean>,
  });
  const [result, setResult] = useState<PredictionResult>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = shares.filter(
    (s) =>
      s.requesterId === school.id &&
      s.status === "승인됨" &&
      s.blockActive &&
      s.predictionEnabled &&
      s.permissionId &&
      !s.deleted,
  );
  const predictiveVariables = variables.filter(
    (v) =>
      v.active &&
      v.predictive &&
      v.count >= 100 &&
      v.mealTimes.includes(input.mealTime),
  );
  const predict = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBusy(true);
      setError("");
      const ext = (
        await Promise.all(active.map((s) => getExternalMeals(s.permissionId!)))
      ).flat();
      setResult(runPrediction(own, ext, input));
    } catch (e) {
      setError(errorText(e));
      setResult(undefined);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="prediction-layout">
      <form className="card form-card" onSubmit={predict}>
        <div className="card-head">
          <div>
            <h2>예측 조건 입력</h2>
            <p>활성화된 외부 데이터만 서버 권한 검사를 거쳐 불러옵니다.</p>
          </div>
          <span className="source-pill">외부 블록 {active.length}개</span>
        </div>
        {error && <div className="alert red">{error}</div>}
        <div className="form-grid">
          <label>
            급식 시간대
            <select
              value={input.mealTime}
              onChange={(e) =>
                setInput({ ...input, mealTime: e.target.value as MealTime })
              }
            >
              {school.meals.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            급식 대상 인원
            <input
              type="number"
              min="1"
              value={input.target}
              onChange={(e) => setInput({ ...input, target: +e.target.value })}
            />
          </label>
          <label className="wide">
            전체 메뉴
            <input
              required
              value={input.menu}
              onChange={(e) => setInput({ ...input, menu: e.target.value })}
              placeholder="예: 쌀밥, 된장국, 제육볶음"
            />
          </label>
          <label>
            날씨
            <select
              value={input.weather}
              onChange={(e) => setInput({ ...input, weather: e.target.value })}
            >
              <option>맑음</option>
              <option>흐림</option>
              <option>비</option>
              <option>눈</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={input.rain}
              onChange={(e) => setInput({ ...input, rain: e.target.checked })}
            />{" "}
            강수 있음
          </label>
        </div>
        <fieldset>
          <legend>메뉴 카테고리</legend>
          <div className="chips">
            {categories.map((x) => (
              <Chip
                key={x}
                selected={input.categories.includes(x)}
                onClick={() =>
                  setInput({
                    ...input,
                    categories: input.categories.includes(x)
                      ? input.categories.filter((c) => c !== x)
                      : [...input.categories, x],
                  })
                }
              >
                {x}
              </Chip>
            ))}
          </div>
        </fieldset>
        {predictiveVariables.length > 0 && (
          <fieldset>
            <legend>학습 완료 맞춤 변수</legend>
            <div className="form-grid">
              {predictiveVariables.map((v) => (
                <label key={v.id}>
                  {v.name}
                  {v.type === "숫자" ? (
                    <input
                      type="number"
                      value={String(input.customValues[v.id] ?? "")}
                      onChange={(e) =>
                        setInput({
                          ...input,
                          customValues: {
                            ...input.customValues,
                            [v.id]:
                              e.target.value === "" ? "" : +e.target.value,
                          },
                        })
                      }
                    />
                  ) : (
                    <select
                      value={String(input.customValues[v.id] ?? "")}
                      onChange={(e) =>
                        setInput({
                          ...input,
                          customValues: {
                            ...input.customValues,
                            [v.id]: e.target.value,
                          },
                        })
                      }
                    >
                      <option value="">선택 안 함</option>
                      {v.type === "예·아니요" ? (
                        <>
                          <option>예</option>
                          <option>아니요</option>
                        </>
                      ) : (
                        v.options.map((o) => <option key={o}>{o}</option>)
                      )}
                    </select>
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <fieldset>
          <legend>학사 및 상황 태그</legend>
          <div className="chips">
            {tags.map((x) => (
              <Chip
                key={x}
                selected={input.tags.includes(x)}
                onClick={() =>
                  setInput({
                    ...input,
                    tags: input.tags.includes(x)
                      ? input.tags.filter((c) => c !== x)
                      : [...input.tags, x],
                  })
                }
              >
                {x}
              </Chip>
            ))}
          </div>
        </fieldset>
        <button className="primary full" disabled={busy}>
          {busy ? "승인 데이터 확인 중…" : "예상 식수 인원 계산"}
        </button>
      </form>
      {result ? (
        <PredictionCard result={result} />
      ) : (
        <article className="card prediction-empty">
          <span>⌁</span>
          <h2>예측 조건을 입력해 주세요</h2>
          <p>
            결과에서 자체 데이터와 외부 데이터 사용 건수를 구분해 표시합니다.
          </p>
        </article>
      )}
    </div>
  );
}
function PredictionCard({ result }: { result: PredictionResult }) {
  const total = Math.max(1, result.ownCount + result.externalCount),
    ownRatio = Math.round((result.ownCount / total) * 100);
  return (
    <article className="card prediction-result">
      <span className="reference-label">데이터 기반 참고 예측</span>
      <p>예상 식수 인원</p>
      <strong>
        {result.expected}
        <small>명</small>
      </strong>
      <div className="range">
        권장 준비 범위{" "}
        <b>
          {result.low}~{result.high}명
        </b>
      </div>
      <div className="confidence">
        <span>
          예상 참여율<b>{Math.round(result.rate * 100)}%</b>
        </span>
        <span>
          신뢰도<b>{result.confidence}</b>
        </span>
      </div>
      <div className="result-section">
        <h3>참고 데이터</h3>
        <div className="data-split">
          <div>
            <b>{result.ownCount}</b>
            <span>자체 데이터 사용</span>
          </div>
          <div>
            <b>{result.externalCount}</b>
            <span>외부 데이터 사용</span>
          </div>
          <div>
            <b>{result.rows.length}</b>
            <span>총 유사 사례</span>
          </div>
        </div>
        <div className="source-ratio">
          <div>
            <span>
              자체 데이터 <b>{ownRatio}%</b>
            </span>
            <span>
              외부 데이터 <b>{100 - ownRatio}%</b>
            </span>
          </div>
          <div className="ratio-track">
            <i style={{ width: `${ownRatio}%` }} />
            <em style={{ width: `${100 - ownRatio}%` }} />
          </div>
        </div>
      </div>
      <div className="popularity">
        <span>메뉴 인기 예상도</span>
        <b>{result.popularity.label}</b>
        <p>
          {result.popularity.basis} · 참고 {result.popularity.count}건
        </p>
      </div>
      <details>
        <summary>참고한 유사 사례 목록</summary>
        {result.rows.map((r) => (
          <div className="similar-row" key={`${r.source}-${r.id}`}>
            <span>
              {r.source} · {r.date} · {r.mealTime} · {r.weather}
            </span>
            <b>
              {r.actual}/{r.target}명
            </b>
          </div>
        ))}
      </details>
      <p className="disclaimer">
        과거 유사 사례를 바탕으로 한 참고 예측이며 정확한 확률이나 결과를
        보장하지 않습니다.
      </p>
    </article>
  );
}

function LiveSettings({
  school,
  onSaved,
  flash,
}: {
  school: LiveSchool;
  onSaved: () => Promise<void>;
  flash: (t: string, tone?: "success" | "warning" | "danger") => void;
}) {
  const [f, setF] = useState({ ...school });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSchool(f);
      await onSaved();
      flash("학교 프로필을 저장했습니다.");
    } catch (e) {
      flash(errorText(e), "danger");
    }
  };
  return (
    <form className="card form-card settings" onSubmit={submit}>
      <div className="card-head">
        <div>
          <h2>학교 프로필</h2>
          <p>변경한 학교명은 저장 후 상단 프로필에 즉시 반영됩니다.</p>
        </div>
        <span className="status green">관리자</span>
      </div>
      <div className="form-grid">
        <label>
          학교명
          <input
            required
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
        </label>
        <label>
          학교급
          <select
            value={f.level}
            onChange={(e) => setF({ ...f, level: e.target.value })}
          >
            <option>초등학교</option>
            <option>중학교</option>
            <option>고등학교</option>
          </select>
        </label>
        <label>
          시·도
          <input
            required
            value={f.province}
            onChange={(e) => setF({ ...f, province: e.target.value })}
          />
        </label>
        <label>
          시·군·구
          <input
            required
            value={f.district}
            onChange={(e) => setF({ ...f, district: e.target.value })}
          />
        </label>
        <label>
          재학생 수
          <input
            type="number"
            min="1"
            value={f.students}
            onChange={(e) => setF({ ...f, students: +e.target.value })}
          />
        </label>
        <label>
          급식 대상 인원
          <input
            type="number"
            min="1"
            value={f.targets}
            onChange={(e) => setF({ ...f, targets: +e.target.value })}
          />
        </label>
        <label>
          남학생 수
          <input
            type="number"
            min="0"
            value={f.boys}
            onChange={(e) => setF({ ...f, boys: +e.target.value })}
          />
        </label>
        <label>
          여학생 수
          <input
            type="number"
            min="0"
            value={f.girls}
            onChange={(e) => setF({ ...f, girls: +e.target.value })}
          />
        </label>
        <label>
          성별 유형
          <select
            value={f.genderType}
            onChange={(e) => setF({ ...f, genderType: e.target.value })}
          >
            <option>남학교</option>
            <option>여학교</option>
            <option>남녀공학</option>
          </select>
        </label>
        <label>
          생활 유형
          <select
            value={f.commute}
            onChange={(e) => setF({ ...f, commute: e.target.value })}
          >
            <option>기숙형</option>
            <option>통학형</option>
            <option>혼합형</option>
          </select>
        </label>
      </div>
      <fieldset>
        <legend>운영 급식 시간대</legend>
        <div className="chips">
          {mealTimes.map((x) => (
            <Chip
              key={x}
              selected={f.meals.includes(x)}
              onClick={() =>
                setF({
                  ...f,
                  meals: f.meals.includes(x)
                    ? f.meals.filter((t) => t !== x)
                    : [...f.meals, x],
                })
              }
            >
              {x}
            </Chip>
          ))}
        </div>
      </fieldset>
      <button className="primary">학교 프로필 저장</button>
    </form>
  );
}
