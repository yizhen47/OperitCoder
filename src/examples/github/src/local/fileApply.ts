export type FileEnvironment = 'android' | 'linux';

function buildReplaceBlock(oldContent: string, newContent: string): string {
    return [
        '[START-REPLACE]',
        '[OLD]',
        String(oldContent ?? ''),
        '[/OLD]',
        '[NEW]',
        String(newContent ?? ''),
        '[/NEW]',
        '[END-REPLACE]'
    ].join('\n');
}

function buildDeleteBlock(oldContent: string): string {
    return ['[START-DELETE]', '[OLD]', String(oldContent ?? ''), '[/OLD]', '[END-DELETE]'].join('\n');
}

export async function applyLocalReplace(params: { path: string; old: string; new: string; environment?: FileEnvironment }): Promise<any> {
    return Tools.Files.apply(params.path, buildReplaceBlock(params.old, params.new), params.environment);
}

export async function applyLocalDelete(params: { path: string; old: string; environment?: FileEnvironment }): Promise<any> {
    return Tools.Files.apply(params.path, buildDeleteBlock(params.old), params.environment);
}

export async function overwriteLocalFile(params: { path: string; content: string; environment?: FileEnvironment }): Promise<any> {
    const exists = await Tools.Files.exists(params.path, params.environment);
    if (exists.exists) {
        await Tools.Files.deleteFile(params.path, true, params.environment);
    }
    return Tools.Files.write(params.path, String(params.content ?? ''), false, params.environment);
}
