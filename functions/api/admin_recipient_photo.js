const MAX_PHOTO_BASE64_LENGTH = 3 * 1024 * 1024;

export async function onRequestPost(context) {
    try {
        const adminKey = context.env.ADMIN_KEY || "";
        const uploadUrl = context.env.PHOTO_SCRIPT_URL || "";
        const uploadKey = context.env.PHOTO_UPLOAD_KEY || "photo";

        if (!adminKey) {
            return jsonResponse({ ok: false, message: "ADMIN_KEYが設定されていません。" }, 500);
        }

        if (!uploadUrl) {
            return jsonResponse({ ok: false, message: "PHOTO_UPLOAD_URLが設定されていません。" }, 500);
        }

        const data = await context.request.json();

        if (data.key !== adminKey) {
            return jsonResponse({ ok: false, message: "認証エラー" }, 403);
        }

        const mimeType = String(data.mimeType || "");
        const base64 = String(data.base64 || "");

        if (!/^image\/(jpeg|png|webp)$/.test(mimeType)) {
            return jsonResponse({ ok: false, message: "JPEG、PNG、WebP の画像を選択してください。" }, 400);
        }

        if (!base64) {
            return jsonResponse({ ok: false, message: "画像データが空です。" }, 400);
        }

        if (base64.length > MAX_PHOTO_BASE64_LENGTH) {
            return jsonResponse({ ok: false, message: "画像データが大きすぎます。小さい画像を選択してください。" }, 413);
        }

        const response = await fetch(uploadUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({
                key: uploadKey,
                name: "送別者顔写真",
                comment: "送別者管理ページからアップロード",
                fileName: sanitizeFileName(data.fileName || "recipient.jpg", 80),
                mimeType: mimeType,
                base64: base64
            })
        });

        const text = await response.text();

        let result;
        try {
            result = JSON.parse(text);
        } catch (error) {
            return jsonResponse({
                ok: false,
                message: "Apps Scriptの戻り値がJSONではありません。",
                detail: text.slice(0, 300)
            }, 500);
        }

        if (!response.ok || !result.ok || !result.file_id) {
            return jsonResponse({
                ok: false,
                message: result.message || "顔写真アップロードに失敗しました。"
            }, 500);
        }

        const photoUrl = `https://drive.google.com/thumbnail?id=${encodeURIComponent(result.file_id)}&sz=w600`;

        return jsonResponse({
            ok: true,
            message: "顔写真をアップロードしました。",
            photo_url: photoUrl,
            drive_file_id: result.file_id
        });

    } catch (error) {
        return jsonResponse({
            ok: false,
            message: "顔写真アップロードに失敗しました。",
            detail: String(error && error.message ? error.message : error)
        }, 500);
    }
}

function sanitizeFileName(value, maxLength) {
    return String(value || "")
        .replace(/[\\/:*?"<>|]/g, "")
        .replace(/[\u0000-\u001F\u007F]/g, "")
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