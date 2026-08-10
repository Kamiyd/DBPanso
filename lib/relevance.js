export function compactText(s) {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "")
    .replace(
      /[·•・\-_—–:：|｜/\\[\]()（）【】《》<>「」『』"""''`~,.，。、!！?？@#￥$%^&*+=]/g,
      ""
    );
}

export function looseText(s) {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u3000]+/g, " ")
    .trim();
}

export function tokenizeKeyword(kw) {
  return looseText(kw)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => {
      if (!t) return false;
      if (/^[a-z0-9]+$/i.test(t)) return t.length >= 2;
      return true;
    });
}

export function scoreRelevance(item, kw) {
  const raw = kw.trim();
  if (!raw) {
    return { score: 0, phraseHit: false, titleHit: false, allTokensHit: false };
  }

  const title = item.title || "";
  const body = `${item.content || ""}\n${(item.tags || []).join(" ")}`;
  const hay = `${title}\n${body}`;

  const titleC = compactText(title);
  const hayC = compactText(hay);
  const kwC = compactText(raw);

  if (!kwC) {
    return { score: 0, phraseHit: false, titleHit: false, allTokensHit: false };
  }

  let score = 0;
  const titlePhrase = titleC.includes(kwC);
  const bodyPhrase = !titlePhrase && hayC.includes(kwC);
  const phraseHit = titlePhrase || bodyPhrase;
  const titleHit = titlePhrase;

  if (titlePhrase) score += 100;
  else if (bodyPhrase) score += 50;

  const tokens = tokenizeKeyword(raw)
    .map((t) => compactText(t))
    .filter(Boolean);
  const uniqTokens = Array.from(new Set(tokens));

  let allTokensHit = false;
  if (uniqTokens.length >= 2) {
    const allInTitle = uniqTokens.every((t) => titleC.includes(t));
    const allInHay = uniqTokens.every((t) => hayC.includes(t));
    allTokensHit = allInHay;

    if (allInTitle) {
      score += 40;
    } else if (allInHay) {
      score += 20;
    } else if (!phraseHit) {
      return {
        score: 0,
        phraseHit: false,
        titleHit: false,
        allTokensHit: false,
      };
    }
  } else if (!phraseHit) {
    const titleL = looseText(title);
    const hayL = looseText(hay);
    const kwL = looseText(raw);
    if (titleL.includes(kwL)) {
      score += 100;
      return { score, phraseHit: true, titleHit: true, allTokensHit: true };
    }
    if (hayL.includes(kwL)) {
      score += 50;
      return { score, phraseHit: true, titleHit: false, allTokensHit: true };
    }
    return {
      score: 0,
      phraseHit: false,
      titleHit: false,
      allTokensHit: false,
    };
  }

  if (
    titlePhrase ||
    (uniqTokens.length >= 2 && uniqTokens.every((t) => titleC.includes(t)))
  ) {
    score += 10;
  }

  return {
    score,
    phraseHit: phraseHit || allTokensHit,
    titleHit:
      titleHit ||
      (uniqTokens.length >= 2 && uniqTokens.every((t) => titleC.includes(t))),
    allTokensHit: phraseHit || allTokensHit,
  };
}

export function isRelevant(item, kw) {
  return scoreRelevance(item, kw).score > 0;
}

export function filterByKeyword(results, kw) {
  const q = kw.trim();
  if (!q) return [];

  const out = [];
  for (const r of results) {
    if (r.links.length <= 1) {
      if (isRelevant(r, q)) out.push(r);
      continue;
    }

    const matchedLinks = r.links.filter((l) =>
      isRelevant({ title: l.workTitle || r.title, content: "", tags: [] }, q)
    );

    if (matchedLinks.length > 0) {
      out.push({ ...r, links: matchedLinks });
    } else if (isRelevant(r, q)) {
      out.push(r);
    }
  }
  return out;
}

export function sortByRelevance(results, kw) {
  return [...results].sort((a, b) => {
    const sa = scoreRelevance(a, kw).score;
    const sb = scoreRelevance(b, kw).score;
    if (sa !== sb) return sb - sa;
    return new Date(b.datetime).getTime() - new Date(a.datetime).getTime();
  });
}
