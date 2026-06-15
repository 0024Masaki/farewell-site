export async function onRequestPost(context) {
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

        const response = await fetch(scriptUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        return jsonResponse(result, response.ok ? 200 : 500);

    } catch (error) {
        return jsonResponse({ ok: false, message: "写真投稿に失敗しました。" }, 500);
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