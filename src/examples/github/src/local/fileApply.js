"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyLocalReplace = applyLocalReplace;
exports.applyLocalDelete = applyLocalDelete;
exports.overwriteLocalFile = overwriteLocalFile;
function buildReplaceBlock(oldContent, newContent) {
    return [
        '[START-REPLACE]',
        '[OLD]',
        String(oldContent !== null && oldContent !== void 0 ? oldContent : ''),
        '[/OLD]',
        '[NEW]',
        String(newContent !== null && newContent !== void 0 ? newContent : ''),
        '[/NEW]',
        '[END-REPLACE]'
    ].join('\n');
}
function buildDeleteBlock(oldContent) {
    return ['[START-DELETE]', '[OLD]', String(oldContent !== null && oldContent !== void 0 ? oldContent : ''), '[/OLD]', '[END-DELETE]'].join('\n');
}
async function applyLocalReplace(params) {
    return Tools.Files.apply(params.path, buildReplaceBlock(params.old, params.new), params.environment);
}
async function applyLocalDelete(params) {
    return Tools.Files.apply(params.path, buildDeleteBlock(params.old), params.environment);
}
async function overwriteLocalFile(params) {
    var _a;
    const exists = await Tools.Files.exists(params.path, params.environment);
    if (exists.exists) {
        await Tools.Files.deleteFile(params.path, true, params.environment);
    }
    return Tools.Files.write(params.path, String((_a = params.content) !== null && _a !== void 0 ? _a : ''), false, params.environment);
}
