export async function onRequest(context) {
    try {
        const db = context.env.DB;
        const adminKey = context.env.ADMIN_KEY || "";
        const method = context.request.method.toUpperCase();

        if (method === "GET") {
            const url = new URL(context.request.url);
            const key = url.searchParams.get("key") || "";

            if (!isValidAdminKey(key, adminKey)) {
                return jsonResponse({
                    ok: false,
                    message: "認証エラー"
                }, 403);
            }

            await ensureNoticeRow(db);

            const notice = await getNotice(db);

            return jsonResponse({
                ok: true,
                notice
            });
        }

        if (method === "PUT") {
            const data = await context.request.json();

            if (!isValidAdminKey(data.key, adminKey)) {
                return jsonResponse({
                    ok: false,
                    message: "認証エラー"
                }, 403);
            }

            await ensureNoticeRow(db);

            const notice = buildNotice(data);

            await db.prepare(`
                UPDATE site_notice
                SET
                    site_title = ?,
                    site_subtitle = ?,
                    notice_title = ?,
                    event_datetime = ?,
                    venue_name = ?,
                    venue_address = ?,
                    map_url = ?,
                    route_url = ?,
                    notice_text = ?,
                    is_visible = ?,
                    updated_at = ?
                WHERE id = ?
            `).bind(
                    notice.site_title,
                    notice.site_subtitle,
                    notice.notice_title,
                    notice.event_datetime,
                    notice.venue_name,
                    notice.venue_address,
                    notice.map_url,
                    notice.route_url,
                    notice.notice_text,
                    notice.is_visible,
                    new Date().toISOString(),
                    "main"
            ).run();

            return jsonResponse({
                ok: true,
                message: "お知らせ・会場情報を保存しました。"
            });
        }

        return jsonResponse({
            ok: false,
            message: "未対応のメソッドです。"
        }, 405);

    } catch (error) {
        return jsonResponse({
            ok: false,
            message: "処理に失敗しました。",
            detail: String(error && error.message ? error.message : error)
        }, 500);
    }
}

async function ensureNoticeRow(db) {
    await db.prepare(`
        INSERT OR IGNORE INTO site_notice (
            id,
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
        )
        VALUES (
            ?,
            ?,
            ?,
            ?,
            '',
            '',
            '',
            '',
            '',
            '',
            1,
            ?
        )
    `).bind(
        "main",
        "第３部送別記念サイト",
        "皆様からの写真やメッセージをお待ちしております",
        "宴会場のお知らせ",
        new Date().toISOString()
    ).run();
}

async function getNotice(db) {
    return await db.prepare(`
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
}

function buildNotice(data) {
    return {
        site_title: sanitizeText(
            data.site_title || "第３部送別記念サイト",
            80
        ),
        site_subtitle: sanitizeText(
            data.site_subtitle || "皆様からの写真やメッセージをお待ちしております",
            160
        ),
        notice_title: sanitizeText(data.notice_title || "宴会場のお知らせ", 80),
        event_datetime: sanitizeText(data.event_datetime || "", 120),
        venue_name: sanitizeText(data.venue_name || "", 120),
        venue_address: sanitizeText(data.venue_address || "", 200),
        map_url: sanitizeUrl(data.map_url || "", 600),
        route_url: sanitizeUrl(data.route_url || "", 600),
        notice_text: sanitizeTextarea(data.notice_text || "", 1000),
        is_visible: data.is_visible ? 1 : 0
    };
}

function sanitizeText(value, maxLength) {
    return String(value || "")
        .replace(/[<>]/g, "")
        .replace(/[\u0000-\u001F\u007F]/g, "")
        .trim()
        .slice(0, maxLength);
}

function sanitizeTextarea(value, maxLength) {
    return String(value || "")
        .replace(/[<>]/g, "")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .trim()
        .slice(0, maxLength);
}

function sanitizeUrl(value, maxLength) {
    const url = String(value || "").trim();

    if (!url) {
        return "";
    }

    if (!/^https:\/\/[^\s"'<>]+$/i.test(url)) {
        return "";
    }

    return url.slice(0, maxLength);
}

function isValidAdminKey(inputKey, adminKey) {
    return Boolean(adminKey) && String(inputKey || "") === adminKey;
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