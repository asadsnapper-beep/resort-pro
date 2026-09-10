# Production: it has never had a backup

Paste this whole file into the session with Coolify access.

## The problem

There is no `backup` service on production. Not misconfigured — absent. The
database has never been dumped, and nothing has ever archived the uploads.

The database is about 16 MB, so this costs almost nothing to fix.

## Do this

**1.** In Coolify → `resortpro` → Configuration → Docker Compose: keep a copy of
the current compose. That copy is the undo.

**2.** Replace it with `production-compose-with-backup.yml`, supplied alongside
this prompt. It is the compose now running, plus one new `backup` service and
one volume declaration. Nothing existing is changed.

**3.** Before saving, check one line. The `backup` service's `image:` must be
**identical** to the `api` service's `image:`, including the tag. If a deploy
has happened since this file was written, the api tag will have moved — copy
whatever the api line says onto the backup line.

**4.** Save and redeploy.

## Then check it worked

The container runs one backup as soon as it starts, so its log already holds a
full run.

```bash
docker logs $(docker ps -q --filter 'name=backup') 2>&1 | grep '\[backup\]'
```

Expect **two** `ok` lines from that single run:

```
[backup] ok — <bytes> bytes, <n> tables with data
[backup] ok — <bytes> bytes, <n> file(s)
```

- Two `ok` lines → working.
- `no password supplied` or `does not exist` → the credentials do not match the
  database. Stop and report the line.
- Nothing about uploads → report it.

Then prove the dump is real, rather than trusting its existence:

```bash
docker exec $(docker ps -q --filter 'name=backup') ls -lh /backups
```

A `.dump` of a few MB, and a `.tar`. **A 0-byte `.dump` is a failure**, not a
backup — staging had fifty of those.

## Report back

The `[backup]` log lines, and the `ls -lh` output.

Nothing here touches the database or the uploads. The backup mounts the uploads
volume read-only, so it cannot alter or delete a single guest document.
