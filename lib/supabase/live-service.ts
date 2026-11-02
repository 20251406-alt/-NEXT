import type { User } from "@supabase/supabase-js";
import { getSupabase } from "./client";
import {
  mealFromDb,
  mealToDb,
  statusFromDb,
  type LiveContext,
  type LiveMeal,
  type LiveSchool,
  type LiveShare,
  type LiveVariable,
  type MealTime,
} from "../live-types";

const required = () => {
  const client = getSupabase();
  if (!client) throw new Error("Supabase 인증 설정이 필요합니다.");
  return client;
};
const one = <T>(value: T | T[] | null | undefined) =>
  Array.isArray(value) ? value[0] : value;
const relationName = (value: unknown) => {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" && "name" in row
    ? String((row as { name: unknown }).name)
    : "";
};
const schoolFromRow = (s: Record<string, unknown>): LiveSchool => ({
  id: String(s.id),
  name: String(s.name),
  schoolCode: String(s.school_code),
  level: String(s.school_level),
  province: String(s.province),
  district: String(s.district),
  students: Number(s.student_count),
  targets: Number(s.meal_target_count),
  boys: Number(s.male_count),
  girls: Number(s.female_count),
  genderType: String(s.gender_type),
  commute: String(s.boarding_type),
  meals: [
    s.serves_breakfast && "아침",
    s.serves_lunch && "점심",
    s.serves_dinner && "저녁",
    ].filter(Boolean) as MealTime[],
    recordCount: Number(s.meal_record_count || 0),
  });
const userInfo = (user: User) => ({
  id: user.id,
  name: String(
    user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "학교 담당자",
  ),
  email: user.email || "",
  avatar: String(
    user.user_metadata?.avatar_url || user.user_metadata?.picture || "",
  ),
});

export async function signInWithGoogle() {
  const supabase = required();
  const redirectTo = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw error;
}
export async function signOut() {
  const { error } = await required().auth.signOut();
  if (error) throw error;
}

export async function loadContext(): Promise<LiveContext | null> {
  const supabase = required();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data, error: memberError } = await supabase
    .from("school_members")
    .select("school_id, schools(*)")
    .eq("user_id", user.id)
    .maybeSingle();
  if (memberError) throw memberError;
  const school = one(
    data?.schools as Record<string, unknown> | Record<string, unknown>[] | null,
  );
  return {
    user: userInfo(user),
    school: school ? schoolFromRow(school) : null,
  };
}

export async function registerSchool(
  input: Omit<LiveSchool, "id" | "schoolCode">,
) {
  const { data, error } = await required().rpc("register_my_school", {
    p_name: input.name,
    p_level: input.level,
    p_province: input.province,
    p_district: input.district,
    p_student_count: input.students,
    p_target_count: input.targets,
    p_male_count: input.boys,
    p_female_count: input.girls,
    p_gender_type: input.genderType,
    p_boarding_type: input.commute,
    p_breakfast: input.meals.includes("아침"),
    p_lunch: input.meals.includes("점심"),
    p_dinner: input.meals.includes("저녁"),
  });
  if (error) throw error;
  return data as string;
}

export async function listSchools(): Promise<LiveSchool[]> {
  const { data, error } = await required()
    .from("schools")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data || []).map(schoolFromRow);
}

const mealSelect =
  "*, meal_record_categories(meal_categories(name)), meal_record_tags(standard_tags(name)), custom_variable_values(template_id,number_value,boolean_value,text_value,json_value)";
const mealFromRow = (
  r: Record<string, unknown>,
  source: "자체" | "외부" = "자체",
): LiveMeal => ({
  id: String(r.id),
  schoolId: String(r.school_id || "external"),
  date: String(r.meal_date),
  mealTime: mealFromDb(String(r.meal_time)),
  target: Number(r.target_count),
  menu: String(r.menu_text),
  weather: String(r.weather_status || "맑음"),
  temp: Number(r.temperature || 0),
  rain: Boolean(r.has_precipitation),
  prepared: Number(r.prepared_count),
  actual: Number(r.actual_count),
  waste: Number(r.waste_kg),
  note: source === "자체" ? String(r.private_note || "") : undefined,
  source,
  categories: Array.isArray(r.meal_record_categories)
    ? r.meal_record_categories
        .map((x: unknown) =>
          relationName((x as Record<string, unknown>).meal_categories),
        )
        .filter(Boolean)
    : Array.isArray(r.categories)
      ? r.categories.map(String)
      : [],
  tags: Array.isArray(r.meal_record_tags)
    ? r.meal_record_tags
        .map((x: unknown) =>
          relationName((x as Record<string, unknown>).standard_tags),
        )
        .filter(Boolean)
    : Array.isArray(r.tags)
      ? r.tags.map(String)
      : [],
  otherTagText: source === "자체" ? String(r.other_tag_text || "") : undefined,
  customValues: Array.isArray(r.custom_variable_values)
    ? (Object.fromEntries(
        r.custom_variable_values.map((raw: unknown) => {
          const x = raw as Record<string, unknown>;
          const value =
            x.number_value ??
            x.boolean_value ??
            x.text_value ??
            x.json_value ??
            "";
          return [String(x.template_id), value];
        }),
      ) as Record<string, string | string[] | number | boolean>)
    : r.custom_values && typeof r.custom_values === "object"
      ? (r.custom_values as Record<
          string,
          string | string[] | number | boolean
        >)
      : {},
});

export async function listMeals(schoolId: string): Promise<LiveMeal[]> {
  const { data, error } = await required()
    .from("meal_records")
    .select(mealSelect)
    .eq("school_id", schoolId)
    .order("meal_date", { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => mealFromRow(r as Record<string, unknown>));
}

export async function saveMeal(
  schoolId: string,
  meal: Omit<LiveMeal, "id" | "schoolId">,
  id?: string,
) {
  const supabase = required();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const row = {
    school_id: schoolId,
    meal_date: meal.date,
    meal_time: mealToDb(meal.mealTime),
    target_count: meal.target,
    menu_text: meal.menu,
    weather_status: meal.weather,
    temperature: meal.temp,
    has_precipitation: meal.rain,
    prepared_count: meal.prepared,
    actual_count: meal.actual,
    waste_kg: meal.waste,
    private_note: meal.note || null,
    other_tag_text: meal.otherTagText || null,
    created_by: user?.id,
  };
  const result = id
    ? await supabase
        .from("meal_records")
        .update(row)
        .eq("id", id)
        .select("id")
        .single()
    : await supabase.from("meal_records").insert(row).select("id").single();
  if (result.error) throw result.error;
  const mealId = String(result.data.id);
  await Promise.all([
    supabase
      .from("meal_record_categories")
      .delete()
      .eq("meal_record_id", mealId),
    supabase.from("meal_record_tags").delete().eq("meal_record_id", mealId),
  ]);
  const [{ data: cats }, { data: tags }] = await Promise.all([
    supabase
      .from("meal_categories")
      .select("id,name")
      .in("name", meal.categories),
    supabase.from("standard_tags").select("id,name").in("name", meal.tags),
  ]);
  if (cats?.length)
    await supabase
      .from("meal_record_categories")
      .insert(cats.map((x) => ({ meal_record_id: mealId, category_id: x.id })));
  if (tags?.length)
    await supabase
      .from("meal_record_tags")
      .insert(tags.map((x) => ({ meal_record_id: mealId, tag_id: x.id })));
  await supabase
    .from("custom_variable_values")
    .delete()
    .eq("meal_record_id", mealId);
  const entries = Object.entries(meal.customValues || {}).filter(
    ([, value]) =>
      value !== "" && !(Array.isArray(value) && value.length === 0),
  );
  if (entries.length) {
    const { data: templates, error: templateError } = await supabase
      .from("custom_variable_templates")
      .select("id,input_type")
      .in(
        "id",
        entries.map(([id]) => id),
      );
    if (templateError) throw templateError;
    const types = new Map((templates || []).map((x) => [x.id, x.input_type]));
    const values = entries.map(([template_id, value]) => {
      const type = types.get(template_id);
      return {
        template_id,
        meal_record_id: mealId,
        number_value: type === "number" ? Number(value) : null,
        boolean_value:
          type === "boolean" ? value === true || value === "예" : null,
        text_value: type === "single_select" ? String(value) : null,
        json_value: type === "multi_select" ? value : null,
      };
    });
    const { error: valueError } = await supabase
      .from("custom_variable_values")
      .insert(values);
    if (valueError) throw valueError;
  }
}
export async function deleteMeal(id: string) {
  const { error } = await required().from("meal_records").delete().eq("id", id);
  if (error) throw error;
}

export async function listVariables(schoolId: string): Promise<LiveVariable[]> {
  const supabase = required();
  const { data, error } = await supabase
    .from("custom_variable_templates")
    .select("*,custom_variable_options(label),custom_variable_values(count)")
    .eq("school_id", schoolId)
    .order("created_at");
  if (error) throw error;
  return (data || []).map((v) => ({
    id: v.id,
    schoolId: v.school_id,
    name: v.name,
    description: v.description || "",
    type: (
      {
        number: "숫자",
        boolean: "예·아니요",
        single_select: "단일 선택",
        multi_select: "복수 선택",
      } as Record<string, LiveVariable["type"]>
    )[v.input_type],
    unit: v.unit || "",
    options: (v.custom_variable_options || []).map(
      (o: { label: string }) => o.label,
    ),
    mealTimes: [
      v.applies_breakfast && "아침",
      v.applies_lunch && "점심",
      v.applies_dinner && "저녁",
    ].filter(Boolean) as MealTime[],
    required: v.required,
    predictive: v.use_for_prediction,
    active: v.active,
    count: Number(
      one(v.custom_variable_values as { count: number }[])?.count || 0,
    ),
  }));
}
export async function createVariable(
  schoolId: string,
  v: Omit<LiveVariable, "id" | "schoolId" | "count">,
) {
  const supabase = required();
  const { data, error } = await supabase
    .from("custom_variable_templates")
    .insert({
      school_id: schoolId,
      name: v.name,
      description: v.description,
      input_type: (
        {
          숫자: "number",
          "예·아니요": "boolean",
          "단일 선택": "single_select",
          "복수 선택": "multi_select",
        } as Record<string, string>
      )[v.type],
      unit: v.unit || null,
      applies_breakfast: v.mealTimes.includes("아침"),
      applies_lunch: v.mealTimes.includes("점심"),
      applies_dinner: v.mealTimes.includes("저녁"),
      required: v.required,
      use_for_prediction: v.predictive,
      active: v.active,
    })
    .select("id")
    .single();
  if (error) throw error;
  if (v.options.length) {
    const x = await supabase.from("custom_variable_options").insert(
      v.options.map((label, i) => ({
        template_id: data.id,
        label,
        sort_order: i,
      })),
    );
    if (x.error) throw x.error;
  }
}
export async function toggleVariable(id: string, active: boolean) {
  const { error } = await required()
    .from("custom_variable_templates")
    .update({ active })
    .eq("id", id);
  if (error) throw error;
}
export async function deleteVariable(id: string) {
  const { error } = await required()
    .from("custom_variable_templates")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function listShares(): Promise<LiveShare[]> {
  await required().rpc("expire_data_shares");
  const { data, error } = await required()
    .from("data_share_requests")
    .select(
      "id,requester_school_id,provider_school_id,purpose,requested_meal_times,message,status,requested_data_start,requested_data_end,created_at,decided_at, requester:schools!requester_school_id(name), provider:schools!provider_school_id(name), data_share_permissions(id,request_id,granted_meal_times,data_start,data_end,valid_from,valid_until,max_records,allowed_custom_template_ids,additional_terms,terms_accepted_at,revoked_at,created_at,external_dataset_blocks(id,permission_id,requester_school_id,active,prediction_enabled,activated_at,revoked_at,record_count,deleted_at,created_at))",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => {
    const p = one(r.data_share_permissions);
    const b = one(p?.external_dataset_blocks);
    const expired =
      r.status === "approved" &&
      p?.valid_until &&
      new Date(p.valid_until) < new Date();
    return {
      id: r.id,
      requesterId: r.requester_school_id,
      providerId: r.provider_school_id,
      requesterName: one(r.requester)?.name || "요청 학교",
      providerName: one(r.provider)?.name || "제공 학교",
      purpose: r.purpose,
      message: r.message || "",
      requestedMeals: (r.requested_meal_times || []).map(mealFromDb),
      requestedStart: r.requested_data_start || "",
      requestedEnd: r.requested_data_end || "",
      status: expired ? "만료됨" : statusFromDb(r.status),
      createdAt: r.created_at,
      decidedAt: r.decided_at || undefined,
      revokedAt: p?.revoked_at || undefined,
      permissionId: p?.id,
      grantedMeals: (p?.granted_meal_times || []).map(mealFromDb),
      dataStart: p?.data_start,
      dataEnd: p?.data_end,
      validStart: p?.valid_from,
      validEnd: p?.valid_until,
      maxRecords: p?.max_records,
      recordCount: b?.record_count ?? 0,
      allowedVariables: p?.allowed_custom_template_ids || [],
      additionalTerms: p?.additional_terms || "",
      termsAcceptedAt: p?.terms_accepted_at,
      blockId: b?.id,
      blockActive: Boolean(b?.active),
      predictionEnabled: Boolean(b?.prediction_enabled),
      deleted: Boolean(b?.deleted_at),
    } as LiveShare;
  });
}
export async function requestShare(
  providerId: string,
  input: {
    purpose: string;
    message: string;
    meals: MealTime[];
    start: string;
    end: string;
  },
) {
  const { error } = await required().rpc("request_data_share", {
    p_provider_school_id: providerId,
    p_purpose: input.purpose,
    p_meal_times: input.meals.map(mealToDb),
    p_message: input.message,
    p_data_start: input.start,
    p_data_end: input.end,
  });
  if (error) throw error;
}
export async function approveShare(
  requestId: string,
  input: {
    meals: MealTime[];
    dataStart: string;
    dataEnd: string;
    validStart: string;
    validEnd: string;
    maxRecords: number;
    variableIds: string[];
    terms: string;
  },
) {
  const { error } = await required().rpc("approve_data_share", {
    p_request_id: requestId,
    p_meal_times: input.meals.map(mealToDb),
    p_data_start: input.dataStart,
    p_data_end: input.dataEnd,
    p_valid_from: input.validStart,
    p_valid_until: input.validEnd,
    p_max_records: input.maxRecords,
    p_custom_template_ids: input.variableIds,
    p_additional_terms: input.terms,
  });
  if (error) throw error;
}
export async function rejectShare(requestId: string) {
  const { error } = await required().rpc("reject_data_share", {
    p_request_id: requestId,
  });
  if (error) throw error;
}
export async function revokeShare(requestId: string) {
  const { error } = await required().rpc("revoke_data_share", {
    p_request_id: requestId,
  });
  if (error) throw error;
}
export async function activateDataset(blockId: string) {
  const { error } = await required().rpc("accept_and_activate_dataset", {
    p_block_id: blockId,
  });
  if (error) throw error;
}
export async function setDatasetActive(blockId: string, active: boolean) {
  const { error } = await required().rpc("set_external_dataset_active", {
    p_block_id: blockId,
    p_active: active,
  });
  if (error) throw error;
}
export async function deleteDataset(blockId: string) {
  const { error } = await required().rpc("delete_external_dataset", {
    p_block_id: blockId,
  });
  if (error) throw error;
}
export async function getExternalMeals(
  permissionId: string,
): Promise<LiveMeal[]> {
  const { data, error } = await required().rpc(
    "get_authorized_external_meals",
    { p_permission_id: permissionId },
  );
  if (error) throw error;
  return (data || []).map((r: Record<string, unknown>) =>
    mealFromRow(r, "외부"),
  );
}
export async function updateSchool(school: LiveSchool) {
  const { error } = await required()
    .from("schools")
    .update({
      name: school.name,
      school_level: school.level,
      province: school.province,
      district: school.district,
      student_count: school.students,
      meal_target_count: school.targets,
      male_count: school.boys,
      female_count: school.girls,
      gender_type: school.genderType,
      boarding_type: school.commute,
      serves_breakfast: school.meals.includes("아침"),
      serves_lunch: school.meals.includes("점심"),
      serves_dinner: school.meals.includes("저녁"),
    })
    .eq("id", school.id);
  if (error) throw error;
}
