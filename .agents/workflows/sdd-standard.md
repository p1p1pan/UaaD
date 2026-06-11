---
description: Global Execution Guidelines: Specification-Driven Development (SDD)
---

# Global Execution Guidelines: Specification-Driven Development (sdd-standard)

As an agent operating within this project, your primary source of truth is the project documentation. Please adhere to the established business boundaries.

## 1. Pre-requisite Checks (Hard Blocking)
- **Required Reading**: Before implementing any structural or logic changes, you **must** call the file reading tool to load `docs/SRS.md`, `docs/SYSTEM_DESIGN.md`, and `docs/DDL.md`.
- **Scope Verification**: If a requested feature (e.g., a new endpoint, a new database field) is not documented, please notify the user that it breaks the SDD methodology and request that the `SRS.md` be updated first.

## 2. Environment and Tooling Usage (Toolchain Mastery)
Please coordinate with the existing environment tools:
- Utilize `run_command` to install dependencies and run automated builds when necessary.
- You may execute database schema generation, configure network proxies, or scaffold code directly via CLI to reduce unnecessary human multi-turn interactions.

## 3. Verification Requirements (Evidence Delivery)
Upon completion, please provide concrete verification of the implemented code:
- **API Delivery**: Use `curl`, `go test`, or another HTTP client to send a real request, capturing a `200 OK` response that adheres to the API contract.
- **UI Delivery**: Start the local development server in the terminal and provide snapshot links or logs in `docs/walkthrough.md`.

## 4. Source of Truth
- Project documentation source of truth lives under `docs/` and `frontend/FRONTEND_SPEC.md`.
- Team-maintained AI workflow source of truth lives under `.agents/`.
- If tool-specific prompt files also exist elsewhere in the repo, treat them as compatibility layers unless the task explicitly requires tool-specific behavior.
