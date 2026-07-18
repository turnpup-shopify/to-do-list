import { useEffect, useState } from "react";
import { disableReminders, enableReminders, isSubscribed, pushSupported } from "../lib/push";

type State = "loading" | "on" | "off" | "denied" | "unsupported" | "busy";

/** A toggle in the settings panel to opt in/out of the daily reminder digest. */
export function RemindersToggle() {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pushSupported()) return setStateIf("unsupported");
      if (Notification.permission === "denied") return setStateIf("denied");
      setStateIf((await isSubscribed()) ? "on" : "off");
    })();
    function setStateIf(s: State) {
      if (!cancelled) setState(s);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const turnOn = async () => {
    setState("busy");
    const perm = await enableReminders();
    setState(perm === "granted" ? "on" : perm === "denied" ? "denied" : "off");
  };

  const turnOff = async () => {
    setState("busy");
    await disableReminders();
    setState("off");
  };

  return (
    <section className="panel__section">
      <h3>Reminders</h3>
      <p className="panel__hint">
        A daily notification each morning with what's due today and anything overdue.
      </p>

      {state === "unsupported" && (
        <p className="panel__hint">
          This browser can't receive push notifications. On iPhone, add the app to your Home
          Screen and open it from there.
        </p>
      )}
      {state === "denied" && (
        <p className="panel__hint">
          Notifications are blocked. Enable them for this site in your browser settings, then
          reopen this panel.
        </p>
      )}
      {(state === "on" || state === "off" || state === "busy" || state === "loading") && (
        <button
          type="button"
          className={`btn ${state === "on" ? "btn--danger" : "btn--primary"}`}
          disabled={state === "busy" || state === "loading"}
          onClick={state === "on" ? turnOff : turnOn}
        >
          {state === "on"
            ? "Turn off reminders"
            : state === "busy"
              ? "Working…"
              : "Turn on reminders"}
        </button>
      )}
    </section>
  );
}
