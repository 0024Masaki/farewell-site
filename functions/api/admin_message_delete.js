export async function onRequestPost(context) {
    try {
        const db = context.env.DB;
        const adminKey = context.env.ADMIN_KEY || "";
        const data = await context.request.json();

        if (data.key !== adminKey) {
            return json({ ok:false, message:"認証エラー" },403);
        }

        const id = Number(data.id);

        if (!id) {
            return json({ ok:false, message:"IDがありません。" },400);
        }

        await db.prepare(`
            DELETE FROM messages
            WHERE id = ?
        `).bind(id).run();

        return json({ ok:true, message:"メッセージを削除しました。" });

    } catch (error) {
        return json({ ok:false, message:"削除に失敗しました。" },500);
    }
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