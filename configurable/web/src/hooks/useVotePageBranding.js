import { useEffect } from "react";

const VOTE_ICON = "/imgs/vote-512.png?v=vote-icon-20260417-2";
const VOTE_MANIFEST = "/manifest-vote.webmanifest?v=vote-icon-20260417-2";
const DEFAULT_TITLE = "实时投票";
const DEFAULT_THEME = "#4a90e2";
const VOTE_THEME = "#2185d0";

function pickMeta(name) {
  return document.querySelector(`meta[name="${name}"]`);
}

function pickMetaProperty(property) {
  return document.querySelector(`meta[property="${property}"]`);
}

function iconHrefWithBust(base) {
  const u = new URL(base, window.location.origin);
  u.searchParams.set("cb", "vote-route");
  return u.pathname + u.search;
}

function appendMeta(attr, key, content) {
  const el = document.createElement("meta");
  el.setAttribute(attr, key);
  el.setAttribute("content", content);
  el.setAttribute("data-vote-branding", "1");
  document.head.appendChild(el);
  return el;
}

export function useVotePageBranding({ pageTitle = "投票", appName = "投票" } = {}) {
  useEffect(() => {
    const favicon = document.querySelector('link[rel="icon"]');
    const apple = document.querySelector('link[rel="apple-touch-icon"]');
    const manifest = document.querySelector('link[rel="manifest"]');
    const themeMeta = pickMeta("theme-color");
    const appNameMeta = pickMeta("application-name");
    let ogImage = pickMetaProperty("og:image");
    let ogTitle = pickMetaProperty("og:title");
    let twImage = pickMeta("twitter:image");

    const absIcon = new URL(VOTE_ICON, window.location.origin).href;

    if (!ogImage) {
      ogImage = appendMeta("property", "og:image", absIcon);
    } else {
      ogImage.setAttribute("data-vote-branding", "1");
    }
    if (!ogTitle) {
      ogTitle = appendMeta("property", "og:title", pageTitle);
    } else {
      ogTitle.setAttribute("data-vote-branding", "1");
    }
    if (!twImage) {
      twImage = appendMeta("name", "twitter:image", absIcon);
    } else {
      twImage.setAttribute("data-vote-branding", "1");
    }

    const prev = {
      faviconHref: favicon?.getAttribute("href") ?? null,
      faviconType: favicon?.getAttribute("type") ?? null,
      appleHref: apple?.getAttribute("href") ?? null,
      manifestHref: manifest?.getAttribute("href") ?? null,
      title: document.title,
      theme: themeMeta?.getAttribute("content") ?? null,
      appName: appNameMeta?.getAttribute("content") ?? null,
    };

    const busted = iconHrefWithBust(VOTE_ICON);
    if (favicon) {
      favicon.setAttribute("href", busted);
      favicon.setAttribute("type", "image/png");
    }
    if (apple) apple.setAttribute("href", busted);
    if (manifest) manifest.setAttribute("href", VOTE_MANIFEST);
    document.title = pageTitle;
    if (themeMeta) themeMeta.setAttribute("content", VOTE_THEME);
    if (appNameMeta) appNameMeta.setAttribute("content", appName);
    ogImage.setAttribute("content", absIcon);
    ogTitle.setAttribute("content", pageTitle);
    twImage.setAttribute("content", absIcon);

    return () => {
      document.querySelectorAll('meta[data-vote-branding="1"]').forEach((el) => {
        try {
          el.remove();
        } catch {
          /* ignore */
        }
      });
      if (favicon) {
        if (prev.faviconHref != null) favicon.setAttribute("href", prev.faviconHref);
        if (prev.faviconType != null) favicon.setAttribute("type", prev.faviconType);
      }
      if (apple && prev.appleHref != null) apple.setAttribute("href", prev.appleHref);
      if (manifest && prev.manifestHref != null) manifest.setAttribute("href", prev.manifestHref);
      document.title = prev.title || DEFAULT_TITLE;
      if (themeMeta && prev.theme != null) themeMeta.setAttribute("content", prev.theme);
      else if (themeMeta) themeMeta.setAttribute("content", DEFAULT_THEME);
      if (appNameMeta && prev.appName != null) appNameMeta.setAttribute("content", prev.appName);
      else if (appNameMeta) appNameMeta.setAttribute("content", "实时投票");
    };
  }, [pageTitle, appName]);
}
