import WebSocket from 'ws';

// 設定: 必要に応じて書き換えてください
const MISSKEY_INSTANCE = 'misskey.resonite.love'; // 例: 'misskey.io' や 'misskey.example.com'
const ACCESS_TOKEN = 'dqLZCuimGckjyVIkRsCFFY2NmgPdlf75'; // Misskeyのアクセストークン
const CHANNEL_ID = "9onhhto0or"; // チャンネル監視時はチャンネルIDを指定。LTLならnull

const ws = new WebSocket(`wss://${MISSKEY_INSTANCE}/streaming?i=${ACCESS_TOKEN}`);
const wsecho = new WebSocket("wss://wsecho.kokoa.dev/kokolive/official/comment")
let wsecho_ready = false

wsecho.on("open", () => {
    wsecho_ready = true
})
wsecho.on("close", () => {
    wsecho_ready = false
})

ws.on('open', () => {

    ws.send(JSON.stringify({ type: 'connect', body: { channel: "channel", id: "kokolive_channel", params: { channelId: CHANNEL_ID } } }));
    ws.send(JSON.stringify({ type: "connect", body: { channel: "localTimeline", id: "localTimeline" } }))
    console.log('WebSocket connected and subscribed.');
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    // console.log(JSON.stringify(msg, null, 2))
    if(!msg.body.type === "note") return

    if(msg.body.id === "localTimeline") {
        if(!msg.body.body.text.includes("#kokolive")) {
            return
        }
    }

    const packed_data = {
        channel: msg.body.id,
        userId: msg.body.body.userId,
        user_display_name: msg.body.body.user.name ?? "",
        user_username: msg.body.body.user.username,
        user_avatar_url: msg.body.body.user.avatarUrl,
        text: msg.body.body.text.replace("#kokolive", "")
    }
    wsecho.send(JSON.stringify(packed_data))

});

ws.on('close', () => {
    console.log('WebSocket closed');
});

ws.on('error', (err) => {
    console.error('WebSocket error:', err);
});
