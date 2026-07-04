# Custom Domain Routing

This repo is prepared for a custom domain without Firebase Hosting. Cloud Run
continues to host the landing, frontend, and backend services. Cloud DNS owns
the public DNS zone, and a global external Application Load Balancer owns TLS,
HTTPS host/path routing, and HTTP to HTTPS redirect.

Target routing for the main app:

```text
https://<domain>/           -> Cloud Run research-landing
https://www.<domain>/       -> Cloud Run research-landing
https://app.<domain>/       -> Cloud Run customer-portal
https://app.<domain>/api    -> Cloud Run general-ai-agent
https://app.<domain>/api/*  -> Cloud Run general-ai-agent
```

The load balancer should pass paths through unchanged. The NestJS backend
already exposes routes under the `/api` global prefix, so no URL rewrite is
required for `/api` or `/api/*`.

## Repository Configuration

No custom-domain origin variable is required for the main
`customer-portal` / `general-ai-agent` pair. The production frontend build uses
the same-origin API path `/api`, and the load balancer routes that path on the
`app.<domain>` host to the backend. Browser traffic through
`https://app.<domain>/api` is therefore same-origin and does not require a
custom-domain CORS entry.

Recommended rollout order for a fresh environment:

1. Deploy the backend service once.
2. Deploy the frontend service once.
3. Deploy the landing service once.
4. Run `.github/workflows/custom-domain-bootstrap.yml`.
5. Copy the printed Cloud DNS name servers into the domain registrar. This is
   the only required manual DNS step when the domain delegates to Google.
6. Wait for NS delegation and the Google-managed certificate to become active.

The production frontend calls `/api`, so direct `run.app` frontend URLs are no
longer the target API smoke-test path for the custom-domain build. The landing
page links to `https://app.idealab.expert` in the current production workflow.
Before DNS is ready, use explicit Host-header curl checks against the load
balancer IP rather than normal browser testing, because the managed certificate
is issued for the domain names.

## Google Cloud Setup

The one-time DNS and load balancer setup is performed by
`.github/workflows/custom-domain-bootstrap.yml`. Run it after the landing,
frontend, and backend Cloud Run services exist.

The workflow creates or reuses:

- a public Cloud DNS managed zone for `domain`,
- `A` records for `domain`, `www.<domain>`, and `app.<domain>`,
- a global static Premium tier IPv4 address,
- one regional serverless NEG for `research-landing`,
- one regional serverless NEG for `customer-portal`,
- one regional serverless NEG for `general-ai-agent`,
- global backend services for all NEGs,
- a global URL map with root/www routed to landing, `app.<domain>` routed to
  the frontend service, and `/api` plus `/api/*` on the app host routed to the
  backend service,
- a Google-managed global SSL certificate for `domain`, `www.<domain>`, and
  `app.<domain>`,
- a redirect URL map for HTTP to HTTPS,
- global target HTTP and HTTPS proxies,
- global forwarding rules on ports `80` and `443`.

The workflow is a bootstrap and repair helper, not a full declarative
reconciler. It creates missing resources and updates the HTTP redirect URL map,
but existing serverless NEGs, HTTPS URL map path matchers, SSL certificate
domains, proxies, and forwarding rules are not fully reconciled when the domain
changes. For a different domain after first setup, replace the affected
`rosellas-main-*` GCP resources deliberately.

Required permissions for the GitHub deployer are the existing deploy roles plus
Cloud DNS and Compute permissions for domain and load balancer resources. Use
project owner/editor for a one-off run, or grant these roles to
`GCP_SERVICE_ACCOUNT`:

```text
roles/dns.admin
roles/compute.networkAdmin
roles/compute.instanceAdmin.v1
roles/compute.securityAdmin
```

Run the workflow with:

```text
domain=<domain>
```

The `domain` value must be the root domain, for example `example.com`, without
scheme, path, or `www`. The workflow automatically configures
`example.com`, `www.example.com`, and `app.example.com`.

The workflow enables the required Compute Engine and Cloud DNS APIs, then
prints the Cloud DNS name servers. Set those NS values at the registrar for
`domain`. The workflow also writes `A` records in Cloud DNS for every
certificate domain, pointing them at the load balancer IP. After NS delegation
propagates, the Google-managed certificate can become active. Plain HTTP
requests are redirected to HTTPS with a `301` response.

Keep Cloud Run service ingress compatible with load balancer traffic. The
current workflows leave the services public with `--allow-unauthenticated`,
which works for both direct Cloud Run URLs and the load balancer.

If the load balancer becomes the only intended public entrypoint, harden Cloud
Run later by changing service ingress to `internal-and-cloud-load-balancing` and
disabling direct `run.app` URLs where appropriate. Do that only after the domain
path routing is verified.
