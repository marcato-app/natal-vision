# Natal Vision

App de organização do Natal: amigo secreto, presença, pratos, programação, vaquinha, brincadeiras, bingo, leilão de mentirinha e ranking.
Um código só para **site**, **iPhone** e **Android** (React + Vite + Firebase + Capacitor), monetizado com anúncios.

## 1. Rodar no computador (5 min)

Precisa do [Node.js](https://nodejs.org) 20 ou mais novo.

```bash
npm install
npm run dev
```

Abra o endereço que aparecer. Sem o `.env`, o app roda em **modo demonstração** (dados só no aparelho).

## 2. Ligar o Firebase (tempo real entre a família) (15 min)

1. Crie um projeto em https://console.firebase.google.com (plano gratuito Spark serve).
2. **Authentication** > Começar > ative o provedor **Anônimo**.
3. **Firestore Database** > Criar banco (modo produção, região `southamerica-east1`).
4. Em **Regras**, cole o conteúdo de `firestore.rules` e publique.
5. **Configurações do projeto** > Seus apps > ícone `</>` (Web) > copie as chaves.
6. Copie `.env.example` para `.env` e preencha as chaves `VITE_FIREBASE_*`.
7. `npm run dev` de novo. Agora o evento sincroniza entre todos os celulares.

## 3. Colocar o site no ar (10 min)

Opção mais simples: **Vercel** ou **Netlify**.

1. Suba esta pasta para um repositório no GitHub.
2. Importe na Vercel. Build: `npm run build`, pasta de saída: `dist`.
3. Em *Environment Variables*, cole as mesmas variáveis do `.env`.
4. No Firebase > Authentication > Configurações > **Domínios autorizados**, adicione o domínio da Vercel.

No iPhone, abrir o site no Safari > Compartilhar > **Adicionar à Tela de Início** já instala como app.

## 4. Anúncios

- **Site (AdSense):** cadastre o domínio em https://adsense.google.com. A aprovação pode demorar; o espaço do anúncio já está pronto. Depois preencha `VITE_ADSENSE_CLIENT` e `VITE_ADSENSE_SLOT` e crie o arquivo `public/ads.txt` com a linha que o AdSense mostrar.
- **Apps (AdMob):** crie o app em https://admob.google.com, gere 3 blocos (Banner, Intersticial, Premiado) para Android e 3 para iOS e preencha `VITE_ADMOB_*`. Enquanto estiver vazio, o app usa os **anúncios de teste do Google** (nunca clique nos seus próprios anúncios reais).
- Onde aparecem: banner fixo embaixo; tela cheia só depois do sorteio e no fim de um lote do leilão (no máximo 1 a cada 4 min); anúncio premiado no leilão (+R$ 200 de mentirinha, até 3 por pessoa).

### Configuração nativa do AdMob

Depois do passo 5, edite:

- **Android** `android/app/src/main/AndroidManifest.xml`, dentro de `<application>`:
  ```xml
  <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="SEU_APP_ID_ANDROID~XXXX"/>
  ```
- **iOS** `ios/App/App/Info.plist`:
  ```xml
  <key>GADApplicationIdentifier</key><string>SEU_APP_ID_IOS~XXXX</string>
  <key>NSUserTrackingUsageDescription</key><string>Usamos isso para mostrar anúncios mais relevantes e manter o app gratuito.</string>
  ```
  e a lista `SKAdNetworkItems` indicada na documentação do AdMob.

## 5. Gerar os apps (iPhone e Android)

```bash
npx cap add android
npx cap add ios        # só no Mac, com Xcode instalado
npm run android        # abre no Android Studio
npm run ios            # abre no Xcode
```

A cada mudança no código: `npm run cap:sync`.

Ícone e tela de abertura: `npm i -D @capacitor/assets`, coloque um PNG 1024×1024 em `assets/icon.png` e rode `npx capacitor-assets generate`.

## 6. Publicar nas lojas

- **Google Play:** conta de desenvolvedor (taxa única) em https://play.google.com/console. Gere o `.aab` no Android Studio (Build > Generate Signed Bundle).
- **App Store:** Apple Developer Program (anual), Mac com Xcode. Product > Archive > enviar para App Store Connect.
- As duas lojas pedem **política de privacidade** (URL pública). Diga que o app usa login anônimo, guarda nomes e dados do evento no Firebase e mostra anúncios do Google.
- No formulário da Apple, marque que o app usa dados para publicidade (AdMob) e de identificador do dispositivo.

## Estrutura

```
src/
  App.jsx       entrada, início, cabeçalho, avisos em tempo real, fechamento do leilão
  screens.jsx   amigo secreto, presença, pratos, programação, vaquinha, brincadeiras, bingo, leilão, ranking, notificações
  backend.js    Firebase (tempo real) ou modo demonstração (localStorage)
  native.js     AdMob, AdSense e notificações locais
  lib.js        sorteio com exceções e grupos, cartelas de bingo, perguntas e desafios
firestore.rules regras de segurança do banco
```

## Limites desta versão

- Notificações são **locais** (contagem regressiva agendada no celular e avisos com o app aberto). Push com o app fechado (ex.: "o leilão começou") precisa de Firebase Cloud Messaging + Cloud Functions (plano Blaze).
- Quem organiza é quem criou o evento naquele aparelho. Se trocar de celular, perde o papel de organizador.
- O cronômetro do leilão usa o relógio de cada celular; diferenças de poucos segundos podem acontecer.
- A vaquinha só anota quem pagou: o dinheiro vai direto para a chave Pix de quem organizou.
