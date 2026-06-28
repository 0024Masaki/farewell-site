const DEFAULT_SUMMARY_SETTINGS = {
    summary_enabled: true,
    show_photo_list: true,
    show_message_list: true,
    show_pdf_button: true,
    include_inactive_recipients: false
};

export async function onRequest(context) {
    try {
        const db = context.env.DB;
        const adminKey = context.env.ADMIN_KEY || "";
        const method = context.request.method.toUpperCase();

        await ensureSummarySettingsTable(db);

        if (method === "GET") {
            const url = new URL(context.request.url);
            const key =
                url.searchParams.get("key") ||
                context.request.headers.get("x-admin-key") ||
                "";

            if (!isValidAdminKey(key, adminKey)) {
                return jsonResponse({
                    ok: false,
                    message: "認証エラー"
                }, 403);
            }

            const settings =
                await loadSummarySettings(db);

            return jsonResponse({
                ok: true,
                settings
            });
        }

        if (method === "POST" || method === "PUT") {
            const data =
                await readJson(context.request);

            if (!isValidAdminKey(data.key, adminKey)) {
                return jsonResponse({
                    ok: false,
                    message: "認証エラー"
                }, 403);
            }

            const currentSettings =
                await loadSummarySettings(db);

            const nextSettings =
                buildSettings(data, currentSettings);

            await saveSummarySettings(db, nextSettings);

            return jsonResponse({
                ok: true,
                message: "まとめページ設定を保存しました。",
                settings: nextSettings
            });
        }

        return jsonResponse({
            ok: false,
            message: "未対応のメソッドです。"
        }, 405);

    } catch (error) {
        return jsonResponse({
            ok: false,
            message: "まとめページ設定の処理に失敗しました。",
            detail: String(error && error.message ? error.message : error)
        }, 500);
    }
}

async function ensureSummarySettingsTable(db) {
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS summary_settings (
            setting_key TEXT PRIMARY KEY,
            setting_value TEXT NOT NULL,
            updated_at TEXT
        )
    `).run();
}

async function loadSummarySettings(db) {
    const result =
        await db.prepare(`
            SELECT setting_key, setting_value
            FROM summary_settings
        `).all();

    const settings = {
        ...DEFAULT_SUMMARY_SETTINGS
    };

    (result.results || []).forEach(row => {
        if (Object.prototype.hasOwnProperty.call(settings, row.setting_key)) {
            settings[row.setting_key] = row.setting_value === "1";
        }
    });

    return settings;
}

function buildSettings(data, currentSettings) {
    const nextSettings = {
        ...currentSettings
    };

    Object.keys(DEFAULT_SUMMARY_SETTINGS).forEach(key => {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            nextSettings[key] = Boolean(data[key]);
        }
    });

    return nextSettings;
}

async function saveSummarySettings(db, settings) {
    const now =
        new Date().toISOString();

    for (const [key, value] of Object.entries(settings)) {
        await db.prepare(`
            INSERT INTO summary_settings (
                setting_key,
                setting_value,
                updated_at
            )
            VALUES (?, ?, ?)
            ON CONFLICT(setting_key)
            DO UPDATE SET
                setting_value = excluded.setting_value,
                updated_at = excluded.updated_at
        `).bind(
            key,
            value ? "1" : "0",
            now
        ).run();
    }
}

async function readJson(request) {
    const contentType =
        request.headers.get("content-type") || "";

    if (!contentType.toLowerCase().includes("application/json")) {
        return {};
    }

    return await request.json();
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
