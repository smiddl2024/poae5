import { initializeApp } from "firebase/app";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  onAuthStateChanged, signOut, getRedirectResult
} from "firebase/auth";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp
} from "firebase/firestore";

const $ = (s) => document.querySelector(s);
const whoami = $("#whoami");
const signinBtn = $("#signin");
const signoutBtn = $("#signout");
const errBox = $("#err");
const tasksEl = $("#tasks");
const resetBtn = $("#reset");
const openSite = $("#open-site");

// Optional: link to your site
const CLASS_SITE_URL = "https://your-engagehub.vercel.app";
openSite.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: CLASS_SITE_URL });
});

// ---- TASKS ----
const TASKS = [
  { id: "t1", title: "Day 1: Research & Brainstorm", desc: "Start the challenge" },
  { id: "t2", title: "Day 2: Build & Observe", desc: "Create prototypes" },
  { id: "t3", title: "Day 3: Analyze & Iterate", desc: "Use data to improve" },
  { id: "t4", title: "Day 4: Finalize & Reflect", desc: "Champion plane" }
];

// ---- Firebase config ----
// Paste YOUR Firebase web config here (from Firebase Console -> Project settings)
const firebaseConfig = {
  apiKey:        "YOUR_API_KEY",
  authDomain:    "YOUR_PROJECT.firebaseapp.com",
  projectId:     "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:         "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
const provider = new GoogleAuthProvider();

// Handle popup-vs-redirect auth reliability in school networks
signinBtn.addEventListener("click", async () => {
  hideError();
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    try {
      await signInWithRedirect(auth, provider);
    } catch (e2) {
      showError("Sign-in failed. If this persists, ask IT to allow Google OAuth and add this extension ID to Firebase Authorized domains.");
      console.error(e2);
    }
  }
});
signoutBtn.addEventListener("click", async () => {
  hideError();
  try { await signOut(auth); } catch (e) { console.error(e); }
});

// Trigger redirect result (no-op if none)
getRedirectResult(auth).catch(() => {});

let unsub = null;

onAuthStateChanged(auth, async (user) => {
  if (unsub) { unsub(); unsub = null; }

  if (!user) {
    whoami.textContent = "Not signed in";
    signinBtn.style.display = "";
    signoutBtn.style.display = "none";
    render(null); // disabled, local-only view
    return;
  }

  whoami.textContent = `Signed in as ${user.displayName || user.email || user.uid.slice(0,6)}`;
  signinBtn.style.display = "none";
  signoutBtn.style.display = "";

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, { completed: {}, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  }

  unsub = onSnapshot(userRef, (docSnap) => {
    const completed = docSnap.data()?.completed || {};
    render(completed, userRef);
  });
});

function showError(msg) {
  errBox.textContent = msg;
  errBox.style.display = "";
}
function hideError() {
  errBox.style.display = "none";
  errBox.textContent = "";
}

function render(completed, userRef) {
  tasksEl.innerHTML = "";

  TASKS.forEach((t, idx) => {
    const prevDone = idx === 0 ? true : !!completed?.[TASKS[idx - 1].id];
    const isDone = !!completed?.[t.id];

    const card = document.createElement("div");
    card.className = "task" + (isDone ? " success" : prevDone ? "" : " lock");
    card.innerHTML = `
      <div class="title">${t.title}</div>
      <div class="desc">${t.desc}</div>
      <div class="row">
        <input type="checkbox" ${isDone ? "checked" : ""} ${prevDone ? "" : "disabled"} id="cb-${t.id}">
        <label for="cb-${t.id}" class="muted">
          ${prevDone ? "Mark complete to unlock next" : "Locked until previous is complete"}
        </label>
      </div>
    `;

    const cb = card.querySelector(`#cb-${t.id}`);
    cb?.addEventListener("change", async (e) => {
      if (!userRef) { showError("Sign in to save progress."); return; }
      try {
        await updateDoc(userRef, {
          [`completed.${t.id}`]: e.target.checked,
          updatedAt: serverTimestamp()
        });
      } catch {
        await setDoc(userRef, {
          completed: { [t.id]: e.target.checked },
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    });

    tasksEl.appendChild(card);
  });

  // Reset just clears Firestore for this user
  resetBtn.onclick = async () => {
    if (!userRef) { showError("Sign in to reset saved progress."); return; }
    await setDoc(userRef, { completed: {}, updatedAt: serverTimestamp() }, { merge: true });
  };
}
