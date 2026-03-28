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

## 4. Nakon deploya

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
