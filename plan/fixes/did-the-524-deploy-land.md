# Did the 524'd staging deploy actually land?

Paste this whole file into the session with staging server access.
**Read-only. Nothing here changes, restarts or deploys anything.**

## What happened

The staging deploy for commit `327f90f` failed with:

```
error code: 524
Portainer stack update failed with HTTP 524 — staging is still running the previous image.
```

524 is Cloudflare's 100-second timeout. It means **no reply arrived**, not that
the work did not happen — Portainer may have finished the stack update after
the proxy gave up. The workflow cannot tell, so it refused to claim success,
which is the right behaviour. But it leaves staging in an unknown state.

The question worth answering once, rather than guessing at every recurrence:
**after a 524, does the update apply anyway?**

## The tag to look for

```
dev-327f90f3291899955baf707a10a5f2d66cc8ed95
```

## 1. What are the containers actually running?

```bash
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep -i resortpro
```

- Image tag ends `dev-327f90f…` → **the update landed despite the 524.**
- An older `dev-<sha>` → it did not; staging is on the previous build.

## 2. What does Portainer have stored?

The workflow PUTs the whole compose. If the stored compose has the new tag but
the containers do not, the PUT landed and only the container recreate was cut
off — a different situation, fixable by redeploying the stack as-is.

In the Portainer UI: the `resortpro-staging` stack → Editor. Or read it from
the API if that is easier. Just report which tag the `api` and `web` image
lines carry.

## 3. How long did it take?

Worth knowing whether 100 seconds is nearly enough or nowhere near.

```bash
docker ps --format '{{.Names}}\t{{.CreatedAt}}' | grep -i resortpro
```

Compare the api/web container creation times against each other and against
roughly when the deploy ran.

## 4. Report back

1. The image tags from §1 — do they end in `327f90f…`?
2. The tag in Portainer's stored compose from §2.
3. The container creation times from §3.

Do not redeploy or re-run anything yet. The answer decides whether a 524 needs
a retry at all, and that is worth knowing before the next one.
