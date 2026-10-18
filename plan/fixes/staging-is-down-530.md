> ## Resolved 2026-10-18 — it was the home internet, and the file's hypothesis was wrong
>
> The ops session ran this and found nothing wrong on the server:
>
> - machine up **20 days**; `cloudflared` `active (running)`, `enabled`, and
>   **not one crash since 28 September**
> - all six staging containers `Up 23 hours`, healthy, on `dev-a2274e2`
> - locally: web `:3001` → 200, api `:4001/health` → 200
>
> **The internet was out.** `cloudflared`'s log carried `no recent network
> activity` 4,212 times, `no such host` 385, `network is unreachable` 34. Two
> windows: 17 Oct 08:35→11:09 (~2.5 h) and 17 Oct 22:00 → 18 Oct 10:24
> (~12 h). When the connection came back the tunnel **re-registered itself
> within about two minutes** — nobody restarted anything.
>
> So this file's guess — "the tunnel, not the apps" — was half right. Not the
> apps, but the tunnel was blameless too; it was upstream of both. A
> `systemctl enable` or a watchdog would have changed nothing, because
> cloudflared was already enabled and already recovered on its own.
>
> **Two corrections to the steps below**, kept rather than hidden:
> Portainer listens on **9443**, not 9000 — the `000` that step 4 produced was
> this file's error, not a symptom. And step 6's `gh run rerun` cannot be done
> from that machine; `gh` is not installed there.
>
> **The real finding, and it is not a server problem:** the connection also
> drops briefly **every day at 04:00** (confirmed on the 17th too), which
> looks like a scheduled router reboot. The fix lives with the ISP or the
> router — possibly a UPS or a backup link — and not in this repository.
>
> **What would help here:** an external uptime check (Cloudflare health
> checks, UptimeRobot, similar) so an outage is known when it happens instead
> of being discovered because a deploy failed hours later. Not built yet.

# Staging is returning 530 — find out why, then bring it back

**Diagnosis first, read-only.** The fix steps are at the end and start with the
least disruptive one. Production is unaffected and must not be touched here.

## Where to paste this

**The session that can reach the home server** — the one that runs staging and
Portainer. Not the authoring session; it has no server access, which is why it
is asking.

## What is observed, from outside

Measured 2026-10-18, from the authoring machine:

| | |
|---|---|
| `https://resortpro.webcoronet.com` | **HTTP 530** |
| `https://docker.webcoronet.com` (Portainer) | **HTTP 530** |
| `https://resortpro.site` (production) | ✅ 200 |
| `https://api.resortpro.site/health` | ✅ 200 |
| `https://app.resortpro.site` | ✅ 200 |

And the staging deploy workflow has failed twice, both times at the same step:

```
Get Portainer stack ID
  STACK_ID=$(curl -s -H "X-API-Key: ***" https://docker.webcoronet.com/api/stacks | jq -r ...)
  jq: parse error: Invalid numeric literal at line 1, column 6
```

That parse error is the symptom, not the cause: Cloudflare returned an HTML
error page and `jq` was handed HTML instead of JSON.

**The hypothesis — not yet confirmed — is the Cloudflare tunnel, not the
apps.** 530 is Cloudflare saying it could not reach the origin at all, and
*both* hostnames on that host are returning it. If a single container had
died, the other hostname would still answer. One thing in front of both of
them failing fits better: `cloudflared`, the host, or its connectivity.

**Consequence worth knowing:** staging never received `b8bfa22`. That commit
is tests-only, so staging is functionally current at `a2274e2` — nothing is
missing from it but a test file.

## 1. Is the machine actually up?

Before anything else, and without embarrassment — it is a home server:

- Is it powered on? Was there a power cut?
- Is the home internet up?
- Can you reach it on the LAN at all (ping, or SSH by local IP)?

If the answer is "it is off" or "the internet was down", that is the whole
story and the rest of this file is unnecessary. Say so and skip to step 5.

## 2. Is the tunnel connected? (read-only)

```bash
systemctl status cloudflared --no-pager | head -20
journalctl -u cloudflared --since '2 hours ago' --no-pager | tail -40
```

What to look for: `active (running)` versus `failed`/`inactive`, and in the log
`Registered tunnel connection` versus repeated `Unable to reach the origin` or
`failed to connect to the edge`.

If `cloudflared` runs in a container instead of as a unit:

```bash
docker ps -a --filter name=cloudflared --format '{{.Names}}\t{{.Status}}'
docker logs --tail 60 <that container name>
```

## 3. Are the staging containers up? (read-only)

```bash
docker ps -a --format '{{.Names}}\t{{.Status}}\t{{.Image}}' | grep -i resortpro
```

Expect six for the staging stack. Report anything `Exited`, `Restarting`, or
`unhealthy`, with its status text.

If one has died, its reason matters more than the fact:

```bash
docker logs --tail 80 <container name>
```

## 4. Does the origin answer locally? (read-only)

This separates "the apps are broken" from "Cloudflare cannot reach a working
origin" — the single most useful check in this file:

```bash
curl -s -o /dev/null -w 'web  %{http_code}\n' http://localhost:3001
curl -s -o /dev/null -w 'api  %{http_code}\n' http://localhost:4001/health
curl -s -o /dev/null -w 'ptnr %{http_code}\n' https://localhost:9443 -k
```

- **Local 200s, public 530** → the apps are fine; it is the tunnel. Fix is
  step 5.
- **Local also failing** → the apps are down too, and the tunnel may be a red
  herring. Report what the logs from step 3 say before restarting anything.

## 5. Bringing it back — least disruptive first

Only after the steps above, and report what you saw before acting.

```bash
# a) the tunnel alone, if that is what is down
sudo systemctl restart cloudflared
sleep 10 && systemctl status cloudflared --no-pager | head -5

# b) only if a container is actually dead — the stack, not the host
cd <staging compose dir> && docker compose up -d
```

**Do not reboot the host as a first move**, and do not touch anything under
`/opt/resortpro` or anything named `rp-*` — those are production, on a
different machine, and production is currently healthy and serving a release
that landed this morning.

Then confirm from outside, not from the host:

```bash
curl -s -o /dev/null -w 'staging %{http_code}\n' https://resortpro.webcoronet.com
curl -s -o /dev/null -w 'portainer %{http_code}\n' https://docker.webcoronet.com
```

Both should be 200 (Portainer may be 200 or a redirect to its login).

## 6. Once it is back

Staging is one commit behind `dev`. Re-running the failed workflow is enough —
no new push is needed:

```bash
gh run rerun 39061310492 --failed
```

Or say so and the authoring session will re-run it.

## Bring back

1. Whether the machine and its internet were up (step 1).
2. `cloudflared` state, and the giveaway line from its log.
3. The container list, with any that are not `Up (healthy)`.
4. The three local `curl` codes from step 4 — this is the one that says
   whether the apps or the tunnel were at fault.
5. What you restarted, and the two public codes afterwards.

If the cause turns out to be something that will recur — a tunnel that drops
after a power cut and does not come back, say — that is worth its own fix
(`systemctl enable`, a restart policy, a watchdog) rather than a restart each
time. Say so and it can be designed properly.
