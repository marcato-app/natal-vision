// Camada de dados. Com as chaves do Firebase no .env usa Firestore em tempo real;
// sem chaves roda em "modo demonstração", salvando só neste aparelho.
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, runTransaction, writeBatch, collection
} from 'firebase/firestore'

const env = import.meta.env
const cfg = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
}
export const DEMO = !cfg.apiKey || !cfg.projectId

const clone = o => JSON.parse(JSON.stringify(o))
const rid = () => Math.random().toString(36).slice(2, 10)

/* ---------------- Modo demonstração (localStorage) ---------------- */
function localBackend() {
  const subs = {}
  const read = k => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sem storage */ } }
  const mem = {}
  const get = code => mem[code] || (mem[code] = read('nv-ev-' + code))
  const emit = code => (subs[code] || []).forEach(cb => cb(clone(get(code))))
  return {
    demo: true,
    async uid() {
      let id = read('nv-uid'); if (!id) { id = 'u' + rid(); write('nv-uid', id) } return id
    },
    async exists(code) { return !!get(code) },
    async create(ev) { mem[ev.code] = clone(ev); write('nv-ev-' + ev.code, ev); emit(ev.code) },
    subscribe(code, cb) {
      (subs[code] ||= []).push(cb); setTimeout(() => cb(clone(get(code))), 0)
      return () => { subs[code] = subs[code].filter(f => f !== cb) }
    },
    async mutate(code, fn) {
      const d = clone(get(code)); if (!d) return; fn(d)
      mem[code] = d; write('nv-ev-' + code, d); emit(code)
    },
    async setSecrets(code, map) { write('nv-sec-' + code, map) },
    watchSecret(code, pid, cb) {
      const f = () => cb((read('nv-sec-' + code) || {})[pid] || null); f()
      const un = this.subscribe(code, f); return un
    }
  }
}

/* ---------------- Firebase (tempo real) ---------------- */
function firebaseBackend() {
  const app = initializeApp(cfg)
  const auth = getAuth(app)
  const db = getFirestore(app)
  let ready = null
  const ensure = () => ready ||= new Promise((res, rej) => {
    const un = onAuthStateChanged(auth, u => {
      if (u) { un(); res(u.uid) } else signInAnonymously(auth).catch(rej)
    })
  })
  const ref = code => doc(db, 'events', code)
  return {
    demo: false,
    uid: ensure,
    async exists(code) { await ensure(); return (await getDoc(ref(code))).exists() },
    async create(ev) { await ensure(); await setDoc(ref(ev.code), ev) },
    subscribe(code, cb) {
      let un = () => {}
      ensure().then(() => { un = onSnapshot(ref(code), s => cb(s.exists() ? s.data() : null)) })
      return () => un()
    },
    // Transação: dois lances ao mesmo tempo nunca se perdem
    async mutate(code, fn) {
      await ensure()
      await runTransaction(db, async tx => {
        const s = await tx.get(ref(code)); if (!s.exists()) return
        const d = s.data(); fn(d); tx.set(ref(code), d)
      })
    },
    // Cada resultado do amigo secreto fica num documento que só o dono consegue ler
    async setSecrets(code, map) {
      await ensure()
      const b = writeBatch(db)
      Object.entries(map).forEach(([pid, to]) => b.set(doc(collection(db, 'events', code, 'secret'), pid), { to }))
      await b.commit()
    },
    watchSecret(code, pid, cb) {
      let un = () => {}
      ensure().then(() => {
        un = onSnapshot(doc(db, 'events', code, 'secret', pid), s => cb(s.exists() ? s.data().to : null), () => cb(null))
      })
      return () => un()
    }
  }
}

export const backend = DEMO ? localBackend() : firebaseBackend()
export { rid }
