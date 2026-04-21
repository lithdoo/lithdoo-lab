/** 由宿主注入：将模型 tool 调用落到真实实现（占位阶段无默认实现）。 */
export interface ToolExecutor {
  execute(name: string, argumentsJson: string): Promise<string> | string;
}
