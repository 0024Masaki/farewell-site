const DEFAULT_SUMMARY_SETTINGS = {
    summary_enabled: true,
    show_photo_list: true,
    show_message_list: true,
    show_pdf_button: true,
    include_inactive_recipients: false
};

export async function onRequestGet(context) {
    try {
        const db = context.env.DB;
        const url = new URL(context.request.url);
        const metaOnly = url.searchParams.get("meta") === "1";

        await ensureSummarySettingsTable(db);

        const settings =
            await loadSummarySettings(db);

        if (metaOnly) {
            return jsonResponse({
                ok: true,
                settings
            });
        }

        const recipients =
            await loadRecipients(db, settings.include_inactive_recipients);

        if (recipients.length === 0) {
            return jsonResponse({
                ok: true,
                settings,
                recipients: []
            });
        }

        const recipientIdSet =
            new Set(recipients.map(recipient => recipient.id));

        const messageMap =
            settings.show_message_list
                ? await loadMessagesByRecipient(db, recipientIdSet)
                : new Map();

        const photoMap =
            settings.show_photo_list
                ? await loadPhotosByRecipient(db, recipientIdSet)
                : new Map();

        const summaryRecipients =
            recipients.map(recipient => ({
                id: recipient.id,
                name: recipient.name,
                title: recipient.title || "",
                photo_url: recipient.photo_url || "",
                sort_order: recipient.sort_order,
                is_active: Boolean(recipient.is_active),
                messages: messageMap.get(recipient.id) || [],
                photos: photoMap.get(recipient.id) || []
            }));

        return jsonResponse({
            ok: true,
            settings,
            recipients: summaryRecipients
        });

    } catch (error) {
        return jsonResponse({
            ok: false,
            message: "まとめページ情報を取得できませんでした。"
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

async function loadRecipients(db, includeInactive) {
    const whereClause =
        includeInactive
            ? ""
            : "WHERE is_active = 1";

    const result =
        await db.prepare(`
            SELECT
                id,
                name,
                title,
                photo_url,
                sort_order,
                is_active
            FROM recipients
            ${whereClause}
            ORDER BY sort_order ASC, id ASC
        `).all();

    return result.results || [];
}

async function loadMessagesByRecipient(db, recipientIdSet) {
    const result =
        await db.prepare(`
            SELECT
                id,
                recipient_id,
                name,
                message,
                created_at
            FROM messages
            ORDER BY recipient_id ASC, id DESC
        `).all();

    const messageMap = new Map();

    (result.results || []).forEach(message => {
        if (!recipientIdSet.has(message.recipient_id)) {
            return;
        }

        if (!messageMap.has(message.recipient_id)) {
            messageMap.set(message.recipient_id, []);
        }

        messageMap.get(message.recipient_id).push({
            id: message.id,
            name: message.name || "匿名",
            message: message.message || "",
            created_at: message.created_at || ""
        });
    });

    return messageMap;
}

async function loadPhotosByRecipient(db, recipientIdSet) {
    const result =
        await db.prepare(`
            SELECT
                id,
                recipient_id,
                name,
                comment,
                drive_file_id,
                created_at
            FROM photos
            ORDER BY recipient_id ASC, id DESC
        `).all();

    const photoMap = new Map();

    (result.results || []).forEach(photo => {
        if (!recipientIdSet.has(photo.recipient_id)) {
            return;
        }

        if (!photo.drive_file_id) {
            return;
        }

        if (!photoMap.has(photo.recipient_id)) {
            photoMap.set(photo.recipient_id, []);
        }

        photoMap.get(photo.recipient_id).push({
            id: photo.id,
            name: photo.name || "匿名",
            comment: photo.comment || "",
            drive_file_id: photo.drive_file_id,
            created_at: photo.created_at || ""
        });
    });

    return photoMap;
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
