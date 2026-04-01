# RentAdria — deploy na GitHub i Vercel

## 1. Prije pusha (sigurnost)

1. **Nikad ne commituj** `.env`, fajlove sa lozinkama/tokenima (npr. `*token*.txt`, `*supabase*API*.txt`).
2. Provjeri: `git status` — u staged smiju biti samo kod i `public/`, ne tajne.
3. Kopiraj `.env.example` u lokalni `.env` i popuni vrijednosti; na Vercelu ćeš ih ponovo unijeti ručno.

## 2. Git i GitHub

```bash
git add .
git status
git commit -m "Opis promjena"
```

Ako repo još nema remote:

```bash
git remote add origin https://github.com/TVOJ_NALOG/TVOJ_REPO.git
git branch -M main
git push -u origin main
```

Ako repo već postoji: `git push`.

## 3. Vercel

1. Otvori [vercel.com](https://vercel.com) → **Add New** → **Project** → importuj GitHub repo.
2. **Framework:** Vite  
   **Build command:** `npm run build`  
   **Output directory:** `dist`
3. **Environment Variables** — kopiraj iz `.env.example` sve što koristiš (posebno `JWT_SECRET`, `SITE_URL`, Brevo, Supabase, Meta, `SOCIAL_ENQUEUE_SECRET` + `VITE_SOCIAL_ENQUEUE_SECRET` isti string, opciono `SITE_VISITS_READ_SECRET` + `VITE_SITE_VISITS_READ_SECRET` isti string).
4. **Deploy**.

## 4. Instagram / Facebook (red + cron)

1. **Šablon slike (1024×1024):** stavi fajl kao `public/social/sablon-instagram.png` (prazan kalendar kao tvoj „sablon za instagram“). Bez toga server ne može generisati JPEG za objavu.
2. **Supabase:** tabele/RPC `social_queue` i `enqueue_social_post` moraju biti deployovane (vidi SQL u projektu / dokumentaciji).
3. **Enqueue:** kad vlasnik objavi oglas i uključi „Objavi na Instagram/Facebook“, frontend šalje POST na `/api/social-enqueue` (treba `SOCIAL_ENQUEUE_SECRET` na serveru i isti `VITE_SOCIAL_ENQUEUE_SECRET` u buildu).
4. **Obrada:** Vercel cron zove `/api/social-process-queue` **svakih 15 minuta** (`*/15 * * * *`). U jednom pozivu obrađuje se do **40** redova iz reda (svi koji su spremni). Caption i layout slike prate univerzalni šablon u kodu (`server/lib/socialCaption.ts`, `renderSocialTemplate.ts`).
5. **Meta:** `META_ACCESS_TOKEN`, `META_IG_USER_ID`, `META_PAGE_ID` (i ostalo iz `publishMetaSocial`) — bez toga red se označi kao greška ili samo upozorenje.

## 5. Nakon deploya

- Otvori production URL i provjeri glavnu stranicu i `/admin`.
- Ako si uključio `SITE_VISITS_READ_SECRET`, mora biti **isti** na serveru i u `VITE_*` (admin statistika posjeta).

## Šta kod trenutno radi (zaštita)

- **Rate limit** na API rutama koje šalju email ili troše resurse (upiti vlasniku, registracija, verifikacija tokena, social red, statistika posjeta).
- U **produkciji** greške servera ne vraćaju interne poruke klijentu (`server_error`).
- **HTTP zaglavlja** (nosniff, frame, referrer, permissions) preko `vercel.json`.
- **Tajne** samo u Vercel env / lokalnom `.env` — ne u repou.

## Šta nije “apsolutna” zaštita

- Bilo koji `VITE_*` ključ je vidljiv u buildu pregledača — zato koristi **jake** tajne i rotiraj ih ako cure.
- Rate limit je po **instanci** serverlessa — za ozbiljan napad treba i **Vercel Firewall** / WAF ili Cloudflare.
- Za potpunu zaštitu od botova uz email treba **CAPTCHA** (npr. Cloudflare Turnstile) — nije ugrađena u ovaj korak.
