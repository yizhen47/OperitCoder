"use strict";
/* METADATA
{
  "name": "github",
  "description": { "zh": "基于 GitHub REST API 的工具集合（不依赖 GitHub MCP）。包含 GitHub 侧（仓库/Issues/PR/文件提交/分支/差异提交）与本地侧（apply_file 差异更新、terminal 终端）能力。", "en": "A toolkit built on the GitHub REST API (does not depend on GitHub MCP). Includes GitHub-side operations (repos/issues/PRs/commits/branches/diffs) and local-side utilities (apply_file patch updates, terminal)." },
  "env": [
    {
      "name": "GITHUB_TOKEN",
      "description": { "zh": "GitHub API 认证令牌", "en": "GitHub API authentication token" },
      "required": true
    },
    {
      "name": "GITHUB_API_BASE_URL",
      "description": { "zh": "GitHub API 基础 URL", "en": "GitHub API base URL" },
      "required": false,
      "defaultValue": "https://api.github.com"
    }
  ],
  "enabledByDefault": false,
  "tools": [
    {
      "name": "search_repositories",
      "description": { "zh": "搜索 GitHub 仓库（/search/repositories）。", "en": "Search GitHub repositories (/search/repositories)." },
      "parameters": [
        { "name": "query", "description": { "zh": "搜索关键词（GitHub search query）", "en": "Search keywords (GitHub search query)." }, "type": "string", "required": true },
        { "name": "sort", "description": { "zh": "排序字段：stars/forks/help-wanted-issues/updated", "en": "Sort field: stars/forks/help-wanted-issues/updated." }, "type": "string", "required": false },
        { "name": "order", "description": { "zh": "排序方向：desc/asc", "en": "Sort order: desc/asc." }, "type": "string", "required": false },
        { "name": "page", "description": { "zh": "页码（默认 1）", "en": "Page number (default: 1)." }, "type": "number", "required": false },
        { "name": "per_page", "description": { "zh": "每页数量（默认 30，最大 100）", "en": "Items per page (default: 30, max: 100)." }, "type": "number", "required": false }
      ]
    },
    {
      "name": "get_repository",
      "description": { "zh": "获取仓库信息（/repos/{owner}/{repo}）。", "en": "Get repository information (/repos/{owner}/{repo})." },
      "parameters": [
        { "name": "owner", "description": { "zh": "仓库 owner", "en": "Repository owner." }, "type": "string", "required": true },
        { "name": "repo", "description": { "zh": "仓库名", "en": "Repository name." }, "type": "string", "required": true }
      ]
    },
    {
      "name": "list_issues",
      "description": { "zh": "列出仓库 Issues（/repos/{owner}/{repo}/issues）。注意：GitHub 的 issues API 默认也会包含 PR，需要时可用 include_pull_requests 控制。", "en": "List repository issues (/repos/{owner}/{repo}/issues). Note: GitHub issues API also includes PRs by default; use include_pull_requests when needed." },
      "parameters": [
        { "name": "owner", "description": { "zh": "仓库 owner", "en": "Repository owner." }, "type": "string", "required": true },
        { "name": "repo", "description": { "zh": "仓库名", "en": "Repository name." }, "type": "string", "required": true },
        { "name": "state", "description": { "zh": "open/closed/all（默认 open）", "en": "open/closed/all (default: open)." }, "type": "string", "required": false },
        { "name": "labels", "description": { "zh": "labels 逗号分隔", "en": "Labels, comma-separated." }, "type": "string", "required": false },
        { "name": "creator", "description": { "zh": "创建者 login", "en": "Creator login." }, "type": "string", "required": false },
        { "name": "page", "description": { "zh": "页码（默认 1）", "en": "Page number (default: 1)." }, "type": "number", "required": false },
        { "name": "per_page", "description": { "zh": "每页数量（默认 30，最大 100）", "en": "Items per page (default: 30, max: 100)." }, "type": "number", "required": false },
        { "name": "include_pull_requests", "description": { "zh": "是否保留 PR（默认 false，仅返回 issue）", "en": "Whether to include PRs (default: false; issues only)." }, "type": "boolean", "required": false }
      ]
    },
    {
      "name": "create_issue",
      "description": { "zh": "创建 Issue（/repos/{owner}/{repo}/issues）。", "en": "Create an issue (/repos/{owner}/{repo}/issues)." },
      "parameters": [
        { "name": "owner", "description": { "zh": "仓库 owner", "en": "Repository owner." }, "type": "string", "required": true },
        { "name": "repo", "description": { "zh": "仓库名", "en": "Repository name." }, "type": "string", "required": true },
        { "name": "title", "description": { "zh": "Issue 标题", "en": "Issue title." }, "type": "string", "required": true },
        { "name": "body", "description": { "zh": "Issue 内容", "en": "Issue body." }, "type": "string", "required": false },
        { "name": "labels", "description": { "zh": "labels 数组（字符串数组）", "en": "Labels array (string array)." }, "type": "array", "required": false },
        { "name": "assignees", "description": { "zh": "assignees 数组（字符串数组）", "en": "Assignees array (string array)." }, "type": "array", "required": false }
      ]
    },
    {
      "name": "comment_issue",
      "description": { "zh": "给 Issue/PR 评论（/repos/{owner}/{repo}/issues/{issue_number}/comments）。", "en": "Comment on an issue/PR (/repos/{owner}/{repo}/issues/{issue_number}/comments)." },
      "parameters": [
        { "name": "owner", "description": { "zh": "仓库 owner", "en": "Repository owner." }, "type": "string", "required": true },
        { "name": "repo", "description": { "zh": "仓库名", "en": "Repository name." }, "type": "string", "required": true },
        { "name": "issue_number", "description": { "zh": "Issue 编号", "en": "Issue number." }, "type": "number", "required": true },
        { "name": "body", "description": { "zh": "评论内容", "en": "Comment body." }, "type": "string", "required": true }
      ]
    },
    {
      "name": "list_issue_comments",
      "description": { "zh": "列出 Issue/PR 的评论（/repos/{owner}/{repo}/issues/{issue_number}/comments）。", "en": "List comments on an issue/PR (/repos/{owner}/{repo}/issues/{issue_number}/comments)." },
      "parameters": [
        { "name": "owner", "description": { "zh": "仓库 owner", "en": "Repository owner." }, "type": "string", "required": true },
        { "name": "repo", "description": { "zh": "仓库名", "en": "Repository name." }, "type": "string", "required": true },
        { "name": "issue_number", "description": { "zh": "Issue 编号", "en": "Issue number." }, "type": "number", "required": true },
        { "name": "page", "description": { "zh": "页码（默认 1）", "en": "Page number (default: 1)." }, "type": "number", "required": false },
        { "name": "per_page", "description": { "zh": "每页数量（默认 30，最大 100）", "en": "Items per page (default: 30, max: 100)." }, "type": "number", "required": false }
      ]
    },
    {
      "name": "list_pull_requests",
      "description": { "zh": "列出 PR（/repos/{owner}/{repo}/pulls）。", "en": "List pull requests (/repos/{owner}/{repo}/pulls)." },
      "parameters": [
        { "name": "owner", "description": { "zh": "仓库 owner", "en": "Repository owner." }, "type": "string", "required": true },
        { "name": "repo", "description": { "zh": "仓库名", "en": "Repository name." }, "type": "string", "required": true },
        { "name": "state", "description": { "zh": "open/closed/all（默认 open）", "en": "open/closed/all (default: open)." }, "type": "string", "required": false },
        { "name": "head", "description": { "zh": "head 过滤（可选）", "en": "Head filter (optional)." }, "type": "string", "required": false },
        { "name": "base", "description": { "zh": "base 过滤（可选）", "en": "Base filter (optional)." }, "type": "string", "required": false },
        { "name": "page", "description": { "zh": "页码（默认 1）", "en": "Page number (default: 1)." }, "type": "number", "required": false },
        { "name": "per_page", "description": { "zh": "每页数量（默认 30，最大 100）", "en": "Items per page (default: 30, max: 100)." }, "type": "number", "required": false }
      ]
    },
    {
      "name": "create_pull_request",
      "description": { "zh": "创建 PR（/repos/{owner}/{repo}/pulls）。", "en": "Create a pull request (/repos/{owner}/{repo}/pulls)." },
      "parameters": [
        { "name": "owner", "description": { "zh": "仓库 owner", "en": "Repository owner." }, "type": "string", "required": true },
        { "name": "repo", "description": { "zh": "仓库名", "en": "Repository name." }, "type": "string", "required": true },
        { "name": "title", "description": { "zh": "PR 标题", "en": "PR title." }, "type": "string", "required": true },
        { "name": "head", "description": { "zh": "源分支，例如 feature-branch 或 owner:branch", "en": "Head branch, e.g. feature-branch or owner:branch." }, "type": "string", "required": true },
        { "name": "base", "description": { "zh": "目标分支，例如 main", "en": "Base branch, e.g. main." }, "type": "string", "required": true },
        { "name": "body", "description": { "zh": "PR 内容", "en": "PR body." }, "type": "string", "required": false },
        { "name": "draft", "description": { "zh": "是否为 Draft", "en": "Whether this is a draft PR." }, "type": "boolean", "required": false }
      ]
    },
    {
      "name": "get_pull_request",
      "description": { "zh": "获取 PR 详情（/repos/{owner}/{repo}/pulls/{pull_number}）。", "en": "Get pull request details (/repos/{owner}/{repo}/pulls/{pull_number})." },
      "parameters": [
        { "name": "owner", "description": { "zh": "仓库 owner", "en": "Repository owner." }, "type": "string", "required": true },
        { "name": "repo", "description": { "zh": "仓库名", "en": "Repository name." }, "type": "string", "required": true },
        { "name": "pull_number", "description": { "zh": "PR 编号", "en": "PR number." }, "type": "number", "required": true }
      ]
    },
    {
      "name": "merge_pull_request",
      "description": { "zh": "合并 PR（/repos/{owner}/{repo}/pulls/{pull_number}/merge）。", "en": "Merge a pull request (/repos/{owner}/{repo}/pulls/{pull_number}/merge)." },
      "parameters": [
        { "name": "owner", "description": { "zh": "仓库 owner", "en": "Repository owner." }, "type": "string", "required": true },
        { "name": "repo", "description": { "zh": "仓库名", "en": "Repository name." }, "type": "string", "required": true },
        { "name": "pull_number", "description": { "zh": "PR 编号", "en": "PR number." }, "type": "number", "required": true },
        { "name": "commit_title", "description": { "zh": "可选，merge commit 标题", "en": "Optional: merge commit title." }, "type": "string", "required": false },
        { "name": "commit_message", "description": { "zh": "可选，merge commit 内容", "en": "Optional: merge commit message." }, "type": "string", "required": false },
        { "name": "merge_method", "description": { "zh": "merge/squash/rebase", "en": "merge/squash/rebase." }, "type": "string", "required": false }
      ]
    },
    {
      "name": "get_file_content",
      "description": { "zh": "读取仓库文件内容（/repos/{owner}/{repo}/contents/{path}）。若文件是 base64 返回，将自动解码为文本并返回。", "en": "Read repository file content (/repos/{owner}/{repo}/contents/{path}). If the API returns base64, it will be decoded and returned as text." },
      "parameters": [
        { "name": "owner", "description": { "zh": "仓库 owner", "en": "Repository owner." }, "type": "string", "required": true },
        { "name": "repo", "description": { "zh": "仓库名", "en": "Repository name." }, "type": "string", "required": true },
        { "name": "path", "description": { "zh": "文件路径（如 README.md）", "en": "File path (e.g. README.md)." }, "type": "string", "required": true },
        { "name": "ref", "description": { "zh": "分支/Tag/SHA（可选）", "en": "Branch/Tag/SHA (optional)." }, "type": "string", "required": false }
      ]
    },
    {
      "name": "create_or_update_file",
      "description": { "zh": "创建或更新仓库文件并提交（/repos/{owner}/{repo}/contents/{path}，PUT）。", "en": "Create or update a repository file and commit it (/repos/{owner}/{repo}/contents/{path}, PUT)." },
      "parameters": [
        { "name": "owner", "description": { "zh": "仓库 owner", "en": "Repository owner." }, "type": "string", "required": true },
        { "name": "repo", "description": { "zh": "仓库名", "en": "Repository name." }, "type": "string", "required": true },
        { "name": "path", "description": { "zh": "文件路径", "en": "File path." }, "type": "string", "required": true },
        { "name": "message", "description": { "zh": "提交信息", "en": "Commit message." }, "type": "string", "required": true },
        { "name": "content", "description": { "zh": "文件内容（默认按 utf-8 文本编码为 base64）", "en": "File content (base64-encoded as utf-8 text by default)." }, "type": "string", "required": true },
        { "name": "content_encoding", "description": { "zh": "utf-8/base64（默认 utf-8）", "en": "utf-8/base64 (default: utf-8)." }, "type": "string", "required": false },
        { "name": "branch", "description": { "zh": "目标分支（可选）", "en": "Target branch (optional)." }, "type": "string", "required": false },
        { "name": "sha", "description": { "zh": "可选：已知 sha（更新文件时）", "en": "Optional: known sha (when updating a file)." }, "type": "string", "required": false }
      ]
    },
    {
      "name": "patch_file_in_repo",
      "description": { "zh": "对仓库文件做差异更新（传入 [START-REPLACE]/[START-DELETE] 块），并提交。", "en": "Patch a repository file by applying diff blocks ([START-REPLACE]/[START-DELETE]) and commit." },
      "parameters": [
        { "name": "owner", "description": { "zh": "仓库 owner", "en": "Repository owner." }, "type": "string", "required": true },
        { "name": "repo", "description": { "zh": "仓库名", "en": "Repository name." }, "type": "string", "required": true },
        { "name": "path", "description": { "zh": "文件路径", "en": "File path." }, "type": "string", "required": true },
        { "name": "message", "description": { "zh": "提交信息", "en": "Commit message." }, "type": "string", "required": true },
        { "name": "patch", "description": { "zh": "差异块字符串（可多块）", "en": "Diff blocks string (can include multiple blocks)." }, "type": "string", "required": true },
        { "name": "branch", "description": { "zh": "目标分支（可选）", "en": "Target branch (optional)." }, "type": "string", "required": false }
      ]
    },
    {
      "name": "delete_file",
      "description": { "zh": "删除仓库文件并提交（/repos/{owner}/{repo}/contents/{path}，DELETE）。", "en": "Delete a repository file and commit (/repos/{owner}/{repo}/contents/{path}, DELETE)." },
      "parameters": [
        { "name": "owner", "description": { "zh": "仓库 owner", "en": "Repository owner." }, "type": "string", "required": true },
        { "name": "repo", "description": { "zh": "仓库名", "en": "Repository name." }, "type": "string", "required": true },
        { "name": "path", "description": { "zh": "文件路径", "en": "File path." }, "type": "string", "required": true },
        { "name": "message", "description": { "zh": "提交信息", "en": "Commit message." }, "type": "string", "required": true },
        { "name": "branch", "description": { "zh": "目标分支（可选）", "en": "Target branch (optional)." }, "type": "string", "required": false },
        { "name": "sha", "description": { "zh": "可选：已知 sha（删除文件时）", "en": "Optional: known sha (when deleting a file)." }, "type": "string", "required": false }
      ]
    },
    {
      "name": "create_branch",
      "description": { "zh": "基于已有分支创建新分支（/git/refs）。", "en": "Create a new branch from an existing branch (/git/refs)." },
      "parameters": [
        { "name": "owner", "description": { "zh": "仓库 owner", "en": "Repository owner." }, "type": "string", "required": true },
        { "name": "repo", "description": { "zh": "仓库名", "en": "Repository name." }, "type": "string", "required": true },
        { "name": "new_branch", "description": { "zh": "新分支名", "en": "New branch name." }, "type": "string", "required": true },
        { "name": "from_branch", "description": { "zh": "源分支（可选，默认使用 default_branch）", "en": "Source branch (optional; defaults to default_branch)." }, "type": "string", "required": false }
      ]
    },
    {
      "name": "apply_local_replace",
      "description": { "zh": "使用 Tools.Files.apply 对本地文件做 REPLACE（结构化块）。", "en": "Run Tools.Files.apply REPLACE on a local file (structured blocks)." },
      "parameters": [
        { "name": "path", "description": { "zh": "本地文件路径", "en": "Local file path." }, "type": "string", "required": true },
        { "name": "old", "description": { "zh": "要替换的旧内容片段", "en": "Old content snippet to replace." }, "type": "string", "required": true },
        { "name": "new", "description": { "zh": "替换后的新内容片段", "en": "New content snippet." }, "type": "string", "required": true },
        { "name": "environment", "description": { "zh": "android/linux（可选）", "en": "android/linux (optional)." }, "type": "string", "required": false }
      ]
    },
    {
      "name": "apply_local_delete",
      "description": { "zh": "使用 Tools.Files.apply 对本地文件做 DELETE（结构化块）。", "en": "Run Tools.Files.apply DELETE on a local file (structured blocks)." },
      "parameters": [
        { "name": "path", "description": { "zh": "本地文件路径", "en": "Local file path." }, "type": "string", "required": true },
        { "name": "old", "description": { "zh": "要删除的旧内容片段", "en": "Old content snippet to delete." }, "type": "string", "required": true },
        { "name": "environment", "description": { "zh": "android/linux（可选）", "en": "android/linux (optional)." }, "type": "string", "required": false }
      ]
    },
    {
      "name": "overwrite_local_file",
      "description": { "zh": "覆盖写入本地文件（如果存在会先删除再写入）。", "en": "Overwrite a local file (if it exists, it will be deleted before writing)." },
      "parameters": [
        { "name": "path", "description": { "zh": "本地文件路径", "en": "Local file path." }, "type": "string", "required": true },
        { "name": "content", "description": { "zh": "完整文件内容", "en": "Full file content." }, "type": "string", "required": true },
        { "name": "environment", "description": { "zh": "android/linux（可选）", "en": "android/linux (optional)." }, "type": "string", "required": false }
      ]
    },
    {
      "name": "terminal_exec",
      "description": { "zh": "在终端会话中执行命令（Tools.System.terminal）。", "en": "Execute a command in a terminal session (Tools.System.terminal)." },
      "parameters": [
        { "name": "command", "description": { "zh": "要执行的命令", "en": "Command to execute." }, "type": "string", "required": true },
        { "name": "session_name", "description": { "zh": "会话名（可选，默认 github_tools_session）", "en": "Session name (optional; default: github_tools_session)." }, "type": "string", "required": false },
        { "name": "close", "description": { "zh": "是否执行后关闭会话", "en": "Whether to close the session after execution." }, "type": "boolean", "required": false }
      ]
    }
  ]
}
*/
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference path="../../types/index.d.ts" />
const tools_1 = require("./tools");
const repos_1 = require("./github/repos");
const api_1 = require("./github/api");
exports.search_repositories = tools_1.toolImpl.search_repositories;
exports.get_repository = tools_1.toolImpl.get_repository;
exports.list_issues = tools_1.toolImpl.list_issues;
exports.create_issue = tools_1.toolImpl.create_issue;
exports.comment_issue = tools_1.toolImpl.comment_issue;
exports.list_issue_comments = tools_1.toolImpl.list_issue_comments;
exports.list_pull_requests = tools_1.toolImpl.list_pull_requests;
exports.create_pull_request = tools_1.toolImpl.create_pull_request;
exports.get_pull_request = tools_1.toolImpl.get_pull_request;
exports.merge_pull_request = tools_1.toolImpl.merge_pull_request;
exports.get_file_content = tools_1.toolImpl.get_file_content;
exports.create_or_update_file = tools_1.toolImpl.create_or_update_file;
exports.patch_file_in_repo = tools_1.toolImpl.patch_file_in_repo;
exports.delete_file = tools_1.toolImpl.delete_file;
exports.create_branch = tools_1.toolImpl.create_branch;
exports.apply_local_replace = tools_1.toolImpl.apply_local_replace;
exports.apply_local_delete = tools_1.toolImpl.apply_local_delete;
exports.overwrite_local_file = tools_1.toolImpl.overwrite_local_file;
exports.terminal_exec = tools_1.toolImpl.terminal_exec;
async function main(params) {
    try {
        const owner = String((params === null || params === void 0 ? void 0 : params.owner) || 'octocat');
        const repo = String((params === null || params === void 0 ? void 0 : params.repo) || 'Hello-World');
        const query = String((params === null || params === void 0 ? void 0 : params.query) || 'operit');
        const baseUrl = (0, api_1.getBaseUrl)();
        const token = (0, api_1.getToken)();
        const repoInfo = await (0, repos_1.getRepository)({ owner, repo });
        const searchResult = await (0, repos_1.searchRepositories)({ query, per_page: 5 });
        complete({
            success: true,
            message: 'GitHub tools main test finished.',
            data: {
                baseUrl,
                hasToken: Boolean(token),
                get_repository: repoInfo,
                search_repositories: searchResult
            }
        });
    }
    catch (error) {
        complete({
            success: false,
            message: `GitHub tools main test failed: ${String(error && error.message ? error.message : error)}`,
            error_stack: String(error && error.stack ? error.stack : '')
        });
    }
}
exports.main = main;
