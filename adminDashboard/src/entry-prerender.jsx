// Build-time only (vite build --ssr): renders public pages to HTML strings.
// Not loaded in the browser.
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import Landing from "./pages/Landing";
import About from "./pages/About";
import Creators from "./pages/Creators";
import FaqPage from "./pages/FaqPage";
import Contact from "./pages/Contact";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Guidelines from "./pages/Guidelines";
import CopyrightPolicy from "./pages/CopyrightPolicy";
import ModerationPolicy from "./pages/ModerationPolicy";
import CookiePolicy from "./pages/CookiePolicy";
import AccountDeletion from "./pages/AccountDeletion";
import ChildSafety from "./pages/ChildSafety";
import RefundPolicy from "./pages/RefundPolicy";
export { PUBLIC_PAGES, SITE_URL } from "./seo/publicPages";

const COMPONENTS = {
  "/": Landing,
  "/about": About,
  "/creators": Creators,
  "/for-creators": Creators,
  "/faq": FaqPage,
  "/contact": Contact,
  "/terms": Terms,
  "/privacy": Privacy,
  "/guidelines": Guidelines,
  "/copyright": CopyrightPolicy,
  "/moderation": ModerationPolicy,
  "/cookies": CookiePolicy,
  "/account-deletion": AccountDeletion,
  "/child-safety": ChildSafety,
  "/refunds": RefundPolicy,
};

export function render(path) {
  const Page = COMPONENTS[path];
  if (!Page) throw new Error(`No pre-render component for ${path}`);
  return renderToString(
    <StaticRouter location={path}>
      <Page />
    </StaticRouter>
  );
}
