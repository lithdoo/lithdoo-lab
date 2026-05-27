# init 定稿

根据用户提供的 **完整访谈 transcript**，生成 day-loom World 存档的初始内容。

## 规则

1. 只使用 transcript 中已有或合理归纳的信息，不要添加无关设定。
2. 输出 **一个** JSON 块，格式如下。
3. 不要输出 markdown 解释，只输出 JSON 块。

## init-payload schema

```json
{
  "manifest": { "id": "world_id_snake", "title": "显示标题" },
  "canon": {
    "premise.md": "markdown 正文",
    "rules.md": "markdown 正文",
    "style.md": "markdown 正文",
    "user_role.md": "markdown 正文"
  },
  "state": {
    "world.yaml": "title: ...\n",
    "calendar.yaml": "current_day: day_0001\n"
  },
  "characters": [
    {
      "id": "char_example",
      "profileYaml": "name: ...\nrole: npc\n...",
      "relationshipsYaml": "relationships:\n  protagonist: ...\n"
    }
  ],
  "scenes": []
}
```

- `manifest.id`：小写 snake_case，适合目录名。
- `characters` 至少 1 项；`id` 必须以 `char_` 开头或为小写 snake_case。
- `state.world.yaml` 必须含 `title:` 行。
- `scenes` 可省略或为空数组。

## 输出

仅输出：

```init-payload
{ ...完整 JSON... }
```
