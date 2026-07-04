# Google Observability

This project uses the cost-safe Google Cloud Observability baseline that is built
around Cloud Run managed services:

- Cloud Run built-in metrics for every deployed service.
- Cloud Logging for stdout/stderr and structured application logs.
- Error Reporting from structured error log entries.
- Cloud Monitoring and Cloud Trace APIs enabled for native Cloud Run views and
  future low-volume diagnostics.

The implementation intentionally does not emit custom metrics, Prometheus
samples, or custom OpenTelemetry spans. Those can be useful later, but they are
not part of the free baseline and can become billable by ingestion volume or
sample count.

## Implemented

NestJS services (`general-ai-agent` and `crud-backend`) use a Cloud Run JSON
logger:

- `severity` is mapped for Cloud Logging.
- `serviceContext` includes the Cloud Run service and deployed revision or Git
  SHA for Error Reporting grouping.
- `x-cloud-trace-context` is propagated into `logging.googleapis.com/trace`
  when `GOOGLE_CLOUD_PROJECT` is set.
- A global exception filter reports only HTTP 5xx/unhandled exceptions to Error
  Reporting. 4xx responses are left to Cloud Run request logs.
- Request bodies are not logged.

The TRIZ MCP server uses JSON logging for Python and logs tool exceptions with
stack traces so Cloud Logging can surface them in Error Reporting.

`LOG_LEVEL` defaults to `INFO` in local env examples and Cloud Run deploy
workflows. Use `WARNING` during demos if log volume needs to be minimized.

## Enabled APIs

The infra bootstrap workflow enables:

- `logging.googleapis.com`
- `monitoring.googleapis.com`
- `clouderrorreporting.googleapis.com`
- `cloudtrace.googleapis.com`

Cloud Run still provides built-in logs and metrics, but enabling the APIs makes
the observability console surfaces explicit in new projects.

## Console Checks

Use the project links in `docs/google-infra-links.md`, then check:

- Cloud Run service Metrics tab for request count, latency, CPU, memory, and
  instance count.
- Logs Explorer for structured application logs.
- Error Reporting for grouped 5xx/unhandled exceptions.

Useful Logs Explorer filters:

```text
resource.type="cloud_run_revision"
resource.labels.service_name="general-ai-agent"
jsonPayload.service="general-ai-agent"
```

```text
resource.type="cloud_run_revision"
severity>=ERROR
jsonPayload."@type"="type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent"
```

```text
resource.type="cloud_run_revision"
resource.labels.service_name="triz-mcp-server"
jsonPayload.logger="app.tools.contradictions"
severity>=ERROR
```

## Cost Guardrails

- Keep `LOG_LEVEL=INFO` or `WARNING`; avoid debug logs in Cloud Run.
- Do not log full chat histories, prompts, request bodies, secrets, or raw tool
  payloads.
- Prefer Cloud Run built-in metrics before adding custom metrics.
- Do not add OpenTelemetry metrics/traces without sampling and a cost estimate.
- Do not create metric alerting policies automatically. Review current Google
  Cloud Observability pricing first, because alerting policy pricing changes
  are scheduled for 2026-08-01.

Firebase Performance Monitoring and Cloud Profiler are not enabled in this
baseline. Firebase Performance requires project-specific Firebase web app
configuration, and Cloud Profiler requires runtime agents/dependencies. Add them
only after deciding that the extra instrumentation is needed.
