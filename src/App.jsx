import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { backend, DEMO } from './backend'
import { newEvent, demoEvent, newCode, fmt, COLORS } from './lib'
import { NATIVE, ADSENSE, loadAdsense, showBanner, showInterstitial, scheduleCountdown, notifyNow, askPermission } from './native'
import { Icon } from './icons'
import * as Screens from './screens'

export const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* sem storage */ } }
}
export const DEFAULT_NOTIF = { countdown: true, secret: true, dishes: true, pay: true, auction: true, bingo: true }

/* ---------- peças compartilhadas ---------- */
export function Avatar({ id, size = 36 }) {
  const { E } = useApp()
  const i = Math.max(0, E.people.findIndex(p => p.id === id))
  const p = E.people[i]
  return <span className="av" style={{ background: COLORS[i % COLORS.length], width: size, height: size }}>{(p?.name || '?').trim()[0]?.toUpperCase()}</span>
}
export const nameOf = (E, id) => E.people.find(p => p.id === id)?.name || '—'

const Trees = () => (
  <svg className="trees" viewBox="0 0 400 70" preserveAspectRatio="none" aria-hidden="true">
    {[0, 40, 85, 130, 175, 220, 262, 305, 350].map((x, i) => {
      const h = 40 + (i % 3) * 12
      return <path key={i} d={`M${x + 20} ${70 - h} L${x + 38} 70 L${x + 2} 70Z`} fill={i % 2 ? '#0a3a24' : '#0c4429'} />
    })}
    {Array.from({ length: 22 }, (_, i) => (
      <circle key={'l' + i} className="lt" style={{ animationDelay: `${(i % 5) * 0.3}s` }} cx={10 + i * 18} cy={12 + (i * 7) % 22} r="2" fill={['#ffd76a', '#ff5a6e', '#fff'][i % 3]} />
    ))}
  </svg>
)

export function Header({ title, back = true, children }) {
  const { go, me, openWho } = useApp()
  return (
    <header className="top">
      <Trees />
      <div className="bar">
        {back && <button className="back" onClick={() => go('hub')} aria-label="Voltar ao início">‹</button>}
        <h1>{title}</h1>
        <button className="who" onClick={openWho}>{me?.name} ▾</button>
      </div>
      {children}
    </header>
  )
}

export function AdBar() {
  const ref = useRef(null)
  useEffect(() => {
    if (NATIVE || !ADSENSE || !ref.current) return
    loadAdsense()
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}) } catch { /* bloqueador */ }
  }, [])
  if (NATIVE) return <div className="ad-space" />
  return (
    <div className="ad" ref={ref}>
      {ADSENSE
        ? <ins className="adsbygoogle" style={{ display: 'block', width: '100%', height: 60 }} data-ad-client={ADSENSE.client} data-ad-slot={ADSENSE.slot} data-ad-format="horizontal" data-full-width-responsive="false" />
        : <span><b>AD</b> Espaço do anúncio</span>}
    </div>
  )
}

function Countdown({ date }) {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(t) }, [])
  const p = Math.max(0, new Date(date) - new Date())
  const c = [Math.floor(p / 864e5), Math.floor(p / 36e5) % 24, Math.floor(p / 6e4) % 60, Math.floor(p / 1e3) % 60]
  return (
    <div className="count" role="timer">
      {['dias', 'horas', 'min', 'seg'].map((l, i) => <div key={l}><b>{String(c[i]).padStart(2, '0')}</b><span>{l}</span></div>)}
    </div>
  )
}

/* ---------- Entrada ---------- */
function Entry({ onEnter }) {
  const [mode, setMode] = useState('join')
  const [f, setF] = useState({ code: '', name: '', evName: 'Natal da Família', date: '2026-12-24T20:00', place: '' })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const set = k => e => setF({ ...f, [k]: e.target.value })
  const run = fn => async () => { setErr(''); setBusy(true); try { await fn() } catch (e) { console.error(e); setErr('Não deu certo. Confira a internet e tente de novo.') } setBusy(false) }

  const join = run(async () => {
    const code = f.code.trim().toUpperCase(); const name = f.name.trim()
    if (!code || !name) return setErr('Preencha o código e seu nome.')
    if (!(await backend.exists(code))) return setErr('Não achei esse código. Confira com quem organizou.')
    const uid = await backend.uid()
    await backend.mutate(code, d => {
      if (!d.people.some(p => p.id === uid)) d.people.push({ id: uid, name, rsvp: 'sim', guests: 0, diet: [], group: 'Adultos' })
    })
    onEnter(code, uid)
  })
  const create = run(async () => {
    const name = f.name.trim(); if (!name) return setErr('Coloque seu nome.')
    const uid = await backend.uid(); let code = newCode()
    while (await backend.exists(code)) code = newCode()
    await backend.create(newEvent({ code, name: f.evName.trim() || 'Natal da Família', date: f.date, place: f.place.trim() || 'A definir', owner: uid, ownerName: name }))
    onEnter(code, uid, true)
  })
  const demo = run(async () => {
    const uid = await backend.uid(); const ev = demoEvent(uid, f.name.trim() || 'Você')
    await backend.create(ev); onEnter(ev.code, uid)
  })

  return (
    <div className="app">
      <div className="top" style={{ paddingBottom: 70 }}>
        <Trees />
        <div className="hero-in">
          <span className="ic hero-ic"><Icon n="gift" /></span>
          <h2>Natal Vision</h2>
          <p>Amigo secreto, ceia, vaquinha, leilão e bingo da família em um só lugar.</p>
        </div>
      </div>
      <main className="main">
        <div className="tabs" role="tablist">
          <button className={mode === 'join' ? 'on' : ''} onClick={() => setMode('join')}>Entrar com código</button>
          <button className={mode === 'create' ? 'on' : ''} onClick={() => setMode('create')}>Organizar um Natal</button>
        </div>
        <div className="card">
          {mode === 'join' ? <>
            <h3>Entrar no Natal</h3>
            <p className="mute m0">Sem cadastro: só o código do evento e seu nome.</p>
            <label htmlFor="c">Código do evento</label>
            <input id="c" value={f.code} onChange={set('code')} placeholder="Ex.: NV7K2P" autoCapitalize="characters" autoComplete="off" />
          </> : <>
            <h3>Organizar um Natal novo</h3>
            <p className="mute m0">Depois é só mandar o código no grupo da família.</p>
            <label htmlFor="en">Nome do evento</label><input id="en" value={f.evName} onChange={set('evName')} />
            <label htmlFor="ed">Data e hora da ceia</label><input id="ed" type="datetime-local" value={f.date} onChange={set('date')} />
            <label htmlFor="ep">Local</label><input id="ep" value={f.place} onChange={set('place')} placeholder="Ex.: Casa da Vó" />
          </>}
          <label htmlFor="n">Seu nome</label>
          <input id="n" value={f.name} onChange={set('name')} placeholder="Como a família te chama" />
          {err && <p className="err">{err}</p>}
          <button className={'btn w mt ' + (mode === 'create' ? 'g' : '')} disabled={busy} onClick={mode === 'join' ? join : create}>
            {busy ? 'Aguarde…' : mode === 'join' ? 'Entrar' : 'Criar evento'}
          </button>
        </div>
        <button className="btn o w" disabled={busy} onClick={demo}>Ver demonstração com família de exemplo</button>
        {DEMO && <p className="proto">Modo demonstração: os dados ficam só neste aparelho até o Firebase ser configurado.</p>}
      </main>
    </div>
  )
}

/* ---------- Início ---------- */
function Hub() {
  const { E, go, meId, openModal, toast } = useApp()
  const paid = E.people.filter(p => E.pay.paid[p.id]).length
  const free = E.dishes.filter(d => !d.who).length
  const yes = E.people.filter(p => p.rsvp === 'sim').reduce((s, p) => s + 1 + (+p.guests || 0), 0)
  const me = E.people.find(p => p.id === meId)
  const lead = Object.entries(E.game.points || {}).sort((a, b) => b[1] - a[1])[0]
  const T = [
    ['amigo', 'Amigo secreto', E.secret.drawn ? 'Sorteio feito' : 'Falta sortear', 'gift', '#c8102e'],
    ['presenca', 'Presença', `${yes} confirmados`, 'users', '#2f7d5b'],
    ['pratos', 'Pratos', free ? `${free} sem dono` : `${E.dishes.length} pratos`, 'dish', '#0f5132'],
    ['programa', 'Programação', `${E.sched.length} momentos`, 'clock', '#b07d12'],
    ['vaquinha', 'Vaquinha', `${paid}/${E.people.length} pagaram`, 'money', '#1d6fa5'],
    ['jogos', 'Brincadeiras', 'Roleta, mímica, quiz', 'game', '#7a3b8f'],
    ['bingo', 'Bingo', E.bingo.drawn.length ? `${E.bingo.drawn.length} bolas sorteadas` : 'Cartela pronta', 'grid', '#d2552a'],
    ['leilao', 'Leilão', E.auc.live ? 'Ao vivo agora!' : `${fmt(E.auc.start)} de mentirinha`, 'hammer', '#9e0b23'],
    ['ranking', 'Ranking', lead ? `${nameOf(E, lead[0])} lidera` : 'Ninguém pontuou', 'trophy', '#5a6b2b']
  ]
  const invite = `Bora organizar o ${E.name}! Baixe o Natal Vision e entre com o código ${E.code}`
  const share = () => openModal(
    <>
      <h3>Convidar a família</h3>
      <p className="mute">Mande este texto no grupo do WhatsApp:</p>
      <div className="card soft">{invite}</div>
      <div className="row">
        <a className="btn g grow center" href={`https://wa.me/?text=${encodeURIComponent(invite)}`} target="_blank" rel="noreferrer">Abrir WhatsApp</a>
        <button className="btn o" onClick={() => navigator.clipboard?.writeText(invite).then(() => toast('Copiado', 'Cole no grupo da família'), () => toast('Não deu para copiar', 'Selecione o texto e copie'))}>Copiar</button>
      </div>
    </>
  )
  return <>
    <Header title={E.name} back={false}>
      <div className="sub">Faltam para a ceia · {E.place}</div>
      <Countdown date={E.date} />
    </Header>
    <main className="main">
      {me && me.rsvp !== 'sim' && <button className="card warn w left" onClick={() => go('presenca')}><b>Você ainda não confirmou presença</b><div className="mute">Toque para confirmar</div></button>}
      {E.auc.live && <button className="card live w left" onClick={() => go('leilao')}><b>O leilão está ao vivo!</b><div>Toque para dar seu lance</div></button>}
      <div className="grid">
        {T.map(t => (
          <button key={t[0]} className="tile" onClick={() => go(t[0])}>
            <span className="ic" style={{ background: t[4] }}><Icon n={t[3]} /></span>
            <span><b>{t[1]}</b><small>{t[2]}</small></span>
          </button>
        ))}
      </div>
      <div className="card mt">
        <div className="row"><span className="ic" style={{ background: 'var(--green)' }}><Icon n="share" /></span>
          <div className="grow"><b>Código: {E.code}</b><div className="mute">{E.people.length} pessoas no evento</div></div>
          <button className="btn o" onClick={share}>Convidar</button></div>
      </div>
      <div className="card">
        <div className="row"><span className="ic" style={{ background: 'var(--gold)' }}><Icon n="bell" /></span>
          <div className="grow"><b>Notificações</b><div className="mute">Lembretes de prato, Pix, leilão e bingo</div></div>
          <button className="btn o" onClick={() => go('avisos')}>Ajustar</button></div>
      </div>
      {DEMO && <p className="proto">Demonstração: toque no seu nome lá em cima para fingir ser outra pessoa da família.</p>}
    </main>
    <AdBar />
  </>
}

/* ---------- App ---------- */
export default function App() {
  const [session, setSession] = useState(() => store.get('nv-session', null))
  const [E, setE] = useState(undefined)
  const [view, setView] = useState('hub')
  const [modal, setModal] = useState(null)
  const [t, setT] = useState(null)
  const [notif, setNotifState] = useState(() => store.get('nv-notif', DEFAULT_NOTIF))
  const prev = useRef(null); const tt = useRef(null)

  const toast = useCallback((title, body) => { setT({ title, body }); clearTimeout(tt.current); tt.current = setTimeout(() => setT(null), 3200) }, [])
  const setNotif = n => { setNotifState(n); store.set('nv-notif', n) }

  useEffect(() => { if (NATIVE) showBanner() }, [])
  useEffect(() => {
    if (!session) { setE(undefined); return }
    return backend.subscribe(session.code, d => setE(d))
  }, [session?.code])

  // Avisos em tempo real quando algo muda
  useEffect(() => {
    const p = prev.current; prev.current = E
    if (!E || !p || p.code !== E.code) return
    const say = (k, a, b) => { toast(a, b); if (notif[k]) notifyNow(a, b) }
    if (!p.auc.live && E.auc.live) say('auction', 'O leilão começou!', E.auc.prizes.find(x => x.id === E.auc.live.pid)?.name || '')
    if (p.auc.live && !E.auc.live) {
      const w = E.auc.prizes.find(x => x.id === p.auc.live.pid)
      if (w?.win) say('auction', 'Dou-lhe três!', `${nameOf(E, w.win)} arrematou ${w.name} por ${fmt(w.price)}`)
      showInterstitial()
    }
    if (!p.secret.drawn && E.secret.drawn) { say('secret', 'Sorteio feito!', 'Abra o amigo secreto para ver quem você tirou'); showInterstitial() }
    if (!p.bingo.winner && E.bingo.winner) say('bingo', 'BINGO!', `${nameOf(E, E.bingo.winner)} ganhou a rodada`)
    if (E.bingo.drawn.length > p.bingo.drawn.length && view !== 'bingo') toast('Nova bola no bingo', 'Número ' + E.bingo.drawn.at(-1))
  }, [E])

  // Lembretes locais da contagem regressiva
  const meIdS = session?.meId
  const myDishes = E ? E.dishes.filter(d => d.who === meIdS).map(d => d.name).join(', ') : ''
  const owes = E ? !E.pay.paid[meIdS] && E.pay.value > 0 : false
  useEffect(() => {
    if (!E) return
    const at = new Date(E.date).getTime(), extra = []
    if (notif.pay && owes) extra.push({ id: 120, title: 'Vaquinha do Natal', body: `Falta seu Pix de ${fmt(E.pay.value)}.`, schedule: { at: new Date(at - 2 * 864e5) } })
    if (notif.dishes && myDishes) extra.push({ id: 121, title: 'Não esquece!', body: `Você leva: ${myDishes}`, schedule: { at: new Date(at - 8 * 36e5) } })
    if (notif.countdown || extra.length) scheduleCountdown(notif.countdown ? E : { ...E, date: '1970-01-01' }, extra)
  }, [E?.date, E?.place, notif.countdown, notif.pay, notif.dishes, owes, myDishes])

  // Fecha o lote do leilão quando o tempo acaba (transação garante que fecha uma vez só)
  useEffect(() => {
    if (!E?.auc.live) return
    const timer = setInterval(() => {
      const L = E.auc.live
      if (Date.now() < L.end) return
      clearInterval(timer)
      backend.mutate(E.code, d => {
        const l = d.auc.live; if (!l || l.pid !== L.pid || Date.now() < l.end) return
        const P = d.auc.prizes.find(x => x.id === l.pid)
        if (l.by && P) { P.win = l.by; P.price = l.high; d.auc.bal[l.by] = (d.auc.bal[l.by] ?? d.auc.start) - l.high }
        d.auc.live = null
      })
    }, 500)
    return () => clearInterval(timer)
  }, [E?.auc.live?.pid, E?.auc.live?.end])

  const enter = (code, meId, created) => {
    const s = { code, meId }; setSession(s); store.set('nv-session', s); setView('hub')
    if (created) { setTimeout(() => toast('Evento criado!', `Mande o código ${code} no grupo da família`), 400); askPermission() }
  }
  const leave = () => { setModal(null); setSession(null); store.set('nv-session', null); prev.current = null }

  if (!session) return <Entry onEnter={enter} />
  if (E === undefined) return <div className="app center-screen"><div className="spinner" /></div>
  if (E === null) return (
    <div className="app center-screen"><div className="card" style={{ margin: 20 }}>
      <h3>Evento não encontrado</h3><p className="mute">Ele pode ter sido apagado.</p>
      <button className="btn w" onClick={leave}>Voltar</button></div></div>
  )

  const meId = session.meId
  const me = E.people.find(p => p.id === meId)
  const go = v => { setView(v); window.scrollTo(0, 0) }
  const act = fn => backend.mutate(E.code, fn).catch(e => { console.error(e); toast('Ops', 'Não salvou. Confira a internet.') })
  const openModal = c => setModal(c)
  const closeModal = () => setModal(null)
  const openWho = () => openModal(
    <>
      <h3>{me?.name}</h3>
      {DEMO ? <>
        <p className="mute">Demonstração: escolha quem você quer ser para simular a família.</p>
        <ul className="list">{E.people.map(p => (
          <li key={p.id}><button className="li-btn" onClick={() => { const s = { ...session, meId: p.id }; setSession(s); store.set('nv-session', s); closeModal() }}>
            <Avatar id={p.id} /><span className="grow left">{p.name}</span>{p.id === meId && <span className="pill ok">Agora</span>}</button></li>
        ))}</ul>
      </> : <p className="mute">Código do evento: <b>{E.code}</b></p>}
      <button className="btn o w mt" onClick={leave}>Sair do evento</button>
    </>
  )
  const ctx = { E, me, meId, isOwner: E.owner === meId || DEMO, act, go, view, toast, openModal, closeModal, openWho, notif, setNotif }
  const V = { hub: Hub, ...Screens.VIEWS }[view] || Hub

  return (
    <Ctx.Provider value={ctx}>
      <div className="app"><V /></div>
      {modal && <div className="modal" onClick={e => e.target === e.currentTarget && closeModal()}>
        <div className="sheet" role="dialog" aria-modal="true">
          <button className="x" onClick={closeModal} aria-label="Fechar">✕</button>
          {modal}
        </div>
      </div>}
      <div className={'toast' + (t ? ' on' : '')} role="status">
        {t && <><span className="ic" style={{ background: 'var(--red)' }}><Icon n="bell" /></span>
          <div><b>{t.title}</b><div className="mute sm">{t.body}</div></div></>}
      </div>
    </Ctx.Provider>
  )
}
