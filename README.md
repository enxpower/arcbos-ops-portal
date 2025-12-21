# ARCBOS Ops Portal (Static / GitHub Pages)

A lightweight, audit-friendly operations portal for ARCBOS Phase 1 (SnowBot).
No backend. No database. No build tools. Data is version-controlled JSON under `/data`.

## What this portal manages

1) BOM Tree  
2) Parts Master (SKU discipline, revisions, alternates, lifecycle)  
3) Supplier Master (scoring, risk tags, supplied parts mapping)  
4) Change Log (ECR/ECO traceability to parts + BOM nodes)

## Non-goals (explicit)
- No accounts / login
- No backend services
- No file uploads
- No private data ingestion
- No external data APIs
- No China-hosted servers or China APIs (project constraint)

## Repo structure

- `/index.html` Dashboard landing
- `/pages/*.html` Feature pages
- `/css/main.css` Minimal "engineering system" styling
- `/js/*.js` Plain JavaScript modules (no bundler)
- `/data/*.json` Source of truth data

## Deploy to GitHub Pages

1. Create a GitHub repo, commit all files to the default branch.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose:
   - Source: `Deploy from a branch`
   - Branch: `main` (or your default branch), folder: `/ (root)`
4. Save. GitHub Pages will publish your site.

## Local development

### Option A (recommended): local static server
Some browsers block `fetch()` for JSON when opening files via `file://`.
Use a local server instead:

#### Python
```bash
python -m http.server 8000
Open:

http://localhost:8000/

Node (if you already have it, not required)
npx serve .

Option B (best-effort): open via file://

You may be able to open index.html directly, but JSON fetch() may fail depending on browser policy.

How to maintain (edit data, not code)

All operational edits should be done by modifying JSON files under /data:

data/bom.json — BOM tree nodes

data/parts.json — Parts master

data/suppliers.json — Supplier master and scoring

data/changes.json — ECR/ECO log

data/rules.json — SKU layers, status machine, scoring weights, validation rules, and metadata

Recommended workflow:

Create a branch for changes

Edit JSON files only

Open a PR for review

Merge to main to publish

Data auditing principles

The portal renders what is in JSON (source of truth).

Changes must be tracked through git history.

Use ECR/ECO entries to tie together:

part revision changes

supplier changes

BOM node changes

Support

This is intentionally minimal. If you need:

role-based access control

approvals workflow

private data storage

That becomes a different product (requires a backend).
