import React, { useEffect, useRef, useState } from 'react'
import { useApp, Header, AdBar, Avatar, nameOf, DEFAULT_NOTIF } from './App'
import { backend, DEMO, rid } from './backend'
import {
  fmt, CATS, DIETS, GROUPS, REWARD, REWARD_MAX, schedKey, drawSecret, bingoCard, hasBingo, bingoLetter,
  DESAFIOS, MIMICA, QUIZ
} from './lib'
import { NATIVE, ADSENSE, showRewarded, askPermission, notifyNow } from './native'
import { Icon } from './icons'

const Screen = ({ title, children }) => <><Header title={title} /><main className="main">{children}</main><AdBar /></>
const pick = a => a[Math.floor(Math.random() * a.length)]
const addPoints = (d, id, n) => { d.game.points[id] = (d.game.points[id] || 0) + n }

function Confirm({ text, sub, ok, onOk }) {
  const { closeModal } = useApp()
  return <><h3>{text}</h3>{sub && <p className="mute">{sub}</p>}
    <div className="row mt"><button className="btn o grow" onClick={closeModal}>Cancelar</button>
      <button className="btn grow" onClick={() => { onOk(); closeModal() }}>{ok}</button></div></>
}

function Chips({ value, onChange, options = DIETS }) {
  return <div className="chips">{options.map(o => {
    const on = value.includes(o)
    return <button key={o} className={'chip' + (on ? ' on' : '')} aria-pressed={on} onClick={() => onChange(on ? value.filter(x => x !== o) : [...value, o])}>{o}</button>
  })}</div>
}

/* ================= Amigo secreto ================= */
function Amigo() {
  const { E, meId, act, isOwner, toast, openModal } = useApp()
  const s = E.secret
  const [toId, setToId] = useState(null)
  const [lim, setLim] = useState(s.limit)
  const [ex, setEx] = useState(['', ''])
  const [wish, setWish] = useState(s.wishes[meId] || '')
  useEffect(() => { setWish(s.wishes[meId] || '') }, [meId])
  useEffect(() => (s.drawn ? backend.watchSecret(E.code, meId, setToId) : undefined), [s.drawn, meId, E.code])
  const players = E.people.filter(p => p.rsvp !== 'nao')

  const draw = async () => {
    const r = drawSecret(E.people, s.exclusions)
    if (r.error) return toast('Não deu para sortear', r.error)
    await backend.setSecrets(E.code, r.map)
    act(d => { d.secret.drawn = true; d.secret.limit = +lim || 0; d.secret.seen = {} })
  }

  if (!s.drawn) return (
    <Screen title="Amigo secreto">
      {GROUPS.map(g => {
        const list = players.filter(p => (p.group || 'Adultos') === g)
        if (!list.length) return null
        return <div className="card" key={g}><h3>{g} · {list.length}</h3>
          <ul className="list">{list.map(p => <li key={p.id}><Avatar id={p.id} /><span className="grow">{p.name}</span>{p.id === meId && <span className="pill ok">Você</span>}</li>)}</ul></div>
      })}
      <p className="mute sm center">Quem disse que não vai fica fora do sorteio. O grupo de cada um se muda em Presença; grupo com menos de 3 pessoas sorteia junto com os adultos.</p>
      <div className="card">
        <h3>Quem não pode se tirar</h3>
        <p className="mute m0">Casais, irmãos ou quem trocou presente no ano passado.</p>
        <ul className="list">{s.exclusions.map(([a, b], i) => (
          <li key={i}><span className="grow">{nameOf(E, a)} ✕ {nameOf(E, b)}</span>
            {isOwner && <button className="btn o sm-btn" onClick={() => act(d => d.secret.exclusions.splice(i, 1))}>Remover</button>}</li>
        ))}</ul>
        {isOwner && <div className="row mt">
          {[0, 1].map(k => <select key={k} aria-label={'Pessoa ' + (k + 1)} value={ex[k]} onChange={e => setEx(k ? [ex[0], e.target.value] : [e.target.value, ex[1]])}>
            <option value="">Escolha</option>{players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>)}
          <button className="btn g" disabled={!ex[0] || !ex[1] || ex[0] === ex[1]} onClick={() => { act(d => d.secret.exclusions.push(ex)); setEx(['', '']) }}>+</button>
        </div>}
      </div>
      <div className="card">
        <label htmlFor="lim" className="mt0">Valor do presente (até)</label>
        <input id="lim" type="number" inputMode="numeric" value={lim} onChange={e => setLim(e.target.value)} disabled={!isOwner} />
        {isOwner
          ? <button className="btn w mt" onClick={draw}>Sortear agora</button>
          : <p className="mute">Quem organizou faz o sorteio. Você recebe um aviso quando sair.</p>}
        <p className="mute sm">Ninguém tira a si mesmo e cada pessoa só vê o próprio resultado.</p>
      </div>
    </Screen>
  )

  const seen = s.seen[meId]
  return (
    <Screen title="Amigo secreto">
      {toId === null && players.some(p => p.id === meId) && <div className="card"><p className="m0">Carregando seu resultado…</p></div>}
      {toId && <button className="reveal" onClick={() => !seen && act(d => { d.secret.seen[meId] = true })}>
        {seen ? <><div className="o85">Você tirou</div><div className="big">{nameOf(E, toId)}</div><div className="o85">Presente de até {fmt(s.limit)}</div></>
          : <><div className="o85">Toque para revelar quem você tirou</div><div className="big"><Icon n="gift" /></div><div className="o85 sm">Confira se ninguém está olhando</div></>}
      </button>}
      {toId && seen && <div className="card mt"><h3>Lista de desejos de {nameOf(E, toId)}</h3><p className="m0">{s.wishes[toId] || 'Ainda não escreveu nada.'}</p></div>}
      <div className="card mt"><h3>Sua lista de desejos</h3><p className="mute m0">Quem te tirou vai ver isso.</p>
        <div className="row mt"><input value={wish} onChange={e => setWish(e.target.value)} placeholder="Tamanho, cor, ideias…" aria-label="Sua lista de desejos" />
          <button className="btn g" onClick={() => { act(d => { d.secret.wishes[meId] = wish.trim() }); toast('Salvo', 'Lista de desejos atualizada') }}>Salvar</button></div></div>
      <div className="card"><h3>Quem já viu o resultado</h3>
        <ul className="list">{players.map(p => <li key={p.id}><Avatar id={p.id} /><span className="grow">{p.name}</span><span className={'pill ' + (s.seen[p.id] ? 'ok' : 'no')}>{s.seen[p.id] ? 'Já viu' : 'Ainda não'}</span></li>)}</ul></div>
      {isOwner && <button className="btn o w" onClick={() => openModal(<Confirm text="Refazer o sorteio?" sub="Todo mundo vai precisar ver o resultado de novo." ok="Refazer" onOk={() => act(d => { d.secret.drawn = false; d.secret.seen = {} })} />)}>Refazer sorteio</button>}
    </Screen>
  )
}

/* ================= Presença ================= */
function Presenca() {
  const { E, meId, act } = useApp()
  const me = E.people.find(p => p.id === meId)
  const upd = patch => act(d => { const p = d.people.find(x => x.id === meId); if (p) Object.assign(p, patch) })
  const yes = E.people.filter(p => p.rsvp === 'sim')
  const total = yes.reduce((s, p) => s + 1 + (+p.guests || 0), 0)
  const diets = {}
  E.people.filter(p => p.rsvp !== 'nao').forEach(p => (p.diet || []).forEach(d => (diets[d] ||= []).push(p.name)))
  const label = { sim: 'Vou', talvez: 'Talvez', nao: 'Não vou' }
  if (!me) return <Screen title="Presença"><p className="mute">Você não está na lista deste evento.</p></Screen>
  return (
    <Screen title="Presença">
      <div className="card"><div className="mute">Confirmados</div><div className="big">{total} pessoas</div>
        <div className="mute">{yes.length} confirmaram, com {total - yes.length} acompanhante(s)</div></div>
      <div className="card">
        <h3>E você, vai?</h3>
        <div className="seg">{['sim', 'talvez', 'nao'].map(r => <button key={r} className={me.rsvp === r ? 'on' : ''} onClick={() => upd({ rsvp: r })}>{label[r]}</button>)}</div>
        <label>Acompanhantes</label>
        <div className="row"><button className="btn o" aria-label="Menos" onClick={() => upd({ guests: Math.max(0, (+me.guests || 0) - 1) })}>−</button>
          <b className="stepper">{me.guests || 0}</b>
          <button className="btn o" aria-label="Mais" onClick={() => upd({ guests: (+me.guests || 0) + 1 })}>+</button></div>
        <label>Restrições alimentares</label>
        <Chips value={me.diet || []} onChange={v => upd({ diet: v })} />
        <label htmlFor="grp">Grupo do amigo secreto</label>
        <select id="grp" value={me.group || 'Adultos'} onChange={e => upd({ group: e.target.value })}>{GROUPS.map(g => <option key={g}>{g}</option>)}</select>
      </div>
      {Object.keys(diets).length > 0 && <div className="card"><h3>Restrições na família</h3>
        <ul className="list">{Object.entries(diets).map(([d, n]) => <li key={d}><span className="grow"><b className="fw6">{d}</b><div className="mute">{n.join(', ')}</div></span></li>)}</ul></div>}
      <div className="card"><h3>Lista</h3>
        <ul className="list">{E.people.map(p => <li key={p.id}><Avatar id={p.id} /><span className="grow">{p.name}{+p.guests > 0 && <span className="mute"> +{p.guests}</span>}</span>
          <span className={'pill ' + (p.rsvp === 'sim' ? 'ok' : p.rsvp === 'nao' ? 'no' : 'maybe')}>{label[p.rsvp] || 'Talvez'}</span></li>)}</ul></div>
    </Screen>
  )
}

/* ================= Pratos ================= */
function Pratos() {
  const { E, meId, act, toast } = useApp()
  const [f, setF] = useState({ name: '', cat: CATS[1], diet: [] })
  const needs = [...new Set(E.people.filter(p => p.rsvp !== 'nao').flatMap(p => p.diet || []))]
  const food = E.dishes.filter(d => d.cat !== 'Bebida')
  const fits = (d, r) => (d.diet || []).includes(r) || (r === 'Vegetariano' && (d.diet || []).includes('Vegano'))
  const missing = needs.filter(r => !food.some(d => fits(d, r)))
  const add = () => {
    const n = f.name.trim(); if (!n) return
    if (E.dishes.some(d => d.name.toLowerCase() === n.toLowerCase())) return toast('Já tem esse prato', 'Escolha outro para não repetir')
    act(d => d.dishes.push({ id: rid(), cat: f.cat, name: n, who: meId, diet: f.diet }))
    setF({ ...f, name: '', diet: [] }); toast('Anotado!', `Você leva ${n}`)
  }
  return (
    <Screen title="Pratos da ceia">
      {missing.length > 0 && <div className="card warn"><b>Falta opção para: {missing.join(', ')}</b><div className="mute">Tem gente com essa restrição confirmada.</div></div>}
      {CATS.map(c => {
        const items = E.dishes.filter(d => d.cat === c)
        return <div className="card" key={c}><h3>{c}</h3>
          {items.length ? <ul className="list">{items.map(d => (
            <li key={d.id}><div className="grow"><b className="fw6">{d.name}</b>
              <div className="mute">{d.who ? 'Leva: ' + nameOf(E, d.who) : 'Ninguém pegou ainda'}</div>
              {(d.diet || []).length > 0 && <div className="tags">{d.diet.map(t => <span key={t} className="tag">{t}</span>)}</div>}</div>
              {d.who
                ? d.who === meId ? <button className="btn o sm-btn" onClick={() => act(x => { const k = x.dishes.find(y => y.id === d.id); if (k) k.who = '' })}>Soltar</button> : <Avatar id={d.who} />
                : <button className="btn g sm-btn" onClick={() => act(x => { const k = x.dishes.find(y => y.id === d.id); if (k && !k.who) k.who = meId })}>Eu levo</button>}
            </li>))}</ul> : <p className="mute m0">Nada ainda.</p>}
        </div>
      })}
      <div className="card"><h3>Adicionar prato</h3>
        <label htmlFor="dn">Prato</label><input id="dn" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Ex.: Salpicão" />
        <label htmlFor="dc">Categoria</label><select id="dc" value={f.cat} onChange={e => setF({ ...f, cat: e.target.value })}>{CATS.map(c => <option key={c}>{c}</option>)}</select>
        <label>Serve para</label><Chips value={f.diet} onChange={v => setF({ ...f, diet: v })} />
        <button className="btn w mt" onClick={add}>Adicionar e levar eu</button></div>
    </Screen>
  )
}

/* ================= Programação ================= */
function Programa() {
  const { E, act, isOwner, toast } = useApp()
  const [t, setT] = useState('21:00'); const [n, setN] = useState('')
  const [pl, setPl] = useState(E.place); const [dt, setDt] = useState(E.date)
  const sorted = [...E.sched].sort((a, b) => schedKey(a.t).localeCompare(schedKey(b.t)))
  return (
    <Screen title="Programação">
      <div className="card"><h3>{new Date(E.date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
        <ul className="list">{sorted.map(x => <li key={x.id}><span className="time">{x.t}</span><span className="grow">{x.title}</span>
          <button className="btn o sm-btn" aria-label={'Remover ' + x.title} onClick={() => act(d => { d.sched = d.sched.filter(y => y.id !== x.id) })}>✕</button></li>)}</ul></div>
      <div className="card"><h3>Novo momento</h3>
        <div className="row"><input type="time" value={t} onChange={e => setT(e.target.value)} style={{ maxWidth: 130 }} aria-label="Horário" />
          <input value={n} onChange={e => setN(e.target.value)} placeholder="Ex.: Oração" aria-label="Momento" /></div>
        <button className="btn g w mt" onClick={() => { if (!n.trim()) return; act(d => d.sched.push({ id: rid(), t, title: n.trim() })); setN('') }}>Adicionar</button></div>
      {isOwner && <div className="card"><h3>Local e horário da ceia</h3>
        <label htmlFor="pl">Local</label><input id="pl" value={pl} onChange={e => setPl(e.target.value)} />
        <label htmlFor="dt">Data e hora</label><input id="dt" type="datetime-local" value={dt} onChange={e => setDt(e.target.value)} />
        <button className="btn o w mt" onClick={() => { act(d => { d.place = pl.trim() || d.place; d.date = dt || d.date }); toast('Salvo', 'Todo mundo já vê a mudança') }}>Salvar</button></div>}
    </Screen>
  )
}

/* ================= Vaquinha ================= */
function Vaquinha() {
  const { E, meId, act, isOwner, toast } = useApp()
  const [v, setV] = useState(E.pay.value); const [pix, setPix] = useState(E.pay.pix)
  const n = E.people.length, paid = E.people.filter(p => E.pay.paid[p.id]).length
  const tot = n * E.pay.value, got = paid * E.pay.value
  const copy = () => navigator.clipboard?.writeText(E.pay.pix).then(() => toast('Chave Pix copiada', 'Cole no app do seu banco'), () => toast('Não deu para copiar', 'Selecione a chave e copie'))
  return (
    <Screen title="Vaquinha">
      <div className="card"><div className="mute">Arrecadado</div>
        <div className="big">{fmt(got)} <span className="mute nowrap" style={{ fontSize: 18 }}>de {fmt(tot)}</span></div>
        <div className="prog"><i style={{ width: `${tot ? got / tot * 100 : 0}%` }} /></div>
        <div className="mute">{paid} de {n} pagaram · {fmt(E.pay.value)} por pessoa</div></div>
      <div className="card"><h3>Pagar com Pix</h3>
        <p className="mute m0">O app só anota quem pagou. O dinheiro vai direto para a chave de quem organizou.</p>
        {E.pay.pix ? <div className="row mt"><code className="pix grow">{E.pay.pix}</code><button className="btn g" onClick={copy}>Copiar</button></div>
          : <p className="mute">Chave Pix ainda não cadastrada.</p>}
        {!E.pay.paid[meId] && <button className="btn w mt" onClick={() => { act(d => { d.pay.paid[meId] = true }); toast('Valeu!', 'Marcado como pago') }}>Já paguei</button>}
      </div>
      {isOwner && <div className="card"><h3>Configurar</h3>
        <label htmlFor="pix">Chave Pix</label><input id="pix" value={pix} onChange={e => setPix(e.target.value)} placeholder="E-mail, celular ou chave aleatória" />
        <label htmlFor="pv">Valor por pessoa</label><input id="pv" type="number" inputMode="numeric" value={v} onChange={e => setV(e.target.value)} />
        <button className="btn o w mt" onClick={() => { act(d => { d.pay.value = Math.max(0, +v || 0); d.pay.pix = pix.trim() }); toast('Salvo', 'Vaquinha atualizada') }}>Salvar</button></div>}
      <div className="card"><h3>Quem já pagou</h3>
        <ul className="list">{E.people.map(p => <li key={p.id}><Avatar id={p.id} /><span className="grow">{p.name}</span>
          <button className={'pill ' + (E.pay.paid[p.id] ? 'ok' : 'no')} disabled={!isOwner} onClick={() => act(d => { d.pay.paid[p.id] = !d.pay.paid[p.id] })}>{E.pay.paid[p.id] ? 'Pago ✓' : 'Pendente'}</button></li>)}</ul>
        {isOwner && <button className="btn w mt" disabled={paid === n} onClick={() => {
          const faltam = E.people.filter(p => !E.pay.paid[p.id]).map(p => p.name).join(', ')
          const txt = `Lembrete da vaquinha do ${E.name}: ${fmt(E.pay.value)} no Pix ${E.pay.pix}. Faltam: ${faltam}`
          window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank')
        }}>Cobrar no WhatsApp ({n - paid})</button>}
      </div>
    </Screen>
  )
}

/* ================= Brincadeiras ================= */
function Jogos() {
  const { E, meId, act, toast } = useApp()
  const [tab, setTab] = useState('roleta')
  const players = E.people.filter(p => p.rsvp !== 'nao')
  return (
    <Screen title="Brincadeiras">
      <div className="tabs">{[['roleta', 'Roleta do desafio'], ['mimica', 'Mímica'], ['quiz', 'Quiz de Natal']].map(([k, l]) =>
        <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'roleta' && <Roleta players={players} />}
      {tab === 'mimica' && <Mimica players={players} />}
      {tab === 'quiz' && <Quiz />}
      <p className="proto">Cada acerto ou desafio cumprido vale 1 ponto no Ranking.</p>
    </Screen>
  )
}
function Roleta({ players }) {
  const { act, toast } = useApp()
  const [rot, setRot] = useState(0); const [res, setRes] = useState(null); const [spin, setSpin] = useState(false)
  const n = Math.max(players.length, 1), seg = 360 / n
  const go = () => {
    const k = Math.floor(Math.random() * n)
    const target = rot + 1440 + (360 - ((k + 0.5) * seg)) - (rot % 360)
    setRot(target); setSpin(true); setRes(null)
    setTimeout(() => { setRes({ p: players[k], d: pick(DESAFIOS) }); setSpin(false) }, 3300)
  }
  return <div className="card center">
    <svg className="wheel" viewBox="-110 -110 220 220" style={{ transform: `rotate(${rot}deg)` }} aria-label="Roleta">
      {players.map((p, i) => {
        const a1 = (i * seg - 90) * Math.PI / 180, a2 = ((i + 1) * seg - 90) * Math.PI / 180, m = ((i + 0.5) * seg - 90) * Math.PI / 180
        return <g key={p.id}><path d={`M0 0L${100 * Math.cos(a1)} ${100 * Math.sin(a1)}A100 100 0 ${seg > 180 ? 1 : 0} 1 ${100 * Math.cos(a2)} ${100 * Math.sin(a2)}Z`} fill={i % 2 ? '#0f5132' : '#c8102e'} stroke="#fff" strokeWidth="2" />
          <text x={62 * Math.cos(m)} y={62 * Math.sin(m)} fill="#fff" fontSize="11" fontWeight="600" textAnchor="middle" dominantBaseline="middle">{p.name.split(' ')[0]}</text></g>
      })}
      <circle r="14" fill="#d4a72c" />
    </svg>
    <div className="pointer">▲</div>
    <div className="spin-res">{res ? <><b>{res.p.name}</b><br />{res.d}</> : <span className="mute">Gire para sortear quem paga o desafio</span>}</div>
    {res ? <div className="row"><button className="btn o grow" onClick={() => setRes(null)}>Não cumpriu</button>
      <button className="btn g grow" onClick={() => { act(d => addPoints(d, res.p.id, 1)); toast('+1 ponto', res.p.name); setRes(null) }}>Cumpriu (+1)</button></div>
      : <button className="btn w" disabled={spin || players.length < 2} onClick={go}>{spin ? 'Girando…' : 'Girar roleta'}</button>}
  </div>
}
function Mimica({ players }) {
  const { meId, act, toast } = useApp()
  const [w, setW] = useState(null); const [s, setS] = useState(60); const t = useRef(null)
  useEffect(() => () => clearInterval(t.current), [])
  const start = () => {
    clearInterval(t.current); setW(pick(MIMICA)); setS(60)
    t.current = setInterval(() => setS(x => { if (x <= 1) { clearInterval(t.current); return 0 } return x - 1 }), 1000)
  }
  const hit = id => { clearInterval(t.current); act(d => { addPoints(d, id, 1); addPoints(d, meId, 1) }); toast('Acertou!', '+1 para quem acertou e +1 para você'); setW(null) }
  return <>
    <div className="lot center"><div className="o85">Faça a mímica de</div><div className="big">{w || 'Toque em sortear'}</div>
      <span className={'timer' + (s <= 10 && w ? ' hot' : '')}>{w ? (s ? s + 's' : 'Tempo!') : '60s'}</span></div>
    {w ? <div className="card"><h3>Quem acertou?</h3><div className="chips">{players.filter(p => p.id !== meId).map(p => <button key={p.id} className="chip" onClick={() => hit(p.id)}>{p.name}</button>)}</div></div>
      : <button className="btn w" onClick={start}>Sortear palavra e iniciar 60s</button>}
  </>
}
function Quiz() {
  const { meId, act, toast } = useApp()
  const [q, setQ] = useState(0); const [pts, setPts] = useState(0)
  if (q >= QUIZ.length) return <div className="card center"><div className="mute">Sua pontuação</div><div className="big">{pts} de {QUIZ.length}</div>
    <button className="btn w mt" onClick={() => { setQ(0); setPts(0) }}>Jogar de novo</button></div>
  const [txt, opts, right] = QUIZ[q]
  const answer = i => {
    if (i === right) { setPts(pts + 1); act(d => addPoints(d, meId, 1)); toast('Acertou!', '+1 ponto') } else toast('Errou', 'Resposta: ' + opts[right])
    setQ(q + 1)
  }
  return <div className="card"><div className="mute">Pergunta {q + 1} de {QUIZ.length} · {pts} acertos</div>
    <h3 className="q">{txt}</h3>{opts.map((o, i) => <button key={o} className="btn o w left mb" onClick={() => answer(i)}>{o}</button>)}</div>
}

/* ================= Bingo ================= */
function Bingo() {
  const { E, meId, act, isOwner, openModal, toast } = useApp()
  const B = E.bingo
  const card = bingoCard(E.code, meId, B.round)
  const last = B.drawn.at(-1)
  const can = hasBingo(card, B.drawn)
  const next = () => act(d => {
    if (d.bingo.winner || d.bingo.drawn.length >= 75) return
    const left = Array.from({ length: 75 }, (_, i) => i + 1).filter(x => !d.bingo.drawn.includes(x))
    d.bingo.drawn.push(pick(left))
  })
  const shout = () => act(d => {
    if (d.bingo.winner) return
    if (hasBingo(bingoCard(d.code, meId, d.bingo.round), d.bingo.drawn)) { d.bingo.winner = meId; addPoints(d, meId, 3) }
  })
  return (
    <Screen title="Bingo de Natal">
      <div className="lot center">
        {B.winner ? <><div className="o85">Rodada {B.round}</div><div className="big">BINGO de {nameOf(E, B.winner)}!</div><div className="o85">+3 pontos no Ranking</div></>
          : last ? <><div className="o85">Última bola · {B.drawn.length} de 75</div><div className="ball">{bingoLetter(last)}<b>{last}</b></div></>
            : <><div className="o85">Rodada {B.round}</div><div className="big">Esperando a primeira bola</div></>}
      </div>
      {isOwner && !B.winner && <button className="btn w mb" onClick={next} disabled={B.drawn.length >= 75}>Sortear bola</button>}
      <div className="card">
        <div className="bingo">{'BINGO'.split('').map(l => <b key={l} className="bh">{l}</b>)}
          {card.flat().map((n, i) => <span key={i} className={'bc' + (n === 0 || B.drawn.includes(n) ? ' hit' : '') + (n === last ? ' last' : '')}>{n === 0 ? '★' : n}</span>)}</div>
        <button className="btn w mt big-btn" disabled={!can || !!B.winner} onClick={shout}>{B.winner ? 'Rodada encerrada' : can ? 'BINGO!' : 'Complete uma linha, coluna ou diagonal'}</button>
        <p className="mute sm center">Os números marcam sozinhos quando são sorteados.</p>
      </div>
      {B.drawn.length > 0 && <div className="card"><h3>Bolas sorteadas</h3><div className="drawn">{[...B.drawn].sort((a, b) => a - b).map(n => <span key={n}>{n}</span>)}</div></div>}
      {isOwner && <button className="btn o w" onClick={() => openModal(<Confirm text="Começar nova rodada?" sub="Todo mundo recebe uma cartela nova." ok="Nova rodada" onOk={() => act(d => { d.bingo = { drawn: [], winner: null, round: d.bingo.round + 1 } })} />)}>Nova rodada</button>}
    </Screen>
  )
}

/* ================= Leilão ================= */
function WebRewardAd({ onDone }) {
  const [s, setS] = useState(5)
  useEffect(() => { const t = setInterval(() => setS(x => Math.max(0, x - 1)), 1000); return () => clearInterval(t) }, [])
  useEffect(() => { if (ADSENSE) try { (window.adsbygoogle = window.adsbygoogle || []).push({}) } catch { /* bloqueador */ } }, [])
  return <>
    <h3>Anúncio premiado</h3>
    <div className="adbox">{ADSENSE
      ? <ins className="adsbygoogle" style={{ display: 'block', width: '100%', height: 250 }} data-ad-client={ADSENSE.client} data-ad-slot={ADSENSE.slot} data-ad-format="rectangle" />
      : <span><b>AD</b><br />Espaço do anúncio</span>}</div>
    <button className="btn g w mt" disabled={s > 0} onClick={onDone}>{s > 0 ? `Aguarde ${s}s` : `Pegar +${fmt(REWARD)}`}</button>
  </>
}
function Leilao() {
  const { E, meId, act, isOwner, openModal, closeModal, toast } = useApp()
  const A = E.auc, L = A.live
  const bal = id => A.bal[id] ?? A.start
  const [, tick] = useState(0)
  useEffect(() => { if (!L) return; const t = setInterval(() => tick(x => x + 1), 250); return () => clearInterval(t) }, [L?.pid])
  const P = L && A.prizes.find(x => x.id === L.pid)
  const left = L ? Math.max(0, Math.ceil((L.end - Date.now()) / 1000)) : 0
  const used = A.rewards?.[meId] || 0
  const players = E.people.filter(p => p.rsvp !== 'nao')

  const bid = (who, v) => act(d => {
    const l = d.auc.live; if (!l || Date.now() > l.end) return
    const pr = d.auc.prizes.find(x => x.id === l.pid)
    const nh = l.by ? l.high + v : pr.min
    if (l.by === who || nh > (d.auc.bal[who] ?? d.auc.start)) return
    l.high = nh; l.by = who
    if (l.end - Date.now() < 10000) l.end = Date.now() + 10000
  })
  const reward = async () => {
    const give = () => { act(d => { const r = (d.auc.rewards ||= {}); if ((r[meId] || 0) >= REWARD_MAX) return; r[meId] = (r[meId] || 0) + 1; d.auc.bal[meId] = (d.auc.bal[meId] ?? d.auc.start) + REWARD }); toast('Saldo turbinado!', `+${fmt(REWARD)} para o leilão`) }
    if (NATIVE) { const ok = await showRewarded(); if (ok) give(); else toast('Anúncio indisponível', 'Tente de novo em instantes') }
    else openModal(<WebRewardAd onDone={() => { give(); closeModal() }} />)
  }
  const nextLot = A.prizes.find(p => !p.win)

  return (
    <Screen title="Leilão">
      {L && P ? <>
        <div className="lot">
          <div className="row"><span className="grow o85">Ao vivo</span><span className={'timer' + (left <= 10 ? ' hot' : '')}>{left}s</span></div>
          <div className="big">{P.name}</div>
          {L.by ? <><div className="o85">Maior lance</div><div className="bid">{fmt(L.high)} · {nameOf(E, L.by)}</div></>
            : <><div className="o85">Lance inicial</div><div className="bid">{fmt(P.min)}</div></>}
        </div>
        <div className="card">
          <div className="mute mb">Seu saldo: <b className="ink">{fmt(bal(meId))}</b></div>
          {L.by === meId ? <p className="ok-text">Você está ganhando! Segura aí.</p>
            : !L.by ? <button className="btn w" disabled={P.min > bal(meId)} onClick={() => bid(meId, 0)}>Dar lance de {fmt(P.min)}</button>
              : <div className="grid g3">{[50, 100, 200].map(v => <button key={v} className="btn" disabled={L.high + v > bal(meId)} onClick={() => bid(meId, v)}>+{v}</button>)}</div>}
          {DEMO && <button className="btn o w mt" onClick={() => {
            const o = players.filter(p => p.id !== meId && p.id !== L.by && bal(p.id) >= (L.by ? L.high + 50 : P.min))
            if (!o.length) return toast('Ninguém tem saldo', 'Os outros não conseguem cobrir')
            bid(pick(o).id, pick([50, 100]))
          }}>Simular lance de outra pessoa</button>}
          <p className="mute sm">Lance nos últimos 10 segundos volta o cronômetro para 10s.</p>
        </div>
      </> : <div className="lot">
        {nextLot ? <><div className="o85">Cada pessoa começa com</div><div className="big">{fmt(A.start)}</div><div className="o85 mb">de mentirinha para disputar os prêmios</div>
          {isOwner ? <button className="btn w white" onClick={() => act(d => { if (!d.auc.live) d.auc.live = { pid: nextLot.id, high: 0, by: '', end: Date.now() + 30000 } })}>Iniciar lote: {nextLot.name}</button>
            : <p className="m0">Quem organizou inicia cada lote. Fique de olho no aviso!</p>}</>
          : <><div className="big">{A.prizes.length ? 'Leilão encerrado' : 'Nenhum prêmio ainda'}</div><div className="o85">{A.prizes.length ? 'Confira quem levou cada prêmio.' : 'Adicione os prêmios abaixo.'}</div></>}
      </div>}

      <button className="card reward w left" disabled={used >= REWARD_MAX} onClick={reward}>
        <span className="ic" style={{ background: 'var(--gold)' }}><Icon n="play" /></span>
        <span className="grow"><b>Assista um anúncio e ganhe +{fmt(REWARD)}</b><span className="mute block">{used >= REWARD_MAX ? 'Você já usou todos de hoje' : `Restam ${REWARD_MAX - used} de ${REWARD_MAX}`}</span></span>
      </button>

      <div className="card"><h3>Prêmios</h3>
        <ul className="list">{A.prizes.map(p => <li key={p.id}><div className="grow"><b className="fw6">{p.name}</b>
          <div className="mute">{p.win ? `Arrematado por ${nameOf(E, p.win)} · ${fmt(p.price)}` : 'Lance mínimo ' + fmt(p.min)}</div></div>
          {p.win ? <Avatar id={p.win} /> : L?.pid === p.id ? <span className="pill no">Ao vivo</span>
            : isOwner && !L && <button className="btn o sm-btn" aria-label={'Remover ' + p.name} onClick={() => act(d => { d.auc.prizes = d.auc.prizes.filter(x => x.id !== p.id) })}>✕</button>}</li>)}</ul>
        {isOwner && !L && <AddPrize />}
      </div>
      <div className="card"><h3>Saldos</h3>
        <ul className="list">{[...players].sort((a, b) => bal(b.id) - bal(a.id)).map(p => <li key={p.id}><Avatar id={p.id} /><span className="grow">{p.name}</span><b className="num">{fmt(bal(p.id))}</b></li>)}</ul>
        {isOwner && <button className="btn o w mt" onClick={() => openModal(<Confirm text="Zerar o leilão?" sub="Saldos voltam ao início e os prêmios voltam para a fila." ok="Zerar" onOk={() => act(d => { d.auc.bal = {}; d.auc.live = null; d.auc.rewards = {}; d.auc.prizes.forEach(p => { delete p.win; delete p.price }) })} />)}>Zerar leilão</button>}
      </div>
    </Screen>
  )
}
function AddPrize() {
  const { act, E } = useApp()
  const [n, setN] = useState(''); const [m, setM] = useState(''); const [st, setSt] = useState(E.auc.start)
  return <>
    <div className="row mt"><input value={n} onChange={e => setN(e.target.value)} placeholder="Novo prêmio" aria-label="Novo prêmio" />
      <input type="number" inputMode="numeric" value={m} onChange={e => setM(e.target.value)} placeholder="Mín." style={{ maxWidth: 90 }} aria-label="Lance mínimo" />
      <button className="btn g" onClick={() => { if (!n.trim()) return; act(d => d.auc.prizes.push({ id: rid(), name: n.trim(), min: Math.max(50, +m || 100) })); setN(''); setM('') }}>+</button></div>
    <label htmlFor="st">Saldo inicial de cada pessoa</label>
    <div className="row"><input id="st" type="number" inputMode="numeric" value={st} onChange={e => setSt(e.target.value)} />
      <button className="btn o" onClick={() => act(d => { d.auc.start = Math.max(100, +st || 1500) })}>Salvar</button></div>
  </>
}

/* ================= Ranking ================= */
function Ranking() {
  const { E, act, isOwner, openModal } = useApp()
  const pts = E.game.points || {}
  const rows = E.people.filter(p => p.rsvp !== 'nao').map(p => ({ ...p, pts: pts[p.id] || 0, prizes: E.auc.prizes.filter(x => x.win === p.id).length })).sort((a, b) => b.pts - a.pts)
  const max = Math.max(1, ...rows.map(r => r.pts))
  return (
    <Screen title="Ranking da noite">
      {rows[0]?.pts > 0 && <div className="lot center"><div className="o85">Campeão até agora</div><div className="big">{rows[0].name}</div><div className="o85">{rows[0].pts} {rows[0].pts === 1 ? 'ponto' : 'pontos'}</div></div>}
      <div className="card"><ul className="list">{rows.map((r, i) => <li key={r.id}><span className="pos">{i + 1}º</span><Avatar id={r.id} />
        <div className="grow"><div className="row nowrap-row"><span className="grow">{r.name}</span><b className="num">{r.pts} pts</b></div>
          <div className="prog thin"><i style={{ width: `${r.pts / max * 100}%` }} /></div>
          {r.prizes > 0 && <div className="mute sm">{r.prizes} prêmio(s) no leilão</div>}</div></li>)}</ul></div>
      <p className="proto">Roleta e mímica: 1 ponto · Quiz: 1 por acerto · Bingo: 3 pontos</p>
      {isOwner && <button className="btn o w" onClick={() => openModal(<Confirm text="Zerar o ranking?" ok="Zerar" onOk={() => act(d => { d.game.points = {} })} />)}>Zerar ranking</button>}
    </Screen>
  )
}

/* ================= Notificações ================= */
function Avisos() {
  const { notif, setNotif, toast } = useApp()
  const N = [['countdown', 'Contagem regressiva', 'Avisos em 7 dias, 1 dia e 1 hora'], ['secret', 'Amigo secreto', 'Quando o sorteio sair'], ['dishes', 'Pratos', 'Lembrete do que você vai levar'],
    ['pay', 'Vaquinha', 'Lembrete se o Pix estiver pendente'], ['auction', 'Leilão', 'Quando um lote começar e terminar'], ['bingo', 'Bingo', 'Quando alguém gritar BINGO']]
  const n = { ...DEFAULT_NOTIF, ...notif }
  return (
    <Screen title="Notificações">
      <div className="card"><ul className="list">{N.map(([k, t, d]) => <li key={k}><div className="grow"><b className="fw6">{t}</b><div className="mute">{d}</div></div>
        <button className={'tg' + (n[k] ? ' on' : '')} role="switch" aria-checked={!!n[k]} aria-label={t} onClick={() => setNotif({ ...n, [k]: !n[k] })} /></li>)}</ul></div>
      <button className="btn w" onClick={async () => { const ok = await askPermission(); notifyNow('Teste do Natal Vision', 'As notificações estão funcionando!'); toast(ok ? 'Notificações ligadas' : 'Permissão negada', ok ? 'Você vai receber os lembretes' : 'Ative nas configurações do celular') }}>Ativar e testar</button>
    </Screen>
  )
}

export const VIEWS = { amigo: Amigo, presenca: Presenca, pratos: Pratos, programa: Programa, vaquinha: Vaquinha, jogos: Jogos, bingo: Bingo, leilao: Leilao, ranking: Ranking, avisos: Avisos }
