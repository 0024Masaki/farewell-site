export async function onRequestGet(context) {
    try {

        const db = context.env.DB;

        const url =
            new URL(context.request.url);

        const recipientId =
            (url.searchParams.get("recipient_id") || "")
            .replace(/[^a-zA-Z0-9_-]/g, "");

        if (!recipientId) {

            return jsonResponse({
                ok:false,
                message:"recipient_idがありません"
            },400);

        }

        const result =
            await db.prepare(`
                SELECT
                    id,
                    name,
                    comment,
                    drive_file_id,
                    created_at
                FROM photos
                WHERE recipient_id = ?
                ORDER BY id DESC
            `)
            .bind(recipientId)
            .all();

        return jsonResponse({
            ok:true,
            photos:result.results || []
        });

    } catch(error){

        return jsonResponse({
            ok:false,
            message:"取得失敗"
        },500);

    }
}

function jsonResponse(data,status=200){

    return new Response(
        JSON.stringify(data),
        {
            status,
            headers:{
                "content-type":
                "application/json;charset=utf-8"
            }
        }
    );

}