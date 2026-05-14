# example.sh — 仅作文档：列出 promptpile 与 example.toml [promptpile] 对齐的命令行写法（= 连接值）。
# 不执行。复制时去掉每行行首的「# 」并拼成一条命令（续行符 \ 须位于行末且无尾随空格）。
#
# promptpile \
#   --config=example.toml \
#   --directory=./message \
#   --format=text \
#   --output=./message/promptpile-example-output.md \
#   --after-hook-path=./after_hook.sh \
#   --tool-choice=auto \
#   --tools-file=./.tools.toml \
#   --input \
#   --system-inject-file=./test.md \
#   --model= \
#   --api-key= \
#   --api-base-url=
#
# 各参数含义（与 example.toml 字段对应）：
# --config=example.toml — 单独指定 TOML 配置文件。
# --directory=./message — dir，消息扫描目录。
# --format=text — format，输出 text 或 json。
# --output=./message/promptpile-example-output.md — output 写文件路径（TOML 为 true 时请改为具体路径）。
# （quiet=false 不传 --quiet；为 true 时追加 --quiet）
# --after-hook-path=./after_hook.sh — after_hook，成功后脚本路径（CLI 相对 cwd）。
# --tool-choice=auto — tool_choice。
# --tools-file=./.tools.toml — tools_file（CLI 相对 cwd）；仅 .toml，文件内可写 extends
# （disable_tool=false 不传 --disable-tool；为 true 时追加 --disable-tool）
# （continue=false 不传 --continue；为 true 时追加 --continue）
# --input — input=true，终端读入用户消息（无 = 值）。
# --system-inject-file=./test.md — system_inject_file。
# --model= — llm_api_model，可与 toml 中 llm_api 所选 profile 合并。
# --api-key= — llm_api_key。
# --api-base-url= — llm_api_base_url。
# （llm_api 选用哪档 profile、llm_api_key_env 从其它环境变量名取密钥：无单独 CLI 时由 --config 读 TOML 或见 example.env 中 PROMPTPILE_LLM_*）
