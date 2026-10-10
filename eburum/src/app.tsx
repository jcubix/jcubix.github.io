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
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LazyMotion, domAnimation, MotionConfig, m } from "motion/react";
import {
  CalendarDays,
  Home,
  Users,
  Trophy,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  MessageSquare,
  ShieldCheck,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Tooltip, TooltipProvider } from "./components/ui/tooltip";
import {
  TrainingPage,
  MatchesPage,
  PlayersPage,
  MeetingsPage,
  ToolsPage,
  FeatureSurface,
} from "./pages";
import { CommunicationsPage } from "./communications";
import { PwaStatus } from "./pwa";
import type { Runtime, RuntimeSnapshot, Page } from "./types";

const navigation = [
  { page: "dashboard", label: "Home", icon: Home },
  { page: "training", label: "Allena", icon: CalendarDays },
  { page: "players", label: "Rosa", icon: Users },
  { page: "matches", label: "Partite", icon: Trophy },
  { page: "more", label: "Altro", icon: MoreHorizontal },
] as const;
const roleNames = {
  admin: "Amministratore",
  manager: "Team manager",
  coach: "Allenatore",
  secretary: "Segretario",
};
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
    previousPath = useRef(location.pathname);
  useLayoutEffect(() => {
    if (snapshot.status !== "ready") return;
    if (previousPath.current !== location.pathname) {
      previousPath.current = location.pathname;
      if (runtime.state.trainingDraft?.saving) {
        navigate("/" + snapshot.page, { replace: true });
        return;
      }
      const page = pageFromPath(location.pathname);
      if (page !== snapshot.page && !runtime.navigate(page))
        navigate("/" + snapshot.page, { replace: true });
    } else if (location.pathname !== "/" + snapshot.page)
      navigate("/" + snapshot.page, { replace: location.pathname === "/" });
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
      <LazyMotion features={domAnimation}>
        <MotionConfig
          reducedMotion="user"
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
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
        </MotionConfig>
      </LazyMotion>
    </ErrorBoundary>
  );
}
function Brand() {
  return (
    <div className="app-brand">
      <img src="./icon.svg" width="40" height="40" alt="" />
      <div>
        <strong>EBVRVM</strong>
        <span>Team Manager</span>
      </div>
    </div>
  );
}
function Login({ runtime }: { runtime: Runtime }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
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
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending.current) return;
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
              setError(
                err instanceof Error
                  ? err.message
                  : "Accesso non riuscito. Controlla le credenziali e riprova.",
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
            />
          </label>
          <label className="grid gap-2" htmlFor="password">
            Password
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={busy}
            />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? (
              <>
                <LoaderCircle className="animate-spin" />
                Accesso…
              </>
            ) : (
              "Accedi"
            )}
          </Button>
          <p role="status" className="text-sm text-red-200">
            {error}
          </p>
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
          <p role="status" className="flex items-center gap-3">
            <LoaderCircle className="size-5 animate-spin" />
            Caricamento squadra…
          </p>
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
  collapsed = false,
  mobile = false,
}: {
  page: Page;
  label: string;
  icon: typeof Home;
  selected: boolean;
  collapsed?: boolean;
  mobile?: boolean;
}) {
  const link = (
    <NavLink
      to={"/" + page}
      className={"app-nav-item " + (selected ? "is-active" : "")}
      aria-current={selected ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
    >
      {selected ? (
        <m.span
          layoutId={
            mobile ? "nav-mobile" : collapsed ? "nav-collapsed" : "nav-full"
          }
          className="nav-selection"
        />
      ) : null}
      <Icon size={21} strokeWidth={1.8} />
      <span className={collapsed ? "sr-only" : ""}>{label}</span>
    </NavLink>
  );
  return collapsed ? <Tooltip label={label}>{link}</Tooltip> : link;
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
  const [collapsed, setCollapsed] = useState(() => {
      try {
        return localStorage.getItem("eburum:sidebar:v1") === "collapsed";
      } catch {
        return false;
      }
    }),
    [actionError, setActionError] = useState("");
  const count = runtime.actions.activeCommunications().length;
  const activeNav =
    snapshot.page === "communications" ||
    ["meetings", "register", "reports"].includes(snapshot.page)
      ? "more"
      : snapshot.page;
  useEffect(() => {
    try {
      localStorage.setItem(
        "eburum:sidebar:v1",
        collapsed ? "collapsed" : "expanded",
      );
    } catch {
      /* Preferences are optional. */
    }
  }, [collapsed]);
  useLayoutEffect(() => {
    document.getElementById("mainContent")?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [snapshot.page]);
  return (
    <div className={"app-layout " + (collapsed ? "sidebar-collapsed" : "")}>
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
      <aside className="app-sidebar">
        <Brand />
        <Button
          variant="ghost"
          size="icon"
          className="sidebar-toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={
            collapsed ? "Espandi navigazione" : "Comprimi navigazione"
          }
          aria-expanded={!collapsed}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
        <nav aria-label="Navigazione principale" className="app-desktop-nav">
          {navigation.map((item) => (
            <NavItem
              key={item.page}
              {...item}
              selected={activeNav === item.page}
              collapsed={collapsed}
            />
          ))}
        </nav>
        <div className="sidebar-staff">
          {!collapsed ? (
            <>
              <span>{snapshot.role ? roleNames[snapshot.role] : ""}</span>
              <small title={snapshot.email}>{snapshot.email}</small>
            </>
          ) : (
            <ShieldCheck size={20} />
          )}
        </div>
      </aside>
      <div className="app-workspace">
        <header className="app-header">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="desktop-context">
            <SeasonPicker runtime={runtime} />
            {snapshot.role ? (
              <span className="staff-role">{roleNames[snapshot.role]}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Tooltip label="Comunicazioni">
              <Button variant="secondary" size="icon" asChild>
                <NavLink
                  to="/communications"
                  aria-label={"Comunicazioni, " + count + " attive"}
                  className="relative"
                >
                  <MessageSquare />
                  {count > 0 ? (
                    <span className="communication-nav-count">{count}</span>
                  ) : null}
                </NavLink>
              </Button>
            </Tooltip>
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
        </header>
        <div className="mobile-season">
          <SeasonPicker runtime={runtime} />
        </div>
        {actionError ? (
          <p role="alert" className="text-red-200">
            {actionError}
          </p>
        ) : null}
        <main id="mainContent" tabIndex={-1} className="workspace-content">
          <PageContent runtime={runtime} snapshot={snapshot} />
        </main>
      </div>
      <nav className="app-mobile-nav" aria-label="Navigazione mobile">
        {navigation.map((item) => (
          <NavItem
            key={item.page}
            {...item}
            selected={activeNav === item.page}
            mobile
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
      return <MeetingsPage runtime={runtime} />;
    case "communications":
      return (
        <CommunicationsPage
          runtime={runtime}
          revision={snapshot.communicationRevision}
        />
      );
    case "more":
      return <ToolsPage runtime={runtime} />;
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
