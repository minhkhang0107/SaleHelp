# Implementation Plan - Gemini API Key Protection & Secure Backend Proxy

Protect the Gemini API Key from front-end client leakage by introducing a Secure Backend Proxy architecture, environment secret isolation, and zero-client-key exposure.

## User Review Required

> [!IMPORTANT]
> - **Zero Client Exposure**: The raw `GEMINI_API_KEY` will NEVER be compiled into client web JS or sent over client browser requests.
> - **Secure Proxy Pattern**: All AI generation calls route through a server-side proxy middleware that attaches server secrets securely.
> - **Git Secret Isolation**: `.env` is added to `.gitignore` to prevent accidental key commits.

## Proposed Changes

### Security & Data Layer (`salehelp`)

#### [NEW] [.env.example](file:///home/david/Downloads/scripts/AI_tools/tools/sale-help/salehelp/.env.example) & [MODIFY] [.gitignore](file:///home/david/Downloads/scripts/AI_tools/tools/sale-help/salehelp/.gitignore)
- Add `.env` to `.gitignore` to prevent secret commits.
- Create `.env.example` template for server environment variables.

#### [NEW] [gemini_proxy_service.dart](file:///home/david/Downloads/scripts/AI_tools/tools/sale-help/salehelp/data/lib/src/service/gemini_proxy_service.dart)
- Implement `GeminiProxyService` to act as a secure server-side middleware relaying requests to Google Gemini REST API using server-held environment secrets.

#### [MODIFY] [gemini_service.dart](file:///home/david/Downloads/scripts/AI_tools/tools/sale-help/salehelp/data/lib/src/service/gemini_service.dart)
- Update `GeminiService` to use `GeminiProxyService`, removing raw API Key exposure from client-side execution.

## Verification Plan

### Automated Tests
- Run unit test in `gemini_service_test.dart` verifying that `GeminiService` executes securely via `GeminiProxyService` without leaking client keys.

### Manual Verification
- Inspect Web Application network payloads to confirm no `GEMINI_API_KEY` query parameters or headers are visible to the browser client.
