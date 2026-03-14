# Operations Guide

Author: Will Soltani

## 1) Production Topology
- Next.js app serves UI and API routes.
- DynamoDB stores project/file metadata.
- S3 raw bucket stores uploaded sources.
- S3 output bucket stores converted and filled artifacts.
- Step Functions orchestrates conversion jobs.
- Lambda container worker performs conversion execution.

## 2) Monitoring and Alerting

### 2.1 Key signals
- API 5xx rate on `/app/api/projects/*` endpoints.
- Step Functions execution failures/timeouts.
- Lambda worker errors and duration percentiles.
- S3 access errors (Put/Get/Delete failures).
- DynamoDB conditional/check failures where unexpected.

### 2.2 Recommended CloudWatch alarms
- Worker `Errors > 0` over short window.
- Worker `Duration` approaching timeout.
- State machine `ExecutionsFailed` > threshold.
- API route 5xx anomaly alarms.
- Optional: DynamoDB throttling alarms.

## 3) Logs and Diagnostics

### 3.1 API logs
- Route handlers log structured failures and auth errors.
- Single-file delete endpoint logs requested id and object deletion counts (guardrail against cascades).

### 3.2 Worker logs
- Conversion flow logs source detection and critical transformation failures.
- SVG/PAGES/AVIF paths should be monitored for regression signatures.
- Preserve error message payloads for user-safe API responses and operator debugging.

### 3.3 Fill PDF logs
- Client-side export path logs contextual step names on failure in dev.
- Persist failures are surfaced as non-fatal warnings after successful local download.

## 4) Common Failure Modes and Troubleshooting

### 4.1 Upload or completion failures
Checklist:
1. Validate presigned URL expiration and method.
2. Check required headers (`Content-Type`) on upload.
3. Verify DynamoDB write permission and key format.

### 4.2 Conversion stuck in processing
Checklist:
1. Confirm Step Functions execution started.
2. Inspect worker Lambda logs for source detection/conversion errors.
3. Verify RAW/OUTPUT bucket object permissions and KMS grants.
4. Validate output row update path did not fail on reserved-name aliasing.

### 4.3 Download URL failures
Checklist:
1. Confirm file row has valid bucket/key.
2. Check object exists in S3 (HEAD).
3. Confirm signed URL TTL and clock drift assumptions.

### 4.4 Filled PDF persistence failed after local download
Checklist:
1. Verify create/upload/complete filled endpoints are reachable.
2. Confirm output bucket policy allows write for app role.
3. Confirm frontend sends bytes as binary payload (not stringified).

## 5) Performance Tuning Knobs

### 5.1 Lambda worker
- `memorySize`: currently configured for mixed conversion workloads; increase for AVIF/PDF-heavy jobs.
- `timeout`: increase if large document/image conversions regularly approach limit.
- architecture: x86_64 chosen for native dependency compatibility.

### 5.2 Concurrency
- Control worker reserved concurrency to protect downstream services.
- Tune Step Functions retry policy for transient AWS errors versus deterministic input failures.

### 5.3 Caching and fetch behavior
- File listing uses `cache: no-store` for consistency.
- Signed URL fetching should be refreshed on expiration-sensitive UI flows.

## 6) Security Checklist
- Keep all buckets private; enforce SSL-only transport.
- Use KMS encryption for raw/output objects.
- Keep presigned URL TTL short and operation-scoped.
- Validate and sanitize user-provided filenames.
- Enforce auth on all project/file endpoints.
- Ensure delete endpoints are key-specific (no prefix deletes for single-item operations).
- Keep SVG sanitization strict against script/XXE/remote fetch vectors.

## 7) Deployment and Rollback Notes
- Deploy infra and app with coordinated env vars.
- Validate canary flows: upload, convert, download, fill PDF, filled artifact persistence.
- Rollback strategy:
  - app rollback for UI/API regressions,
  - infra rollback only after verifying stateful impacts (table/buckets).

## 8) Unknown/Not Found
- Automated alerting configuration files are not present in this repository.
- If alarms are configured externally (Console/Terraform/organization baseline), document them in a future `docs/alerts/` supplement.
