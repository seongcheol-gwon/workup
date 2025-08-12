# Getting Started

### Reference Documentation

For further reference, please consider the following sections:

* [Official Gradle documentation](https://docs.gradle.org)
* [Spring Boot Gradle Plugin Reference Guide](https://docs.spring.io/spring-boot/3.5.5-SNAPSHOT/gradle-plugin)
* [Create an OCI image](https://docs.spring.io/spring-boot/3.5.5-SNAPSHOT/gradle-plugin/packaging-oci-image.html)
* [Spring Configuration Processor](https://docs.spring.io/spring-boot/3.5.5-SNAPSHOT/specification/configuration-metadata/annotation-processor.html)
* [Spring Data JPA](https://docs.spring.io/spring-boot/3.5.5-SNAPSHOT/reference/data/sql.html#data.sql.jpa-and-spring-data)
* [Spring for GraphQL](https://docs.spring.io/spring-boot/3.5.5-SNAPSHOT/reference/web/spring-graphql.html)
* [Spring Security](https://docs.spring.io/spring-boot/3.5.5-SNAPSHOT/reference/web/spring-security.html)
* [Amazon Bedrock](https://docs.spring.io/spring-ai/reference/api/bedrock-chat.html)
* [Spring Web](https://docs.spring.io/spring-boot/3.5.5-SNAPSHOT/reference/web/servlet.html)

### Guides

The following guides illustrate how to use some features concretely:

* [Accessing Data with JPA](https://spring.io/guides/gs/accessing-data-jpa/)
* [Building a GraphQL service](https://spring.io/guides/gs/graphql-server/)
* [Securing a Web Application](https://spring.io/guides/gs/securing-web/)
* [Spring Boot and OAuth2](https://spring.io/guides/tutorials/spring-boot-oauth2/)
* [Authenticating a User with LDAP](https://spring.io/guides/gs/authenticating-ldap/)
* [Building a RESTful Web Service](https://spring.io/guides/gs/rest-service/)
* [Serving Web Content with Spring MVC](https://spring.io/guides/gs/serving-web-content/)
* [Building REST services with Spring](https://spring.io/guides/tutorials/rest/)

### Additional Links

These additional references should also help you:

* [Gradle Build Scans – insights for your project's build](https://scans.gradle.com#gradle)

## GraphQL code generation with DGS

This project has been configured to use the Netflix DGS Codegen plugin.
This plugin can be used to generate client files for accessing remote GraphQL services.
The default setup assumes that the GraphQL schema file for the remote service is added to the
`src/main/resources/graphql-client/` location.

You can learn more about
the [plugin configuration options](https://netflix.github.io/dgs/generating-code-from-schema/#configuring-code-generation)
and
[how to use the generated types](https://netflix.github.io/dgs/generating-code-from-schema/) to adapt the default setup.



# Getting Started

### Reference Documentation

For further reference, please consider the following sections:

* [Official Gradle documentation](https://docs.gradle.org)
* [Spring Boot Gradle Plugin Reference Guide](https://docs.spring.io/spring-boot/3.5.5-SNAPSHOT/gradle-plugin)
* [Create an OCI image](https://docs.spring.io/spring-boot/3.5.5-SNAPSHOT/gradle-plugin/packaging-oci-image.html)
* [Spring Configuration Processor](https://docs.spring.io/spring-boot/3.5.5-SNAPSHOT/specification/configuration-metadata/annotation-processor.html)
* [Spring Data JPA](https://docs.spring.io/spring-boot/3.5.5-SNAPSHOT/reference/data/sql.html#data.sql.jpa-and-spring-data)
* [Spring for GraphQL](https://docs.spring.io/spring-boot/3.5.5-SNAPSHOT/reference/web/spring-graphql.html)
* [Spring Security](https://docs.spring.io/spring-boot/3.5.5-SNAPSHOT/reference/web/spring-security.html)
* [Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/what-is-bedrock.html)
* [Spring Web](https://docs.spring.io/spring-boot/3.5.5-SNAPSHOT/reference/web/servlet.html)

### Guides

The following guides illustrate how to use some features concretely:

* [Accessing Data with JPA](https://spring.io/guides/gs/accessing-data-jpa/)
* [Building a GraphQL service](https://spring.io/guides/gs/graphql-server/)
* [Securing a Web Application](https://spring.io/guides/gs/securing-web/)
* [Spring Boot and OAuth2](https://spring.io/guides/tutorials/spring-boot-oauth2/)
* [Authenticating a User with LDAP](https://spring.io/guides/gs/authenticating-ldap/)
* [Building a RESTful Web Service](https://spring.io/guides/gs/rest-service/)
* [Serving Web Content with Spring MVC](https://spring.io/guides/gs/serving-web-content/)
* [Building REST services with Spring](https://spring.io/guides/tutorials/rest/)

### Additional Links

These additional references should also help you:

* [Gradle Build Scans – insights for your project's build](https://scans.gradle.com#gradle)

## GraphQL code generation with DGS

This project has been configured to use the Netflix DGS Codegen plugin.
This plugin can be used to generate client files for accessing remote GraphQL services.
The default setup assumes that the GraphQL schema file for the remote service is added to the
`src/main/resources/graphql-client/` location.

You can learn more about
the [plugin configuration options](https://netflix.github.io/dgs/generating-code-from-schema/#configuring-code-generation)
and
[how to use the generated types](https://netflix.github.io/dgs/generating-code-from-schema/) to adapt the default setup.

---

## Amazon Bedrock Prompt Optimization API (SigV4)

이 프로젝트에는 Amazon Bedrock을 호출하여 프롬프트를 최적화하는 REST API가 포함되어 있습니다.
실제 Bedrock Runtime 호출은 AWS Signature V4(SigV4)로 서명되어야 하므로, AWS 자격 증명(예: 환경 변수, EC2/Role, ECS Task Role 등)이 필요합니다.

### 필수 환경 변수 / 설정
`src/main/resources/application.properties`에서 다음 속성을 설정합니다.

- `BEDROCK_REGION` 또는 `bedrock.region` (기본값: `us-east-1`)
- `BEDROCK_MODEL_ID` 또는 `bedrock.model-id` (기본값: `anthropic.claude-3-haiku-20240307-v1:0`)

또한, AWS SDK 기본 자격 증명 공급자 체인(DefaultCredentialsProvider)이 찾을 수 있도록 다음 중 하나를 구성하세요.

- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (필요 시 `AWS_SESSION_TOKEN`)
- 또는 인스턴스/컨테이너 프로파일(Role) 사용

선택적:
- `BEDROCK_API_KEY` 또는 `bedrock.api-key`: 일부 환경에서 추가 검증용 API Key를 쓸 수 있으나, Bedrock Runtime 호출 자체는 SigV4가 필수입니다. API Key가 없어도 자격 증명이 있으면 호출됩니다.

예)

```bash
export AWS_ACCESS_KEY_ID=AKIA...
export AWS_SECRET_ACCESS_KEY=...
# export AWS_SESSION_TOKEN=...  # (임시 자격증명일 경우)
export BEDROCK_REGION=us-east-1
export BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0
# export BEDROCK_API_KEY=optional_key
```

### 엔드포인트
- POST `/api/bedrock/prompt/customize`

Request Body
```json
{
  "prompt": "원본 프롬프트 텍스트",
  "instructions": "선택: 추가 지침",
  "maxTokens": 512
}
```

Response Body
```json
{
  "optimizedPrompt": "최적화된 프롬프트",
  "modelId": "anthropic.claude-3-haiku-20240307-v1:0",
  "usedApiKey": true
}
```

### 호출 예시
```bash
curl -X POST "http://localhost:8080/api/bedrock/prompt/customize" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "사용자에게 일정표를 만들어달라고 요청하는 프롬프트",
    "instructions": "출력 형식을 표로 제한하고, 시간 범위를 오전 9시~오후 6시로 설정"
  }'
```

API Key가 설정되지 않은 경우, 서버는 안전한 로컬 폴백 로직을 사용해 간단히 최적화된 프롬프트 형태를 반환합니다.

## 다중 스프레드시트 처리 API 사용 시 Bedrock 사용 여부 확인 및 출력 모드 선택
- Endpoint: POST /api/excel/process-multi (multipart/form-data)
- Query/Form parameter: mode (optional)
  - mode=detail (기본값): 상세 결과를 반환합니다. 모델 ID, usedBedrock, rows 등의 컨텍스트와 함께 outputText를 포함한 전체 객체를 리턴합니다.
  - mode=json: 모델 outputText 내부에서 JSON 객체/배열을 추출하여 그 JSON만 응답 본문으로 리턴합니다. 
    - 우선적으로 ```json ... ``` 펜스 블록을 찾고, 없으면 첫 번째 {...} 또는 [...] 블록을 시도합니다.
    - 파싱에 실패하면 {"result": "<원본 텍스트>"} 형태로 반환합니다.
- Response JSON includes (mode=detail):
  - modelId: 사용 모델 ID (예: anthropic.claude-3-5-sonnet-20240620-v1:0)
  - usedBedrock: true면 Bedrock 호출 성공, false면 로컬 폴백 사용됨
  - usedApiKey: (하위 호환 필드) usedBedrock와 동일 의미

Bedrock 호출이 실패(권한/리전/모델 미승인 등)하면 usedBedrock=false가 되고, 서버는 프롬프트와 일부 컨텍스트를 이용한 안전한 폴백 텍스트를 반환합니다.

예시(curl):

- 상세 모드(default)
```
curl -X POST "http://localhost:8080/api/excel/process-multi?mode=detail" \
  -H "Authorization: Basic YWRtaW46YWRtaW4xMjMh" \
  -H "Content-Type: multipart/form-data" \
  -F "files=@/path/a.xlsx" \
  -F "prompt=상품명으로 카드번호를 찾아서 결과를 JSON으로 반환"
```

- JSON 전용 모드
```
curl -X POST "http://localhost:8080/api/excel/process-multi?mode=json" \
  -H "Authorization: Basic YWRtaW46YWRtaW4xMjMh" \
  -H "Content-Type: multipart/form-data" \
  -F "files=@/path/a.xlsx" \
  -F "prompt=상품명으로 카드번호를 찾아서 결과를 JSON으로 반환"
```


---

## Frontend (Next.js + GraphQL)

The frontend lives under the `web/` directory. Do NOT run `npx next build` from the repository root because there is no Next.js project at the root. Instead, use the provided root-level npm scripts which delegate into `web/`.

- Development (from project root):
  - `npm run web:dev` → runs Next.js dev server at http://localhost:3000
- Build (from project root):
  - `npm run web:build` → executes `next build` inside `web/`
- Start production server (after build):
  - `npm run web:start`

Note: The root-level scripts automatically install web/ dependencies before running, so you can run them directly without a prior manual npm install.

Alternatively, you can execute commands inside the `web/` folder directly:

- `cd web && npm install`
- `npm run dev` (for development)
- `npm run build` (to build)
- `npm run start` (to start production server)

Optional: configure the backend URL for the GraphQL API route (default `http://localhost:8080`):

- Set env var before starting Next.js: `export BACKEND_URL=http://localhost:8080`

Feature page:
- Navigate to http://localhost:3000/excel
- Upload multiple Excel files (per-file delete and password input), enter a prompt, choose mode (detail/json), and click 실행.
- Button is disabled until required fields are set and shows a loading state while processing.
