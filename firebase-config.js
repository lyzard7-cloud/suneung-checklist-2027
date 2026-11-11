// GitHub Pages 공개 파일: Firebase 웹앱 설정값은 공개 가능, 비밀번호·비밀키는 넣지 마세요.
window.FIREBASE_CONFIG = {
  apiKey: "여기에_API_KEY",
  authDomain: "여기에_AUTH_DOMAIN",
  projectId: "여기에_PROJECT_ID",
  storageBucket: "여기에_STORAGE_BUCKET",
  messagingSenderId: "여기에_MESSAGING_SENDER_ID",
  appId: "여기에_APP_ID"
};
// Cloudflare Workers에서 생성한 HTTPS 접속주소. 끝에 /login 경로를 자동으로 붙입니다.
window.AUTH_WORKER_URL = "https://여기에_WORKER_주소.workers.dev";
