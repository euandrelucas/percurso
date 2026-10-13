import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** Banco temporário isolado para cada arquivo de teste. */
export function useTempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "percurso-test-"));
  process.env.DATABASE_PATH = path.join(dir, "test.db");
  process.env.MOCK_AI = "1";
  delete process.env.ADMIN_EMAIL;
}
