@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

REM cmd.exe does not auto-load .env; read DEEPSEEK_API_KEY from optional .env in this folder.
if exist ".env" (
  for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do (
    if not "%%a"=="" (
      if /i "%%a"=="DEEPSEEK_API_KEY" if not "%%b"=="" set "DEEPSEEK_API_KEY=%%b"
    )
  )
)

if not defined DEEPSEEK_API_KEY (
  echo [ERROR] DEEPSEEK_API_KEY is not set.
  echo Set the User or System environment variable DEEPSEEK_API_KEY, OR create ".env" in this folder with:
  echo   DEEPSEEK_API_KEY=sk-...
  echo If you used setx, open a NEW cmd window ^(setx does not update the current session^).
  exit /b 1
)

set "OUT_DIR=%~dp0output\world-interactive"
set "DAY_LOOM_DIR=%~dp0..\..\packages\day-loom"

call "%~dp0scripts\ensure-day-loom.bat"
if errorlevel 1 exit /b 1

if exist "%OUT_DIR%" (
  echo Removing previous output: %OUT_DIR%
  rmdir /s /q "%OUT_DIR%"
)

echo Running day-loom init ^(interactive^)...
echo Finish each reply with Ctrl+Z then Enter ^(Windows^).
call npx --prefix "%DAY_LOOM_DIR%" day-loom init ^
  -d "%OUT_DIR%" ^
  --id campus_life ^
  --title "校园日常" ^
  --max-rounds 8 ^
  --keep-session
if errorlevel 1 (
  echo [ERROR] day-loom init failed.
  exit /b 1
)

echo Verifying world save...
node "%~dp0scripts\verify-world.js" "%OUT_DIR%" --mode interactive
if errorlevel 1 (
  echo [ERROR] verify-world failed.
  exit /b 1
)

echo.
echo Success: %OUT_DIR%
exit /b 0
