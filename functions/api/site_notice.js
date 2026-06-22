export async function onRequestGet(context) {
    try {
        const db = context.env.DB;

        const notice = await db.prepare(`
            SELECT
                site_title,
                site_subtitle,
                notice_title,
                event_datetime,
                venue_name,
                venue_address,
                map_url,
                route_url,
                notice_text,
                is_visible,
                updated_at
            FROM site_notice
            WHERE id = ?
            LIMIT 1
        `).bind("main").first();

        if (!notice) {
            return jsonResponse({
                ok: true,
                notice: {
                    site_title: "第３部送別記念サイト",
                    site_subtitle: "皆様からの写真やメッセージをお待ちしております",
                    notice_title: "宴会場のお知らせ",
                    event_datetime: "",
                    venue_name: "",
                    venue_address: "",
                    map_url: "",
                    route_url: "",
                    notice_text: "",
                    is_visible: 0
                }
            });
        }

        return jsonResponse({
            ok: true,
            notice
        });

    } catch (error) {
        return jsonResponse({
            ok: false,
            message: "お知らせ情報を取得できませんでした。"
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