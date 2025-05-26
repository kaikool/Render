const express = require("express");
const puppeteer = require("puppeteer");
const app = express();

app.get("/screenshot", async (req, res) => {
  const symbol = req.query.symbol || "NASDAQ:AAPL";
  const interval = req.query.interval || "1D";

  const url = `https://www.tradingview.com/chart/?symbol=${symbol}`;

  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    await page.goto(url, { waitUntil: "networkidle2" });

    // Đợi biểu đồ render (có thể tùy chỉnh kỹ hơn bằng cách đợi selector cụ thể)
    await page.waitForTimeout(5000);

    const screenshot = await page.screenshot({ type: "png" });

    await browser.close();

    res.set("Content-Type", "image/png");
    res.send(screenshot);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error taking screenshot");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
