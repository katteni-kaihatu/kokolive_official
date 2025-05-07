import WebSocket from 'ws';

// 設定: 必要に応じて書き換えてください
const MISSKEY_INSTANCE = 'misskey.resonite.love'; // 例: 'misskey.io' や 'misskey.example.com'
const ACCESS_TOKEN = 'dqLZCuimGckjyVIkRsCFFY2NmgPdlf75'; // Misskeyのアクセストークン
const CHANNEL_ID = "9onhhto0or"; // チャンネル監視時はチャンネルIDを指定。LTLならnull

let ws;
let wsecho;
let wsecho_ready = false;

function connectWSEcho() {
    wsecho = new WebSocket("wss://wsecho.kokoa.dev/kokolive/official/comment");
    wsecho.on("open", () => {
        wsecho_ready = true;
    });
    wsecho.on("close", () => {
        wsecho_ready = false;
        setTimeout(connectWSEcho, 3000);
    });
    wsecho.on("error", () => {
        // closeが呼ばれるので何もしない
    });
}

function connectMisskeyWS() {
    ws = new WebSocket(`wss://${MISSKEY_INSTANCE}/streaming?i=${ACCESS_TOKEN}`);

    ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'connect', body: { channel: "channel", id: "kokolive_channel", params: { channelId: CHANNEL_ID } } }));
        ws.send(JSON.stringify({ type: "connect", body: { channel: "localTimeline", id: "localTimeline" } }));
        console.log('WebSocket connected and subscribed.');
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data);
        // console.log(JSON.stringify(msg, null, 2))
        if (!msg.body.type === "note") return

        if (msg.body.id === "localTimeline") {
            if (!msg.body.body.text?.includes("#kokolive")) {
                return
            }
        }

        const packed_data = {
            channel: msg.body.id,
            userId: msg.body.body.userId,
            user_display_name: msg.body.body.user.name ?? "",
            user_username: msg.body.body.user.username,
            user_avatar_url: msg.body.body.user.avatarUrl ?? "",
            text: msg.body.body.text.replace("#kokolive", "")
        }
        if (wsecho_ready) {
            wsecho.send(JSON.stringify(packed_data));
        }
    });

    ws.on('close', () => {
        console.log('WebSocket closed, reconnecting...');
        setTimeout(connectMisskeyWS, 3000);
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        // closeが呼ばれるので何もしない
    });
}

connectWSEcho();
connectMisskeyWS();
