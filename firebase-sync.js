import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut, signInWithCustomToken, setPersistence, browserSessionPersistence } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js';
import { getFirestore, collection, doc, onSnapshot, runTransaction, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js';

const status = (msg, identity='', ready=false, signed=false) => window.setSharedStatus?.(msg, identity, ready, signed);
const errors = {
 'auth/invalid-custom-token': '서버가 발급한 토큰이 잘못되었습니다. Firebase 프로젝트를 확인해 주세요.',
 'auth/custom-token-mismatch': 'Worker의 서비스 계정과 웹페이지 Firebase 프로젝트가 다릅니다.',
 'auth/network-request-failed': '네트워크 연결을 확인해 주세요.',
 'permission-denied': 'Firestore 규칙이 비밀번호 인증 계정을 허용하지 않습니다.',
 'unavailable': 'Firebase 서비스 연결을 확인해 주세요.'
};
const describe = e => errors[e?.code] || e?.message || String(e);
const config=window.FIREBASE_CONFIG, endpoint=window.AUTH_WORKER_URL?.replace(/\/$/,'');
const login=document.getElementById('loginBtn'), logout=document.getElementById('logoutBtn'), pw=document.getElementById('sharedPassword');
const configured = config && Object.values(config).every(v => typeof v==='string' && v.trim() && !v.includes('여기에_'))
  && endpoint && /^https:\/\//.test(endpoint) && !endpoint.includes('여기에_');
if (!configured) {
  status('설정이 필요합니다. firebase-config.js에 Firebase 구성값과 Worker 주소를 입력해 주세요.');
} else {
  try {
    const app=initializeApp(config), auth=getAuth(app), db=getFirestore(app);
    const persistenceReady=setPersistence(auth,browserSessionPersistence);
    let unsubscribe=null, currentUser=null, approved=false, authGeneration=0;
    const attempt=async()=>{
      const password=pw.value;
      if (!password){status('공용 비밀번호를 입력해 주세요.');pw.focus();return;}
      if(password.length>256){status('비밀번호가 너무 깁니다.');return;}
      login.disabled=true;
      status('학교 공용 비밀번호를 서버에서 확인 중…');
      try {
        await persistenceReady;
        const response=await fetch(endpoint+'/login', {
          method:'POST', mode:'cors', cache:'no-store',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({password})
        });
        if(!response.ok){
          const data=await response.json().catch(()=>({}));
          throw Error(response.status===401?'비밀번호가 일치하지 않습니다.':
            response.status===429?'로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.':
            (data.error || '인증 서버 오류 ('+response.status+')'));
        }
        const result=await response.json();
        if (!result.token || typeof result.token!=='string') throw Error('인증 서버가 토큰을 보내지 않았습니다.');
        await signInWithCustomToken(auth,result.token);
        pw.value='';
      } catch(e) {status('접속 실패: '+describe(e));}
      finally { login.disabled=false; }
    };
    login.addEventListener('click',attempt);
    pw.addEventListener('keydown',e=>{if(e.key==='Enter')attempt();});
    logout.addEventListener('click',async()=>{
      try {await signOut(auth);} catch(e){status('접속 종료 실패: '+describe(e));}
    });
    window.sharedToggle=async(classId,taskId,shouldCheck)=>{
      if(!approved||!currentUser) throw Error('공용 비밀번호 인증이 필요합니다.');
      if(!/^[123]-[1-9]$/.test(classId)||!/^[a-z0-9-]+$/.test(taskId))throw Error('허용되지 않은 항목입니다.');
      const ref=doc(db,'classChecks',classId);
      await runTransaction(db, async tx=>{
        const snap=await tx.get(ref);
        const old=snap.exists() && Array.isArray(snap.data().checked) ? snap.data().checked : [];
        const next=shouldCheck ? Array.from(new Set([...old,taskId])) : old.filter(x=>x!==taskId);
        tx.set(ref,{checked:next,updatedBy:currentUser.uid,updatedAt:serverTimestamp()});
      });
    };
    onAuthStateChanged(auth, async user=>{
      const generation=++authGeneration;
      if(unsubscribe){unsubscribe();unsubscribe=null;}
      approved=false;currentUser=null;window.setSharedData?.({});
      if(!user){status('학교 공용 비밀번호를 입력하세요.','',false,false);return;}
      const identity='학교 공용 비밀번호로 접속됨';
      status('접속 권한 확인 중…',identity,false,true);
      try {
        const tokenResult=await user.getIdTokenResult();
        if(generation!==authGeneration)return;
        if(user.uid!=='school-teachers-2027' || tokenResult.claims.schoolAccess!==true){
          status('해당 계정은 교사용 인증 계정이 아닙니다.',identity,false,true);
          await signOut(auth); return;
        }
        approved=true;currentUser=user;
        status('권한 확인 완료 · 공유 기록 연결 중…',identity,false,true);
        unsubscribe=onSnapshot(collection(db,'classChecks'),snapshot=>{
          if(generation!==authGeneration)return;
          const state={};
          snapshot.forEach(s=>{
            if(/^[123]-[1-9]$/.test(s.id) && Array.isArray(s.data().checked))
              state[s.id]=s.data().checked.filter(x=>typeof x==='string');
          });
          window.setSharedData?.(state);
          status(snapshot.metadata.fromCache?'오프라인 캐시 · 인터넷 연결 확인 필요':'실시간 공유 연결됨',identity,!snapshot.metadata.fromCache,true);
        },e=>status('공유 기록 연결 실패: '+describe(e),identity,false,true));
      }catch(e){if(generation===authGeneration)status('접속 권한 확인 실패: '+describe(e),identity,false,true);}
    });
  } catch(e) {status('Firebase 초기화 오류: '+describe(e));}
}
