# セットアップガイド

## 🚀 クイックスタート

### ローカルで試す

1. **HTTPサーバーを起動**（Service Workerにはhttps/localhostが必要）

```bash
# Python 3の場合
cd invader-game
python3 -m http.server 8000

# Node.jsの場合
npx serve invader-game
```

2. **ブラウザでアクセス**
```
http://localhost:8000/index.html
```

3. **PC/モバイルで確認**
   - PC: キーボード操作で動作確認
   - スマホ: DevToolsのデバイスエミュレーターで確認

### iPhoneでテストする

#### 方法1: ローカルネットワーク経由（開発用）

1. PCとiPhoneを同じWi-Fiに接続
2. PCのローカルIPアドレスを確認
   ```bash
   # Mac/Linux
   ifconfig | grep "inet "
   # または
   ip addr show
   ```
3. iPhoneのSafariで `http://[PCのIP]:8000/index.html` にアクセス

#### 方法2: GitHub Pages（本番環境）

1. GitHubリポジトリにプッシュ
2. Settings → Pages でGitHub Pagesを有効化
3. 公開されたURLにiPhoneでアクセス
4. 「共有」→「ホーム画面に追加」

## 📱 iPhoneでホーム画面に追加する手順

1. SafariでゲームのURLを開く
2. 画面下部の **共有ボタン**（□↑）をタップ
3. 下にスクロールして **「ホーム画面に追加」** を選択
4. 任意の名前を入力（デフォルト: インベーダー）
5. **「追加」** をタップ

これで、ホーム画面からタップするだけでゲームを起動できます！

## 🎨 アイコンの設定（オプション）

現在、アイコンは設定されていません。カスタムアイコンを追加する場合：

### 自動生成を使用

1. ブラウザで `generate-icons.html` を開く
2. 表示されたアイコンをダウンロード
   - 「ダウンロード」ボタンをクリック
   - `icon-192.png`（192x192）
   - `icon-512.png`（512x512）
3. ダウンロードしたファイルを `invader-game/` ディレクトリに配置
4. `manifest.json` を更新:

```json
"icons": [
  {
    "src": "icon-192.png",
    "sizes": "192x192",
    "type": "image/png",
    "purpose": "any maskable"
  },
  {
    "src": "icon-512.png",
    "sizes": "512x512",
    "type": "image/png",
    "purpose": "any maskable"
  }
]
```

5. `index.html` の `<head>` に追加:
```html
<link rel="apple-touch-icon" href="icon-192.png">
```

### カスタムアイコンを使用

- 192x192px と 512x512px のPNG画像を準備
- 上記と同じ手順で配置・設定

## 🧪 動作テスト

### PCブラウザでテスト
- [ ] キーボード操作（矢印キー、スペース、Enter）
- [ ] ゲームロジック（敵の移動、衝突判定、スコア）
- [ ] ゲームオーバー/ステージクリア

### スマホブラウザでテスト
- [ ] タッチ操作（画面タップで移動）
- [ ] 仮想ボタン（◄、►、発射、スタート）
- [ ] レスポンシブレイアウト
- [ ] スクロールが発生しないか確認

### PWA機能のテスト
- [ ] Service Worker登録（Console確認）
- [ ] オフライン動作（機内モードでアクセス）
- [ ] ホーム画面に追加
- [ ] フルスクリーン起動

## 🔧 トラブルシューティング

### Service Workerが登録されない
- HTTPSまたはlocalhostでアクセスしているか確認
- ブラウザのConsoleでエラーを確認
- キャッシュをクリアして再読み込み

### タッチ操作が効かない
- ブラウザのConsoleでエラーを確認
- タッチイベントがサポートされているか確認
- デバイスエミュレーターで確認

### ホーム画面に追加できない
- Safariで開いているか確認（Chrome/Firefoxでは非対応）
- manifest.jsonが正しく読み込まれているか確認
- HTTPSでアクセスしているか確認（ローカルホストは除く）

### 画面サイズがおかしい
- viewportメタタグが設定されているか確認
- ブラウザのズームレベルを確認
- デバイスの向き（縦/横）を確認

## 📊 ブラウザ互換性

| ブラウザ | バージョン | 動作 | PWA |
|---------|----------|------|-----|
| Safari (iOS) | 12.2+ | ✅ | ✅ |
| Chrome (iOS) | 最新 | ✅ | ❌ |
| Safari (Mac) | 最新 | ✅ | ✅ |
| Chrome (PC) | 最新 | ✅ | ✅ |
| Firefox | 最新 | ✅ | ✅ |
| Edge | 最新 | ✅ | ✅ |

注: iOSでは、PWA機能はSafariでのみサポートされています。

## 🎉 完成！

これで、iPhoneで手軽に遊べるインベーダーゲームが完成しました！
質問や問題があれば、READMEを参照してください。

楽しいゲームライフを！👾🚀
