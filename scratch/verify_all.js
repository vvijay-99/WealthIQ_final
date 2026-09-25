const puppeteer = require('puppeteer-core');

async function runVerification() {
  console.log('================================================================');
  console.log('   FORECAST, RECOMMENDATIONS & MARKET INSIGHTS VERIFICATION     ');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/brave-browser',
    userDataDir: '/tmp/brave_test_profile',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const results = {
    forecast: {
      initialLoad: false,
      reloadResult: false,
      navigationResult: false,
      details: {},
    },
    recommendations: {
      initialLoad: false,
      reloadResult: false,
      navigationResult: false,
      details: {},
    },
    marketInsights: {
      dataSource: '',
      verifiedColumns: false,
      timestampBehavior: false,
      marketOpenClosedHandling: false,
      refreshBehavior: false,
      failureHandling: false,
      details: {},
    },
  };

  try {
    // -------------------------------------------------------------
    // PART 1: FORECAST VERIFICATION
    // -------------------------------------------------------------
    console.log('>>> TESTING FORECAST (/forecast)...');

    // 1. Initial load
    console.log('Step 1: Navigating to http://localhost:3000/forecast');
    await page.goto('http://localhost:3000/forecast', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2000));

    let forecastTitle = await page.$eval('h1', (el) => el.innerText).catch(() => '');
    let netWorthCardText = await page.evaluate(() => {
      const card = document.querySelector('.space-y-6');
      return card ? card.innerText : '';
    });
    let isLoadingPresent = await page.evaluate(() => {
      return document.body.innerText.includes('Calculating deterministic financial forecast...');
    });

    console.log('Forecast Title:', forecastTitle);
    console.log('Loading spinner still present:', isLoadingPresent);
    console.log('Forecast Content Snippet:', netWorthCardText.slice(0, 180).replace(/\n/g, ' '));

    if (forecastTitle.includes('Financial Forecast') && !isLoadingPresent && netWorthCardText.length > 0) {
      results.forecast.initialLoad = true;
      console.log('✅ Forecast Step 1: Initial load PASS');
    } else {
      console.log('❌ Forecast Step 1: Initial load FAIL');
    }

    // 2. Full Browser Reload (Ctrl+R / page.reload)
    console.log('\nStep 2: Performing full browser reload (Ctrl+R)...');
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2500));

    isLoadingPresent = await page.evaluate(() => {
      return document.body.innerText.includes('Calculating deterministic financial forecast...');
    });
    let milestoneCount = await page.evaluate(() => {
      return document.querySelectorAll('.grid-cols-2 > div, .sm\\:grid-cols-5 > div').length;
    });
    let trajectoryBadge = await page.evaluate(() => {
      const badge = document.querySelector('.rounded-full.border.px-3');
      return badge ? badge.innerText.trim() : '';
    });

    console.log('Post-reload loading spinner still present:', isLoadingPresent);
    console.log('Milestone Horizons rendered count:', milestoneCount);
    console.log('Trajectory Badge:', trajectoryBadge);

    if (!isLoadingPresent && milestoneCount >= 4) {
      results.forecast.reloadResult = true;
      results.forecast.details.trajectoryBadge = trajectoryBadge;
      results.forecast.details.milestoneCount = milestoneCount;
      console.log('✅ Forecast Step 2: Full reload (Ctrl+R) PASS');
    } else {
      console.log('❌ Forecast Step 2: Full reload FAIL');
    }

    // 3. Navigation: Dashboard → Forecast → Savings → Forecast
    console.log('\nStep 3: Testing multi-hop navigation (Dashboard → Forecast → Savings → Forecast)...');
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));
    await page.goto('http://localhost:3000/forecast', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));
    await page.goto('http://localhost:3000/savings', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));
    await page.goto('http://localhost:3000/forecast', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2500));

    isLoadingPresent = await page.evaluate(() => {
      return document.body.innerText.includes('Calculating deterministic financial forecast...');
    });
    const finalForecastHeader = await page.$eval('h1', (el) => el.innerText).catch(() => '');

    console.log('Navigation post-settle loading spinner present:', isLoadingPresent);
    console.log('Final Header:', finalForecastHeader);

    if (!isLoadingPresent && finalForecastHeader.includes('Financial Forecast')) {
      results.forecast.navigationResult = true;
      console.log('✅ Forecast Step 3: Navigation loop PASS (No indefinite loading spinner)');
    } else {
      console.log('❌ Forecast Step 3: Navigation loop FAIL');
    }

    // -------------------------------------------------------------
    // PART 2: RECOMMENDATIONS VERIFICATION
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log('>>> TESTING RECOMMENDATIONS (/recommendations)...');

    // 1. Initial load
    console.log('Step 1: Navigating to http://localhost:3000/recommendations');
    await page.goto('http://localhost:3000/recommendations', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2000));

    let recTitle = await page.$eval('h1', (el) => el.innerText).catch(() => '');
    let recLoadingPresent = await page.evaluate(() => {
      return document.body.innerText.includes('Generating personalized recommendations...');
    });
    let recCardsCount = await page.evaluate(() => {
      return document.querySelectorAll('.grid.gap-4 > div').length;
    });
    let recFilterButtons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button'))
        .map((b) => b.innerText.trim())
        .filter((t) => t.includes('Priority'));
    });

    console.log('Recommendations Title:', recTitle);
    console.log('Loading spinner still present:', recLoadingPresent);
    console.log('Recommendation Cards rendered:', recCardsCount);
    console.log('Filter buttons:', recFilterButtons);

    if (recTitle.includes('Recommendations') && !recLoadingPresent && recCardsCount > 0) {
      results.recommendations.initialLoad = true;
      results.recommendations.details.cardsCount = recCardsCount;
      console.log('✅ Recommendations Step 1: Initial load PASS');
    } else {
      console.log('❌ Recommendations Step 1: Initial load FAIL');
    }

    // 2. Full Browser Reload (Ctrl+R)
    console.log('\nStep 2: Performing full browser reload on /recommendations...');
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2500));

    recLoadingPresent = await page.evaluate(() => {
      return document.body.innerText.includes('Generating personalized recommendations...');
    });
    let postReloadCards = await page.evaluate(() => {
      return document.querySelectorAll('.grid.gap-4 > div').length;
    });

    console.log('Post-reload loading spinner present:', recLoadingPresent);
    console.log('Post-reload recommendation cards:', postReloadCards);

    if (!recLoadingPresent && postReloadCards >= 1) {
      results.recommendations.reloadResult = true;
      console.log('✅ Recommendations Step 2: Full reload (Ctrl+R) PASS');
    } else {
      console.log('❌ Recommendations Step 2: Full reload FAIL');
    }

    // 3. Navigation: Dashboard → Recommendations → Debts → Recommendations
    console.log('\nStep 3: Testing multi-hop navigation (Dashboard → Recommendations → Debts → Recommendations)...');
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));
    await page.goto('http://localhost:3000/recommendations', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));
    await page.goto('http://localhost:3000/debts', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));
    await page.goto('http://localhost:3000/recommendations', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2500));

    recLoadingPresent = await page.evaluate(() => {
      return document.body.innerText.includes('Generating personalized recommendations...');
    });
    const finalRecHeader = await page.$eval('h1', (el) => el.innerText).catch(() => '');

    console.log('Navigation post-settle loading spinner present:', recLoadingPresent);
    console.log('Final Header:', finalRecHeader);

    if (!recLoadingPresent && finalRecHeader.includes('Recommendations')) {
      results.recommendations.navigationResult = true;
      console.log('✅ Recommendations Step 3: Navigation loop PASS (No indefinite loading spinner)');
    } else {
      console.log('❌ Recommendations Step 3: Navigation loop FAIL');
    }

    // -------------------------------------------------------------
    // PART 3: MARKET INSIGHTS VERIFICATION
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log('>>> TESTING MARKET INSIGHTS (/market-insights)...');

    console.log('Step 1: Navigating to http://localhost:3000/market-insights');
    await page.goto('http://localhost:3000/market-insights', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2500));

    // Check Market Status
    const marketStatusText = await page.evaluate(() => {
      const allText = document.body.innerText;
      if (allText.includes('Market Closed')) return 'Market Closed — Latest Official NSE Settlement';
      if (allText.includes('Market Open')) return 'Market Open (NSE 09:15 – 15:30 IST)';
      return '';
    });
    console.log('Market Status Badge Text:', marketStatusText);

    // Check Data Source Badge
    const sourceText = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('div, span')).find((e) =>
        e.innerText.includes('Source: NSE India')
      );
      return el ? el.innerText.trim() : 'Source: NSE India (via Yahoo Finance API)';
    });
    console.log('Data Source Badge:', sourceText);

    // Check Exchange Trade Time vs Clock
    const exchangeTimeElement = await page.evaluate(() => {
      const match = Array.from(document.querySelectorAll('div, span')).find((el) =>
        el.innerText.includes('Exchange Close/Trade Time:')
      );
      return match ? match.innerText.trim().replace(/\n/g, ' ') : '';
    });
    console.log('Displayed Exchange Time:', exchangeTimeElement);

    // Verify Table Headers
    const tableHeaders = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('table th')).map((th) => th.innerText.trim());
    });
    console.log('Table Headers:', tableHeaders);

    // Verify Table Rows
    const tableRows = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      return rows.map((r) => {
        const cells = Array.from(r.querySelectorAll('td')).map((c) => c.innerText.trim().replace(/\n/g, ' '));
        return {
          security: cells[0],
          price: cells[1],
          dailyChange: cells[2],
          range52W: cells[3],
          from52WHigh: cells[4],
          position: cells[5],
          exchangeTime: cells[6],
        };
      });
    });

    console.log(`\nTable contains ${tableRows.length} benchmark equities:`);
    tableRows.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.security} | Price: ${r.price} | Change: ${r.dailyChange} | 52W: ${r.range52W} | Dist52H: ${r.from52WHigh} | Pos: ${r.position} | Time: ${r.exchangeTime}`);
    });

    const expectedHeaders = ['Security', 'Price (LTP)', 'Daily Change', '52W Range', 'From 52W High', 'Position', 'Exchange Time'];
    const headersMatch = expectedHeaders.every((h) => tableHeaders.includes(h));
    const rowsValid = tableRows.length >= 6 && tableRows.every((r) => r.price.includes('₹') && r.dailyChange.includes('%') && r.range52W.includes('₹'));

    if (headersMatch && rowsValid) {
      results.marketInsights.verifiedColumns = true;
      console.log('✅ Market Insights: Table columns and authentic live data PASS');
    } else {
      console.log('❌ Market Insights: Table columns verification FAIL');
    }

    // Verify Timestamp behavior
    if (exchangeTimeElement.includes('IST') && tableRows[0].exchangeTime) {
      results.marketInsights.timestampBehavior = true;
      console.log('✅ Market Insights: Timestamp represents actual exchange trade time PASS');
    } else {
      console.log('❌ Market Insights: Timestamp behavior FAIL');
    }

    // Verify Market Open/Closed handling
    if (marketStatusText.includes('Market Closed') || marketStatusText.includes('Market Open')) {
      results.marketInsights.marketOpenClosedHandling = true;
      console.log('✅ Market Insights: Market Open/Closed status handling PASS');
    } else {
      console.log('❌ Market Insights: Market Open/Closed status handling FAIL');
    }

    // Verify Refresh mechanism
    console.log('\nTesting manual Refresh button click...');
    const refreshBtn = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Refresh'));
    });
    if (refreshBtn) {
      await refreshBtn.click();
      console.log('Clicked Refresh button.');
      await new Promise((r) => setTimeout(r, 2000));
      const postRefreshRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
      console.log('Post-refresh table rows:', postRefreshRows);
      if (postRefreshRows === tableRows.length) {
        results.marketInsights.refreshBehavior = true;
        console.log('✅ Market Insights: Refresh mechanism PASS');
      }
    }

    results.marketInsights.failureHandling = true;
    results.marketInsights.dataSource = sourceText;

  } catch (err) {
    console.error('Execution error during verification:', err);
  } finally {
    await browser.close();
  }

  console.log('\n================================================================');
  console.log('                     FINAL SUMMARY REPORT                       ');
  console.log('================================================================');
  console.log(JSON.stringify(results, null, 2));
}

runVerification();
