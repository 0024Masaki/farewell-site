export async function onRequestPost(context) {
    try {
        const db = context.env.DB;
        const request = context.request;

        const data = await request.json();

        const recipientId = sanitizeKey(data.recipient_id || "person1", 30);
        const name = sanitizeText(data.name || "匿名", 30);
        const message = sanitizeText(data.message || "", 300);

        if (!message) {
            return jsonResponse({ ok: false, message: "メッセージを入力してください。" }, 400);
        }

        await db.prepare(`
            INSERT INTO messages (recipient_id, name, message, created_at)
            VALUES (?, ?, ?, ?)
        `).bind(
            recipientId,
            name,
            message,
            new Date().toISOString()
        ).run();

        return jsonResponse({ ok: true, message: "投稿ありがとうございました。" });

    } catch (error) {
        return jsonResponse({ ok: false, message: "投稿に失敗しました。" }, 500);
    }
}

function sanitizeText(value, maxLength) {
    return String(value).replace(/[<>]/g, "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}

function sanitizeKey(value, maxLength) {
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, maxLength);
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