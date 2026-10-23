"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import {
  LayoutDashboard,
  Users,
  ScanSearch,
  FolderKanban,
  Layers,
  Send,
  Workflow,
  Settings,
  Search,
  Bell,
  Plus,
  PanelLeftClose,
  Menu,
  ChevronDown,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { useData } from "./data-context";
import { EditableCollection } from "@/lib/domain";
import { RecordForm } from "./record-form";
import { Modal, Empty } from "./ui";
export const nav = [
  { href: "/", label: "Today", icon: LayoutDashboard },
  { href: "/crm", label: "CRM", icon: Users },
  { href: "/sales", label: "Sales", icon: Send },
  { href: "/tasks", label: "Tasks", icon: LayoutDashboard },
  { href: "/analytics", label: "Analytics", icon: ScanSearch },
  { href: "/audits", label: "Audits", icon: ScanSearch },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/content", label: "Content", icon: Layers },
  { href: "/posted", label: "Posted", icon: Send },
  { href: "/automations", label: "Automations", icon: Workflow },
  { href: "/team", label: "Team & Access", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { data, provider, mutate } = useData();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [panel, setPanel] = useState<
    "search" | "notifications" | "add" | "user" | null
  >(null);
  const [query, setQuery] = useState("");
  const [add, setAdd] = useState<EditableCollection | null>(null);
  const results = data
    ? [
        ...data.leads.map((r) => ({
          id: r.id,
          title: `${r.name} · ${r.company}`,
          href: "/crm",
          kind: "Lead",
        })),
        ...data.audits.map((r) => ({
          id: r.id,
          title: r.title,
          href: "/audits",
          kind: "Audit",
        })),
        ...data.projects.map((r) => ({
          id: r.id,
          title: r.name,
          href: "/projects",
          kind: "Project",
        })),
        ...data.content.map((r) => ({
          id: r.id,
          title: r.title,
          href: "/content",
          kind: "Content",
        })),
      ].filter((r) => r.title.toLowerCase().includes(query.toLowerCase()))
    : [];
  return (
    <div
      className={`app-shell ${collapsed ? "collapsed" : ""} ${data?.settings.appearance === "Compact" ? "compact" : ""}`}
    >
      <aside
        className={`sidebar ${mobile ? "mobile-open" : ""}`}
        aria-label="Main navigation"
      >
        <Link href="/" className="brand" onClick={() => setMobile(false)}>
          <span className="brand-mark">
            d<span>m</span>
          </span>
          <span className="brand-word">
            designmela<span>AGENCY WORKSPACE</span>
          </span>
        </Link>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {nav.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${path === item.href ? "active" : ""} ${i === 7 ? "settings-link" : ""}`}
              title={item.label}
              aria-current={path === item.href ? "page" : undefined}
              onClick={() => setMobile(false)}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
              {item.label === "CRM" && (
                <small>{data?.leads.length ?? "—"}</small>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <Sparkles size={19} />
            <strong>Good work starts here.</strong>
            <p>A little clarity. A lot of possibility.</p>
          </div>
          <button
            className="collapse-button"
            onClick={() => {
              setCollapsed(!collapsed);
              setMobile(false);
            }}
          >
            <PanelLeftClose size={18} />
            <span>{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu size={22} />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            <strong>{nav.find((n) => n.href === path)?.label ?? "Page"}</strong>
          </div>
          <button
            className="global-search"
            aria-label="Search your workspace"
            onClick={() => setPanel("search")}
          >
            <Search size={17} />
            <span>Search your workspace</span>
            <kbd>⌕</kbd>
          </button>
          <div className="top-actions">
            <span className="demo-indicator">
              <i />
              Demo data
            </span>
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              onClick={() => setPanel("notifications")}
            >
              <Bell size={19} />
              {data?.notifications.some((n) => !n.read) && <i />}
            </button>
            <button
              className="button primary quick-add"
              aria-label="Quick add"
              onClick={() => setPanel("add")}
            >
              <Plus size={17} />
              <span>Quick add</span>
            </button>
            <button
              className="avatar-button"
              aria-label="User menu"
              onClick={() => setPanel("user")}
            >
              DM
              <ChevronDown size={13} />
            </button>
          </div>
        </header>
        <main id="main-content">{children}</main>
        <footer className="footer">
          <span>Designmela · A space for the work that matters.</span>
          <span>Demo workspace · session-only data</span>
        </footer>
      </div>
      {panel === "search" && (
        <Modal title="Search workspace" onClose={() => setPanel(null)}>
          <label>
            Search leads, audits, projects and content
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try a company or project…"
            />
          </label>
          <div className="search-results">
            {results.map((r) => (
              <Link
                key={r.id}
                href={`${r.href}?record=${encodeURIComponent(r.id)}`}
                onClick={() => setPanel(null)}
              >
                <span>
                  <small>{r.kind}</small>
                  {r.title}
                </span>
                <ArrowUpRight size={17} />
              </Link>
            ))}
            {!results.length && (
              <Empty title="No matches" text="Try another name or title." />
            )}
          </div>
        </Modal>
      )}
      {panel === "add" && (
        <Modal title="Make your next move" onClose={() => setPanel(null)}>
          <div className="quick-grid">
            {(
              ["leads", "audits", "projects", "content"] as EditableCollection[]
            ).map((c) => (
              <button
                key={c}
                className="button"
                onClick={() => {
                  setAdd(c);
                  setPanel(null);
                }}
              >
                <Plus size={18} />
                Add{" "}
                {c === "leads"
                  ? "lead"
                  : c === "content"
                    ? "content item"
                    : c.slice(0, -1)}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {panel === "notifications" && (
        <Modal
          title="Notifications · fictional demo"
          onClose={() => setPanel(null)}
        >
          {data?.notifications.map((n) => (
            <div className="notification-row" key={n.id}>
              <p>{n.title}</p>
              <button
                className="button small"
                disabled={n.read}
                onClick={() =>
                  mutate(
                    () =>
                      provider.save("notifications", {
                        ...n,
                        read: true,
                        updatedAt: new Date().toISOString(),
                      }),
                    "Notification marked as read.",
                  )
                }
              >
                {n.read ? "Read" : "Mark read"}
              </button>
            </div>
          ))}
        </Modal>
      )}
      {panel === "user" && (
        <Modal title="Your demo profile" onClose={() => setPanel(null)}>
          <p>{data?.settings.user}</p>
          <p className="muted">
            Authentication is not connected. This is a local demonstration
            workspace.
          </p>
          <Link
            className="button primary"
            href="/settings"
            onClick={() => setPanel(null)}
          >
            Open settings
          </Link>
        </Modal>
      )}
      {add && <RecordForm collection={add} onClose={() => setAdd(null)} />}
    </div>
  );
}
