export async function onRequest(context) {
    const db = context.env.DB;
    const adminKey = context.env.ADMIN_KEY || "";

    try {
        if (context.request.method === "GET") {
            const url = new URL(context.request.url);
            const key = url.searchParams.get("key") || "";

            if (key !== adminKey) {
                return json({ ok:false, message:"認証エラー" },403);
            }

            const result = await db.prepare(`
                SELECT id, name, title, profile_html, sort_order, is_active
                FROM recipients
                ORDER BY sort_order, id
            `).all();

            return json({ ok:true, recipients:result.results || [] });
        }

        const data = await context.request.json();

        if (data.key !== adminKey) {
            return json({ ok:false, message:"認証エラー" },403);
        }

        if (context.request.method === "POST") {
            const id = sanitizeKey(data.id || "", 30);
            const name = sanitizeText(data.name || "", 80);
            const title = sanitizeText(data.title || "", 120);
            const profileHtml = sanitizeProfile(data.profile_html || "", 4000);
            const sortOrder = Number(data.sort_order || 0);

            if (!id || !name) {
                return json({ ok:false, message:"IDと名前は必須です。" },400);
            }

            await db.prepare(`
                INSERT INTO recipients
                    (id, name, title, profile_html, sort_order, is_active, created_at)
                VALUES
                    (?, ?, ?, ?, ?, 1, ?)
            `).bind(
                id,
                name,
                title,
                profileHtml,
                sortOrder,
                new Date().toISOString()
            ).run();

            return json({ ok:true, message:"送別者を追加しました。" });
        }

        if (context.request.method === "PUT") {
            const id = sanitizeKey(data.id || "", 30);
            const name = sanitizeText(data.name || "", 80);
            const title = sanitizeText(data.title || "", 120);
            const profileHtml = sanitizeProfile(data.profile_html || "", 4000);
            const sortOrder = Number(data.sort_order || 0);
            const isActive = data.is_active ? 1 : 0;

            if (!id || !name) {
                return json({ ok:false, message:"IDと名前は必須です。" },400);
            }

            await db.prepare(`
                UPDATE recipients
                SET name = ?,
                    title = ?,
                    profile_html = ?,
                    sort_order = ?,
                    is_active = ?
                WHERE id = ?
            `).bind(
                name,
                title,
                profileHtml,
                sortOrder,
                isActive,
                id
            ).run();

            return json({ ok:true, message:"送別者を更新しました。" });
        }

        if (context.request.method === "DELETE") {
            const id = sanitizeKey(data.id || "", 30);

            if (!id) {
                return json({ ok:false, message:"IDがありません。" },400);
            }

            await db.prepare(`
                UPDATE recipients
                SET is_active = 0
                WHERE id = ?
            `).bind(id).run();

            return json({ ok:true, message:"送別者を非表示にしました。" });
        }

        return json({ ok:false, message:"未対応のメソッドです。" },405);

    } catch (error) {
        return json({ ok:false, message:"処理に失敗しました。" },500);
    }
}

function sanitizeText(value, maxLength) {
    return String(value)
        .replace(/[<>]/g, "")
        .replace(/[\u0000-\u001F\u007F]/g, "")
        .trim()
        .slice(0, maxLength);
}

function sanitizeKey(value, maxLength) {
    return String(value)
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, maxLength);
}

function sanitizeProfile(value, maxLength) {
    return String(value)
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
        .replace(/on\w+="[^"]*"/gi, "")
        .replace(/on\w+='[^']*'/gi, "")
        .trim()
        .slice(0, maxLength);
}

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers:{
            "content-type":"application/json; charset=utf-8",
            "x-content-type-options":"nosniff"
        }
    });
}