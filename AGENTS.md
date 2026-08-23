# Personal Site Guidance

## Purpose

This repository is the user's personal website: an expressive "Internet Playground" for toy/Vibe Coding work, while presenting serious work with equal clarity and credibility.

## Visual and content principles

- Preserve the playful, young, outward-facing character; do not flatten it into generic SaaS or portfolio styling.
- Serious work belongs within the same visual world. Do not reintroduce a disconnected full-black page.
- Describe projects from verified source material only. Never turn a prototype, private experiment, or internal work into a public launch, adoption claim, or business result.

## Local implementation and Git autonomy

- Agents may improve front-end code and run local/browser verification without asking again.
- Agents may make focused Git commits for those local front-end changes after checking the diff and working tree.
- Keep commits small and descriptive. Preserve user-owned changes and never reset, clean, force-push, or rewrite history without explicit permission.
- Track source files and intentional reusable assets. Do not track generated `artifacts/`, deployment archives, dependencies, logs, `.env` files, certificates, private keys, or credentials.

## Verification

- For visible UI changes, check desktop and mobile layouts, avoid page-level horizontal overflow, and inspect console/network errors where practical.
- Keep the static site runnable without an unnecessary build system unless the user approves a technology change.

## Cloud and deployment approval gate

- Treat uploads to the server, package installation, Nginx/service changes, DNS, TLS, domain purchases, ICP/public-security filing, and security-group changes as cloud state changes.
- Before any such change, state the exact target, expected impact, rollback/recovery path, and wait for the user's explicit confirmation.
- If the user explicitly authorizes a concrete cloud change, agents may perform that exact scoped change and verify the result. Do not broaden the authorization.
- Prefer read-only server checks until approval. Never inspect, print, copy, or transmit AccessKey secrets, private keys, passwords, cookies, browser profiles, or credential files.

## Network baseline

- Public web traffic may use 80 and, after certificate setup, 443.
- Do not expose database, cache, management-panel, or arbitrary application ports publicly.
- SSH/RDP management access must be restricted to trusted sources or replaced by Workbench/session management; changes require approval.

## Domain and mainland-hosting rules

- The origin is a Chinese-mainland ECS. Do not point a new domain at it until the domain's ICP eligibility and filing are complete.
- After ICP approval, configure DNS, Nginx `server_name`, HTTPS, HTTP-to-HTTPS redirect, and the filing footer as a deliberate approved release.
