export async function onRequestGet(context) {
    try {
        const db = context.env.DB;
        const adminKey = context.env.ADMIN_KEY || "";
        const url = new URL(context.request.url);
        const key = url.searchParams.get("key") || "";

        if (!adminKey || key !== adminKey) {
            return jsonResponse({ ok: false, message: "認証に失敗しました。" }, 403);
        }

        const result = await db.prepare(`
            SELECT
                id,
                name,
                message,
                created_at
            FROM messages
            ORDER BY id DESC
        `).all();

        return jsonResponse({
            ok: true,
            messages: result.results || []
        });

    } catch (error) {
        return jsonResponse({ ok: false, message: "取得に失敗しました。" }, 500);
    }
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