export async function onRequestPost(context) {
    try {
        const adminKey = context.env.ADMIN_KEY || "";
        const uploadUrl = context.env.PHOTO_UPLOAD_URL || "";
        const uploadKey = context.env.PHOTO_UPLOAD_KEY || "photo";

        const data = await context.request.json();

        if (data.key !== adminKey) {
            return json({ ok:false, message:"認証エラー" }, 403);
        }

        if (!uploadUrl) {
            return json({ ok:false, message:"写真アップロードURLが設定されていません。" }, 500);
        }

        const mimeType = String(data.mimeType || "");

        if (!/^image\/(jpeg|png|webp)$/.test(mimeType)) {
            return json({ ok:false, message:"JPEG、PNG、WebP の画像を選択してください。" }, 400);
        }

        const response = await fetch(uploadUrl, {
            method:"POST",
            headers:{
                "content-type":"application/json"
            },
            body:JSON.stringify({
                key:uploadKey,
                name:"送別者顔写真",
                comment:"送別者管理ページからアップロード",
                fileName:sanitizeFileName(data.fileName || "recipient.jpg", 80),
                mimeType:mimeType,
                base64:String(data.base64 || "")
            })
        });

        const result = await response.json();

        if (!response.ok || !result.ok || !result.file_id) {
            return json({
                ok:false,
                message:result.message || "顔写真アップロードに失敗しました。"
            }, 500);
        }

        const photoUrl =
            `https://drive.google.com/thumbnail?id=${encodeURIComponent(result.file_id)}&sz=w600`;

        return json({
            ok:true,
            message:"顔写真をアップロードしました。",
            photo_url:photoUrl,
            drive_file_id:result.file_id
        });

    } catch (error) {
        return json({
            ok:false,
            message:"顔写真アップロードに失敗しました。",
            detail:String(error && error.message ? error.message : error)
        }, 500);
    }
}

function sanitizeFileName(value, maxLength) {
    return String(value)
        .replace(/[\\/:*?"<>|]/g, "")
        .replace(/[\u0000-\u001F\u007F]/g, "")
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