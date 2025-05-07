// obs-control.mjs
import OBSWebSocket from 'obs-websocket-js';

const obs = new OBSWebSocket();

// OBS WebSocket 接続設定
const obsConfig = {
  address: 'ws://localhost:4456', // OBS 28+ のデフォルト WebSocket アドレス
  password: 'QfI2FyriKApJepZa'   // あなたの WebSocket パスワードに変更してください
};

// シーン名と VLC ソース名
const sceneName = 'シーン 2';
const vlcSourceName = 'VLC ビデオソース';

// 設定したい新しい URL
const newMediaURL = 'rtsp://192.168.10.201:8554/stream1';

async function connectToOBS() {
  try {
    // OBS WebSocket サーバーに接続
    console.log('OBS WebSocket に接続中...');
    await obs.connect(obsConfig.address, obsConfig.password);
    console.log('OBS に正常に接続しました');
    
    // 現在のシーンアイテムを取得してソースの存在を確認
    const { sceneItems } = await obs.call('GetSceneItemList', { sceneName });
    
    // VLC ソースを検索
    const vlcSource = sceneItems.find(item => item.sourceName === vlcSourceName);
    
    if (!vlcSource) {
      console.error(`シーン "${sceneName}" 内に VLC ソース "${vlcSourceName}" が見つかりません`);
      await obs.disconnect();
      return;
    }
    
    // VLC ソースの現在の設定を取得
    const { inputSettings } = await obs.call('GetInputSettings', {
      inputName: vlcSourceName
    });
    
    console.log('現在の VLC ソース設定:', inputSettings);
    
    // 新しい URL で設定を更新
    // VLC ソースの場合、プレイリストはメディア URL を含む配列
    const newSettings = {
      ...inputSettings,
      network_caching: 100,
      playlist: [
        {
          value: newMediaURL,
          selected: true,
          hidden: false
        }
      ]
    };
    
    // 新しい設定でソースを更新
    await obs.call('SetInputSettings', {
      inputName: vlcSourceName,
      inputSettings: newSettings
    });
    
    console.log(`VLC ソース URL を正常に更新しました: ${newMediaURL}`);
    
    // OBS との接続を切断
    await obs.disconnect();
    console.log('OBS WebSocket から切断しました');
    
  } catch (error) {
    console.error('エラー:', error);
    
    // エラーが発生しても接続を切断
    if (obs.socket && obs.socket.readyState === 1) {
      await obs.disconnect();
    }
  }
}

// 関数を実行
connectToOBS();