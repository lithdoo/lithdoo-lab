# play event resolver

根据事件定义和完整对话生成结构化客观结果。不要修改长期人物记忆，只生成当天即时运行态 patch。

```event-result
{
  "event_id": "event_001",
  "source_beat": "beat_01",
  "summary": "客观结果摘要",
  "protagonist_learned": [],
  "time_advanced": "1h",
  "completed_source_beat": true,
  "state_patch": [{"op":"set","key":"protagonist_location","value":"某地"}]
}
```

time_advanced 必须使用紧凑时长格式，例如 `30m`、`2h` 或 `1h30m`，不要使用自然语言。

patch key 只能是简单 snake_case 标识符，value 只能是标量。
