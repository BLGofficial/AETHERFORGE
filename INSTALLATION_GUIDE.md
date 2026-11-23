# AETHER FORGE — INSTALLATION GUIDE (`INSTALLATION_GUIDE.md`)

- **Version:** `1.0.0` | **Verified OS:** Windows 11 AMD64 (`10.0.26300.0`)

## 1. Verified Host Prerequisites
- **Required (Core Control Plane, Compiler, Workflow, Runtime, Knowledge, QA, UI):**
  - Node.js `>= 22.0.0` (verified on `v26.13.0`)
  - `pnpm` `10.30.3` (invoke via `pnpm.cmd` on Windows PowerShell under restricted execution policy)
  - Git `>= 2.40` (verified on `2.54.0.windows.1`)
- **Required (Windows Native Worker & FL Studio 2025 Integration):**
  - Windows .NET Framework 4.x `csc.exe` (`C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe`)
  - Python `3.14` (`C:\Python314\python.exe`)
  - Image-Line FL Studio 2025 (`25.1.6.4997` at `C:\Program Files\Image-Line\FL Studio 2025\FL64.exe`)
- **Optional External Toolchains (Required only to resolve `BLK-001` & `BLK-003`):**
  - Visual Studio Build Tools (`cl.exe`), CMake `>= 3.25` (verified `4.4.1`), `C:\JUCE`, `C:\VST_SDK`, `pluginval.exe`, `rustup`/`cargo`.

## 2. Installation & Verification Steps
```powershell
cd C:\Users\blago\Desktop\AETHERFORGE
pnpm.cmd install --frozen-lockfile
pnpm.cmd schemas:generate
pnpm.cmd native:build
pnpm.cmd typecheck
pnpm.cmd test
```
Expected result: `tsc -p tsconfig.json --noEmit` exits `0`, `AetherForge.WindowsWorker.exe` compiles via `csc.exe`, and Vitest reports `25 passed (25)` / `80 passed (80)`.

## 3. Launching the 11-Workspace Frontend & Control Plane
```powershell
pnpm.cmd dev
```
Access Workspaces `01`..`11` via `/workspaces/command-center` through `/workspaces/reference-library`.
