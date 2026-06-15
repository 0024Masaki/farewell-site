export async function onRequestPost(context) {
    try {
        const db = context.env.DB;
        const request = context.request;

        const contentType = request.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            return jsonResponse({ ok: false, message: "送信形式が正しくありません。" }, 400);
        }

        const data = await request.json();

        const name = sanitizeText(data.name || "匿名", 30);
        const message = sanitizeText(data.message || "", 300);

        if (!message) {
            return jsonResponse({ ok: false, message: "メッセージを入力してください。" }, 400);
        }

        await db.prepare(`
            INSERT INTO messages (name, message, created_at)
            VALUES (?, ?, ?)
        `).bind(
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
    return String(value)
        .replace(/[\u0000-\u001F\u007F]/g, "")
        .replace(/[<>]/g, "")
        .trim()
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