import { useState } from "react";
import { verifyPassphrase } from "../lib/repository";

interface Props {
  onAuthenticated: (passphrase: string) => void;
}

/** Full-screen unlock screen shown until a valid passphrase is entered. */
export function PassphraseGate({ onAuthenticated }: Props) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "error">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pass = value.trim();
    if (!pass) return;
    setStatus("checking");
    const ok = await verifyPassphrase(pass);
    if (ok) onAuthenticated(pass);
    else setStatus("error");
  };

  return (
    <div className="gate">
      <form className="gate__card" onSubmit={submit}>
        <h1 className="gate__title">To-Do</h1>
        <p className="gate__hint">Enter your passphrase to unlock your lists.</p>
        <input
          type="password"
          className="gate__input"
          placeholder="Passphrase"
          value={value}
          autoFocus
          onChange={(e) => {
            setValue(e.target.value);
            if (status === "error") setStatus("idle");
          }}
        />
        {status === "error" && <p className="gate__error">Incorrect passphrase. Try again.</p>}
        <button type="submit" className="btn btn--primary gate__btn" disabled={status === "checking"}>
          {status === "checking" ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
