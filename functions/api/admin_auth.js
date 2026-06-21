export async function onRequestPost(context) {
    try {
        const adminKey = context.env.ADMIN_KEY || "";
        const data = await context.request.json();

        if (!adminKey || String(data.key || "") !== adminKey) {
            return jsonResponse({
                ok: false,
                message: "認証エラー"
            }, 403);
        }

        return jsonResponse({
            ok: true,
            message: "認証しました。"
        });

    } catch (error) {
        return jsonResponse({
            ok: false,
            message: "認証処理に失敗しました。"
        }, 500);
    }
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