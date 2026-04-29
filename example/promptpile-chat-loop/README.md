# promptpile-chat-loop example

Run `promptpile` with `--input --continue` in a single bat loop.

## Prerequisites

- Set user environment variable: `DEEPSEEK_API_KEY`
- Run from this folder with `run-example.bat`

## Behavior

- If `.env` does not exist, it is created from `.env.example`.
- The script injects `AI_API_KEY` from `%DEEPSEEK_API_KEY%`.
- Each round runs `promptpile --input --continue`.
- Enter `Y` to continue next round, any other input exits.
