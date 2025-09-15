const Parser = require("rss-parser");
const cheerio = require("cheerio");
const axios = require("axios");
const https = require("https");
const ragService = require("./ragService");
class NewsService {
    constructor() {
        // Configure RSS parser with proper HTTPS support
        this.parser = new Parser({
            timeout: 20000, // 20 second timeout
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0; +https://example.com/bot)',
                'Accept': 'application/rss+xml, application/xml, text/xml'
            },
            // Custom request options for better HTTPS handling
            customFields: {
                feed: ['language', 'copyright'],
                item: ['category', 'source']
            }
        });

        // Updated RSS sources with working, reliable feeds
        this.rssSource = [
            // BBC feeds (most reliable)
            'https://feeds.bbci.co.uk/news/rss.xml',
            'https://feeds.bbci.co.uk/news/world/rss.xml',
            'https://feeds.bbci.co.uk/news/business/rss.xml',
            
            // Alternative news sources (more reliable than CNN/Reuters)
            'https://rss.cnn.com/rss/cnn_topstories.rss', 
            'https://feeds.feedburner.com/ndtvnews-top-stories',
            'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
            'https://feeds.skynews.com/feeds/rss/home.xml',
            
            // Backup international sources
            'https://feeds.npr.org/1001/rss.xml',
            'https://rss.dw.com/atom/rss-en-all',

             // Technology & Science
            'https://timesofindia.indiatimes.com/rssfeeds/66949542.cms', 
            'https://feeds.feedburner.com/gadgets360-latest', 
            'https://indianexpress.com/section/technology/feed/',

            // Major Indian English News Sources (Most Reliable)
            'https://timesofindia.indiatimes.com/rssfeedstopstories.cms', 
            'https://feeds.feedburner.com/ndtvnews-top-stories', 
            'https://indianexpress.com/feed/', 
            'https://www.indiatoday.in/rss/1206578', 
            'https://www.hindustantimes.com/feeds/rss/india-news/index.xml',
        ];

        // Configure axios with better network settings
        this.axiosConfig = {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            httpsAgent: new https.Agent({
                rejectUnauthorized: false,
                timeout: 15000,
                keepAlive: true,
                maxSockets: 5
            })
        };
    }

    // Enhanced RSS fetching with multiple retry strategies
    async fetchRSSFeed(url, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`Fetching RSS from ${url} (attempt ${attempt}/${maxRetries})`);

                // Use axios for initial fetch to handle HTTPS better
                const response = await axios.get(url, {
                    ...this.axiosConfig,
                    timeout: 20000 + (attempt * 5000) // Increase timeout with retries
                });

                // Parse the XML content
                const feed = await this.parser.parseString(response.data);
                console.log(`Successfully fetched ${feed.items.length} items from ${url}`);
                return feed.items;

            } catch (error) {
                const isLastAttempt = attempt === maxRetries;
                console.error(`Attempt ${attempt} failed for ${url}:`, error.message);

                if (isLastAttempt) {
                    console.error(`All ${maxRetries} attempts failed for ${url}`);
                    return [];
                }

                // Progressive backoff: wait longer between retries
                const waitTime = attempt * 2000 + Math.random() * 1000;
                console.log(`Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        return [];
    }

    // Enhanced article scraping with better error handling
    async scrapeArticleContentURL(url, maxRetries = 2) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await axios.get(url, {
                    ...this.axiosConfig,
                    timeout: 12000 + (attempt * 3000)
                });

                const $ = cheerio.load(response.data);
                let content = "";

                // Try multiple content selectors for different news sites
                const contentSelectors = [
                    'article p',
                    '.story-body p',
                    '.entry-content p',
                    '.post-content p',
                    '.article-content p',
                    '.content p',
                    'p'
                ];

                for (const selector of contentSelectors) {
                    $(selector).each((i, elem) => {
                        const text = $(elem).text().trim();
                        // Only add meaningful paragraphs
                        if (text.length > 30 && !text.match(/^(Advertisement|Subscribe|Follow us)/i)) {
                            content += text + "\n";
                        }
                    });

                    // Stop if we have enough content
                    if (content.length > 200) break;
                }
                if (content.length > 50) {
                    return content.trim();
                }

            } catch (error) {
                if (attempt === maxRetries) {
                    console.error(`Failed to scrape ${url}: ${error.message}`);
                }
            }
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
        return '';
    }

    // Main ingestion function with improved error handling
    async ingestNewsArticles() {
        let totalIngested = 0;
        let articleId = 1;
        const maxArticles = 30; // Increased limit
        const articlesPerSource = 5;
        for (const rssUrl of this.rssSource) {
            if (totalIngested >= maxArticles) break;
            const articles = await this.fetchRSSFeed(rssUrl);
            if (articles.length === 0) {
                console.log(`No articles from ${rssUrl}, continuing with next source...`);
                continue;
            }
            // Process articles from this source
            for (const article of articles.slice(0, articlesPerSource)) {
                if (totalIngested >= maxArticles) break;
                try {
                    const articleTitle = article?.title || 'Unknown Title';
                    // Skip if no valid link
                    if (!article.link || !article.link.startsWith('http')) {
                        console.log(` Skipping - invalid link: ${article.link}`);
                        continue;
                    }

                    const content = await this.scrapeArticleContentURL(article.link);
                    
                    if (content.length > 100) {
                        const text = `Title: ${articleTitle}\n\nContent: ${content}`;
                        
                        await ragService.storeEmbedding(articleId, text, {
                            title: articleTitle,
                            url: article.link,
                            published: article.pubDate || new Date().toISOString(),
                            source: rssUrl,
                            category: article.category || 'general'
                        });
                        
                        console.log(`Stored article ${articleId}: ${articleTitle.substring(0, 50)}...`);
                        articleId++;
                        totalIngested++;
                        
                    } else {
                        console.log(`Skipped - insufficient content: ${articleTitle.substring(0, 50)}...`);
                    }

                } catch (error) {
                    const safeTitle = article?.title?.substring(0, 50) || 'Unknown';
                    console.error(`Failed to process article: ${safeTitle} - ${error.message}`);
                }

                // Rate limiting between articles
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            // Rate limiting between sources
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        return totalIngested;
    }

    // Test method to verify connectivity
    async testConnectivity() {
        console.log("Testing RSS feed connectivity...");
        const testUrls = ['https://feeds.bbci.co.uk/news/rss.xml','https://www.google.com'];
        for (const url of testUrls) {
            try {
                const response = await axios.get(url, {
                    ...this.axiosConfig,
                    timeout: 5000
                });
                console.log(`Connectivity test passed: ${url} (${response.status})`);
            } catch (error) {
                console.error(` Connectivity test failed: ${url} - ${error.message}`);
            }
        }
    }
}
module.exports = new NewsService();