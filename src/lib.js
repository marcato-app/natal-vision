import { rid } from './backend'

export const fmt = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR')
export const COLORS = ['#c8102e', '#0f5132', '#b07d12', '#7a3b8f', '#1d6fa5', '#d2552a', '#2f7d5b', '#9e0b23', '#5a6b2b', '#a3376b']
export const CATS = ['Entrada', 'Prato principal', 'Acompanhamento', 'Sobremesa', 'Bebida']
export const DIETS = ['Vegetariano', 'Vegano', 'Sem lactose', 'Sem glúten', 'Sem frutos do mar', 'Sem carne de porco']
export const GROUPS = ['Adultos', 'Crianças']
export const REWARD = 200       // R$ de mentirinha por anúncio assistido
export const REWARD_MAX = 3     // anúncios premiados por pessoa

export function newCode() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return 'NV' + Array.from({ length: 4 }, () => a[Math.floor(Math.random() * a.length)]).join('')
}

export const person = (id, name, extra = {}) => ({ id, name, rsvp: 'sim', guests: 0, diet: [], group: 'Adultos', ...extra })

export function newEvent({ code, name, date, place, owner, ownerName }) {
  return {
    code, name, date, place, owner, createdAt: Date.now(),
    people: [person(owner, ownerName)],
    secret: { drawn: false, limit: 100, exclusions: [], wishes: {}, seen: {} },
    dishes: [],
    sched: [
      { id: rid(), t: '19:00', title: 'Chegada' },
      { id: rid(), t: '22:00', title: 'Ceia' },
      { id: rid(), t: '00:00', title: 'Feliz Natal!' }
    ],
    pay: { value: 0, pix: '', paid: { [owner]: true } },
    auc: { start: 1500, bal: {}, prizes: [], live: null, rewards: {} },
    game: { points: {} },
    bingo: { drawn: [], winner: null, round: 1 }
  }
}

// Família fictícia para a demonstração
export function demoEvent(meId, meName) {
  const ev = newEvent({ code: newCode(), name: 'Natal da Família', date: '2026-12-24T20:00', place: 'Casa da Vó', owner: meId, ownerName: meName })
  const fam = [['Mãe', {}], ['Pai', {}], ['Vó Lúcia', { diet: ['Sem lactose'] }], ['Tio Marcos', { rsvp: 'talvez' }],
    ['Tia Renata', { diet: ['Vegetariano'], guests: 1 }], ['Pedro', { group: 'Crianças' }], ['Ana', { group: 'Crianças' }], ['Lucas', { group: 'Crianças' }]]
  const ids = {}
  fam.forEach(([n, x]) => { const id = 'd' + rid(); ids[n] = id; ev.people.push(person(id, n, x)) })
  ev.secret.exclusions = [[ids['Mãe'], ids['Pai']]]
  ev.secret.wishes = { [ids['Mãe']]: 'Livro de receitas, avental', [ids['Vó Lúcia']]: 'Manta, chinelo 37', [ids['Pedro']]: 'Bola de futebol' }
  ev.dishes = [
    { id: rid(), cat: 'Prato principal', name: 'Peru assado', who: ids['Mãe'], diet: [] },
    { id: rid(), cat: 'Acompanhamento', name: 'Arroz à grega', who: ids['Vó Lúcia'], diet: ['Vegetariano'] },
    { id: rid(), cat: 'Acompanhamento', name: 'Farofa de bacon', who: ids['Tio Marcos'], diet: [] },
    { id: rid(), cat: 'Sobremesa', name: 'Pavê de chocolate', who: ids['Tia Renata'], diet: ['Vegetariano'] },
    { id: rid(), cat: 'Bebida', name: 'Refrigerante e suco', who: '', diet: ['Vegano'] }
  ]
  ev.sched = [['19:00', 'Chegada e aperitivos'], ['20:30', 'Foto da família'], ['21:00', 'Leilão de prêmios'], ['22:00', 'Ceia'], ['23:00', 'Bingo de Natal'], ['23:30', 'Amigo secreto'], ['00:00', 'Feliz Natal!']].map(([t, title]) => ({ id: rid(), t, title }))
  ev.pay = { value: 80, pix: 'natal.familia@email.com', paid: { [meId]: true, [ids['Mãe']]: true, [ids['Pai']]: true, [ids['Vó Lúcia']]: true } }
  ev.auc.prizes = [['Panetone trufado', 100], ['Vale-pizza para 2', 200], ['Caixa de bombons', 100], ['Garrafa de vinho', 300], ['Envelope misterioso', 150]].map(([name, min]) => ({ id: rid(), name, min }))
  return ev
}

// Ordem da noite: horários de madrugada (00h–05h) vão para o fim
export const schedKey = t => (t < '06' ? '2' : '1') + t

/* -------- Amigo secreto com exceções e grupos -------- */
export function drawSecret(people, exclusions) {
  const blocked = new Set(exclusions.flatMap(([a, b]) => [a + '>' + b, b + '>' + a]))
  const result = {}
  const active = people.filter(p => p.rsvp !== 'nao')
  // Grupo com menos de 3 pessoas entra no sorteio dos adultos (2 pessoas iam se tirar entre si)
  const groupOf = p => {
    const g = p.group || 'Adultos'
    return active.filter(x => (x.group || 'Adultos') === g).length >= 3 ? g : 'Adultos'
  }
  for (const g of GROUPS) {
    const ids = active.filter(p => groupOf(p) === g).map(p => p.id)
    if (ids.length === 0) continue
    if (ids.length < 3) return { error: 'O sorteio precisa de pelo menos 3 pessoas' }
    let ok = null
    for (let t = 0; t < 5000 && !ok; t++) {
      const r = [...ids].sort(() => Math.random() - 0.5)
      if (r.every((x, k) => x !== ids[k] && !blocked.has(ids[k] + '>' + x))) ok = r
    }
    if (!ok) return { error: `Não deu para sortear o grupo ${g} com essas exceções` }
    ids.forEach((id, k) => { result[id] = ok[k] })
  }
  return { map: result }
}

/* -------- Bingo -------- */
function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19 }
  return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296 }
}
// Cartela 5x5 (B-I-N-G-O), centro livre; sempre a mesma para a pessoa na rodada
export function bingoCard(code, pid, round) {
  const r = rng(code + pid + round), cols = []
  for (let c = 0; c < 5; c++) {
    const pool = Array.from({ length: 15 }, (_, i) => c * 15 + i + 1)
    const pick = []
    while (pick.length < 5) { const n = pool.splice(Math.floor(r() * pool.length), 1)[0]; pick.push(n) }
    cols.push(pick)
  }
  return Array.from({ length: 5 }, (_, row) => Array.from({ length: 5 }, (_, c) => (row === 2 && c === 2 ? 0 : cols[c][row])))
}
export function hasBingo(card, drawn) {
  const m = card.map(row => row.map(n => n === 0 || drawn.includes(n)))
  const lines = [...m, ...m[0].map((_, c) => m.map(r => r[c])), m.map((r, i) => r[i]), m.map((r, i) => r[4 - i])]
  return lines.some(l => l.every(Boolean))
}
export const bingoLetter = n => 'BINGO'[Math.floor((n - 1) / 15)]

/* -------- Brincadeiras -------- */
export const DESAFIOS = ['Imitar o Papai Noel por 20 segundos', 'Cantar um trecho de música de Natal', 'Contar a melhor história de Natal da família', 'Fazer um brinde de 30 segundos', 'Dançar até alguém rir', 'Elogiar três pessoas da mesa', 'Falar com sotaque até a próxima rodada', 'Tirar uma selfie com todo mundo', 'Adivinhar o presente de alguém', 'Fazer a pose de foto mais natalina']
export const MIMICA = ['Montar a árvore', 'Papai Noel preso na chaminé', 'Abrir um presente ruim', 'Assar o peru', 'Rena voando', 'Boneco de neve derretendo', 'Fazer um pedido de Natal', 'Esperar o Papai Noel acordado', 'Embrulhar presente', 'Amigo secreto envergonhado', 'Comer panetone com uva-passa', 'Desembaraçar o pisca-pisca']
export const QUIZ = [
  ['Qual é o pão doce italiano típico do Natal?', ['Panetone', 'Croissant', 'Brioche'], 0],
  ['Em que dia se comemora o Dia de Reis?', ['25 de dezembro', '1º de janeiro', '6 de janeiro'], 2],
  ['De qual país vem a tradição da árvore de Natal enfeitada?', ['Alemanha', 'Brasil', 'Japão'], 0],
  ['Quantas renas puxam o trenó na versão clássica (sem o Rudolph)?', ['6', '8', '12'], 1],
  ['Qual é a cor tradicional da roupa do Papai Noel?', ['Verde', 'Azul', 'Vermelha'], 2],
  ['Como se chama a rena de nariz vermelho?', ['Rudolph', 'Corredora', 'Cometa'], 0],
  ['Qual fruta seca costuma dividir opiniões no panetone?', ['Uva-passa', 'Damasco', 'Ameixa'], 0],
  ['Em que mês começa o verão no Brasil?', ['Novembro', 'Dezembro', 'Janeiro'], 1]
]
