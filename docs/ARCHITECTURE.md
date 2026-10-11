# Atelier — Architecture

> [!NOTE]
>
> This covers the infrastructure and the design decisions behind it. The
> bird's eye view is in the project [README](../README.md); the upload app's
> code is the source of truth for its own behavior.

## Context

Atelier hosts static sites (typically LLM/agent-produced HTML/CSS/JS). A user
drags a `.zip` onto a page, supplies a slug, and the site goes live at
`<slug>.artsy.dev` within seconds. Access to _everything_ — the uploader and
every hosted site — is gated to verified Artsy users; once in, anyone may
overwrite any slug after confirming intent.

Hosted sites live flat under `*.artsy.dev`, not nested under
`*.atelier.artsy.dev`. The nested wildcard hit a Cloudflare TLS limit (free
Universal SSL covers only one wildcard level). `atelier.artsy.dev` (the app)
and every `<slug>.artsy.dev` (a hosted site) are single-level subdomains of the
one `artsy.dev` zone. This is the permanent design.

## Overview

```
 verified user
   │  (SSO via Cloudflare Access — one application over the whole zone)
   ▼
 Cloudflare (DNS proxied, wildcard TLS, Access JWT)
   ├── atelier.artsy.dev            → origin: Next.js upload app (k8s via Hokusai)
   └── *.artsy.dev                  → origin: CloudFront distribution
                                            │ CloudFront Function: Host → S3 prefix
                                            ▼
                                        S3  artsy-atelier  (private, OAC)
                                          braze-dash/  price-game/  …
   Upload app  ── writes (delete-then-put under slug/) ──►  S3
```

S3 is the source of truth, with one prefix per slug and no database. The
slug ↔ folder ↔ subdomain mapping is 1:1. Who uploaded a site, and when, is
stored as S3 object metadata (`x-amz-meta-uploaded-by`, `x-amz-meta-uploaded-at`).

## 1. Auth & DNS — Cloudflare Access

- One Cloudflare Access application, "Atelier", has the destination
  `*.artsy.dev`, which covers `atelier.artsy.dev` and every hosted site. It has
  two policies: "All employees" (Allow) and a service token policy (Service
  Auth) for programmatic access.
- The upload app reads the uploader's identity from the
  `Cf-Access-Authenticated-User-Email` header, falling back to `X-Requested-By`
  for service-token callers, and records it as upload metadata.
- Cloudflare provides wildcard TLS for `*.artsy.dev` (free Universal SSL, since
  it's a single wildcard level). The zone's encryption mode is Full (strict), so
  the CloudFront origin must present a valid certificate (see §2).
- DNS records (proxied unless noted):
  - `atelier.artsy.dev` → the upload app's k8s ingress.
  - `*.artsy.dev` → the CloudFront distribution.
  - `atelier-staging` and `next` → the staging ingress; `gallery` → a
    Cloudflare Worker. Explicit records win over the wildcard, so these names
    can never serve a hosted site.
  - Two DNS-only CNAMEs with `_`-prefixed names appear to be ACM certificate
    validation records. Keep them so the certificate can renew.
  - `www`, `upload`, `uploads`, `admin` and the `artsy.dev` apex → 301
    redirect to `atelier.artsy.dev` (Cloudflare Redirect Rules).
  - Reserved slugs are listed in `src/lib/slug.ts`.
- The `artsy.dev` zone is delegated to Cloudflare nameservers.

**Why a separate domain (`artsy.dev`, not under `artsy.net`).** Uploaded sites
run arbitrary, LLM-authored JS. On `artsy.net` that JS would be _same-site with
all of Artsy production_: able to read any `Domain=.artsy.net` cookie and to
_set_ `.artsy.net` cookies (session fixation). `artsy.dev` is a different
eTLD+1, which severs that relationship, so uploaded content cannot touch any
`artsy.net` cookie. The `.dev` TLD is also HSTS-preloaded. Sites still share
`.artsy.dev` with each other, which is accepted under the "anyone can overwrite
anyone" model.

## 2. Serving — CloudFront + S3, no server

- A single CloudFront distribution with alternate domain name `*.artsy.dev` and
  a wildcard ACM cert (must be in **us-east-1** for CloudFront).
- A **CloudFront Function** (viewer-request) maps host to prefix. It routes by
  URL _shape_, since a viewer function has no network access and cannot check
  whether an S3 key exists:
  - take the leftmost label of the `Host` header as `slug`;
  - path has a **file extension** → serve the exact key `slug<path>`;
  - path **ends in `/`** → append `index.html` (MPA directory index);
  - otherwise (a client-side route) → serve `slug/index.html` (**SPA
    fallback**).
- This serves SPAs, and MPAs that use `.html` files or trailing-slash directory
  URLs. MPAs with "clean URLs" (`/about` expecting `about/index.html`) are
  unsupported. If that's needed, upgrade the function to a Lambda@Edge
  origin-request handler that does a real S3 existence check.
- The origin is S3 via **Origin Access Control (OAC)**. The bucket has Block
  Public Access fully on and no website hosting, and a bucket policy scopes
  `s3:GetObject` to this distribution.
- CloudFront is somewhat redundant given Cloudflare is already CDN, TLS and
  Access. A Cloudflare Worker reading S3 directly could replace it. We keep
  CloudFront so that serving logic stays in AWS and S3 stays private via OAC.

## 3. Upload app — Next.js

A Next.js (Pages Router, TypeScript) app on the existing Artsy Kubernetes
cluster via Hokusai, behind the shared nginx ingress. Secrets are injected by
**Fortress** via a `setenv` init container (see `hokusai/*.yml`).

`POST /api/upload` (multipart: slug + zip):

1. **Validate the slug**: lowercase, DNS-label-safe, not on the reserved list.
2. **Parse and validate the zip**: the archive is parsed as a stream
   (`unzipper`), and anything that fails to parse is rejected. One cap,
   `MAX_UPLOAD_BYTES`, applies to both the upload size and the total extracted
   size. Entries with `..`, absolute or null-byte paths are rejected
   (**zip-slip**). Extracted contents are held in memory until uploaded. macOS
   junk (`__MACOSX`, `.DS_Store`, `._*`) is dropped, and a single wrapping
   folder is collapsed so `index.html` lands at the site root.
3. **Overwrite = replace, not merge**: if `slug/` has objects and the request
   isn't confirmed, return a 409 with the previous uploader and time so the UI
   can prompt. On confirm, delete all keys under `slug/`, then upload.
4. **Upload** each file to `slug/<path>` with a correct `Content-Type`
   (`mime-types`), `Cache-Control: no-cache`, and the uploader metadata.
5. **Invalidate** the CloudFront path `/slug/*`. A failed invalidation is
   logged but does not fail the upload.

`GET /api/check?slug=` reads the uploader metadata from a `HEAD` on the slug's
`index.html`, which drives the warn-before-overwrite prompt.

## 4. Caching — freshness without a build step

Users iterate on a design with repeated uploads to the same slug, so stale
assets are the main hazard. We want to avoid asset fingerprinting and any build
step:

- **Every object is uploaded with `Cache-Control: no-cache`.** This does _not_
  mean "don't cache". Caches may store the object but must revalidate before
  reusing it. Revalidation uses S3's `ETag`: unchanged assets return a bodiless
  `304`, and after an overwrite the ETag changes so the next request pulls
  fresh bytes.
- **CloudFront uses the `Managed-CachingOptimized` cache policy** (minimum TTL
  1 s, default 24 h). The `no-cache` header makes the effective TTL the 1 s
  minimum, so the edge serves a cached copy for up to a second before
  revalidating. An object stored without a `Cache-Control` header would instead
  be cached for the 24 h default; every upload from the app sets the header.
  Cloudflare does not cache a site's HTML (`cf-cache-status: DYNAMIC`); its
  caching of static assets has not been checked. HTML responses through
  Cloudflare carry no `ETag`, so browsers refetch HTML in full, which costs
  bandwidth only.
- **`/slug/*` is invalidated on each overwrite**, so the edge drops copies of
  the previous version immediately. A wildcard counts as a single invalidation
  path. If an invalidation fails (logged, not fatal), stale content can be
  served for about a second.
- The cost is a conditional round-trip per asset, which is a non-issue for
  low-traffic internal sites. A site that wants long-lived caching can opt into
  fingerprinted filenames on its own.

## Risks & open considerations

1. **Origin lock (hardening, tracked in #150).** Cloudflare Access enforces at
   the Cloudflare edge. The CloudFront origin should accept only requests that
   came through Cloudflare. The plan is for Cloudflare to add a secret header
   and for the CloudFront function (or a WAF rule) to reject requests without
   it.
2. **Request body limits.** Cloudflare may cap request body size depending on
   the plan, rejecting larger uploads at the edge. The ingress sets
   `proxy-body-size: 50m` and 300s read/send timeouts to match the app's
   default `MAX_UPLOAD_BYTES` of 50 MB. If larger sites are needed, switch to
   presigned direct-to-S3 uploads.
3. **Non-atomic replace.** A failure mid-upload leaves the old content deleted
   and the new content partially written. This is an accepted tradeoff against
   the more complex put-all-then-delete-orphans ordering.
