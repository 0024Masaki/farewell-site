export async function onRequest(context) {
    if (context.request.method !== "POST") {
        return jsonResponse({ ok: false, message: "POSTのみ対応しています。" }, 405);
    }

    try {
        const scriptUrl = context.env.PHOTO_SCRIPT_URL;
        const uploadKey = context.env.PHOTO_UPLOAD_KEY;

        if (!scriptUrl || !uploadKey) {
            return jsonResponse({ ok: false, message: "写真投稿設定が未設定です。" }, 500);
        }

        const data = await context.request.json();

        const payload = {
            key: uploadKey,
            name: sanitizeText(data.name || "匿名", 30),
            comment: sanitizeText(data.comment || "", 200),
            fileName: sanitizeFileName(data.fileName || "photo.jpg"),
            mimeType: data.mimeType || "",
            base64: data.base64 || ""
        };

        if (!payload.base64) {
            return jsonResponse({ ok: false, message: "写真データがありません。" }, 400);
        }

        if (!/^image\/(jpeg|png|webp)$/.test(payload.mimeType)) {
            return jsonResponse({ ok: false, message: "対応していない画像形式です。" }, 400);
        }

        const response = await fetch(scriptUrl, {
            method: "POST",
            headers: {
                "content-type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload)
        });

        const text = await response.text();

        let result;
        try {
            result = JSON.parse(text);
        } catch (error) {
            return jsonResponse({
                ok: false,
                message: "Google側の応答を解析できません。",
                detail: text.slice(0, 200)
            }, 500);
        }

        return jsonResponse(result, result.ok ? 200 : 500);

    } catch (error) {
        return jsonResponse({
            ok: false,
            message: "写真投稿に失敗しました。"
        }, 500);
    }
}

function sanitizeText(value, maxLength) {
    return String(value)
        .replace(/[<>]/g, "")
        .replace(/[\u0000-\u001F\u007F]/g, "")
        .trim()
        .slice(0, maxLength);
}

function sanitizeFileName(value) {
    const safeName = String(value)
        .replace(/[\\/:*?"<>|]/g, "_")
        .replace(/[\u0000-\u001F\u007F]/g, "")
        .trim()
        .slice(0, 80);

    return safeName || "photo.jpg";
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