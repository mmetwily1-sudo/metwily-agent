// @metwily/tools/fs — ACI مجردة: read/search/edit (لا bash خام)
// read(path, offset=1, limit=50): شرائح فقط، ممنوع full-read >400 سطر
// search(pattern): بديل grep، يمنع cat العشوائي
// edit(filePath, oldString, newString): استبدال حرفي واحد
export const DENIED = ["rm -rf", "sudo", "curl|sh", "git push"] as const;
export const ALLOW_RUN = ["bun", "npm", "pnpm", "tsc", "git", "ls"] as const;
