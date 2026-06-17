export async function onRequest(context) {
    const db = context.env.DB;
    const adminKey = context.env.ADMIN_KEY || "";

    try {
        const method = context.request.method.toUpperCase();

        if (method === "GET") {
            const url = new URL(context.request.url);
            const key = url.searchParams.get("key") || context.request.headers.get("x-admin-key") || "";

            if (!isValidAdminKey(key, adminKey)) {
                return json({ ok:false, message:"認証エラー" }, 403);
            }

            const result = await db.prepare(`
                SELECT id, name, title, photo_url, profile_html, sort_order, is_active
                FROM recipients
                ORDER BY sort_order ASC, id ASC
            `).all();

            return json({ ok:true, recipients:result.results || [] });
        }

        if (!["POST", "PUT", "DELETE"].includes(method)) {
            return json({ ok:false, message:"未対応のメソッドです。" }, 405);
        }

        const data = await readJson(context.request);

        if (!isValidAdminKey(data.key, adminKey)) {
            return json({ ok:false, message:"認証エラー" }, 403);
        }

        if (method === "POST") {
            return await createRecipient(db, data);
        }

        if (method === "PUT") {
            return await updateRecipient(db, data);
        }

        if (method === "DELETE") {
            if (data.action === "permanent_delete") {
                return await permanentDeleteRecipient(db, data);
            }

            return await hideRecipient(db, data);
        }

    } catch (error) {
        return json({
            ok:false,
            message:"処理に失敗しました。",
            detail:String(error && error.message ? error.message : error)
        }, 500);
    }
}

async function createRecipient(db, data) {
    const recipient = buildRecipient(data);

    if (!recipient.id || !recipient.name) {
        return json({ ok:false, message:"IDと名前は必須です。" }, 400);
    }

    const existing = await db.prepare(`
        SELECT id
        FROM recipients
        WHERE id = ?
        LIMIT 1
    `).bind(recipient.id).first();

    if (existing) {
        return json({
            ok:false,
            message:"同じIDの送別者が既にあります。編集ボタンから更新してください。"
        }, 409);
    }

    await db.prepare(`
        INSERT INTO recipients
            (id, name, title, photo_url, profile_html, sort_order, is_active, created_at)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        recipient.id,
        recipient.name,
        recipient.title,
        recipient.photo_url,
        recipient.profile_html,
        recipient.sort_order,
        recipient.is_active,
        new Date().toISOString()
    ).run();

    return json({ ok:true, message:"送別者を追加しました。" });
}

async function updateRecipient(db, data) {
    const recipient = buildRecipient(data);

    if (!recipient.id || !recipient.name) {
        return json({ ok:false, message:"IDと名前は必須です。" }, 400);
    }

    const existing = await db.prepare(`
        SELECT id
        FROM recipients
        WHERE id = ?
        LIMIT 1
    `).bind(recipient.id).first();

    if (!existing) {
        return json({ ok:false, message:"更新対象の送別者が見つかりません。" }, 404);
    }

    await db.prepare(`
        UPDATE recipients
        SET name = ?,
            title = ?,
            photo_url = ?,
            profile_html = ?,
            sort_order = ?,
            is_active = ?
        WHERE id = ?
    `).bind(
        recipient.name,
        recipient.title,
        recipient.photo_url,
        recipient.profile_html,
        recipient.sort_order,
        recipient.is_active,
        recipient.id
    ).run();

    return json({ ok:true, message:"送別者を更新しました。" });
}

async function hideRecipient(db, data) {
    const id = sanitizeKey(data.id || "", 30);

    if (!id) {
        return json({ ok:false, message:"IDがありません。" }, 400);
    }

    const existing = await db.prepare(`
        SELECT id
        FROM recipients
        WHERE id = ?
        LIMIT 1
    `).bind(id).first();

    if (!existing) {
        return json({ ok:false, message:"削除対象の送別者が見つかりません。" }, 404);
    }

    await db.prepare(`
        UPDATE recipients
        SET is_active = 0
        WHERE id = ?
    `).bind(id).run();

    return json({ ok:true, message:"送別者を非表示にしました。" });
}

async function permanentDeleteRecipient(db, data) {
    const id = sanitizeKey(data.id || "", 30);

    if (!id) {
        return json({ ok:false, message:"IDがありません。" }, 400);
    }

    const existing = await db.prepare(`
        SELECT id
        FROM recipients
        WHERE id = ?
        LIMIT 1
    `).bind(id).first();

    if (!existing) {
        return json({ ok:false, message:"完全削除対象の送別者が見つかりません。" }, 404);
    }

    await db.prepare(`
        DELETE FROM messages
        WHERE recipient_id = ?
    `).bind(id).run();

    await db.prepare(`
        DELETE FROM photos
        WHERE recipient_id = ?
    `).bind(id).run();

    await db.prepare(`
        DELETE FROM recipients
        WHERE id = ?
    `).bind(id).run();

    return json({ ok:true, message:"送別者を完全削除しました。" });
}

function buildRecipient(data) {
    return {
        id: sanitizeKey(data.id || "", 30),
        name: sanitizeText(data.name || "", 80),
        title: sanitizeText(data.title || "", 120),
        photo_url: sanitizeText(data.photo_url || "", 500),
        profile_html: sanitizeProfile(data.profile_html || "", 4000),
        sort_order: normalizeNumber(data.sort_order, 0),
        is_active: data.is_active ? 1 : 0
    };
}

async function readJson(request) {
    const contentType = request.headers.get("content-type") || "";

    if (!contentType.toLowerCase().includes("application/json")) {
        return {};
    }

    return await request.json();
}

function isValidAdminKey(inputKey, adminKey) {
    return Boolean(adminKey) && String(inputKey || "") === adminKey;
}

function normalizeNumber(value, fallback) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return fallback;
    }

    return Math.trunc(number);
}

function sanitizeText(value, maxLength) {
    return String(value)
        .replace(/[<>]/g, "")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
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
        .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
        .replace(/on\w+\s*=\s*'[^']*'/gi, "")
        .replace(/javascript\s*:/gi, "")
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
