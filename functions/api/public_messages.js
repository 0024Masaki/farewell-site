export async function onRequestGet(context) {
    try {
        const db = context.env.DB;
        const url = new URL(context.request.url);
        const recipientId = sanitizeKey(url.searchParams.get("recipient_id") || "", 30);

        if (!recipientId) {
            return jsonResponse({ ok: false, message: "送別者が指定されていません。" }, 400);
        }

        const result = await db.prepare(`
            SELECT
                name,
                message,
                created_at
            FROM messages
            WHERE recipient_id = ?
            ORDER BY id DESC
        `).bind(recipientId).all();

        return jsonResponse({
            ok: true,
            messages: result.results || []
        });

    } catch (error) {
        return jsonResponse({ ok: false, message: "取得に失敗しました。" }, 500);
    }
}

function sanitizeKey(value, maxLength) {
    return String(value)
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, maxLength);
}

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "x-content-type-options": "nosniff"
        }
    });
}