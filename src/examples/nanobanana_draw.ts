/* METADATA
{
  "name": "nanobanana_draw",
  "description": "使用 Nano Banana API (基于Grsai的api服务/https://grsai.com/) 根据提示词画图，支持文生图和图生图（可传入参考图片URL进行图像编辑与合成），将图片保存到本地 /sdcard/Download/Operit/draws/ 目录，并返回 Markdown 图片提示。",
  "env": [
    "NANOBANANA_API_KEY"
  ],
  "tools": [
    {
      "name": "draw_image",
      "description": "根据提示词调用 Nano Banana API 生成图片（支持文生图和图生图），保存到本地并返回 Markdown 图片提示。",
      "parameters": [
        { "name": "prompt", "description": "绘图提示词（英文或中文皆可）", "type": "string", "required": true },
        { "name": "model", "description": "Nano Banana 模型名称，默认 nano-banana-pro", "type": "string", "required": false },
        { "name": "aspect_ratio", "description": "输出图像比例，如 '1:1', '16:9', 'auto' 等，可选", "type": "string", "required": false },
        { "name": "image_size", "description": "输出图像大小，仅 nano-banana-pro 支持，如 '1K', '2K', '4K'，可选", "type": "string", "required": false },
        { "name": "image_urls", "description": "参考图URL数组（图生图），支持格式：字符串数组['https://...'] 或 JSON字符串'[\"https://...\"]' 或逗号分隔'url1,url2'，可选", "type": "array", "required": false },
        { "name": "file_name", "description": "自定义保存到本地的文件名（不含路径和扩展名）", "type": "string", "required": false }
      ]
    }
  ]
}
*/

const nanobananaDraw = (function () {
    const client = OkHttp.newClient();

    // API配置
    const API_ENDPOINT = "https://grsai.dakka.com.cn/v1/draw/nano-banana";
    const RESULT_ENDPOINT = "https://grsai.dakka.com.cn/v1/draw/result";
    const DEFAULT_MODEL = "nano-banana-pro";
    // Android 实际路径为 /sdcard/Download，对应系统中文名"下载"
    const DOWNLOAD_ROOT = "/sdcard/Download";
    const OPERIT_DIR = `${DOWNLOAD_ROOT}/Operit`;
    const DRAWS_DIR = `${OPERIT_DIR}/draws`;

    // 轮询配置
    const POLL_INTERVAL = 5000;      // 每5秒查询一次
    const MAX_WAIT_TIME = 300000;    // 最多等待5分钟

    function getApiKey(): string {
        const apiKey = getEnv("NANOBANANA_API_KEY");
        if (!apiKey) {
            throw new Error("NANOBANANA_API_KEY 未配置，请在环境变量中设置 Nano Banana 的 API Key。");
        }
        return apiKey;
    }

    function sanitizeFileName(name: string): string {
        const safe = name.replace(/[\\/:*?"<>|]/g, "_").trim();
        if (!safe) {
            return `nano_draw_${Date.now()}`;
        }
        return safe.substring(0, 80);
    }

    function buildFileName(prompt: string, customName?: string | null): string {
        if (customName && customName.trim().length > 0) {
            return sanitizeFileName(customName);
        }
        const shortPrompt = prompt.length > 40 ? `${prompt.substring(0, 40)}...` : prompt;
        const base = sanitizeFileName(shortPrompt || "image");
        const timestamp = Date.now();
        return `${base}_${timestamp}`;
    }

    async function ensureDirectories(): Promise<void> {
        const dirs = [DOWNLOAD_ROOT, OPERIT_DIR, DRAWS_DIR];
        for (const dir of dirs) {
            try {
                const result = await Tools.Files.mkdir(dir);
                if (!result.successful) {
                    console.warn(`创建目录失败(可能已存在): ${dir} -> ${result.details}`);
                }
            } catch (e: any) {
                console.warn(`创建目录异常: ${dir} -> ${e?.message || e}`);
            }
        }
    }

    async function callNanobananaApi(params: {
        prompt: string;
        model?: string;
        aspect_ratio?: string;
        image_size?: string;
        image_urls?: string[];
    }): Promise<string> {
        const apiKey = getApiKey();
        const model = (params.model && params.model.trim().length > 0)
            ? params.model.trim()
            : DEFAULT_MODEL;

        // 构建请求体 - 使用异步模式（webHook: "-1"）
        const body: any = {
            model: model,
            prompt: params.prompt,
            webHook: "-1",  // 关键：立即返回任务ID
            shutProgress: false
        };

        // 添加可选参数
        if (params.aspect_ratio && params.aspect_ratio.trim().length > 0) {
            body.aspectRatio = params.aspect_ratio.trim();
        }

        if (params.image_size && params.image_size.trim().length > 0) {
            body.imageSize = params.image_size.trim();
        }

        // 图生图：添加参考图URL数组
        // 支持格式：['https://example.com/1.jpg', 'https://example.com/2.jpg']
        // 或 JSON字符串："[\"https://...\"]"
        // 或 逗号分隔："url1,url2"
        if (params.image_urls && Array.isArray(params.image_urls) && params.image_urls.length > 0) {
            body.urls = params.image_urls.filter(url => url && url.trim().length > 0);
        }

        const headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        };

        const request = client
            .newRequest()
            .url(API_ENDPOINT)
            .method("POST")
            .headers(headers)
            .body(JSON.stringify(body), "json");

        console.log("步骤1/2: 提交绘图任务...");
        const response = await request.build().execute();

        if (!response.isSuccessful()) {
            throw new Error(`Nano Banana API 调用失败: ${response.statusCode} - ${response.content}`);
        }

        let parsed: any;
        try {
            parsed = JSON.parse(response.content);
        } catch (e: any) {
            throw new Error(`解析 Nano Banana 响应失败: ${e?.message || e}`);
        }

        // 检查响应格式
        if (!parsed || !parsed.data || !parsed.data.id) {
            throw new Error("API响应中未找到任务ID，请检查参数是否正确。响应: " + JSON.stringify(parsed));
        }

        const taskId: string = parsed.data.id;
        console.log(`任务提交成功! ID: ${taskId}`);
        console.log(`步骤2/2: 等待任务完成（轮询中，每${POLL_INTERVAL / 1000}秒查询一次）...`);

        return taskId;
    }

    async function pollForResult(taskId: string): Promise<string> {
        const apiKey = getApiKey();
        const startTime = Date.now();
        let attempts = 0;

        // 构建结果查询请求
        const requestBody = JSON.stringify({ id: taskId });
        const headers = {
            "accept": "application/json",
            "content-type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        };

        while (Date.now() - startTime < MAX_WAIT_TIME) {
            attempts++;
            console.log(`第${attempts}次查询任务状态...`);

            // 查询结果
            const request = client
                .newRequest()
                .url(RESULT_ENDPOINT)
                .method("POST")
                .headers(headers)
                .body(requestBody, "json");

            const response = await request.build().execute();

            if (!response.isSuccessful()) {
                throw new Error(`查询结果失败: ${response.statusCode} - ${response.content}`);
            }

            let parsed: any;
            try {
                parsed = JSON.parse(response.content);
            } catch (e: any) {
                throw new Error(`解析结果响应失败: ${e?.message || e}`);
            }

            // 检查响应格式
            if (!parsed || parsed.code !== 0 || !parsed.data) {
                console.warn(`查询响应异常: ${JSON.stringify(parsed)}`);
                await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
                continue;
            }

            const data = parsed.data;
            const progress: number = data.progress || 0;
            const status: string = data.status || "unknown";

            console.log(`当前进度: ${progress}% | 状态: ${status}`);

            if (status === "succeeded") {
                console.log("✅ 任务完成!");
                if (!data.results || !data.results[0] || !data.results[0].url) {
                    throw new Error("任务完成但响应中未找到图片URL: " + JSON.stringify(data));
                }
                return String(data.results[0].url);
            } else if (status === "failed") {
                const reason: string = data.failure_reason || "未知原因";
                const error: string = data.error || "";
                throw new Error(`任务执行失败: ${reason} - ${error}`);
            } else if (status === "running" && progress > 0) {
                console.log(`生成中... 进度: ${progress}%`);
            }

            // 等待后再次查询
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        }

        throw new Error(`任务超时: 等待超过${MAX_WAIT_TIME / 60000}分钟仍未完成`);
    }

    function guessExtensionFromUrl(url: string): string {
        const match = url.match(/\.(png|jpg|jpeg|webp|gif)(?:\?|#|$)/i);
        if (match && match[1]) {
            return match[1].toLowerCase();
        }
        return "png";
    }

    interface DrawImageParams {
        prompt: string;
        model?: string;
        aspect_ratio?: string;
        image_size?: string;
        image_urls?: string[] | string;
        file_name?: string;
    }

    interface DrawImageResult {
        file_path: string;
        file_uri: string;
        markdown: string;
        prompt: string;
        model: string;
        aspect_ratio?: string;
        image_size?: string;
        image_urls?: string[] | string;
        hint: string;
    }

    async function draw_image(params: DrawImageParams): Promise<DrawImageResult> {
        if (!params || !params.prompt || params.prompt.trim().length === 0) {
            throw new Error("参数 prompt 不能为空。");
        }

        const prompt = params.prompt.trim();

        // 添加辅助函数来解析URL数组
        function parseImageUrls(image_urls: string[] | string): string[] {
            // 如果已经是数组，直接过滤空值返回
            if (Array.isArray(image_urls)) {
                return image_urls.filter(url => url && url.trim().length > 0);
            }

            // 如果是字符串，尝试解析
            if (typeof image_urls === "string") {
                // 方法一：尝试JSON解析
                try {
                    const parsed = JSON.parse(image_urls);
                    if (Array.isArray(parsed)) {
                        return parsed.filter((url: string) => url && url.trim().length > 0);
                    }
                } catch (e) {
                    // 解析失败继续方法二
                }

                // 方法二：按逗号分割（支持 "url1,url2" 格式）
                const splitUrls = image_urls.split(",")
                    .map(url => url.trim())
                    .filter(url => url.length > 0);
                if (splitUrls.length > 0) {
                    return splitUrls;
                }
            }

            return [];
        }

        // 替换原有的验证逻辑
        let imageUrlsArray: string[] = [];
        if (params.image_urls) {
            imageUrlsArray = parseImageUrls(params.image_urls);
            if (imageUrlsArray.length === 0) {
                throw new Error("参数 image_urls 必须是有效的URL数组。");
            }
        }

        await ensureDirectories();

        // 步骤1: 提交任务并获取任务ID
        const taskId = await callNanobananaApi({
            prompt,
            model: params.model,
            aspect_ratio: params.aspect_ratio,
            image_size: params.image_size,
            image_urls: imageUrlsArray
        });

        // 步骤2: 轮询等待任务完成
        const imageUrl = await pollForResult(taskId);

        const ext = guessExtensionFromUrl(imageUrl);
        const baseName = buildFileName(prompt, params.file_name ?? null);
        const filePath = `${DRAWS_DIR}/${baseName}.${ext}`;

        const downloadResult = await Tools.Files.download(imageUrl, filePath);
        if (!downloadResult.successful) {
            throw new Error(`下载图片失败: ${downloadResult.details}`);
        }

        const fileUri = `file://${filePath}`;
        const markdown = `![AI生成的图片](${fileUri})`;

        const hintLines: string[] = [];
        hintLines.push("图片已生成并保存在本地 /sdcard/Download/Operit/draws/ 目录。");
        hintLines.push(`本地路径: ${filePath}`);
        hintLines.push("");
        hintLines.push("在后续回答中，请直接输出下面这一行 Markdown 来展示这张图片：");
        hintLines.push("");
        hintLines.push(markdown);

        return {
            file_path: filePath,
            file_uri: fileUri,
            markdown,
            prompt,
            model: params.model || DEFAULT_MODEL,
            aspect_ratio: params.aspect_ratio,
            image_size: params.image_size,
            image_urls: params.image_urls,
            hint: hintLines.join("\n")
        };
    }

    async function draw_image_wrapper(params: DrawImageParams) {
        try {
            const result = await draw_image(params);
            complete({
                success: true,
                message: "图片生成成功，已保存到 /sdcard/Download/Operit/draws/，并返回 Markdown 图片提示。",
                data: result
            });
        } catch (error: any) {
            console.error("draw_image 执行失败:", error);
            complete({
                success: false,
                message: `图片生成失败: ${error?.message || error}`,
                error_stack: error?.stack
            });
        }
    }

    return {
        draw_image: draw_image_wrapper
    };
})();

exports.draw_image = nanobananaDraw.draw_image;
