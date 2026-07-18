// Where the per-device passphrase is remembered. Shared so the push helper can
// authenticate its requests the same way the repository does.
export const PASSPHRASE_KEY = "to-do-list/passphrase";

export function getPassphrase(): string {
  return localStorage.getItem(PASSPHRASE_KEY) ?? "";
}
