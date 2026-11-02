# 급식 NEXT

“오늘의 데이터를, 내일의 지속가능한 급식으로.”

학교별 급식 기록과 승인된 유사 학교의 익명 데이터를 이용해 식수 인원을 참고 예측하고 잔반과 조리 에너지 낭비를 줄이는 반응형 웹서비스입니다.

## 두 가지 실행 모드

- **실제 운영 모드**: Supabase Google Auth로 로그인하며 학교·급식·맞춤 변수·공유 요청·권한·감사 로그를 PostgreSQL에 저장합니다. 한 계정은 등록한 학교에만 연결되며 다른 학교로 전환할 수 없습니다.
- **데모 체험 모드**: OAuth 설정 없이도 기존 대회 시연 데이터를 브라우저 `localStorage`에 저장하여 사용할 수 있습니다. 실제 운영 데이터와 섞이지 않습니다.

환경변수가 없거나 잘못되어도 흰 화면이나 무한 로딩 대신 설정 안내와 **데모로 둘러보기** 버튼을 표시합니다.

## 로컬 실행과 검사

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

`.env.example`을 `.env.local`로 복사하고 값을 입력합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

서비스 역할 키와 Google Client Secret은 브라우저 환경변수나 저장소에 입력하지 않습니다.

## Supabase 데이터베이스 설정

Supabase Dashboard의 **SQL Editor**에서 아래 순서로 실행합니다.

1. `supabase/migrations/202607180001_initial.sql`
2. `supabase/migrations/202607190001_google_auth_multitenant.sql`

두 번째 migration은 Google 프로필의 공개 불가 필드, 요청 데이터 기간, 추가 승인 조건, 외부 블록 예측 상태를 추가합니다. 또한 다음 보안 RPC를 설치합니다.

- `register_my_school`: 최초 학교 등록과 관리자 연결을 한 트랜잭션으로 처리
- `request_data_share`: 요청 저장과 감사 로그 작성
- `approve_data_share`: 승인, 권한, 외부 데이터셋 블록, 감사 로그를 한 번에 생성
- `reject_data_share`, `revoke_data_share`: 제공 학교 권한 검증 후 상태 변경
- `accept_and_activate_dataset`, `set_external_dataset_active`, `delete_external_dataset`: 요청 학교만 자신의 외부 블록 관리
- `get_authorized_external_meals`: 승인·동의·활성·유효기간·미회수 조건을 모두 만족할 때만 익명 급식 필드 반환

RLS는 사용자의 소속 학교 급식 원자료만 직접 조회·수정하게 합니다. 다른 학교 원자료, 담당자 이메일, Google 프로필, 사용자 ID, 내부 특이사항은 공유되지 않습니다. 제공 학교의 원자료는 RLS를 우회하는 임의 클라이언트 조회가 아니라 범위를 검증하는 `security definer` RPC의 제한된 익명 결과로만 예측에 전달됩니다.

## Google OAuth 설정

### 1. Google Cloud Console

1. Google Cloud Console에서 프로젝트를 만들고 **Google Auth Platform → Clients**로 이동합니다.
2. OAuth Client 유형을 **Web application**으로 생성합니다.
3. 승인된 JavaScript 원본에 로컬 주소와 배포 주소를 등록합니다.
   - `http://localhost:3000`
   - 실제 배포 주소(예: `https://geupsik-next.iou6901.chatgpt.site`)
4. 승인된 리디렉션 URI에는 Supabase Dashboard가 안내하는 Callback URL을 등록합니다.
   - `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
5. Google Client ID와 Client Secret을 복사합니다. Secret은 Supabase Provider 설정에만 입력합니다.

### 2. Supabase Dashboard

1. **Authentication → Providers → Google**을 활성화합니다.
2. Google Client ID와 Client Secret을 입력합니다.
3. **Authentication → URL Configuration**에서 Site URL을 실제 배포 주소로 설정합니다.
4. Redirect URLs에 다음을 추가합니다.
   - `http://localhost:3000/**`
   - `https://geupsik-next.iou6901.chatgpt.site/**` 또는 실제 배포 도메인
5. **Project Settings → API**의 Project URL과 anon/publishable key를 배포 환경변수에 등록합니다.
6. 배포 환경의 `NEXT_PUBLIC_SITE_URL`은 정확한 배포 주소로 설정합니다.

Google OAuth 앱이 테스트 상태라면 **Google Auth Platform → Audience → Test users**에 시연할 두 Google 계정을 모두 추가해야 합니다.

## 상태 자동 갱신 방식

대회 시연 안정성을 위해 Realtime 채널 대신 다음 세 가지를 함께 사용합니다.

- 운영 화면 진입 시 즉시 조회
- 10초 간격 자동 상태 조회
- 데이터 공유함의 **새로고침** 버튼과 상단 **상태 새로고침** 버튼

따라서 두 브라우저를 동시에 열어 두면 요청·승인·거절·회수가 늦어도 약 10초 안에 반영됩니다. 새로고침 버튼을 누르면 즉시 확인할 수 있습니다.

## 두 Google 계정 영상 시연

1. 일반 Chrome 창에서 사용자 A로 로그인하고 `학산고등학교`를 등록합니다.
2. 다른 Chrome 프로필 또는 시크릿 창에서 사용자 B로 로그인하고 `새봄고등학교`를 등록합니다.
3. A의 **비슷한 학교 찾기**에서 새봄고등학교에 필요한 기간과 점심을 선택해 요청합니다.
4. B의 **데이터 공유함 → 받은 요청**에서 목적·메시지·기간을 확인합니다.
5. B가 **조건 설정 후 승인**을 눌러 점심, 데이터 기간, 유효기간 종료일 30일 후, 최대 30건을 설정합니다.
6. A에서 **상태 새로고침**을 누르고 승인 상태를 확인합니다.
7. A의 **외부 데이터셋**에서 조건에 동의한 뒤 **동의 후 예측에 사용**을 누릅니다.
8. A의 **식수 인원 예측**에서 자체·외부 사용 건수와 비율을 확인합니다.
9. B가 승인 내역의 **공유 권한 회수**를 누르고 경고를 확인합니다.
10. A가 새로고침하면 외부 블록이 회수 상태로 바뀌고 다음 예측에서 외부 사용 건수가 0건으로 표시됩니다.

실제 외부 기록을 예측에 표시하려면 제공 학교 B가 승인한 데이터 기간 안에 해당 시간대의 급식 기록을 먼저 입력해야 합니다.

## 주요 파일

- `app/AuthEntry.tsx`: 모드 선택, Google 로그인, 설정 누락 안내
- `app/Onboarding.tsx`: 최초 학교 등록과 관리자 연결 UI
- `app/LiveApp.tsx`: Supabase 실제 운영 화면과 10초 동기화
- `app/page.tsx`: 기존 데모 기능과 운영 모드 진입점
- `lib/supabase/client.ts`: 브라우저용 Supabase client
- `lib/supabase/live-service.ts`: 실제 운영 데이터 접근 계층
- `lib/live-types.ts`: 운영 데이터 타입과 DB enum 변환
- `supabase/migrations`: 정규화 테이블, RPC, RLS 정책

## 현재 한계

- Supabase URL, anon key, Google Provider와 Redirect URL은 서비스 소유자가 직접 설정해야 실제 Google 로그인이 동작합니다.
- 자동 상태 반영은 Realtime이 아니라 10초 폴링 방식입니다.
- 실제 Google OAuth의 최종 로그인은 프로젝트별 Google/Supabase 비밀 설정 없이는 로컬 자동 테스트로 완료할 수 없습니다.
- 예측은 설명 가능한 유사 사례 기반 참고치이며 과학적 확률이나 급식 준비량을 보장하지 않습니다.
