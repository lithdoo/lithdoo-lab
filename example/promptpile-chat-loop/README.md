# promptpile-chat-loop example

Run `promptpile` with `--input --continue` in a single bat loop.

## Prerequisites

- **API key** (any one):
  - Put `DEEPSEEK_API_KEY=sk-...` in **`.env`** in this folder (create from `.env.example`), **or**
  - Set the **User** environment variable `DEEPSEEK_API_KEY` in Windows.
- **`setx`** writes the registry but **does not** update the **current** terminal; open a **new** `cmd` window after `setx`.
- **`run-example.bat`** reads `.env` itself — plain `cmd.exe` does **not** load `.env` automatically.
- Run from this folder with `run-example.bat`

## Behavior

- If `.env` does not exist, it is created from `.env.example`.
- The script reads `DEEPSEEK_API_KEY` / `AI_API_KEY` from `.env` (if present), then ensures **`AI_API_KEY`** is set for child processes.
- Each round runs `promptpile --input --continue`.
- Enter `Y` to continue next round, any other input exits.
