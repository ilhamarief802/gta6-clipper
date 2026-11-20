/**
 * make.fun — gta6-clipper-01 entry.
 *
 * Reads VIDEO.json from the bot directory, validates it (object, <= 16384 bytes,
 * YouTube clip URL), then copies it into the output directory for the harness.
 *
 * Env:
 *   MAKEFUN_BOT_DIR     where VIDEO.json is read from   (default ".")
 *   MAKEFUN_OUTPUT_DIR  where VIDEO.json is written to  (default "/output")
 */
import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MAX_BYTES = 16_384;

const VIDEO_URL_RE =
  /^https?:\/\/(www\.|m\.)?(youtube\.com\/(shorts\/|watch\?v=)|youtu\.be\/)[A-Za-z0-9_-]{11}/;

type Entry = { url: string };

function fail(code: number, message: string): never {
  console.error(`main.ts: ${message}`);
  process.exit(code);
}

/** Load and validate VIDEO.json. Exits 1 on IO/shape errors, 2 on a bad url. */
function loadEntry(botDir: string): Entry {
  const path = join(botDir, "VIDEO.json");

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    fail(1, `cannot read ${path}: ${(err as Error).message}`);
  }

  const bytes = statSync(path).size;
  if (bytes > MAX_BYTES) {
    fail(1, `${path} is ${bytes} bytes, limit is ${MAX_BYTES}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail(1, `${path} is not valid JSON: ${(err as Error).message}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    fail(1, `${path} must contain a JSON object`);
  }

  const url = (parsed as Record<string, unknown>).url;
  if (typeof url !== "string" || !VIDEO_URL_RE.test(url)) {
    fail(
      2,
      `invalid .url in ${path}: expected a YouTube clip url ` +
        `(youtube.com/shorts/<11-char id>, youtube.com/watch?v=<id>, ` +
        `youtu.be/<id>), got ${JSON.stringify(url)}`,
    );
  }

  return { url };
}

function usage(): never {
  console.error(
    "usage: node main.ts [--check]\n" +
      "  --check   validate VIDEO.json and exit without writing anything",
  );
  process.exit(1);
}

/** One-line success summary, printed only after validation (and publish). */
function report(entry: Entry): void {
  console.log(`entry video: ${entry.url}`);
}

function main(): void {
  const args = process.argv.slice(2);
  let checkOnly = false;

  for (const arg of args) {
    if (arg === "--check") checkOnly = true;
    else if (arg === "--help" || arg === "-h") usage();
    else fail(1, `unknown argument: ${arg}`);
  }

  const botDir = process.env.MAKEFUN_BOT_DIR ?? ".";
  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

  const entry = loadEntry(botDir);

  if (checkOnly) {
    report(entry);
    return;
  }

  try {
    mkdirSync(outputDir, { recursive: true });
    copyFileSync(join(botDir, "VIDEO.json"), join(outputDir, "VIDEO.json"));
  } catch (err) {
    fail(1, `cannot publish to ${outputDir}: ${(err as Error).message}`);
  }

  report(entry);
}

main();
