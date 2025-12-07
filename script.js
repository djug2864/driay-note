// =========================================================================
// 1. Firebaseの設定（ここをあなたの情報に書き換える必要があります！）
// =========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyAaLm_M8wlsbIWUVEZgjRXicLSw0_D0R7M",              // Firebaseの「APIキー」
    authDomain: "djug-diary.firebaseapp.com", // Firebaseの「認証ドメイン」
    projectId: "djug-diary",        // Firebaseの「プロジェクトID」
    storageBucket: "djug-diary.firebasestorage.app", // Firebaseの「ストレージバケット」
    messagingSenderId: "886149384144", // Firebaseの「メッセージングID」
    appId: "1:886149384144:web:3a53323507b1cf4a345bd5"                 // Firebaseの「アプリID」
};

// 【重要】
// 投稿・削除ができるのは、このIDを持つあなただけにするための設定です。
// あなたがログインしたときの「ユーザーID（UID）」をここに入れてください！
const ADMIN_UID = "kBicyBS3KtWPdy4iaGCmYpyLwGB3"; 

// Firebaseの初期化（アプリを動かす準備）
firebase.initializeApp(firebaseConfig);

// 使うサービスに名前を付ける
const auth = firebase.auth();         // ログイン・ログアウト（認証）のサービス
const db = firebase.firestore();      // データベース（データの保存）のサービス

// =========================================================================
// 2. HTMLの要素を取得（【変更点】モーダル関連の要素を追加）
// =========================================================================
const menuToggleButton = document.getElementById('menu-toggle-button');
const menuCloseButton = document.getElementById('menu-close-button');
const fullScreenMenu = document.getElementById('full-screen-menu');
const authButton = document.getElementById('auth-button');
const postSection = document.getElementById('post-section');
const accountNameSpan = document.getElementById('account-name');
const accountEmailSpan = document.getElementById('account-email');

const diaryInput = document.getElementById('diary-input');
const postButton = document.getElementById('post-button');
const diaryListDiv = document.getElementById('diary-list');

// --- モーダル関連の要素 ---
const modal = document.getElementById('modal');
const externalUrlDisplay = document.getElementById('external-url-display');
const confirmButton = document.getElementById('confirm-button');
const cancelButton = document.getElementById('cancel-button');

// モーダルで開くURLを一時的に保存する変数
let currentExternalUrl = '';


// =========================================================================
// 3. UIの操作（メニューの開閉）
// =========================================================================
menuToggleButton.addEventListener('click', () => {
    fullScreenMenu.classList.remove('hidden');
});

menuCloseButton.addEventListener('click', () => {
    fullScreenMenu.classList.add('hidden');
});


// =========================================================================
// 4. 認証の処理（ログイン・ログアウト）
// =========================================================================
auth.onAuthStateChanged(user => {
    if (user) {
        console.log("ログイン中:", user.uid);
        authButton.textContent = 'ログアウト';
        accountNameSpan.textContent = user.displayName || '管理者（あなた）'; 
        accountEmailSpan.textContent = user.email;
        fullScreenMenu.classList.add('hidden'); 
        postSection.classList.remove('hidden');
    } else {
        console.log("ログアウト中");
        authButton.textContent = 'ログイン';
        accountNameSpan.textContent = '--';
        accountEmailSpan.textContent = 'ログインしてください';
        postSection.classList.add('hidden');
    }
});

authButton.addEventListener('click', () => {
    if (auth.currentUser) {
        auth.signOut().then(() => {
            alert('ログアウトしました。');
        }).catch(error => {
            console.error("ログアウトエラー:", error);
        });
    } else {
        const email = prompt("あなたのメールアドレスを入力してください:");
        const password = prompt("パスワードを入力してください:");

        if (email && password) {
            auth.signInWithEmailAndPassword(email, password)
                .then(() => {
                    alert('ログインしました！');
                })
                .catch(error => {
                    alert('ログインに失敗しました。メールアドレスとパスワードを確認してください。');
                    console.error("ログインエラー:", error);
                });
        }
    }
});

// =========================================================================
// 5. データベースの処理（投稿、表示、削除）
// =========================================================================

// 投稿ボタンの処理（変更なし）
postButton.addEventListener('click', () => {
    const text = diaryInput.value.trim();
    if (!text) {
        alert("つぶやきが空です。");
        return;
    }

    db.collection("diaries").add({
        text: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(), 
        uid: auth.currentUser.uid 
    })
    .then(() => {
        diaryInput.value = ''; 
        console.log("投稿完了");
    })
    .catch(error => {
        alert("投稿に失敗しました。ログイン状態を確認してください。");
        console.error("投稿エラー:", error);
    });
});


// 【重要：追加関数】テキスト内のURLを自動でリンクに変換する処理
function linkify(text) {
    // http://, https://, www.などで始まる文字列をURLとして認識する
    const urlPattern = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]|\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    
    // 見つけたURLを <a href="URL" class="external-link">URL</a> に変換する
    return text.replace(urlPattern, (url) => {
        // httpやhttpsがない場合、安全のため先頭に付ける
        const fullUrl = url.startsWith('http') ? url : 'http://' + url;
        return `<a href="${fullUrl}" class="external-link" target="_blank">${url}</a>`;
    });
}


// 投稿済み一覧をリアルタイムで表示する関数（【変更点】URL自動リンク化とモーダル制御を追加）
function loadDiaries() {
    db.collection("diaries")
      .orderBy("timestamp", "desc")
      .onSnapshot((snapshot) => {
        diaryListDiv.innerHTML = ''; 
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const diaryId = doc.id;
            const itemElement = document.createElement('div');
            itemElement.className = 'diary-item';

            const date = data.timestamp ? data.timestamp.toDate() : new Date();
            const dateString = date.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            // リンク変換処理を適用する
            const linkedText = linkify(data.text);

            itemElement.innerHTML = `
                <div class="diary-content">${linkedText}</div>
                <div class="diary-footer">
                    <span class="timestamp">${dateString}</span>
                    <button class="delete-button hidden" data-id="${diaryId}">削除</button>
                </div>
            `;
            
            // 削除ボタンの表示制御（変更なし）
            const deleteButton = itemElement.querySelector('.delete-button');
            const currentUser = auth.currentUser;
            if (currentUser && currentUser.uid === ADMIN_UID && data.uid === ADMIN_UID) {
                 deleteButton.classList.remove('hidden');
                 deleteButton.addEventListener('click', (e) => {
                    if (confirm("本当にこのつぶやきを削除しますか？")) {
                        deleteDiary(e.target.dataset.id);
                    }
                 });
            }
            
            // --- 【重要：追加処理】リンクがクリックされたときの処理 ---
            itemElement.querySelectorAll('.external-link').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault(); // リンク先への移動を一旦止める！
                    showModal(link.href); // モーダルを開く関数を呼び出す
                });
            });

            diaryListDiv.appendChild(itemElement);
        });

        if (snapshot.empty) {
            diaryListDiv.innerHTML = '<p style="text-align: center; color: #777;">まだ独り言がありません。</p>';
        }
    }, 
    // 【ここが追加・修正されたエラー処理部分です】
    // 読み込み自体が失敗した場合の処理
    (error) => {
        console.error("Firebaseからのデータ取得エラー:", error);
        diaryListDiv.innerHTML = `
            <div style="padding: 20px; color: #dc3545; border: 1px solid #dc3545; border-radius: 6px; background-color: #fff3f4;">
                <h3>⚠️ 読み込みエラー</h3>
                <p>このサイトはFirebaseの**無料プラン**で動いています。もしデータが表示されない場合は、一時的に**データ量が上限を超えて**しまっているか、**通信環境**に問題がある可能性があります。</p>
                <p>少し時間をおいてから、再度お試しください。</p>
            </div>
        `;
    });
}

// 独り言の削除処理（変更なし）
function deleteDiary(diaryId) {
    db.collection("diaries").doc(diaryId).delete()
        .then(() => {
            console.log("削除完了");
        })
        .catch(error => {
            alert("削除に失敗しました。権限があるか確認してください。");
            console.error("削除エラー:", error);
        });
}


// =========================================================================
// 6. モーダル制御の処理（【追加】）
// =========================================================================

// モーダルを開く
function showModal(url) {
    currentExternalUrl = url; // クリックされたURLを変数に保存
    externalUrlDisplay.textContent = url; // モーダルにURLを表示
    modal.classList.remove('hidden'); // モーダルを表示
}

// モーダルを閉じる
function hideModal() {
    modal.classList.add('hidden');
    currentExternalUrl = ''; // URLをリセット
}

// 「はい、移動します」ボタンの処理
confirmButton.addEventListener('click', () => {
    if (currentExternalUrl) {
        // 別タブでリンク先に移動する
        window.open(currentExternalUrl, '_blank'); 
        hideModal(); 
    }
});

// 「いいえ、閉じます」ボタンの処理
cancelButton.addEventListener('click', () => {
    hideModal(); 
});


// ページが読み込まれたら独り言の表示を開始
loadDiaries();