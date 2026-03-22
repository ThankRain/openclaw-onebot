let oneBotRuntime: any;

export function setOneBotRuntime(runtime: any) {
  oneBotRuntime = runtime;
}

export function getOneBotRuntime(): any {
  if (!oneBotRuntime) {
    throw new Error("OneBot runtime is not initialized");
  }
  return oneBotRuntime;
}
