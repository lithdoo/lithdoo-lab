@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

REM cmd.exe does not auto-load .env; read API keys from .env in this folder if present.
if exist ".env" (
  for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do (
    if not "%%a"=="" (
      if /i "%%a"=="DEEPSEEK_API_KEY" if not "%%b"=="" set "DEEPSEEK_API_KEY=%%b"
      if /i "%%a"=="AI_API_KEY" if not "%%b"=="" set "AI_API_KEY=%%b"
      if /i "%%a"=="AI_MODEL" if not "%%b"=="" set "AI_MODEL=%%b"
      if /i "%%a"=="AI_API_BASE_URL" if not "%%b"=="" set "AI_API_BASE_URL=%%b"
      if /i "%%a"=="PROMPTPILE_MCP_TOKEN" if not "%%b"=="" set "PROMPTPILE_MCP_TOKEN=%%b"
      if /i "%%a"=="PROMPTPILE_MCP_BASE_URL" if not "%%b"=="" set "PROMPTPILE_MCP_BASE_URL=%%b"
    )
  )
)

REM promptpile defaults to OpenAI base URL; align with promptpile-chat-loop when unset
if not defined AI_API_BASE_URL set "AI_API_BASE_URL=https://api.deepseek.com/v1"

REM MCP gateway port — keep in sync with example/promptpile-mcp-launcher/mcp.toml [gateway].port
set "MCP_PORT=8765"
set "MCP_BASE_URL=http://127.0.0.1:%MCP_PORT%"
REM after-hook / exec-calls（可与 .env 覆盖）；promptpile 子进程继承
if not defined PROMPTPILE_MCP_BASE_URL set "PROMPTPILE_MCP_BASE_URL=%MCP_BASE_URL%"
set "MAX_STEP=8"
if not "%PROMPTPILE_REACT_MAX_STEP%"=="" set "MAX_STEP=%PROMPTPILE_REACT_MAX_STEP%"
set "MODEL=deepseek-chat"
if not "%AI_MODEL%"=="" set "MODEL=%AI_MODEL%"

if not defined AI_API_KEY if defined DEEPSEEK_API_KEY set "AI_API_KEY=!DEEPSEEK_API_KEY!"
if not defined AI_API_KEY (
  echo [ERROR] No API key. Set DEEPSEEK_API_KEY or AI_API_KEY in User env, or add DEEPSEEK_API_KEY to ".env" here.
  echo If you used setx, open a NEW terminal ^(setx does not update the current session^).
  exit /b 1
)

if not exist "%~dp0..\node_modules" (
  echo Installing dependencies in example\ ...
  pushd "%~dp0.."
  call npm install
  if errorlevel 1 (
    popd
    echo npm install failed.
    exit /b 1
  )
  popd
)

REM --- Step 1: gateway ready or start launcher ---
curl -sf "%MCP_BASE_URL%/health" >nul 2>&1
if not errorlevel 1 goto step2_setup

echo MCP gateway not reachable at %MCP_BASE_URL%.
netstat -an | findstr ":%MCP_PORT%" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo WARNING: Port %MCP_PORT% is listening but /health failed - another process may own it.
)

echo Starting promptpile-mcp-launcher in a new window...
start "promptpile-mcp-launcher" /D "%~dp0..\promptpile-mcp-launcher" cmd /k call run-example.bat

set WAIT_COUNT=0
:poll_launch
curl -sf "%MCP_BASE_URL%/health" >nul 2>&1
if not errorlevel 1 goto step2_setup
set /a WAIT_COUNT+=1
if !WAIT_COUNT! GEQ 31 (
  echo ERROR: Gateway did not become healthy within ~62s. Check the launcher window.
  exit /b 1
)
timeout /t 2 /nobreak >nul
goto poll_launch

:step2_setup
echo MCP gateway OK: %MCP_BASE_URL%

if not exist "messages" mkdir "messages"

if not exist "messages\.react.core.md" if exist ".react.core.md" copy /y ".react.core.md" "messages\.react.core.md" >nul
if not exist "messages\.react.observe.md" if exist ".react.observe.md" copy /y ".react.observe.md" "messages\.react.observe.md" >nul
if not exist "messages\.react.final.md" if exist ".react.final.md" copy /y ".react.final.md" "messages\.react.final.md" >nul

if not exist "messages\[0]system.md" (
  > "messages\[0]system.md" echo You are a helpful assistant. Reply in Chinese.
)

set "TOKEN_ARG="
if not "%PROMPTPILE_MCP_TOKEN%"=="" set "TOKEN_ARG=--token %PROMPTPILE_MCP_TOKEN%"

echo Exporting messages\.tools.toml ...
call npx --prefix "..\..\packages\promptpile-mcp" promptpile-mcp export-tools --base-url "%MCP_BASE_URL%" -o "messages\.tools.toml" %TOKEN_ARG%
if errorlevel 1 (
  echo export-tools failed.
  exit /b 1
)

REM --- Step 3: promptpile-react input + continue loop ---
set "EXTRA_B="
if defined AI_API_BASE_URL set "EXTRA_B=-b !AI_API_BASE_URL!"

echo.
echo Starting promptpile-react ^(-i -c^). User input: type message then Ctrl+Z Enter ^(Windows^) to submit each round. Ctrl+C to exit.
echo.

call npx --prefix "..\..\packages\promptpile-react" promptpile-react -i -c -d messages --tools-file messages\.tools.toml --max-step !MAX_STEP! -m "!MODEL!" -k "!AI_API_KEY!" --after-hook-path "%~dp0after-hook-mcp-exec-calls.bat" !EXTRA_B!
set "ERR=!ERRORLEVEL!"

echo.
echo After-hook attempts exec-calls when Thought emits tool_calls ^(gateway must stay up^). Manual retry:
echo   npx --prefix "..\..\packages\promptpile-mcp" promptpile-mcp exec-calls --base-url "%MCP_BASE_URL%" --dir "%CD%\messages" %TOKEN_ARG%

exit /b !ERR!
