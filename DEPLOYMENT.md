# Публикуване на The Traitors Analytics

Във Vercel е създаден отделен проект **the-traitors-analytics** с Next.js и Node.js 24.x. Приложението е достъпно на [the-traitors-analytics.vercel.app](https://the-traitors-analytics.vercel.app). Проектът е свързан с [Bo4ka7a/traitors](https://github.com/Bo4ka7a/traitors).

## 1. Firebase

1. Във [Firebase Console](https://console.firebase.google.com/) отворете предназначения за приложението проект или създайте такъв. Регистрирайте Web App и създайте Cloud Firestore в Production mode.
2. В **Authentication → Sign-in method** включете **Google** и задайте имейл за поддръжка.
3. В **Authentication → Settings → Authorized domains → Add domain** въведете точно `the-traitors-analytics.vercel.app` като име на хост, без `https://` и без път. За тестване на входа в preview добавете конкретния preview хост, който ще отваряте.
4. Публикувайте `firestore.rules` и `firestore.indexes.json` за избрания Firebase проект. От папката на приложението с Firebase CLI и акаунт с достъп изпълнете `firebase deploy --only firestore:rules,firestore:indexes --project YOUR_PROJECT_ID`. Правилата позволяват достъп до архива само на потребители, влезли през Google, с документ в администраторския списък.
5. Във Firebase вземете Web App конфигурацията от **Project settings → General → Your apps → SDK setup and configuration**.

[Firebase Google Sign-In](https://firebase.google.com/docs/auth/web/google-signin)

## 2. Променливи във Vercel

В **the-traitors-analytics → Settings → Environment Variables** добавете тези четири стойности за **Production**. За preview builds добавете съответните настройки за **Preview**, за предпочитане с отделен Firebase проект за тестване. Промените се прилагат при следващото публикуване.

| Vercel | Firebase Web App |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` |

Използвайте `authDomain` от Web App конфигурацията. Vercel домейнът се добавя в **Authorized domains**. Тези стойности са клиентска конфигурация. Достъпът до данните се управлява от Firebase Authentication и правилата на Firestore.

[Управление на променливите във Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables)

## 3. GitHub и автоматично публикуване

1. Създайте отделно GitHub хранилище или използвайте хранилището, предназначено за приложението. Качете файловете от архива в корена му, включително `.gitignore`, `vercel.json` и `pnpm-lock.yaml`, и запишете първия commit на клона `main`. Ако хранилището има съдържание, добавете проекта чрез отделен commit или pull request.
2. В съществуващия Vercel проект **the-traitors-analytics → Settings → Git** свържете хранилището. Ако е необходимо, в GitHub разрешете на Vercel достъп до конкретното хранилище. Оставете **Root Directory** на корена, ако там е `package.json`.
3. Проверете, че **Production → Branch Tracking** сочи към `main`. След като променливите са добавени, стартирайте първия deployment от `main` или изпратете commit. Оттогава push или merge в `main` задейства автоматично production публикуване. Другите клонове получават preview deployment. Vercel извършва публикуването през GitHub интеграцията.
4. В **Deployments** изчакайте статус **Ready** и проверете [production адреса](https://the-traitors-analytics.vercel.app). Хостваната компилация проверява за четирите Firebase променливи.

[Автоматични Git deployments във Vercel](https://vercel.com/docs/git)

## 4. Първи вход

1. Влезте с Google на production адреса. Ако UID още липсва в списъка, приложението показва екрана за отказ с UID. Може да видите UID и в **Firebase → Authentication → Users**.
2. Създайте документ `admins/<UID>` през **Firestore Database → Data**, например с поле `enabled` от тип boolean и стойност `true`. Достъпът се определя от наличието на документа. Излезте и влезте отново.
3. Проверете запис от компютър и появата му на телефон със същия акаунт. Проверете и отказа за Google акаунт извън списъка. След успешното публикуване не е нужно локално стартиране, за да се използва сайтът.

