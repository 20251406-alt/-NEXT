export type MealTime = "아침" | "점심" | "저녁";
export type ShareStatus = "대기 중" | "승인됨" | "거절됨" | "회수됨" | "만료됨";

export type LiveSchool = {
  id: string;
  name: string;
  schoolCode: string;
  level: string;
  province: string;
  district: string;
  students: number;
  targets: number;
  boys: number;
  girls: number;
  genderType: string;
  commute: string;
  meals: MealTime[];
  recordCount?: number;
};

export type LiveMeal = {
  id: string;
  schoolId: string;
  date: string;
  mealTime: MealTime;
  target: number;
  menu: string;
  categories: string[];
  weather: string;
  temp: number;
  rain: boolean;
  tags: string[];
  otherTagText?: string;
  prepared: number;
  actual: number;
  waste: number;
  note?: string;
  source?: "자체" | "외부";
  customValues?: Record<string, string | string[] | number | boolean>;
};

export type LiveVariable = {
  id: string;
  schoolId: string;
  name: string;
  description: string;
  type: "숫자" | "예·아니요" | "단일 선택" | "복수 선택";
  unit: string;
  options: string[];
  mealTimes: MealTime[];
  required: boolean;
  predictive: boolean;
  active: boolean;
  count: number;
};

export type LiveShare = {
  id: string;
  requesterId: string;
  providerId: string;
  requesterName: string;
  providerName: string;
  purpose: string;
  message: string;
  requestedMeals: MealTime[];
  requestedStart: string;
  requestedEnd: string;
  status: ShareStatus;
  createdAt: string;
  decidedAt?: string;
  revokedAt?: string;
  permissionId?: string;
  grantedMeals: MealTime[];
  dataStart?: string;
  dataEnd?: string;
  validStart?: string;
  validEnd?: string;
  maxRecords?: number;
  recordCount?: number;
  allowedVariables: string[];
  additionalTerms?: string;
  termsAcceptedAt?: string;
  blockId?: string;
  blockActive: boolean;
  predictionEnabled: boolean;
  deleted: boolean;
};

export type LiveContext = {
  user: { id: string; name: string; email: string; avatar: string };
  school: LiveSchool | null;
};

export const mealToDb = (value: MealTime) =>
  ({ 아침: "breakfast", 점심: "lunch", 저녁: "dinner" })[value];
export const mealFromDb = (value: string): MealTime =>
  ({ breakfast: "아침", lunch: "점심", dinner: "저녁" })[value] as MealTime;
export const statusFromDb = (value: string): ShareStatus =>
  ({
    pending: "대기 중",
    approved: "승인됨",
    rejected: "거절됨",
    revoked: "회수됨",
    expired: "만료됨",
  })[value] as ShareStatus;
