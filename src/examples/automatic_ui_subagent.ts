/* METADATA
{
    "name": "Automatic_ui_subagent",
    "description": "兼容AutoGLM，提供基于独立UI控制器模型（例如 autoglm-phone-9b）的高层UI自动化子代理工具，用于根据自然语言意图自动规划并执行点击/输入/滑动等一系列界面操作。当用户提出需要帮忙完成某个界面操作任务（例如打开应用、搜索内容、在多个页面之间完成一套步骤）时，可以调用本包由子代理自动规划和执行具体步骤。",

    "tools": [
        {
            "name": "usage_advice",
            "description": "UI子代理使用建议：\\n- 任务拆分：当任务包含多个逻辑上独立的子目标时（例如：先在音乐App中播放一首歌，然后再去搜索并收藏另一首歌），建议将它们拆分成多个子任务，依次多次调用本子代理。\\n- 单次流程：对于目标单一、流程连续的任务（例如：在某个社交应用中找到某个联系人并发送一条消息），应尽量在一次调用中给出完整意图，由子代理自动规划中间步骤。\\n- 适用场景：可以推广到音乐、购物、内容浏览、搜索等多种App场景，只要你能用自然语言清晰描述高层目标即可。",
            "parameters": []
        },
        {
            "name": "run_subagent",
            "description": "运行内置UI子代理（使用独立UI控制器模型）根据高层意图自动规划并执行一系列UI操作，例如自动点击、滑动、输入等。",
            "parameters": [
                { "name": "intent", "description": "任务意图描述，例如：'打开微信并发送一条消息' 或 '在B站搜索某个视频'", "type": "string", "required": true },
                { "name": "max_steps", "description": "最大执行步数，默认20，可根据任务复杂度调整。", "type": "number", "required": false }
            ]
        }
    ]
}
*/

const UIAutomationSubAgentTools = (function () {

    interface ToolResponse {
        success: boolean;
        message: string;
        data?: any;
    }

    async function run_subagent(params: { intent: string, max_steps?: number }): Promise<ToolResponse> {
        const { intent, max_steps } = params;
        const result = await Tools.UI.runSubAgent(intent, max_steps);
        return {
            success: true,
            message: 'UI子代理执行完成',
            data: result,
        };
    }

    async function wrapToolExecution<P>(func: (params: P) => Promise<ToolResponse>, params: P) {
        try {
            const result = await func(params);
            complete(result);
        } catch (error: any) {
            console.error(`Tool ${func.name} failed unexpectedly`, error);
            complete({
                success: false,
                message: `工具执行时发生意外错误: ${error.message}`,
            });
        }
    }

    return {
        run_subagent: (params: { intent: string, max_steps?: number }) => wrapToolExecution(run_subagent, params),
    };
})();

exports.run_subagent = UIAutomationSubAgentTools.run_subagent;
