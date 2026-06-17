export async function onRequestPost(context) {
    try {
        const db = context.env.DB;
        const adminKey = context.env.ADMIN_KEY || "";
        const scriptUrl = context.env.PHOTO_SCRIPT_URL;
        const uploadKey = context.env.PHOTO_UPLOAD_KEY;

        const data = await context.request.json();

        if (data.key !== adminKey) {
            return json({ ok:false, message:"認証エラー" },403);
        }

        const id = Number(data.id);
        const driveFileId = sanitizeKey(data.drive_file_id || "", 100);

        if (!id || !driveFileId) {
            return json({ ok:false, message:"削除情報が不足しています。" },400);
        }

        await fetch(scriptUrl, {
            method:"POST",
            headers:{ "content-type":"text/plain;charset=utf-8" },
            body:JSON.stringify({
                key: uploadKey,
                action:"delete",
                file_id: driveFileId
            })
        });

        await db.prepare(`
            DELETE FROM photos
            WHERE id = ?
        `).bind(id).run();

        return json({ ok:true, message:"写真を削除しました。" });

    } catch (error) {
        return json({ ok:false, message:"写真削除に失敗しました。" },500);
    }
}

function sanitizeKey(value, maxLength) {
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, maxLength);
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