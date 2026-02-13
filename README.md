## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Backend Docker 啟動（時區正確）

為了讓 `backend/copilot_logs` 的檔名時間使用「啟動這台電腦的本地時區」，
啟動 backend compose 時請帶入 `HOST_TZ`。

### macOS / Linux

在 `backend/` 目錄執行：

`HOST_TZ=$(node -e "console.log(Intl.DateTimeFormat().resolvedOptions().timeZone)") docker compose up --build -d`

### Windows PowerShell

在 `backend/` 目錄執行：

`$env:HOST_TZ = [System.TimeZoneInfo]::Local.Id; docker compose up --build -d`

### 驗證容器時區（可選）

`docker compose exec travel-planner-copilot sh -lc 'echo TZ=$TZ; node -e "console.log(new Date().toString()); console.log(Intl.DateTimeFormat().resolvedOptions().timeZone);"'`

