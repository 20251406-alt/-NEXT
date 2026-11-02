"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getSupabase, hasSupabaseConfig } from "../lib/supabase/client";
import { loadContext, signInWithGoogle } from "../lib/supabase/live-service";
import type { LiveContext } from "../lib/live-types";
import { LiveApp } from "./LiveApp";

type Mode = "선택" | "데모" | "운영";

export function AuthEntry({ demo }: { demo: ReactNode }) {
  const [mode, setMode] = useState<Mode>("선택");
  const [context, setContext] = useState<LiveContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const configured = hasSupabaseConfig();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    queueMicrotask(() => {
      const saved =
        (localStorage.getItem("geupsik-next-mode") as Mode | null) || "선택";
      setMode(saved);
      if (saved !== "운영" || !configured) {
        setLoading(false);
        return;
      }
      const supabase = getSupabase();
      loadContext()
        .then(setContext)
        .catch((e) =>
          setError(
            e instanceof Error
              ? e.message
              : "로그인 정보를 확인하지 못했습니다.",
          ),
        )
        .finally(() => setLoading(false));
      const { data } = supabase!.auth.onAuthStateChange((_event, session) => {
        if (!session) setContext(null);
        else loadContext().then(setContext).catch(() => setContext(null));
      });
      unsubscribe = () => data.subscription.unsubscribe();
    });
    return () => unsubscribe?.();
  }, [configured]);

  const choose = (next: Mode) => {
    localStorage.setItem("geupsik-next-mode", next);
    setMode(next);
    setLoading(false);
  };
  const login = async () => {
    try {
      setError("");
      localStorage.setItem("geupsik-next-mode", "운영");
      await signInWithGoogle();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Google 로그인을 시작하지 못했습니다.",
      );
    }
  };
  if (loading)
    return (
      <main className="loading">
        <div className="loader" />
        <b>로그인 상태 확인 중</b>
        <span>안전하게 사용자 정보를 확인하고 있습니다.</span>
      </main>
    );
  if (mode === "데모")
    return (
      <>
        <div className="mode-ribbon demo-mode">
          <b>데모 체험 모드</b>
          <span>이 브라우저에만 저장됩니다.</span>
          <button onClick={() => choose("선택")}>로그인 화면으로</button>
        </div>
        {demo}
      </>
    );
  if (mode === "운영" && context)
    return (
      <LiveApp
        context={context}
        onContext={setContext}
        onExit={() => choose("선택")}
      />
    );
  return (
    <main className="auth-screen">
      <section className="auth-hero">
        <span className="auth-kicker">기후위기 × 학교 급식 데이터</span>
        <h1>급식 NEXT</h1>
        <p>오늘의 데이터를, 내일의 지속가능한 급식으로.</p>
        <div className="auth-problem">
          <b>필요 이상으로 준비되는 급식과 잔반을 줄입니다.</b>
          <span>
            메뉴·날씨·학사일정과 유사 학교의 익명 기록을 함께 참고해 식수 인원을
            예측하세요.
          </span>
        </div>
        <div className="auth-features">
          <div>
            <b>01</b>
            <span>급식 기록 관리</span>
          </div>
          <div>
            <b>02</b>
            <span>데이터 기반 예측</span>
          </div>
          <div>
            <b>03</b>
            <span>학교 간 안전한 공유</span>
          </div>
        </div>
      </section>
      <section className="auth-panel">
        <div className="logo auth-logo">N</div>
        <h2>학교 담당자 시작하기</h2>
        <p>
          Google 계정으로 로그인하면 소속 학교의 데이터만 안전하게 관리할 수
          있습니다.
        </p>
        {error && (
          <div className="alert red" role="alert">
            {error}
          </div>
        )}
        {!configured && (
          <div className="alert amber" role="alert">
            Google 로그인을 사용하려면 Supabase 인증 설정이 필요합니다. 현재는
            데모 모드로 이용할 수 있습니다.
          </div>
        )}
        <button
          className="google-button"
          disabled={!configured}
          onClick={login}
        >
          <span>G</span>Google 계정으로 로그인
        </button>
        <button className="ghost demo-enter" onClick={() => choose("데모")}>
          데모로 둘러보기
        </button>
        <small>
          운영 모드에서는 다른 학교 담당자의 개인정보를 볼 수 없습니다.
        </small>
      </section>
    </main>
  );
}
