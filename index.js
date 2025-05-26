const express = require('express');
const fs = require('fs').promises;
const path = require('path');

// Dynamically import browser based on environment
let browserLauncher;
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  browserLauncher = require('chrome-aws-lambda');
} else {
  browserLauncher = require('puppeteer');
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware for JSON parsing
app.use(express.json());

// Root endpoint - Welcome page
app.get('/', (req, res) => {
  res.json({
    service: 'TradingView Screenshot Service',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      screenshot: '/screenshot?symbol=EXCHANGE:SYMBOL'
    },
    example: '/screenshot?symbol=BINANCE:BTCUSDT',
    documentation: 'https://github.com/kaikool/Render'
  });
});

// Helper function to load cookies
async function loadCookies() {
  try {
    // First try to get cookies from environment variable
    const cookieJson = process.env.COOKIE_JSON;
    if (cookieJson) {
      console.log('Loading cookies from environment variable');
      return JSON.parse(cookieJson);
    }
    
    // Fallback to reading from cookies.json file
    console.log('Loading cookies from cookies.json file');
    const cookieFile = await fs.readFile(path.join(__dirname, 'cookies.json'), 'utf8');
    return JSON.parse(cookieFile);
  } catch (error) {
    console.error('Error loading cookies:', error.message);
    return [];
  }
}

// Helper function to validate symbol format
function validateSymbol(symbol) {
  if (!symbol) {
    return false;
  }
  
  // Basic validation for TradingView symbol format (EXCHANGE:PAIR)
  const symbolPattern = /^[A-Z0-9]+:[A-Z0-9]+$/i;
  return symbolPattern.test(symbol);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Screenshot endpoint
app.get('/screenshot', async (req, res) => {
  const { symbol } = req.query;
  
  // Validate symbol parameter
  if (!validateSymbol(symbol)) {
    return res.status(400).json({
      error: 'Invalid symbol format',
      message: 'Symbol must be in format EXCHANGE:PAIR (e.g., BINANCE:BTCUSDT)'
    });
  }
  
  let browser = null;
  
  try {
    console.log(`Starting screenshot capture for symbol: ${symbol}`);
    
    // Launch browser with appropriate configuration
    if (isProduction) {
      browser = await browserLauncher.puppeteer.launch({
        args: browserLauncher.args,
        defaultViewport: browserLauncher.defaultViewport,
        executablePath: await browserLauncher.executablePath,
        headless: browserLauncher.headless,
        ignoreHTTPSErrors: true,
      });
    } else {
      browser = await browserLauncher.launch({
        headless: true,
        ignoreHTTPSErrors: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });
    }
    
    const page = await browser.newPage();
    
    // Set viewport for consistent screenshots
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });
    
    // Set user agent to avoid detection
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    );
    
    // Load and set cookies
    const cookies = await loadCookies();
    if (cookies && cookies.length > 0) {
      console.log(`Setting ${cookies.length} cookies for authentication`);
      await page.setCookie(...cookies);
    } else {
      console.warn('No cookies found - proceeding without authentication');
    }
    
    // Navigate to TradingView chart
    const url = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
    console.log(`Navigating to: ${url}`);
    
    await page.goto(url, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });
    
    // Wait for chart to load
    console.log('Waiting for chart to render...');
    await page.waitForTimeout(6000); // Wait 6 seconds for chart rendering
    
    // Try to wait for chart container to be visible
    try {
      await page.waitForSelector('[data-name="legend-source-item"]', { timeout: 10000 });
      console.log('Chart elements detected');
    } catch (error) {
      console.warn('Chart elements not detected, proceeding with screenshot');
    }
    
    // Hide any potential popups or overlays
    await page.evaluate(() => {
      // Hide common popup elements
      const selectors = [
        '[data-name="popup"]',
        '[data-name="close-button"]',
        '.tv-dialog',
        '.tv-popup',
        '.js-popup',
        '[class*="popup"]',
        '[class*="modal"]',
        '[class*="overlay"]'
      ];
      
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          if (el && el.style) {
            el.style.display = 'none';
          }
        });
      });
    });
    
    // Take screenshot of the chart area
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
      clip: {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
      },
    });
    
    console.log(`Screenshot captured successfully for ${symbol}`);
    
    // Set proper headers for image response
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': screenshot.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    res.send(screenshot);
    
  } catch (error) {
    console.error('Error capturing screenshot:', error);
    
    // Handle specific error types
    if (error.name === 'TimeoutError') {
      return res.status(408).json({
        error: 'Request timeout',
        message: 'Failed to load TradingView chart within timeout period'
      });
    }
    
    if (error.message.includes('net::')) {
      return res.status(502).json({
        error: 'Network error',
        message: 'Failed to connect to TradingView'
      });
    }
    
    // Generic error response
    res.status(500).json({
      error: 'Screenshot capture failed',
      message: error.message || 'An unexpected error occurred'
    });
    
  } finally {
    // Always close the browser
    if (browser) {
      try {
        await browser.close();
        console.log('Browser closed successfully');
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`TradingView Screenshot Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Screenshot endpoint: http://localhost:${PORT}/screenshot?symbol=BINANCE:BTCUSDT`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully');
  process.exit(0);
});
