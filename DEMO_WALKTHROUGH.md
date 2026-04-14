# Aurora — Demo Walkthrough (1 page)

**Stack:** Spring Boot 3 + JPA (H2) + WebSockets + JWT + static SPA (`/css`, `/js`).

---

## Architecture (30 seconds)

1. **Browser** loads `static/index.html` → `chat.js` holds JWT in `sessionStorage`.
2. **REST:** `POST /api/register` / `POST /api/login` → JWT. `GET /api/channels`, `POST /api/channels`, `GET /api/messages?channelId=…` for history.
3. **WebSocket:** `ws(s)://host/chat?token=…&channelId=…` — handshake validates JWT and channel; messages are scoped per channel.
4. **Data:** `Channel`, `Message` (FK to channel), users; initializer ensures `#general`.

---

## Live demo script (~5 minutes)

| Step | Say | Do |
|------|-----|-----|
| 1 | “Single-page app: sign in or create account.” | Register a user; note validation + password strength on register. |
| 2 | “Workspace loads channels from the API.” | Point at sidebar list; mention default `#general`. |
| 3 | “Each channel has its own history and live stream.” | Send a message; show it appears; optional second tab/user later. |
| 4 | “We can create channels.” | `+` → create e.g. `engineering`; switch — empty state then messages. |
| 5 | “Shareable deep links.” | Copy link in header; open new tab / paste URL with `?channel=…`; lands on that channel after login. |
| 6 | “Power user touches.” | Filter channels; `g` then `c` focuses filter; `/` and `⌘K` focus composer (if shown in UI). |
| 7 | “Resilience.” | Briefly: if connection drops, auto-reconnect; failed send queues with **Retry now**. |

---

## Talking points (if asked)

- **Security:** JWT stateless API; WebSocket requires same token + valid `channelId`.
- **Why channels:** isolates history and broadcast domain without separate “rooms” product complexity.
- **Trade-offs:** session in `sessionStorage` (tab-scoped); H2 default suitable for demo — production would use Postgres + secrets management.

---

## Commands

```bash
cd web-chat && mvn spring-boot:run
# http://localhost:8080
cd web-chat && mvn test
```

---

*End of walkthrough.*
