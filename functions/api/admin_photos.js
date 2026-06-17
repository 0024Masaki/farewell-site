export async function onRequestGet(context) {
    try {
        const db = context.env.DB;
        const adminKey = context.env.ADMIN_KEY || "";
        const url = new URL(context.request.url);

        const key = url.searchParams.get("key") || "";
        const recipientId = sanitizeKey(url.searchParams.get("recipient_id") || "", 30);

        if (key !== adminKey) {
            return json({ ok:false, message:"認証エラー" },403);
        }

        const result = await db.prepare(`
            SELECT id, recipient_id, name, comment, drive_file_id, created_at
            FROM photos
            WHERE recipient_id = ?
            ORDER BY id DESC
        `).bind(recipientId).all();

        return json({ ok:true, photos:result.results || [] });

    } catch (error) {
        return json({ ok:false, message:"取得に失敗しました。" },500);
    }
}

function sanitizeKey(value, maxLength) {
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, maxLength);
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