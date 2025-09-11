const FirecrawlApp = require('@mendable/firecrawl-js').default;
const fs = require('fs').promises;
const path = require('path');

class RubinOTScraper {
  constructor() {
    this.firecrawl = new FirecrawlApp({ 
      apiKey: process.env.FIRECRAWL_API_KEY 
    });
    this.dataDir = path.join(__dirname, 'data');
  }

  async scrapeDeaths() {
    const urls = [
      'https://rubinot.com.br/?subtopic=latestdeaths',
      'https://rubinot.com.br/?subtopic=latestdeaths&world=Auroria',
      'https://rubinot.com.br/?subtopic=killstatistics'
    ];

    for (const url of urls) {
      try {
        console.log(`Scraping deaths from: ${url}`);
        
        const result = await this.firecrawl.scrapeUrl(url, {
          formats: ['html'],
          waitFor: 3000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; RubinOTBot/1.0)'
          }
        });

        if (result?.html) {
          const deaths = this.parseDeathsHTML(result.html);
          if (deaths.length > 0) {
            console.log(`Found ${deaths.length} deaths`);
            return deaths;
          }
        }
      } catch (error) {
        console.error(`Failed to scrape ${url}:`, error.message);
      }
    }
    
    return [];
  }

  parseDeathsHTML(html) {
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    const deaths = [];

    $('table tr').each((i, element) => {
      if (i === 0) return; // Skip header
      
      const cells = $(element).find('td');
      if (cells.length >= 3) {
        const player = $(cells[0]).text().trim();
        const level = $(cells[1]).text().trim();
        const killer = $(cells[2]).text().trim();
        const time = cells.length > 3 ? $(cells[3]).text().trim() : 'Recently';
        
        if (player && level && player.length > 2) {
          deaths.push({
            player,
            level: parseInt(level) || 0,
            killer,
            time,
            timestamp: Date.now(),
            id: `${player}-${level}-${killer}-${time}`
          });
        }
      }
    });

    return deaths.slice(0, 20); // Keep last 20 deaths
  }

  async saveData(filename, data) {
    await fs.mkdir(this.dataDir, { recursive: true });
    const filepath = path.join(this.dataDir, filename);
    await fs.writeFile(filepath, JSON.stringify({
      lastUpdated: new Date().toISOString(),
      data: data
    }, null, 2));
  }

  async run() {
    try {
      console.log('Starting RubinOT scraping...');
      
      const deaths = await this.scrapeDeaths();
      await this.saveData('latest_deaths.json', deaths);
      
      console.log(`Scraping complete. Found ${deaths.length} deaths.`);
      
    } catch (error) {
      console.error('Scraping failed:', error);
      process.exit(1);
    }
  }
}

new RubinOTScraper().run();
