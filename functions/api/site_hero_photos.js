export async function onRequestGet(context) {
    try {
        const db = context.env.DB;

        const result = await db.prepare(`
            SELECT
                id,
                drive_file_id,
                image_url,
                sort_order,
                created_at
            FROM site_hero_photos
            ORDER BY sort_order ASC, id ASC
        `).all();

        return jsonResponse({
            ok: true,
            photos: result.results || []
        });

    } catch (error) {
        return jsonResponse({
            ok: false,
            message: "TOP写真を取得できませんでした。"
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