// 사용자님의 Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyBdA6lnw2FSQIwFYiKCvGbXq2peUMarOyc",
  authDomain: "haksangboo-check.firebaseapp.com",
  projectId: "haksangboo-check",
  storageBucket: "haksangboo-check.firebasestorage.app",
  messagingSenderId: "912326084683",
  appId: "1:912326084683:web:ecc51f054d419508cce5ce"
};

let db = null;

function initFirebase() {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
        console.log("Firebase 연동 성공!");
        return true;
    } catch (error) {
        console.error("Firebase 초기화 오류:", error);
        alert("Firebase 연동에 실패했습니다.");
        return false;
    }
}

function getDb() {
    return db;
}

// Check on load
window.addEventListener('DOMContentLoaded', () => {
    initFirebase();
});

