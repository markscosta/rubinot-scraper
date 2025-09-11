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
  // Try direct URLs that might bypass the dropdown
  const urls = [
    'https://rubinot.com.br/?subtopic=latestdeaths&world=Mystian',
    'https://rubinot.com.br/index.php?subtopic=latestdeaths&world=Mystian',
    'https://rubinot.com.br/?subtopic=killstatistics&world=Mystian',
    'https://rubinot.com.br/?subtopic=latestdeaths',
  ];

  for (const url of urls) {
    try {
      console.log(`Trying URL: ${url}`);
      
      const result = await this.firecrawl.scrapeUrl(url, {
        formats: ['html', 'markdown'],
        waitFor: 8000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (result?.html) {
        console.log(`Got HTML from ${url}, length: ${result.html.length}`);
        
        // Also log the markdown to see the content structure
        if (result.markdown) {
          console.log('Markdown content preview:', result.markdown.substring(0, 1000));
        }
        
        const deaths = this.parseDeathsHTML(result.html);
        if (deaths.length > 0) {
          console.log(`Found ${deaths.length} deaths from ${url}`);
          return deaths;
        }
      }
    } catch (error) {
      console.error(`Failed to scrape ${url}:`, error.message);
    }
  }
  
  console.log('No deaths found from any URL');
  return [];
}

  parseDeathsHTML(html) {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const deaths = [];

  console.log('=== DEBUG: HTML PARSING ===');
  console.log('HTML length:', html.length);
  console.log('Page title:', $('title').text());
  
  // Debug: Look for any tables
  const allTables = $('table');
  console.log('Found tables:', allTables.length);
  
  // Debug: Look for any text containing death-related keywords
  const pageText = $('body').text().toLowerCase();
  const hasDeathKeywords = ['death', 'died', 'kill', 'slain'].some(keyword => pageText.includes(keyword));
  console.log('Page contains death keywords:', hasDeathKeywords);
  
  // Debug: Show first 500 characters of body text
  console.log('Page content preview:', $('body').text().substring(0, 500));

  $('table tr').each((i, element) => {
    const cells = $(element).find('td');
    
    // Debug: Log first few rows
    if (i < 5) {
      const cellTexts = [];
      cells.each((j, cell) => cellTexts.push($(cell).text().trim()));
      console.log(`Row ${i}:`, cellTexts);
    }
    
    if (i === 0) return; // Skip header
    
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

  console.log('=== END DEBUG ===');
  return deaths.slice(0, 20);
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
