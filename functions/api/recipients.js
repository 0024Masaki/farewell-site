export async function onRequestGet(context) {
    try {
        const db = context.env.DB;

        const result = await db.prepare(`
            SELECT
                id,
                name,
                title,
                profile_html
            FROM recipients
            WHERE is_active = 1
            ORDER BY sort_order, id
        `).all();

        return jsonResponse({
            ok: true,
            recipients: result.results || []
        });

    } catch (error) {
        return jsonResponse({
            ok: false,
            message: "送別者情報を取得できませんでした。"
        }, 500);
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