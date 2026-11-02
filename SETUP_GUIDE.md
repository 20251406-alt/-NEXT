# 급식 NEXT Google 로그인 설정 안내서

개발 지식이 없어도 순서대로 진행할 수 있도록 작성했습니다. 화면 명칭은 2026년 7월 공식 문서를 기준으로 확인했습니다.

> 중요: Google 비밀번호, Google Client Secret, Supabase `service_role`/secret key는 채팅, 소스 코드, 메모 공유, 화면 녹화에 절대 노출하지 마세요. 이 안내서가 요구하는 브라우저용 publishable/anon key와 비밀키는 서로 다릅니다.

## 준비물

- Supabase 계정: <https://supabase.com/dashboard>
- Google 계정: <https://console.cloud.google.com/>
- 이 파일과 같은 폴더의 `supabase-setup.sql`
- 배포 주소: `https://geupsik-next.iou6901.chatgpt.site`
- 테스트할 Google 계정 2개

## 전체 순서

1. Supabase 프로젝트 생성
2. `supabase-setup.sql` 실행
3. Supabase에서 URL과 브라우저용 키 확인
4. Supabase의 Google Callback URL 확인
5. Google Auth Platform에서 OAuth 앱과 Web Client 생성
6. Google Client ID와 Secret을 Supabase에만 입력
7. Supabase 로그인 Redirect URL 등록
8. ChatGPT Sites 프로젝트에 환경변수 3개 입력
9. 새 버전 재배포
10. 두 Google 계정으로 로그인 확인

---

## 1. Supabase 프로젝트 만들기

1. <https://supabase.com/dashboard>에 로그인합니다.
2. 화면에서 **New project**를 누릅니다.
3. 조직을 선택합니다. 조직이 없다면 화면 안내에 따라 하나를 만듭니다.
4. **Project name**에 알아보기 쉬운 이름을 입력합니다. 예: `geupsik-next`.
5. **Database password**는 자동 생성 또는 강력한 새 비밀번호를 사용합니다.
6. 이 비밀번호는 비밀번호 관리 앱에만 저장하고 채팅이나 소스 코드에 붙여 넣지 않습니다.
7. 가까운 Region을 선택하고 **Create new project**를 누릅니다.
8. 프로젝트 준비가 끝날 때까지 기다립니다.

## 2. 통합 SQL 한 번에 실행하기

1. Supabase 프로젝트 왼쪽 메뉴에서 **SQL Editor**를 누릅니다.
2. **New query**를 누릅니다.
3. [supabase-setup.sql](./supabase-setup.sql) 파일을 텍스트 편집기로 엽니다.
4. 파일 전체를 선택해 복사합니다.
5. SQL Editor 입력칸에 붙여 넣습니다.
6. 오른쪽 아래 또는 상단의 **Run**을 누릅니다.
7. 마지막 결과에 `급식 NEXT Supabase 설치 완료`가 표시되는지 확인합니다.

### 이미 이전 SQL을 실행한 경우

통합 SQL은 다음 방식으로 재실행 충돌을 줄였습니다.

- enum 타입은 이미 있으면 건너뜁니다.
- 테이블·컬럼·인덱스는 `IF NOT EXISTS`를 사용합니다.
- 기본 카테고리와 태그는 중복 삽입하지 않습니다.
- 함수는 최신 내용으로 교체합니다.
- RLS 정책과 트리거는 같은 이름의 기존 항목을 제거하고 다시 만듭니다.
- 전체 실행 중 오류가 발생하면 트랜잭션이 롤백됩니다.

그래도 중요한 운영 데이터가 이미 있다면 실행 전 **Database → Backups**에서 백업 상태를 확인하세요. 급식 NEXT가 아닌 다른 서비스가 같은 테이블 이름을 사용하는 Supabase 프로젝트에는 실행하지 마세요.

## 3. Supabase Project URL과 브라우저용 키 찾기

Supabase는 현재 새 프로젝트에서 **Publishable key**를 권장하며, 이전 프로젝트의 **anon key**도 계속 지원합니다. 공식 설명: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

### 가장 쉬운 방법

1. Supabase 프로젝트 상단의 **Connect** 버튼을 누릅니다.
2. 표시되는 **Project URL**을 복사해 안전한 임시 메모에 둡니다.
3. 표시되는 **Publishable key**를 복사합니다.

### Connect에서 키가 보이지 않는 경우

1. 왼쪽 아래 톱니바퀴 **Project Settings**를 누릅니다.
2. **API Keys**를 누릅니다.
3. **Publishable and secret API keys** 탭에서 **Publishable key**를 복사합니다.
4. 구형 프로젝트라면 **Legacy API Keys**의 `anon public` 값을 사용할 수 있습니다.

환경변수에는 다음처럼 대응합니다.

| 환경변수 | 넣을 값 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL, 예: `https://프로젝트참조.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key 또는 기존 `anon public` key |

### 절대 사용하면 안 되는 키

- `service_role`
- Secret key
- Database password
- JWT signing secret

이 값들은 RLS를 우회하거나 데이터베이스에 강한 권한을 줄 수 있으므로 `NEXT_PUBLIC_` 환경변수에 넣으면 안 됩니다. Supabase도 service/secret 키를 브라우저에서 사용하지 말라고 안내합니다.

## 4. Supabase Google Provider 화면 열기

공식 안내: [Supabase Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google).

1. Supabase 왼쪽 메뉴에서 **Authentication**을 누릅니다.
2. **Sign In / Providers** 또는 화면에 표시되는 **Providers**를 누릅니다.
3. Provider 목록에서 **Google**을 찾고 펼칩니다.
4. 화면에 표시된 **Callback URL**을 복사합니다.
5. 보통 다음 형태입니다.

   `https://프로젝트참조.supabase.co/auth/v1/callback`

6. 아직 Client ID와 Secret을 입력하지 말고 이 탭을 열어 둡니다.

## 5. Google Auth Platform 설정하기

Google의 최신 OAuth 관리 화면은 **Google Auth Platform**의 **Branding**, **Audience**, **Clients**, **Data Access**로 나뉩니다. 공식 안내: [Google Auth Platform 시작하기](https://support.google.com/cloud/answer/15544987), [OAuth Clients 관리](https://support.google.com/cloud/answer/15549257).

### 5-1. Google Cloud 프로젝트 만들기

1. <https://console.cloud.google.com/>에 로그인합니다.
2. 화면 위쪽 프로젝트 선택기를 누릅니다.
3. **New Project**를 누릅니다.
4. Project name을 `급식 NEXT`처럼 입력하고 **Create**를 누릅니다.
5. 생성한 프로젝트가 화면 위쪽에 선택되어 있는지 확인합니다.

### 5-2. Google Auth Platform 시작하기

1. 왼쪽 메뉴 또는 검색창에서 **Google Auth Platform**을 엽니다.
2. 처음이라면 **Get Started**를 누릅니다.
3. **App name**에 `급식 NEXT`를 입력합니다.
4. **User support email**은 본인이 확인 가능한 이메일을 선택합니다.
5. **Audience**는 대회 시연이라면 **External**을 선택합니다.
6. **Contact information**에 본인 이메일을 입력합니다.
7. 약관을 확인하고 **Create** 또는 화면의 완료 버튼을 누릅니다.

### 5-3. 테스트 사용자 2명 등록

Google OAuth 앱이 **Testing** 상태라면 등록한 테스트 사용자만 로그인할 수 있습니다.

1. Google Auth Platform 왼쪽에서 **Audience**를 누릅니다.
2. **Test users** 영역에서 **Add users**를 누릅니다.
3. 영상 시연용 사용자 A의 Google 이메일을 추가합니다.
4. 사용자 B의 Google 이메일도 추가합니다.
5. **Save**를 누릅니다.

테스트 상태에서는 테스트 사용자 목록이 필요하다는 Google 공식 설명: [OAuth 앱 테스트 사용자](https://support.google.com/cloud/answer/13461325).

### 5-4. OAuth Web Client 만들기

1. Google Auth Platform 왼쪽에서 **Clients**를 누릅니다.
2. **Create Client**를 누릅니다.
3. **Application type**에서 **Web application**을 선택합니다.
4. Name에 `급식 NEXT Web`을 입력합니다.
5. **Authorized JavaScript origins**에 다음 두 주소를 추가합니다.

   - `https://geupsik-next.iou6901.chatgpt.site`
   - `http://localhost:3000`

6. **Authorized redirect URIs**에는 4단계에서 복사한 Supabase Callback URL을 정확히 추가합니다.

   - 올바른 예: `https://프로젝트참조.supabase.co/auth/v1/callback`
   - 이 칸에는 `chatgpt.site` 주소를 넣지 않습니다.

7. **Create**를 누릅니다.
8. 표시되는 **Client ID**와 **Client Secret**을 확인합니다.

> Client Secret은 이 순간부터 비밀정보입니다. 채팅에 붙여 넣거나 화면 녹화에 보이게 하지 마세요. Google도 Client Secret을 코드·버전 관리·공개 채널에 저장하지 말 것을 안내합니다.

### 5-5. 추가 권한 범위

급식 NEXT 로그인은 기본 프로필·이름·이메일만 사용합니다. **Data Access**에서 Google Drive, Gmail, Calendar 같은 추가 scope를 선택하지 마세요.

## 6. Google Client 정보를 Supabase에 입력하기

1. 열어 둔 Supabase **Authentication → Sign In / Providers → Google** 화면으로 돌아갑니다.
2. Google Provider의 **Enable Sign in with Google** 또는 활성화 스위치를 켭니다.
3. **Client ID**에 Google에서 만든 Client ID를 붙여 넣습니다.
4. **Client Secret**에 Google Client Secret을 붙여 넣습니다.
5. **Save**를 누릅니다.
6. 입력 후 Google Client Secret을 다른 메모나 채팅에 복사하지 않습니다.

Google Client Secret은 Supabase Provider 설정 안에만 보관합니다. 급식 NEXT 코드와 ChatGPT Sites 환경변수에는 넣지 않습니다.

## 7. Supabase 로그인 URL 등록하기

공식 안내: [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Auth URL Configuration](https://supabase.com/docs/guides/auth/general-configuration).

1. Supabase 왼쪽 메뉴에서 **Authentication**을 누릅니다.
2. **URL Configuration**을 누릅니다.
3. **Site URL**에 아래 주소를 입력합니다.

   `https://geupsik-next.iou6901.chatgpt.site`

4. **Redirect URLs**에 다음 주소를 추가합니다.

   - `https://geupsik-next.iou6901.chatgpt.site/**`
   - `http://localhost:3000/**`

5. **Save**를 누릅니다.

주소의 `https`, 철자, 슬래시가 다르면 로그인 후 `redirect_uri_mismatch` 또는 허용되지 않은 redirect 오류가 날 수 있습니다.

## 8. ChatGPT Sites 환경변수 입력 위치

현재 급식 NEXT Sites 프로젝트를 직접 확인한 결과, 환경변수는 아직 **0개**입니다. 환경변수는 배포된 웹사이트 화면 안에서 입력하는 것이 아니라 **ChatGPT Sites 프로젝트 관리 화면**에 저장해야 합니다.

### Sites 관리 화면에 Environment variables가 보이는 경우

1. ChatGPT에서 급식 NEXT를 만든 이 대화 또는 해당 Site의 관리 카드를 엽니다.
2. 사이트 카드의 **⋯** 또는 **Manage / 사이트 관리**를 누릅니다.
3. **Settings / 설정**을 엽니다.
4. **Environment variables / 환경 변수**를 엽니다.
5. 아래 세 항목을 각각 추가합니다.

| 이름 | 값 | Secret 표시 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | 끔 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key 또는 `anon public` key | 켜도 되고 꺼도 됨 |
| `NEXT_PUBLIC_SITE_URL` | `https://geupsik-next.iou6901.chatgpt.site` | 끔 |

6. 저장합니다.
7. 환경변수 변경은 기존 배포에 자동 적용되지 않을 수 있으므로 반드시 새 버전을 빌드·배포합니다.

### 환경 변수 메뉴가 보이지 않는 경우

ChatGPT Sites는 베타 배포 상태에 따라 직접 관리 메뉴가 표시되지 않는 계정이 있을 수 있습니다. 이 경우 이 대화에서 “급식 NEXT Sites 프로젝트의 환경 변수 관리 화면을 열어 달라”고 요청하세요. 단, 다음 구분을 지켜야 합니다.

- Project URL과 publishable/anon key는 브라우저용 공개 설정이지만 다른 비밀키와 혼동하지 마세요.
- `service_role`, Supabase Secret key, Google Client Secret, Database password는 채팅에 보내지 마세요.
- 관리 화면이 제공되지 않는다면 비밀정보를 채팅으로 우회 전달하지 말고 Sites 환경변수 입력 UI가 제공될 때까지 중단하세요.

ChatGPT Sites는 현재 public beta이므로 메뉴 이름이나 배치가 일부 계정에서 달라질 수 있습니다. 공식 출시 안내: [ChatGPT release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes).

## 9. 환경변수 입력 후 재배포하기

1. 세 환경변수를 저장합니다.
2. 이 대화에서 “환경변수가 적용된 급식 NEXT를 다시 빌드하고 배포해 줘”라고 요청합니다.
3. 새 배포 완료 메시지가 나온 뒤 사이트를 새로 엽니다.
4. 예전 화면이 남으면 강력 새로고침합니다.
   - Windows/Chromebook: `Ctrl + Shift + R`
   - macOS: `Command + Shift + R`
5. 첫 화면의 **Google 계정으로 로그인** 버튼이 활성화되었는지 확인합니다.

## 10. 두 Google 계정으로 최종 확인하기

1. 일반 Chrome 창에서 사용자 A로 로그인합니다.
2. 최초 학교 등록 화면에서 학산고등학교를 등록합니다.
3. 다른 Chrome 프로필 또는 시크릿 창에서 사용자 B로 로그인합니다.
4. 새봄고등학교를 등록합니다.
5. 사용자 B가 승인 기간에 포함되는 점심 기록을 입력합니다.
6. 사용자 A가 새봄고등학교에 공유 요청을 보냅니다.
7. 사용자 B가 데이터 공유함에서 요청을 승인합니다.
8. 사용자 A가 외부 데이터셋 이용 조건에 동의하고 예측에 사용합니다.
9. 사용자 B가 권한을 회수합니다.
10. 사용자 A 화면에서 회수 상태와 예측 제외를 확인합니다.

Supabase에서는 **Authentication → Users**에서 두 계정이 생성되었는지 확인할 수 있습니다. 이 목록이나 이메일이 보이는 화면을 영상에 오래 노출하지 마세요.

## 문제 해결

### Google 로그인 버튼이 비활성화됨

- Sites 환경변수 2개(URL, 브라우저용 key)가 정확히 저장됐는지 확인합니다.
- 환경변수 저장 후 새 버전을 재배포했는지 확인합니다.

### `redirect_uri_mismatch`

- Google **Clients → 해당 Web client → Authorized redirect URIs**에 Supabase Callback URL이 정확히 있는지 확인합니다.
- 배포 사이트 주소가 아니라 `https://프로젝트참조.supabase.co/auth/v1/callback`이어야 합니다.

### Google에서 “액세스 차단됨” 표시

- Google Auth Platform **Audience → Test users**에 해당 계정이 등록됐는지 확인합니다.
- OAuth 앱이 External·Testing 상태인지 확인합니다.

### 로그인 후 다시 로그인 화면으로 돌아옴

- Supabase **Authentication → URL Configuration**의 Site URL과 Redirect URLs를 확인합니다.
- `NEXT_PUBLIC_SITE_URL`이 실제 배포 주소와 완전히 같은지 확인합니다.

### SQL을 두 번째 실행했는데 오류가 남

- 오류 메시지 전체에서 첫 번째 `ERROR` 위치를 확인합니다.
- 같은 이름의 테이블을 다른 서비스가 사용하고 있다면 추가 실행을 멈춥니다.
- 중요한 데이터가 있다면 삭제하거나 초기화하지 말고 먼저 백업합니다.

## 비밀정보 최종 점검표

- [ ] Google 계정 비밀번호를 누구에게도 보내지 않았다.
- [ ] Google Client Secret은 Supabase Google Provider에만 입력했다.
- [ ] Supabase `service_role` 또는 Secret key를 코드·채팅·Sites에 넣지 않았다.
- [ ] Database password를 코드·채팅에 넣지 않았다.
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`에는 publishable/anon public key만 넣었다.
- [ ] 화면 녹화 전에 Google/Supabase 설정 탭을 닫았다.
