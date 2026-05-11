@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo Synced .env from .env.example
)

REM cmd.exe does not auto-load .env; read KEY=value lines into environment (same folder as this bat).
if exist ".env" (
  for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do (
    if not "%%a"=="" (
      if /i "%%a"=="DEEPSEEK_API_KEY" if not "%%b"=="" set "DEEPSEEK_API_KEY=%%b"
      if /i "%%a"=="AI_API_KEY" if not "%%b"=="" set "AI_API_KEY=%%b"
    )
  )
)

if not defined AI_API_KEY if defined DEEPSEEK_API_KEY set "AI_API_KEY=!DEEPSEEK_API_KEY!"
if not defined DEEPSEEK_API_KEY if defined AI_API_KEY set "DEEPSEEK_API_KEY=!AI_API_KEY!"

if not defined AI_API_KEY (
  echo [ERROR] No API key found.
  echo Add DEEPSEEK_API_KEY or AI_API_KEY to ".env" in this folder, OR set User env DEEPSEEK_API_KEY.
  echo If you used setx, open a NEW cmd window ^(setx does not update the current session^).
  exit /b 1
)

if not exist "messages" mkdir "messages"
if not exist "messages\[0]system.md" (
  > "messages\[0]system.md" echo You are a helpful assistant. Reply in Chinese.
)

if not exist "..\..\node_modules" (
  echo Installing dependencies in repo root...
  pushd "..\.."
  call npm install
  if errorlevel 1 (
    popd
    echo npm install failed.
    exit /b 1
  )
  popd
)

echo Starting promptpile chat loop (DeepSeek)...
echo Input ends with Ctrl+Z then Enter.

:loop
echo.
echo ---- New Round ----
call npx --prefix "..\..\packages\promptpile" promptpile --input --continue
if errorlevel 1 (
  echo [ERROR] promptpile failed.
  exit /b 1
)

set /p AGAIN=Continue? (Y/N):
if /I "!AGAIN!"=="Y" goto loop

echo Bye.
exit /b 0
