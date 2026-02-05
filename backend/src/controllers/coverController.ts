import type { Request, Response } from 'express';

const decodeHtmlEntities = (text: string) => {
    return text.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
};

const extractBestImageUrl = (html: string): string[] => {
    const results: Array<{ url: string; width: number; height: number }> = [];

    // Look for <a class="iusc" ... m="{...}" ... href="...">
    // We target the class "iusc" which contains the metadata
    const linkRegex = /<a[^>]+class="iusc"[^>]*>/g;

    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(html)) !== null) {
        const tag = match[0];
        try {
            // Extract m="{...}" containing the media URL
            const mMatch = /m="([^"]+)"/.exec(tag);
            // Extract href="..." containing the dimensions (expw, exph)
            const hrefMatch = /href="([^"]+)"/.exec(tag);

            if (mMatch && hrefMatch) {
                const mStr = decodeHtmlEntities(mMatch[1]);
                const href = decodeHtmlEntities(hrefMatch[1]);

                const mData = JSON.parse(mStr);
                const murl = mData.murl;

                // Extract expw (width) and exph (height) from href parameters
                const widthMatch = /expw=(\d+)/.exec(href);
                const heightMatch = /exph=(\d+)/.exec(href);

                if (murl && widthMatch && heightMatch) {
                    results.push({
                        url: murl,
                        width: parseInt(widthMatch[1]),
                        height: parseInt(heightMatch[1])
                    });
                }
            }
        } catch {
            // Ignore parsing errors for individual items
        }
    }

    // Filter for large images (HD+)
    const large = results.filter(item => item.width >= 1280 && item.height >= 720);
    // Fallback to whatever we found if no large images match
    const pool = large.length > 0 ? large : results;

    if (pool.length === 0) return [];

    // Sort by resolution (descending)
    pool.sort((a, b) => (b.width * b.height) - (a.width * a.height));

    // Return top 20
    return pool.slice(0, 20).map(item => item.url);
};

export async function getCoverImage(req: Request, res: Response) {
    try {

        const query = typeof req.query.query === 'string' ? req.query.query : '';
        if (!query) return res.status(400).json({ error: 'query required' });

        // Add keywords to encourage scenery/photography and exclude maps/charts
        const enhancedQuery = `${query} scenery photography -map -chart -text -diagram -poster -screenshot -clipart -drawing`;
        // Add 'filterui:aspect-wide' to prefer landscape images and 'filterui:photo-photo' for real photos
        const url = `https://www.bing.com/images/search?q=${encodeURIComponent(enhancedQuery)}&qft=+filterui:imagesize-large+filterui:aspect-wide+filterui:photo-photo&form=IRFLTR`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0'

            }
        });

        if (!response.ok) {
            return res.status(502).json({ error: 'Failed to fetch image results' });
        }

        const html = await response.text();
        const imageUrls = extractBestImageUrl(html);

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

