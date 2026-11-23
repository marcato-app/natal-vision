// Anúncios (AdMob nos apps, AdSense no site) e notificações locais.
import { Capacitor } from '@capacitor/core'

export const NATIVE = Capacitor.isNativePlatform()
const OS = Capacitor.getPlatform() // 'ios' | 'android' | 'web'
const env = import.meta.env

// IDs de TESTE oficiais do Google. Troque pelos seus no .env antes de publicar.
const TEST = {
  android: { banner: 'ca-app-pub-3940256099942544/9214589741', inter: 'ca-app-pub-3940256099942544/1033173712', reward: 'ca-app-pub-3940256099942544/5224354917' },
  ios: { banner: 'ca-app-pub-3940256099942544/2435281174', inter: 'ca-app-pub-3940256099942544/4411468910', reward: 'ca-app-pub-3940256099942544/1712485313' }
}
const id = kind => {
  const k = `VITE_ADMOB_${OS.toUpperCase()}_${kind.toUpperCase()}`
  return env[k] || TEST[OS]?.[kind]
}
const isTesting = () => !env[`VITE_ADMOB_${OS.toUpperCase()}_BANNER`]

let admob = null
async function getAdmob() {
  if (!NATIVE) return null
  if (!admob) {
    const m = await import('@capacitor-community/admob')
    admob = m
    await m.AdMob.initialize({ initializeForTesting: isTesting() })
    if (OS === 'ios') { try { await m.AdMob.requestTrackingAuthorization() } catch { /* usuário recusou */ } }
  }
  return admob
}

export async function showBanner() {
  const m = await getAdmob(); if (!m) return
  try {
    await m.AdMob.showBanner({ adId: id('banner'), adSize: m.BannerAdSize.ADAPTIVE_BANNER, position: m.BannerAdPosition.BOTTOM_CENTER, margin: 0, isTesting: isTesting() })
  } catch (e) { console.warn('banner', e) }
}

// Tela cheia só em pausas naturais (fim do sorteio, fim de lote). No máximo 1 a cada 4 min.
let lastInter = 0
export async function showInterstitial() {
  if (Date.now() - lastInter < 240000) return
  lastInter = Date.now()
  const m = await getAdmob(); if (!m) return
  try { await m.AdMob.prepareInterstitial({ adId: id('inter'), isTesting: isTesting() }); await m.AdMob.showInterstitial() } catch (e) { console.warn('inter', e) }
}

// Anúncio premiado: devolve true se a pessoa assistiu até o fim
export async function showRewarded() {
  const m = await getAdmob()
  if (!m) return null // no site, a interface mostra o anúncio da web
  try {
    await m.AdMob.prepareRewardVideoAd({ adId: id('reward'), isTesting: isTesting() })
    const r = await m.AdMob.showRewardVideoAd()
    return !!r
  } catch (e) { console.warn('reward', e); return false }
}

export const ADSENSE = env.VITE_ADSENSE_CLIENT && env.VITE_ADSENSE_SLOT ? { client: env.VITE_ADSENSE_CLIENT, slot: env.VITE_ADSENSE_SLOT } : null
let adsenseLoaded = false
export function loadAdsense() {
  if (!ADSENSE || adsenseLoaded || NATIVE) return
  adsenseLoaded = true
  const s = document.createElement('script')
  s.async = true; s.crossOrigin = 'anonymous'
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE.client}`
  document.head.appendChild(s)
}

/* ---------------- Notificações ---------------- */
let LN = null
const getLN = async () => NATIVE ? (LN ||= (await import('@capacitor/local-notifications')).LocalNotifications) : null

export async function askPermission() {
  const ln = await getLN()
  if (ln) return (await ln.requestPermissions()).display === 'granted'
  if ('Notification' in window) return (await Notification.requestPermission()) === 'granted'
  return false
}

// Agenda os lembretes da contagem regressiva (7 dias, 1 dia, 1 hora e na hora)
export async function scheduleCountdown(ev, extra = []) {
  const ln = await getLN(); if (!ln) return
  try {
    const pend = await ln.getPending()
    if (pend.notifications.length) await ln.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) })
    const at = new Date(ev.date).getTime()
    const list = [[7 * 864e5, 'Falta 1 semana para o Natal!', 'Já sabe o que vai levar para a ceia?'],
      [864e5, 'Amanhã é a ceia!', 'Confira seu prato e o Pix da vaquinha.'],
      [36e5, 'Falta 1 hora!', `${ev.name} começa já já em ${ev.place}.`],
      [0, 'Feliz Natal! 🎄', 'Abra o app para o leilão e as brincadeiras.']]
      .map(([d, title, body], i) => ({ id: 100 + i, title, body, schedule: { at: new Date(at - d) } }))
      .concat(extra)
      .filter(n => n.schedule.at.getTime() > Date.now())
    if (list.length) await ln.schedule({ notifications: list })
  } catch (e) { console.warn('notif', e) }
}

// Aviso imediato (ex.: "o leilão começou") quando o app está aberto
export async function notifyNow(title, body) {
  const ln = await getLN()
  if (ln) { try { await ln.schedule({ notifications: [{ id: Math.floor(Math.random() * 1e6) + 1000, title, body }] }) } catch { /* sem permissão */ } return }
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) { try { new Notification(title, { body }) } catch { /* bloqueado */ } }
}
