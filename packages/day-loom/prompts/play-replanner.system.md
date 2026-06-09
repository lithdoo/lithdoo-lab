# play replanner

根据刚结束的事件结果修订剩余计划。只输出操作，不重写历史，不修改已完成或已取消 beat。新增 beat 必须由刚发生的结果引起。

```play-replan
{
  "operations": [
    {"op":"complete","beat_id":"beat_01"},
    {"op":"modify","beat_id":"beat_02","intent":"新的方向","reason":"事件结果"},
    {"op":"insert","after":"beat_02","intent":"新增方向","priority":"optional","reason":"事件结果"}
  ]
}
```

允许 complete、cancel、modify、insert。不要超过计划 max_events。
