"use client";
import { useState } from "react";
import type { LiveContext, LiveSchool, MealTime } from "../lib/live-types";
import { registerSchool } from "../lib/supabase/live-service";

export function Onboarding({
  context,
  onComplete,
  onLogout,
}: {
  context: LiveContext;
  onComplete: () => Promise<void>;
  onLogout: () => void;
}) {
  const [form, setForm] = useState<Omit<LiveSchool, "id" | "schoolCode">>({
    name: "",
    level: "고등학교",
    province: "",
    district: "",
    students: 0,
    targets: 0,
    boys: 0,
    girls: 0,
    genderType: "남녀공학",
    commute: "통학형",
    meals: ["점심"],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const toggle = (m: MealTime) =>
    setForm({
      ...form,
      meals: form.meals.includes(m)
        ? form.meals.filter((x) => x !== m)
        : [...form.meals, m],
    });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.boys + form.girls > form.students) {
      setError("남학생 수와 여학생 수의 합은 재학생 수를 넘을 수 없습니다.");
      return;
    }
    if (!form.meals.length) {
      setError("운영하는 급식 시간대를 한 개 이상 선택해 주세요.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      await registerSchool(form);
      await onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "학교를 등록하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <main className="onboarding-screen">
      <header className="onboarding-top">
        <div className="brand">
          <span className="logo">N</span>
          <div>
            <b>급식 NEXT</b>
            <small>실제 운영 모드</small>
          </div>
        </div>
        <button className="ghost" onClick={onLogout}>
          로그아웃
        </button>
      </header>
      <form className="card onboarding-card" onSubmit={submit}>
        <span className="eyebrow">최초 로그인 학교 등록</span>
        <h1>담당 학교를 등록해 주세요</h1>
        <p>
          등록을 완료하면 이 Google 계정은 해당 학교의 관리자 역할로 연결됩니다.
          운영 모드에서는 다른 학교로 임의 전환할 수 없습니다.
        </p>
        <div className="profile-preview">
          {context.user.avatar ? (
            // Google OAuth가 제공한 외부 프로필 이미지 URL입니다.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={context.user.avatar} alt="Google 프로필" />
          ) : (
            <span>{context.user.name.slice(0, 1)}</span>
          )}
          <div>
            <b>{context.user.name}</b>
            <small>{context.user.email}</small>
          </div>
        </div>
        {error && (
          <div className="alert red" role="alert">
            {error}
          </div>
        )}
        <div className="form-grid">
          <label>
            학교명 *
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: 학산고등학교"
            />
          </label>
          <label>
            학교급 *
            <select
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
            >
              <option>초등학교</option>
              <option>중학교</option>
              <option>고등학교</option>
            </select>
          </label>
          <label>
            시·도 *
            <input
              required
              value={form.province}
              onChange={(e) => setForm({ ...form, province: e.target.value })}
              placeholder="예: 충청북도"
            />
          </label>
          <label>
            시·군·구 *
            <input
              required
              value={form.district}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
              placeholder="예: 영동군"
            />
          </label>
          <label>
            재학생 수 *
            <input
              type="number"
              min="1"
              required
              value={form.students || ""}
              onChange={(e) => setForm({ ...form, students: +e.target.value })}
            />
          </label>
          <label>
            급식 대상 인원 *
            <input
              type="number"
              min="1"
              required
              value={form.targets || ""}
              onChange={(e) => setForm({ ...form, targets: +e.target.value })}
            />
          </label>
          <label>
            남학생 수 *
            <input
              type="number"
              min="0"
              required
              value={form.boys}
              onChange={(e) => setForm({ ...form, boys: +e.target.value })}
            />
            <small>
              비율{" "}
              {form.students
                ? Math.round((form.boys / form.students) * 100)
                : 0}
              %
            </small>
          </label>
          <label>
            여학생 수 *
            <input
              type="number"
              min="0"
              required
              value={form.girls}
              onChange={(e) => setForm({ ...form, girls: +e.target.value })}
            />
            <small>
              비율{" "}
              {form.students
                ? Math.round((form.girls / form.students) * 100)
                : 0}
              %
            </small>
          </label>
          <label>
            성별 유형
            <select
              value={form.genderType}
              onChange={(e) => setForm({ ...form, genderType: e.target.value })}
            >
              <option>남학교</option>
              <option>여학교</option>
              <option>남녀공학</option>
            </select>
          </label>
          <label>
            생활 유형
            <select
              value={form.commute}
              onChange={(e) => setForm({ ...form, commute: e.target.value })}
            >
              <option>기숙형</option>
              <option>통학형</option>
              <option>혼합형</option>
            </select>
          </label>
        </div>
        <fieldset>
          <legend>운영 급식 시간대 *</legend>
          <div className="chips">
            {(["아침", "점심", "저녁"] as MealTime[]).map((m) => (
              <button
                type="button"
                key={m}
                className={`chip ${form.meals.includes(m) ? "selected" : ""}`}
                onClick={() => toggle(m)}
              >
                {m} 급식
              </button>
            ))}
          </div>
        </fieldset>
        <div className="alert ownership">
          공유 데이터의 소유권과 통제 권한은 제공 학교에 있습니다. 학생
          개인정보와 담당자 Google 정보는 다른 학교에 공유되지 않습니다.
        </div>
        <button className="primary full" disabled={saving}>
          {saving ? "학교 등록 중…" : "학교 등록 완료"}
        </button>
      </form>
    </main>
  );
}
