const Parser = require("rss-parser");
const cheerio = require("cheerio");
const axios = require("axios");
const ragService = require("./ragService");

class NewsService {
    constructor() {
        this.parser = new Parser();
        this.rssSource = [
            'https://feeds.bbci.co.uk/news/rss.xml',
            "https://feeds.bbci.co.uk/news/world/asia/india/rss.xml",
            'https://rss.cnn.com/rss/edition.rss',
           " https://rss.cnn.com/rss/edition_asia.rss",
            'https://feeds.reuters.com/reuters/topNews',
            "https://feeds.reuters.com/reuters/INtopNews",
        ]
    }
    //  fetch RSS Feed
    async fetchRSSFeed(url) {
        try {
            const feeds = await this.parser.parseURL(url);
            return feeds.items;
        } catch (error) {
            console.error(`Error fetching RSS from ${url}:`, error);
            return [];
        }
    }
    // scrapeArticle ContentURl
    async scrapeArticleContentURL(url) {
        try {
            const response = await axios.get(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            })
            const $ = cheerio.load(response.data);
            let content = "";
            $('p').each((i, elem)=> {
                content += $(elem).text() + "\n";
            })
            return content.trim();
        } catch (error) {
            console.error(`Error scraping ${url}:`, error);
            return '';
        }
    }

    async ingestNewsArticles() {
        // console.log("Starting news ingestion...");
        let totalIngested = 0;
        let articleId = 1;

        for (const rssUrl of this.rssSource) {
            const articles = await this.fetchRSSFeed(rssUrl);

            for (const article of articles.slice(0, 20)) {  // limit per source
                if (totalIngested >= 50) break;
                try {
                    const content = await this.scrapeArticleContentURL(article.link);
                    if (article.length > 100) { // meaningful content
                        const text = `Title: ${article.title}\n\nContent: ${content}`;
                        await ragService.storeEmbedding(articleId,text, {
                            title: article.title,
                            url: article.link,
                            published: article.pubDate,
                            source:rssUrl,
                        })
                        // console.log(`Ingested article ${articleId}: ${article.title}`);
                        articleId++;
                        totalIngested++;
                    }
                } catch (error) {
                    console.error(`Failed to ingest article: ${article.title}`, error);
                }
                //  Rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            if (totalIngested >= 50) break;
        }
        //  console.log(`News ingestion complete. Total articles: ${totalIngested}`);
    }
}

module.exports = new NewsService();