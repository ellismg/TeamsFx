<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@microsoft/teamsfx-api](./teamsfx-api.md) &gt; [UserInteraction](./teamsfx-api.userinteraction.md) &gt; [runWithProgress](./teamsfx-api.userinteraction.runwithprogress.md)

## UserInteraction.runWithProgress() method

A function to run a task with progress bar. (CLI and VS Code has different UI experience for progress bar)

<b>Signature:</b>

```typescript
runWithProgress<T>(task: RunnableTask<T>, config: TaskConfig, ...args: any): Promise<Result<T, FxError>>;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  task | [RunnableTask](./teamsfx-api.runnabletask.md)<!-- -->&lt;T&gt; | a runnable task with progress definition |
|  config | [TaskConfig](./teamsfx-api.taskconfig.md) | task running confiuration |
|  args | any | args for task run() API |

<b>Returns:</b>

Promise&lt;Result&lt;T, [FxError](./teamsfx-api.fxerror.md)<!-- -->&gt;&gt;

A promise that resolves the wrapper of task running result or FxError

