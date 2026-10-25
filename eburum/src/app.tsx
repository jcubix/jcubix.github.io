import {
  detailPath,
  detailListPath,
  routeDetail,
} from "../app-presentation.js";
import { LoadingState } from "./components/ui/loading-state";
import { installNavigationMotion } from "./navigation-motion";
import { roleLabels as roleNames } from "../app-roles.js";
import {
  Component,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useId,
  type ReactNode,
} from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Home,
  Users,
  Trophy,
  LayoutGrid,
  LogOut,
  Bell,
  LoaderCircle,
  RefreshCw,
  Settings,
  MessageSquare,
  Wallet,
  Eye,
  EyeOff,
  CircleAlert,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Tooltip, TooltipProvider } from "./components/ui/tooltip";
import {
  TrainingPage,
  MatchesPage,
  PlayersPage,
  ToolsPage,
  FeatureSurface,
} from "./pages";
import { CommunicationsPage } from "./communications";
import { ThemePicker } from "./theme";
import { UserGuide } from "./user-guide";
import { FinancePage } from "./finance";
import { WhiteboardPage } from "./whiteboard";
import { PwaStatus } from "./pwa";
import type { Runtime, RuntimeSnapshot, Page } from "./types";

const navigation = [
  { page: "dashboard", label: "Home", icon: Home },
  { page: "training", label: "Allenamenti", icon: CalendarDays },
  { page: "communications", label: "Messaggi", icon: MessageSquare },
  { page: "matches", label: "Partite", icon: Trophy },
  { page: "more", label: "Altro", icon: LayoutGrid },
] as const;
const allPages = new Set<Page>([
  "dashboard",
  "training",
  "matches",
  "players",
  "reports",
  "register",
  "meetings",
  "more",
  "communications",
  "finance",
  "whiteboard",
]);
const pageFromPath = (path: string): Page =>
  allPages.has(path.slice(1) as Page) ? (path.slice(1) as Page) : "dashboard";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="startup-error">
        <h1>La schermata non è stata caricata</h1>
        <p>Ricarica l’app e riprova.</p>
        <Button onClick={() => window.location.reload()}>Ricarica</Button>
      </main>
    ) : (
      this.props.children
    );
  }
}
export function App({ runtime }: { runtime: Runtime }) {
  const snapshot = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot),
    location = useLocation(),
    navigate = useNavigate(),
    previousPath = useRef(location.pathname),
    previousUrl = useRef(location.pathname + location.search);
  useEffect(() => installNavigationMotion(), []);
  useEffect(() => {
    const root = document.documentElement;
    const pointer = () => {
      root.dataset.uiInput = "pointer";
    };
    const keyboard = () => {
      root.dataset.uiInput = "keyboard";
    };
    window.addEventListener("pointerdown", pointer, true);
    window.addEventListener("keydown", keyboard, true);
    return () => {
      window.removeEventListener("pointerdown", pointer, true);
      window.removeEventListener("keydown", keyboard, true);
      delete root.dataset.uiInput;
    };
  }, []);

  useLayoutEffect(() => {
    if (snapshot.status !== "ready") return;
    if (previousPath.current !== location.pathname) {
      previousPath.current = location.pathname;
      if (runtime.state.trainingDraft?.saving) {
        navigate(previousUrl.current, { replace: true });
        return;
      }
      const page = pageFromPath(location.pathname);
      if (page !== snapshot.page && !runtime.navigate(page))
        navigate(previousUrl.current, { replace: true });
      else previousUrl.current = location.pathname + location.search;
    } else if (location.pathname !== "/" + snapshot.page) {
      const detail =
        [
          ...document.querySelectorAll<HTMLElement>(".modal-back[data-detail]"),
        ].some((root) => root.dataset.page === snapshot.page) ||
        (snapshot.page === "training" &&
          runtime.state.trainingMode === "actual" &&
          !!runtime.state.trainingDraft?.id);
      const closingAttendance =
        runtime.state.trainingMode !== "actual" &&
        routeDetail(
          pageFromPath(location.pathname),
          location.search,
        )?.key.startsWith("session:");
      if (!detail && !closingAttendance)
        navigate("/" + snapshot.page, { replace: location.pathname === "/" });
    }
  }, [
    location.pathname,
    snapshot.page,
    snapshot.status,
    snapshot.revision,
    runtime,
    navigate,
  ]);
  return (
    <ErrorBoundary>
      <TooltipProvider delayDuration={300}>
        {snapshot.status === "login" ? (
          <Login runtime={runtime} />
        ) : snapshot.status === "ready" ? (
          <Workspace runtime={runtime} snapshot={snapshot} />
        ) : (
          <StatusPage runtime={runtime} snapshot={snapshot} />
        )}
        <PwaStatus runtime={runtime} />
      </TooltipProvider>
    </ErrorBoundary>
  );
}
function Brand({ season }: { season?: number } = {}) {
  return (
    <div className="app-brand">
      <img src="./icon.svg" width="40" height="40" alt="" />
      <div>
        <strong>EBVRVM</strong>
        <span
          aria-label={season ? `Stagione ${season}/${season + 1}` : undefined}
        >
          {season
            ? `${season}/${String(season + 1).slice(-2)}`
            : "Team Manager"}
        </span>
      </div>
    </div>
  );
}
function Login({ runtime }: { runtime: Runtime }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [showPassword, setShowPassword] = useState(false),
    [showRecovery, setShowRecovery] = useState(false),
    [fieldErrors, setFieldErrors] = useState<{
      email?: string;
      password?: string;
    }>({}),
    pending = useRef(false);
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Brand />
        <h1>Bentornato in squadra</h1>
        <p className="text-muted-foreground">
          Accedi con le credenziali ricevute dall’amministratore.
        </p>
        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending.current) return;
            const email = e.currentTarget.elements.namedItem(
                "email",
              ) as HTMLInputElement,
              password = e.currentTarget.elements.namedItem(
                "password",
              ) as HTMLInputElement;
            const invalid = {
              email: !email.value.trim()
                ? "Inserisci la tua email."
                : email.validity.typeMismatch
                  ? "Inserisci un indirizzo email valido."
                  : undefined,
              password: !password.value ? "Inserisci la password." : undefined,
            };
            setFieldErrors(invalid);
            if (invalid.email || invalid.password) {
              (invalid.email ? email : password).focus();
              return;
            }
            pending.current = true;
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            try {
              const { error } = await runtime.db.auth.signInWithPassword({
                email: String(form.get("email")).trim(),
                password: String(form.get("password")),
              });
              if (error) throw error;
            } catch (err) {
              const raw = err instanceof Error ? err.message : "";
              const known: Record<string, string> = {
                "Invalid login credentials": "Email o password non corretti.",
                "Email not confirmed":
                  "Email non ancora confermata. Contatta l’amministratore.",
                "Email logins are disabled":
                  "Accesso con email disattivato. Contatta l’amministratore.",
              };
              setError(
                known[raw] ||
                  (/rate limit|too many requests/i.test(raw)
                    ? "Troppi tentativi. Attendi qualche minuto e riprova."
                    : /failed to fetch|network/i.test(raw)
                      ? "Connessione non disponibile. Controlla la rete e riprova."
                      : "Accesso non riuscito. Controlla le credenziali e riprova."),
              );
            } finally {
              pending.current = false;
              setBusy(false);
            }
          }}
          className="grid gap-5"
        >
          <label className="grid gap-2" htmlFor="email">
            Email
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              disabled={busy}
              aria-invalid={!!fieldErrors.email || !!error}
              aria-describedby={
                fieldErrors.email
                  ? "loginEmailError"
                  : error
                    ? "loginError"
                    : undefined
              }
            />
          </label>
          {fieldErrors.email ? (
            <p
              id="loginEmailError"
              className="auth-field-error field-error"
              role="alert"
            >
              {fieldErrors.email}
            </p>
          ) : null}
          <label className="grid gap-2" htmlFor="password">
            Password
            <span className="auth-password">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                disabled={busy}
                aria-invalid={!!fieldErrors.password || !!error}
                aria-describedby={
                  fieldErrors.password
                    ? "loginPasswordError"
                    : error
                      ? "loginError"
                      : undefined
                }
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword ? "Nascondi password" : "Mostra password"
                }
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </span>
          </label>
          {fieldErrors.password ? (
            <p
              id="loginPasswordError"
              className="auth-field-error field-error"
              role="alert"
            >
              {fieldErrors.password}
            </p>
          ) : null}
          {error ? (
            <p id="loginError" role="alert" className="auth-error">
              <CircleAlert size={18} />
              {error}
              {error.includes("Connessione") ? (
                <Button variant="secondary" type="submit" disabled={busy}>
                  Riprova
                </Button>
              ) : null}
            </p>
          ) : null}
          <Button type="submit" disabled={busy}>
            {busy ? (
              <>
                <LoaderCircle className="animate-spin" />
                Accesso in corso…
              </>
            ) : (
              "Accedi"
            )}
          </Button>
          <button
            type="button"
            className="auth-help-link"
            onClick={() => setShowRecovery((v) => !v)}
          >
            Password dimenticata?
          </button>
          {showRecovery ? (
            <p className="auth-help" role="status">
              Chiedi all’amministratore una nuova password. Può assegnarla da
              Gestione utenti → Cambia password.
            </p>
          ) : null}
        </form>
        <p className="auth-help">
          Accesso riservato allo staff. Solo gli amministratori creano nuove
          utenze.
        </p>
      </section>
    </main>
  );
}
function StatusPage({
  runtime,
  snapshot,
}: {
  runtime: Runtime;
  snapshot: RuntimeSnapshot;
}) {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Brand />
        {snapshot.status === "loading" ? (
          <LoadingState label="Caricamento squadra…" />
        ) : (
          <>
            <h1>Squadra non caricata</h1>
            <p role="alert">{snapshot.error}</p>
            <div className="flex gap-3">
              <Button onClick={() => void runtime.actions.reload()}>
                <RefreshCw />
                Riprova
              </Button>
              <Button
                variant="secondary"
                onClick={() => void runtime.actions.logout()}
              >
                Esci
              </Button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
function NavItem({
  page,
  label,
  icon: Icon,
  selected,
}: {
  page: Page;
  label: string;
  icon: typeof Home;
  selected: boolean;
}) {
  const link = (
    <Link
      to={"/" + page}
      className={"app-nav-item " + (selected ? "is-active" : "")}
      aria-current={selected ? "page" : undefined}
    >
      <Icon size={21} strokeWidth={1.8} />
      <span>{label}</span>
    </Link>
  );
  return link;
}
function SeasonPicker({ runtime }: { runtime: Runtime }) {
  const id = useId();
  const year = runtime.actions.season().year,
    configured = Number(window.CONFIG.season.match(/20\d{2}/)?.[0]) || year,
    first = runtime.state.earliestSport;
  const earliest = first
    ? Number(first.slice(0, 4)) - (first.slice(5, 7) < "07" ? 1 : 0)
    : year;
  const years = Array.from(
    { length: Math.max(configured, year) - Math.min(earliest, year) + 1 },
    (_, i) => Math.max(configured, year) - i,
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="app-season">
      <label htmlFor={id}>Stagione</label>
      <select
        id={id}
        value={year}
        disabled={busy}
        onChange={async (e) => {
          setBusy(true);
          setError("");
          try {
            await runtime.actions.changeSeason(Number(e.target.value));
          } catch {
            setError("Stagione non caricata. Riprova.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {years.map((y) => (
          <option value={y} key={y}>
            {y}/{y + 1}
          </option>
        ))}
      </select>
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}
function Workspace({
  runtime,
  snapshot,
}: {
  runtime: Runtime;
  snapshot: RuntimeSnapshot;
}) {
  const [actionError, setActionError] = useState("");
  const [offline, setOffline] = useState(!navigator.onLine),
    [checkingNetwork, setCheckingNetwork] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const location = useLocation(),
    navigate = useNavigate();
  const routeRef = useRef(location),
    acceptedRoute = useRef(location.pathname + location.search);
  routeRef.current = location;
  useLayoutEffect(() => {
    runtime.setDetailRouter((detail) => {
      const current = window.location.hash;
      if (detail) {
        const target = detailPath(detail.page, detail.key, current);
        if (target === current.slice(1)) return;
        const previous = routeDetail(detail.page, current.split("?")[1] || "");
        navigate(target, {
          replace: previous?.key.endsWith(":new") === true,
          state: { detailEntry: true },
        });
      } else if (routeRef.current.state?.detailEntry) navigate(-1);
      else navigate(detailListPath(current), { replace: true });
    });
    return () => runtime.setDetailRouter(null);
  }, [runtime, navigate]);
  useLayoutEffect(() => {
    if (location.pathname !== "/" + snapshot.page) return;
    let cancelled = false;
    setActionError("");
    runtime
      .syncDetail(snapshot.page, location.search)
      .then((allowed) => {
        if (cancelled) return;
        if (!allowed) navigate(acceptedRoute.current, { replace: true });
        else acceptedRoute.current = location.pathname + location.search;
      })
      .catch((error) => {
        if (!cancelled)
          setActionError(error.message || "Dettaglio non caricato. Riprova.");
      });
    return () => {
      cancelled = true;
    };
  }, [runtime, location.pathname, location.search, snapshot.page, navigate]);
  const settingsRef = useRef<HTMLDetailsElement>(null);
  const count = runtime.actions
    .activeCommunications()
    .filter(
      (m) =>
        m.requires_ack &&
        !runtime.state.communication_receipts.some(
          (r) =>
            r.communication_id === m.id &&
            r.reader_id === runtime.state.user?.id,
        ),
    ).length;
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(event.target as Node)
      )
        settingsRef.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && settingsRef.current?.open) {
        settingsRef.current.open = false;
        settingsRef.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  const officeRole = ["treasurer", "president"].includes(snapshot.role || "");
  const roleNavigation = officeRole
    ? navigation.map((item) =>
        item.page === "training"
          ? {
              page: "communications" as const,
              label: "Messaggi",
              icon: MessageSquare,
            }
          : item.page === "communications"
            ? { page: "finance" as const, label: "Economia", icon: Wallet }
            : item,
      )
    : navigation;
  const navPage =
    snapshot.page === "meetings" ? "communications" : snapshot.page;
  const activeNav = roleNavigation.some((item) => item.page === navPage)
    ? navPage
    : "more";
  useLayoutEffect(() => {
    document.getElementById("mainContent")?.focus({ preventScroll: true });
    const frame = requestAnimationFrame(() =>
      window.scrollTo({
        top: runtime.state.pageScroll?.[snapshot.page] || 0,
        behavior: "instant",
      }),
    );
    if (settingsRef.current) settingsRef.current.open = false;
    return () => cancelAnimationFrame(frame);
  }, [snapshot.page, runtime]);
  return (
    <div className="app-layout soft-club">
      <a
        className="skip-link"
        href="#mainContent"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("mainContent")?.focus();
        }}
      >
        Vai al contenuto
      </a>
      <div className="app-workspace">
        <header className="app-header">
          <div className="mobile-brand">
            <Brand season={runtime.actions.season().year} />
          </div>
          <div className="desktop-context">
            <SeasonPicker runtime={runtime} />
          </div>
          <div className="header-actions">
            <UserGuide role={snapshot.role || ""} />
            <Tooltip label="Messaggi">
              <Button variant="secondary" size="icon" asChild>
                <NavLink
                  to="/communications"
                  aria-label={"Notifiche, " + count + " da confermare"}
                  className="relative"
                >
                  <Bell />
                  {count > 0 ? (
                    <span
                      className="communication-nav-dot"
                      aria-hidden="true"
                    />
                  ) : null}
                </NavLink>
              </Button>
            </Tooltip>
            <details
              ref={settingsRef}
              className="header-settings"
              onClick={(event) => {
                if (
                  (event.target as Element).closest(
                    ".header-settings-panel button",
                  ) &&
                  settingsRef.current
                )
                  settingsRef.current.open = false;
              }}
            >
              <summary
                title="Opzioni account e stagione"
                aria-label="Opzioni account e stagione"
              >
                <span className="account-initials" aria-hidden="true">
                  {[
                    runtime.state.team?.first_name,
                    runtime.state.team?.last_name,
                  ]
                    .filter(Boolean)
                    .map((n) => n?.slice(0, 1))
                    .join("") || <Settings size={20} />}
                </span>
              </summary>
              <div className="header-settings-panel">
                <strong className="account-name">
                  {[
                    runtime.state.team?.first_name,
                    runtime.state.team?.last_name,
                  ]
                    .filter(Boolean)
                    .join(" ") || "Staff Eburum"}
                </strong>
                <p className="account-role">
                  {snapshot.role ? roleNames[snapshot.role] : ""}
                </p>
                <SeasonPicker runtime={runtime} />
                <ThemePicker />
                {snapshot.role === "admin" ? (
                  <Tooltip label="Gestione utenti">
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={runtime.actions.users}
                      aria-label="Gestione utenti"
                    >
                      <Users />
                    </Button>
                  </Tooltip>
                ) : null}
                <Tooltip label="Esci">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Esci"
                    onClick={async () => {
                      try {
                        await runtime.actions.logout();
                      } catch (err) {
                        setActionError(
                          err instanceof Error
                            ? err.message
                            : "Uscita non riuscita. Riprova.",
                        );
                      }
                    }}
                  >
                    <LogOut />
                  </Button>
                </Tooltip>
              </div>
            </details>
          </div>
        </header>
        {offline ? (
          <div className="route-feedback" role="alert">
            <p>
              Connessione assente. Le modifiche non salvate restano locali:
              riprova il salvataggio quando torna la rete.
            </p>
            <Button
              variant="secondary"
              disabled={checkingNetwork}
              onClick={async () => {
                setCheckingNetwork(true);
                try {
                  const response = await fetch("./config.js", {
                    cache: "no-store",
                  });
                  setOffline(!navigator.onLine || !response.ok);
                } catch {
                  setOffline(true);
                } finally {
                  setCheckingNetwork(false);
                }
              }}
            >
              Riprova connessione
            </Button>
          </div>
        ) : null}
        {actionError ? (
          <div role="alert" className="route-feedback">
            <p>{actionError}</p>
            <Button
              variant="secondary"
              onClick={() => {
                setActionError("");
                void runtime
                  .syncDetail(snapshot.page, location.search)
                  .catch((e) => setActionError(e.message));
              }}
            >
              Riprova
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                navigate(detailListPath(window.location.hash), {
                  replace: true,
                })
              }
            >
              Torna all’elenco
            </Button>
          </div>
        ) : null}
        <main
          key={snapshot.page}
          id="mainContent"
          tabIndex={-1}
          className="workspace-content"
        >
          <PageContent runtime={runtime} snapshot={snapshot} />
        </main>
        <div id="workspaceEditor" className="workspace-editor-host" />
      </div>
      <nav className="app-mobile-nav" aria-label="Navigazione principale">
        <div className="nav-brand">
          <Brand />
        </div>
        {roleNavigation.map((item) => (
          <NavItem
            key={item.page}
            {...item}
            label={item.page === "communications" ? "Messaggi" : item.label}
            selected={activeNav === item.page}
          />
        ))}
      </nav>
    </div>
  );
}
function PageContent({
  runtime,
  snapshot,
}: {
  runtime: Runtime;
  snapshot: RuntimeSnapshot;
}) {
  switch (snapshot.page) {
    case "dashboard":
      return snapshot.role === "treasurer" ? (
        <FinancePage
          key={runtime.state.team?.owner_id + ":" + snapshot.role}
          runtime={runtime}
          home
        />
      ) : (
        <FeatureSurface
          runtime={runtime}
          page="dashboard"
          revision={snapshot.revision + snapshot.communicationRevision}
        />
      );
    case "training":
      return runtime.state.trainingMode === "actual" ? (
        <FeatureSurface
          runtime={runtime}
          page="training"
          revision={snapshot.revision}
        />
      ) : (
        <TrainingPage runtime={runtime} revision={snapshot.revision} />
      );
    case "matches":
      return <MatchesPage runtime={runtime} />;
    case "players":
      return <PlayersPage runtime={runtime} />;
    case "meetings":
      return (
        <CommunicationsPage
          runtime={runtime}
          revision={snapshot.communicationRevision}
          meetings
        />
      );
    case "communications":
      return (
        <CommunicationsPage
          runtime={runtime}
          revision={snapshot.communicationRevision}
        />
      );
    case "more":
      return <ToolsPage runtime={runtime} />;
    case "finance":
      return (
        <FinancePage
          key={runtime.state.team?.owner_id + ":" + snapshot.role}
          runtime={runtime}
        />
      );
    case "whiteboard":
      return (
        <WhiteboardPage
          key={runtime.state.team?.owner_id + ":" + snapshot.role}
          runtime={runtime}
        />
      );
    default:
      return (
        <FeatureSurface
          runtime={runtime}
          page={snapshot.page}
          revision={snapshot.revision}
        />
      );
  }
}
