const MAX_PHOTO_BASE64_LENGTH = 3 * 1024 * 1024;

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

            const result = await db.prepare(`
                SELECT
                    id,
                    drive_file_id,
                    image_url,
                    sort_order,
                    created_at
                FROM site_hero_photos
                ORDER BY sort_order ASC, id ASC
            `).all();

            return jsonResponse({
                ok: true,
                photos: result.results || []
            });
        }

        if (method === "POST") {
            const data = await context.request.json();

            if (!isValidAdminKey(data.key, adminKey)) {
                return jsonResponse({
                    ok: false,
                    message: "認証エラー"
                }, 403);
            }

            return await uploadHeroPhoto(context, db, data);
        }

        if (method === "DELETE") {
            const data = await context.request.json();

            if (!isValidAdminKey(data.key, adminKey)) {
                return jsonResponse({
                    ok: false,
                    message: "認証エラー"
                }, 403);
            }

            return await deleteHeroPhoto(context, db, data);
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

async function uploadHeroPhoto(context, db, data) {
    const uploadUrl =
        context.env.PHOTO_SCRIPT_URL ||
        context.env.PHOTO_UPLOAD_URL ||
        "";

    const uploadKey =
        context.env.PHOTO_UPLOAD_KEY || "photo";

    if (!uploadUrl) {
        return jsonResponse({
            ok: false,
            message: "写真アップロードURLが設定されていません。"
        }, 500);
    }

    const mimeType = String(data.mimeType || "");
    const base64 = String(data.base64 || "");

    if (!/^image\/(jpeg|png|webp)$/.test(mimeType)) {
        return jsonResponse({
            ok: false,
            message: "JPEG、PNG、WebP の画像を選択してください。"
        }, 400);
    }

    if (!base64) {
        return jsonResponse({
            ok: false,
            message: "画像データが空です。"
        }, 400);
    }

    if (base64.length > MAX_PHOTO_BASE64_LENGTH) {
        return jsonResponse({
            ok: false,
            message: "画像データが大きすぎます。小さい画像を選択してください。"
        }, 413);
    }

    const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
            "content-type": "application/json"
        },
        body: JSON.stringify({
            key: uploadKey,
            name: "TOP写真",
            comment: "お知らせ・会場管理ページからアップロード",
            fileName: sanitizeFileName(data.fileName || "site-hero.jpg", 80),
            mimeType,
            base64
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
            message: result.message || "TOP写真アップロードに失敗しました。"
        }, 500);
    }

    const imageUrl =
        `https://drive.google.com/thumbnail?id=${encodeURIComponent(result.file_id)}&sz=w1200`;

    const maxSort = await db.prepare(`
        SELECT COALESCE(MAX(sort_order), 0) AS max_sort
        FROM site_hero_photos
    `).first();

    const nextSort =
        Number(maxSort && maxSort.max_sort ? maxSort.max_sort : 0) + 1;

    await db.prepare(`
        INSERT INTO site_hero_photos (
            drive_file_id,
            image_url,
            sort_order,
            created_at
        )
        VALUES (?, ?, ?, ?)
    `).bind(
        result.file_id,
        imageUrl,
        nextSort,
        new Date().toISOString()
    ).run();

    return jsonResponse({
        ok: true,
        message: "TOP写真を追加しました。"
    });
}

async function deleteHeroPhoto(context, db, data) {
    const id = Number(data.id);

    if (!Number.isInteger(id) || id < 1) {
        return jsonResponse({
            ok: false,
            message: "削除対象が正しくありません。"
        }, 400);
    }

    const photo = await db.prepare(`
        SELECT id, drive_file_id
        FROM site_hero_photos
        WHERE id = ?
        LIMIT 1
    `).bind(id).first();

    if (!photo) {
        return jsonResponse({
            ok: false,
            message: "削除対象の写真が見つかりません。"
        }, 404);
    }

    const uploadUrl =
        context.env.PHOTO_SCRIPT_URL ||
        context.env.PHOTO_UPLOAD_URL ||
        "";

    const uploadKey =
        context.env.PHOTO_UPLOAD_KEY || "photo";

    if (uploadUrl && photo.drive_file_id) {
        const response = await fetch(uploadUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({
                action: "delete",
                key: uploadKey,
                file_id: photo.drive_file_id
            })
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
            return jsonResponse({
                ok: false,
                message: result.message || "Google Drive側の写真削除に失敗しました。"
            }, 500);
        }
    }

    await db.prepare(`
        DELETE FROM site_hero_photos
        WHERE id = ?
    `).bind(id).run();

    return jsonResponse({
        ok: true,
        message: "TOP写真を削除しました。"
    });
}

function sanitizeFileName(value, maxLength) {
    return String(value || "")
        .replace(/[\\/:*?"<>|]/g, "")
        .replace(/[\u0000-\u001F\u007F]/g, "")
        .trim()
        .slice(0, maxLength);
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