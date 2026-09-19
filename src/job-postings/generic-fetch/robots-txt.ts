interface RobotsRule {
  path: string;
  allow: boolean;
}

interface RobotsGroup {
  userAgents: string[];
  rules: RobotsRule[];
}

function parseGroups(robotsTxt: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let sawRuleSinceLastUserAgent = true;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;

    const [rawField, ...rest] = line.split(':');
    const field = rawField.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (!value) continue;

    if (field === 'user-agent') {
      if (current && sawRuleSinceLastUserAgent) {
        current = null;
      }
      if (!current) {
        current = { userAgents: [], rules: [] };
        groups.push(current);
        sawRuleSinceLastUserAgent = false;
      }
      current.userAgents.push(value.toLowerCase());
    } else if (field === 'disallow' && current) {
      current.rules.push({ path: value, allow: false });
      sawRuleSinceLastUserAgent = true;
    } else if (field === 'allow' && current) {
      current.rules.push({ path: value, allow: true });
      sawRuleSinceLastUserAgent = true;
    }
  }

  return groups;
}

/**
 * A minimal, de-facto-standard robots.txt evaluator (User-agent groups,
 * Disallow/Allow prefix rules, longest-match-wins) — enough to honor the
 * common case real sites use. Not a full spec implementation (no wildcard
 * `*`/`$` path patterns, no crawl-delay/sitemap handling) — those are rare
 * enough in practice that adding them would be speculative complexity for
 * ticket 10's scope, not a fix for anything actually observed.
 */
export function isPathAllowed(robotsTxt: string, path: string, userAgent: string): boolean {
  const groups = parseGroups(robotsTxt);
  const ua = userAgent.toLowerCase();

  const specific = groups.find((group) => group.userAgents.includes(ua));
  const wildcard = groups.find((group) => group.userAgents.includes('*'));
  const rules = (specific ?? wildcard)?.rules ?? [];

  let best: RobotsRule | null = null;
  for (const rule of rules) {
    if (rule.path === '' || path.startsWith(rule.path)) {
      if (!best || rule.path.length > best.path.length) {
        best = rule;
      }
    }
  }

  return best ? best.allow : true;
}
