// obs-mediamtx-control.mjs
import OBSWebSocket from 'obs-websocket-js';
// import fetch from 'node-fetch';

// MediaMTX API 設定
const MEDIAMTX_API_URL = 'http://192.168.10.201:9997/v3/paths/list';
const STREAM_PATH = 'stream1';
const CHECK_INTERVAL = 1000; // 10秒ごとにチェック

// OBS WebSocket 接続設定
const obsConfig = {
    address: 'ws://192.168.16.4:4455', // OBS 28+ のデフォルト WebSocket アドレス
    password: 'kobato'   // あなたの WebSocket パスワードに変更してください
};

const sceneName = 'シーン';
const adSceneName = 'adScene'; // 別シーン名（必要に応じて変更）
const vlcSourceName = 'VLC ビデオソース';

// OBS WebSocket インスタンス
const obs = new OBSWebSocket();
let isConnected = false;
let lastStreamState = null;

// OBS WebSocket へ接続
async function connectToOBS() {
    if (isConnected) return;

    try {
        await obs.connect(obsConfig.address, obsConfig.password);
        isConnected = true;
        console.log('OBS に正常に接続しました');
    } catch (error) {
        console.error('OBS 接続エラー:', error);
        isConnected = false;
    }
}

// OBS から切断
async function disconnectFromOBS() {
    if (!isConnected) return;

    try {
        await obs.disconnect();
        isConnected = false;
        console.log('OBS から切断しました');
    } catch (error) {
        console.error('OBS 切断エラー:', error);
    }
}

async function setVLCSourceVisibility(visible) {
    if (!isConnected) await connectToOBS();

    try {
        const { sceneItems } = await obs.call('GetSceneItemList', { sceneName });
        const vlcItem = sceneItems.find(item => item.sourceName === vlcSourceName);

        if (!vlcItem) {
            console.error(`シーン "${sceneName}" 内に VLC ソース "${vlcSourceName}" が見つかりません`);
            return;
        }

        await obs.call('SetSceneItemEnabled', {
            sceneName,
            sceneItemId: vlcItem.sceneItemId,
            sceneItemEnabled: visible
        });

        console.log(`VLC ソース "${vlcSourceName}" を ${visible ? '表示' : '非表示'} に設定しました`);
    } catch (error) {
        console.error('VLC ソース可視性設定エラー:', error);
        await disconnectFromOBS();
    }
}

// シーンを切り替える
async function switchScene(targetScene) {
    if (!isConnected) await connectToOBS();
    try {
        await obs.call('SetCurrentProgramScene', { sceneName: targetScene });
        console.log(`シーンを "${targetScene}" に切り替えました`);
    } catch (error) {
        console.error('シーン切り替えエラー:', error);
    }
}

async function checkMediaMTXStream() {
    try {
        const response = await fetch(MEDIAMTX_API_URL);

        if (!response.ok) {
            throw new Error(`MediaMTX API エラー: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const streams = data.items || [];

        // 特定のストリームパスが存在するか確認
        const targetStream = streams.find(stream => stream.name === STREAM_PATH);
        const isStreamActive = Boolean(targetStream);

        console.log(`ストリーム "${STREAM_PATH}" 状態: ${isStreamActive ? '配信中' : '配信なし'}`);

        // 前回の状態と異なる場合のみ処理
        if (lastStreamState !== isStreamActive) {
            lastStreamState = isStreamActive;

            if (isStreamActive) {
                // ストリームがある場合: シーン切り替え＋VLCソース有効＋URL更新
                await switchScene(sceneName);
                await setVLCSourceVisibility(true);

                // VLCソースのURL(playlist)を更新
                const newMediaURL = 'rtsp://192.168.10.201:8554/stream1';
                try {
                    // 現在の設定取得
                    const { inputSettings } = await obs.call('GetInputSettings', {
                        inputName: vlcSourceName
                    });
                    console.log(inputSettings)
                    // playlistを新URLで上書き
                    const newSettings = {
                        ...inputSettings,
                        network_caching: 100,
                        playlist: [
                            {
                                value: newMediaURL + `?random=${Math.random()}`,
                                selected: true,
                                hidden: false
                            }
                        ]
                    };
                    await obs.call('SetInputSettings', {
                        inputName: vlcSourceName,
                        inputSettings: newSettings
                    });
                    console.log(`VLC ソース URL を正常に更新しました: ${newMediaURL}`);
                    

                    setTimeout(async () => {
                        // VLCソースを再起動（再生し直す）
                        await obs.call('TriggerMediaInputAction', { inputName: vlcSourceName, mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP' });
                        setTimeout(async () => {
                            await obs.call('TriggerMediaInputAction', { inputName: vlcSourceName, mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART' });
                        }, 3000);
                    }, 5000);

                } catch (e) {
                    console.error('VLCソースURL更新エラー:', e);
                }
            } else {
                // ストリームがない場合: VLCソース非表示＋adSceneに切り替え
                await setVLCSourceVisibility(false);
                await switchScene(adSceneName);
            }
        }
    } catch (error) {
        console.error('MediaMTX API チェックエラー:', error);
    }
}

// メイン処理: 定期的にチェック
async function main() {
    console.log('MediaMTX ストリーム監視を開始します...');

    // 初回チェック
    await checkMediaMTXStream();

    // 定期的にチェック
    setInterval(checkMediaMTXStream, CHECK_INTERVAL);
}

// エラーハンドリングと終了処理
process.on('SIGINT', async () => {
    console.log('プログラムを終了します...');
    await disconnectFromOBS();
    process.exit(0);
});

// プログラム開始
main().catch(error => {
    console.error('メインプロセスエラー:', error);
    disconnectFromOBS();
});
