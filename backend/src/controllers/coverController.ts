import type { Request, Response } from 'express';

type ImageCandidate = {
    url: string;
    width: number;
    height: number;
    title: string;
    pageUrl: string;
    rank: number;
};

const MIN_COVER_WIDTH = 1280;
const MIN_COVER_HEIGHT = 720;
const BING_RESULTS_PER_PAGE = 35;
const MIN_COVER_PIXELS = MIN_COVER_WIDTH * MIN_COVER_HEIGHT;

type SearchLocale = {
    market: string;
    country: string;
    language: string;
    acceptLanguage: string;
};

const GENERIC_QUERY_TOKENS = new Set([
    'landmark',
    'landscape',
    'nature',
    'tourism',
    'scenery',
    'historic',
    'culture',
    'daytime',
    'vacation',
    'panoramic',
    'travel',
    'sightseeing',
    'street',
    'view',
    'aerial',
    'architecture',
    'night',
    'skyline',
    'photo',
    'photography'
]);

const DISALLOWED_IMAGE_PATTERN = /(?:\.gif|\.svg)(?:$|[?#])/i;
const LOW_QUALITY_CONTENT_PATTERN = /\b(?:poster|clipart|drawing|diagram|map|logo|icon|vector|illustration|meme|sticker)\b/i;

const CJK_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const HIRAGANA_KATAKANA_PATTERN = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const HANGUL_PATTERN = /\p{Script=Hangul}/u;

const getBingHeaders = (locale: SearchLocale) => ({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': locale.acceptLanguage,
    'Referer': 'https://www.bing.com/',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Upgrade-Insecure-Requests': '1'
});

const decodeHtmlEntities = (text: string) => {
    return text.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
};

const normalizeSearchText = (text: string) => {
    return text
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
};

const getSearchLocationQuery = (query: string) => {
    const filteredTerms = query
        .split(/\s+/)
        .map(term => term.trim())
        .filter(term => term.length > 0 && !GENERIC_QUERY_TOKENS.has(normalizeSearchText(term)));

    return filteredTerms.join(' ').trim() || query.trim();
};

const detectSearchLocale = (query: string): SearchLocale => {
    if (HIRAGANA_KATAKANA_PATTERN.test(query)) {
        return {
            market: 'ja-JP',
            country: 'JP',
            language: 'ja-JP',
            acceptLanguage: 'ja-JP,ja;q=0.9,en-US;q=0.7'
        };
    }

    if (HANGUL_PATTERN.test(query)) {
        return {
            market: 'ko-KR',
            country: 'KR',
            language: 'ko-KR',
            acceptLanguage: 'ko-KR,ko;q=0.9,en-US;q=0.7'
        };
    }

    if (CJK_PATTERN.test(query)) {
        return {
            market: 'zh-TW',
            country: 'TW',
            language: 'zh-Hant',
            acceptLanguage: 'zh-TW,zh;q=0.9,en-US;q=0.7'
        };
    }

    return {
        market: 'en-US',
        country: 'US',
        language: 'en-US',
        acceptLanguage: 'en-US,en;q=0.9'
    };
};

const expandQueryToken = (token: string): string[] => {
    const normalizedToken = normalizeSearchText(token);
    if (normalizedToken.length < 2) {
        return [];
    }

    const expanded = new Set([normalizedToken]);
    if (CJK_PATTERN.test(token) && token.length >= 4) {
        expanded.add(normalizeSearchText(token.slice(0, 2)));
        expanded.add(normalizeSearchText(token.slice(-2)));

        if (token.length >= 6) {
            expanded.add(normalizeSearchText(token.slice(0, 3)));
            expanded.add(normalizeSearchText(token.slice(-3)));
        }
    }

    return Array.from(expanded).filter(part => part.length >= 2);
};

const getQueryTokens = (query: string): string[] => {
    return Array.from(new Set(
        query
            .split(/[^\p{L}\p{N}]+/u)
            .flatMap(expandQueryToken)
            .filter(token => token.length >= 2 && !GENERIC_QUERY_TOKENS.has(token))
    ));
};

const getCandidateRelevance = (candidate: ImageCandidate, queryTokens: string[]) => {
    const title = normalizeSearchText(candidate.title);
    const pageUrl = normalizeSearchText(candidate.pageUrl);
    const imageUrl = normalizeSearchText(candidate.url);
    const searchableText = `${title} ${pageUrl} ${imageUrl}`;

    let score = 0;
    for (const token of queryTokens) {
        if (title.includes(token)) {
            score += 5;
            continue;
        }

        if (pageUrl.includes(token)) {
            score += 3;
            continue;
        }

        if (imageUrl.includes(token)) {
            score += 1;
        }
    }

    if (LOW_QUALITY_CONTENT_PATTERN.test(searchableText)) {
        score -= 4;
    }

    if ((candidate.width * candidate.height) >= MIN_COVER_PIXELS) {
        score += 2;
    }

    return score;
};

const extractBestImageUrl = (html: string, query: string): string[] => {
    const results: ImageCandidate[] = [];

    // Look for <a class="iusc" ... m="{...}" ... href="...">
    // We target the class "iusc" which contains the metadata
    const linkRegex = /<a[^>]+class="iusc"[^>]*>/g;

    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(html)) !== null) {
        const tag = match[0];
        try {
            // Extract m="{...}" containing the media URL
            const mMatch = /\bm="([^"]+)"/.exec(tag);
            // Extract href="..." containing the dimensions (expw, exph)
            const hrefMatch = /\bhref="([^"]+)"/.exec(tag);

            if (mMatch && hrefMatch) {
                const mStr = decodeHtmlEntities(mMatch[1]);
                const href = decodeHtmlEntities(hrefMatch[1]);

                const mData = JSON.parse(mStr);
                const detailUrl = new URL(href, 'https://www.bing.com');
                const murl = mData.murl || detailUrl.searchParams.get('mediaurl');

                const width = parseInt(detailUrl.searchParams.get('expw') ?? '', 10);
                const height = parseInt(detailUrl.searchParams.get('exph') ?? '', 10);

                if (murl && !DISALLOWED_IMAGE_PATTERN.test(murl)) {
                    results.push({
                        url: murl,
                        width: Number.isFinite(width) ? width : 0,
                        height: Number.isFinite(height) ? height : 0,
                        title: typeof mData.t === 'string' ? mData.t : '',
                        pageUrl: typeof mData.purl === 'string' ? mData.purl : '',
                        rank: results.length
                    });
                }
            }
        } catch {
            // Ignore parsing errors for individual items
        }
    }

    const queryTokens = getQueryTokens(query);
    const deduped = Array.from(new Map(results.map(item => [item.url, item])).values());
    const scored = deduped
        .map(item => ({ item, relevance: getCandidateRelevance(item, queryTokens) }))
        .filter(({ item, relevance }) => !LOW_QUALITY_CONTENT_PATTERN.test(`${item.title} ${item.pageUrl}`) || relevance > 0);

    const relevant = queryTokens.length > 0
        ? scored.filter(({ relevance }) => relevance > 0)
        : scored;

    const poolSource = relevant.length > 0 ? relevant : scored;
    const large = poolSource.filter(({ item }) => (item.width * item.height) >= MIN_COVER_PIXELS);
    const pool = large.length > 0 ? large : poolSource;

    if (pool.length === 0) return [];

    // Prefer destination-relevant images, then keep Bing's original ranking.
    pool.sort((a, b) => {
        if (b.relevance !== a.relevance) {
            return b.relevance - a.relevance;
        }

        return a.item.rank - b.item.rank;
    });

    // Return top 20
    return pool.slice(0, 20).map(({ item }) => item.url);
};

export async function getCoverImage(req: Request, res: Response) {
    try {

        const query = typeof req.query.query === 'string' ? req.query.query : '';
        if (!query) return res.status(400).json({ error: 'query required' });

        const locationQuery = getSearchLocationQuery(query);
        const locale = detectSearchLocale(locationQuery);

        const page = Number.isFinite(Number(req.query.p))
            ? Math.max(0, parseInt(req.query.p as string, 10))
            : 0;
        const first = page * BING_RESULTS_PER_PAGE + 1;

        // Keep the search close to what a user would type in Bing, then rely on photo/size filters.
        const searchUrl = new URL('https://www.bing.com/images/search');
        searchUrl.searchParams.set('q', locationQuery);
        searchUrl.searchParams.set('qft', '+filterui:imagesize-large+filterui:aspect-wide+filterui:photo-photo');
        searchUrl.searchParams.set('form', 'IRFLTR');
        searchUrl.searchParams.set('first', String(first));
        searchUrl.searchParams.set('cw', '1177');
        searchUrl.searchParams.set('ch', '337');
        searchUrl.searchParams.set('mkt', locale.market);
        searchUrl.searchParams.set('cc', locale.country);
        searchUrl.searchParams.set('setlang', locale.language);

        const response = await fetch(searchUrl, { headers: getBingHeaders(locale) });

        if (!response.ok) {
            return res.status(502).json({ error: 'Failed to fetch image results' });
        }

        const html = await response.text();
        const imageUrls = extractBestImageUrl(html, locationQuery);

        if (!imageUrls || imageUrls.length === 0) {
            return res.status(404).json({ error: 'No image found' });
        }

        // Filter out excluded URL (to prevent selecting the same image twice)
        const excludeUrl = typeof req.query.exclude === 'string' ? req.query.exclude : '';
        let filteredUrls = excludeUrl ? imageUrls.filter(url => url !== excludeUrl) : imageUrls;

        // If all URLs were filtered out, fall back to original list
        if (filteredUrls.length === 0) {
            filteredUrls = imageUrls;
        }

        // Logic for deterministic selection if 'index' is provided
        let selectedUrl = '';

        if (req.query.index) {
            const idx = parseInt(req.query.index as string, 10) % filteredUrls.length;
            selectedUrl = filteredUrls[idx];
        } else {
            // Random fallback
            const randomIdx = Math.floor(Math.random() * filteredUrls.length);
            selectedUrl = filteredUrls[randomIdx];
        }

        if (req.query.redirect === 'true') {
            return res.redirect(selectedUrl);
        }

        return res.json({ url: selectedUrl });
    } catch (error: any) {
        return res.status(500).json({ error: error.message || 'Cover lookup failed' });
    }
}

