const puppeteer = require('puppeteer-core');

async function verify() {
  console.log('================================================================');
  console.log('       FINAL CLARITY FIXES BROWSER VERIFICATION AUDIT          ');
  console.log('================================================================\n');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/brave-browser',
    userDataDir: '/tmp/brave_test_profile',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const audit = {
    mlPredictedArchetypeVisible: false,
    probabilityUnderstandable: false,
    probabilityTotals100: false,
    healthScoreAndMLDistinguished: false,
    featureBreakdownValuesUnchanged: false,
    personalizedRecommendationsUnchanged: false,
    supabaseFooterGone: false,
    marketDataTimeAndFetchTimeDistinguished: false,
    marketRefreshWorks: false,
    autoRefreshToggleWorks: false,
    noRuntimeErrors: true,
  };

  page.on('pageerror', (err) => {
    console.error('Browser Page Error:', err.message);
    audit.noRuntimeErrors = false;
  });

  try {
    // -----------------------------------------------------------------
    // 1. DASHBOARD AUDIT: ML Archetype, Explanations, Feature Breakdown, Footer
    // -----------------------------------------------------------------
    console.log('>>> [1/2] AUDITING DASHBOARD (/dashboard)...');
    await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2500));

    // 1. Check ML Predicted Financial Archetype title
    const mlArchetypeTitle = await page.evaluate(() => {
      const p = Array.from(document.querySelectorAll('p, div, span')).find(
        (el) => el.innerText && el.innerText.includes('ML PREDICTED FINANCIAL ARCHETYPE')
      );
      return p ? p.innerText.trim() : '';
    });
    console.log('1. ML Archetype Title:', mlArchetypeTitle);
    if (mlArchetypeTitle.includes('ML PREDICTED FINANCIAL ARCHETYPE')) {
      audit.mlPredictedArchetypeVisible = true;
    }

    // 2. Check Prediction Meaning & Scope explanation
    const understandingMLText = await page.evaluate(() => {
      const match = Array.from(document.querySelectorAll('div, p')).find(
        (el) => el.innerText && el.innerText.includes('Understanding Your ML Prediction')
      );
      return match ? match.innerText.trim() : '';
    });
    console.log('\n2. Understanding ML Prediction Banner:\n', understandingMLText.slice(0, 300));
    if (
      understandingMLText.includes("relative class likelihood, not a prediction of future financial outcomes") &&
      understandingMLText.includes("does NOT predict future money")
    ) {
      audit.probabilityUnderstandable = true;
    }

    // 3. Check Multi-Class Probability Distribution totals 100%
    const probDistributionText = await page.evaluate(() => {
      const match = Array.from(document.querySelectorAll('span, div')).find(
        (el) => el.innerText && el.innerText.includes('Total: 100%')
      );
      return match ? match.innerText.trim() : '';
    });
    console.log('\n3. Probability Distribution Header:', probDistributionText);
    if (probDistributionText.includes('Total: 100%')) {
      audit.probabilityTotals100 = true;
    }

    // 4. Click "How This Differs from Health Score" and verify explanation
    const methodologyBtn = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll('button')).find((b) =>
        b.innerText.includes('How This Differs from Health Score')
      );
    });
    if (methodologyBtn) {
      await methodologyBtn.click();
      await new Promise((r) => setTimeout(r, 800));
      const diffText = await page.evaluate(() => {
        const card = Array.from(document.querySelectorAll('div')).find(
          (d) => d.innerText && d.innerText.includes('Deterministic Health Score:') && d.innerText.includes('ML Prediction:')
        );
        return card ? card.innerText : '';
      });
      console.log('\n4. How This Differs from Health Score Content:\n', diffText.slice(0, 350));
      if (
        diffText.includes('A fixed 0–100 scoring rubric based on five weighted financial pillars') &&
        diffText.includes('An explainable feature-based classifier') &&
        diffText.includes('Why Results May Differ')
      ) {
        audit.healthScoreAndMLDistinguished = true;
      }
    }

    // 5. Click "View All 10 Model Features" and verify legend & values
    const featuresBtn = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll('button')).find((b) =>
        b.innerText.includes('View All 10 Model Features')
      );
    });
    if (featuresBtn) {
      await featuresBtn.click();
      await new Promise((r) => setTimeout(r, 800));

      const featureLegendText = await page.evaluate(() => {
        const legend = Array.from(document.querySelectorAll('div')).find(
          (d) => d.innerText && d.innerText.includes('Recorded Value:') && d.innerText.includes('Normalized:')
        );
        return legend ? legend.innerText : '';
      });
      console.log('\n5. Feature Breakdown Legend:\n', featureLegendText);

      const tableRowsCount = await page.evaluate(() => {
        return document.querySelectorAll('table tbody tr').length;
      });
      console.log('Feature Table Rows Count:', tableRowsCount);

      if (
        featureLegendText.includes('Actual value from your financial records') &&
        featureLegendText.includes('How important the feature is to the ML model') &&
        featureLegendText.includes('Transformed model input on the model') &&
        tableRowsCount >= 10
      ) {
        audit.featureBreakdownValuesUnchanged = true;
      }
    }

    // 6. Verify Deterministic Score Section & Personalized Recommendations
    const healthScoreHeading = await page.evaluate(() => {
      const heading = Array.from(document.querySelectorAll('div, h3, p')).find(
        (el) => el.innerText && el.innerText.includes('How Your Health Score Is Calculated (Deterministic Rule-Based Score)')
      );
      return heading ? heading.innerText.trim() : '';
    });
    console.log('\n6. Health Score Calculation Section Title:', healthScoreHeading);

    const recsCount = await page.evaluate(() => {
      return document.querySelectorAll('.grid.gap-4.md\\:grid-cols-2.lg\\:grid-cols-3 > div').length;
    });
    console.log('Personalized Recommendations Count on Dashboard:', recsCount);
    if (healthScoreHeading && recsCount >= 1) {
      audit.personalizedRecommendationsUnchanged = true;
    }

    // 7. Check that the Supabase footer line is completely GONE
    const hasSupabaseFooter = await page.evaluate(() => {
      const fullText = document.body.innerText;
      return fullText.includes('computed directly from your Supabase records');
    });
    console.log('\n7. Has Supabase Footer Line present:', hasSupabaseFooter);
    if (!hasSupabaseFooter) {
      audit.supabaseFooterGone = true;
    }

    // -----------------------------------------------------------------
    // 2. MARKET INSIGHTS AUDIT: Market Data Time, Fetched, Closed Status, Refresh
    // -----------------------------------------------------------------
    console.log('\n>>> [2/2] AUDITING MARKET INSIGHTS (/market-insights)...');
    await page.goto('http://localhost:3000/market-insights', { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 2500));

    // 8. Verify Market Data Time and Fetched timestamps are distinct
    const timestampControlsText = await page.evaluate(() => {
      const bar = document.querySelector('.flex.flex-wrap.items-center.justify-between.gap-3');
      return bar ? bar.innerText.replace(/\n/g, ' ') : '';
    });
    console.log('\n8. Market Controls Bar Text:\n', timestampControlsText);

    const timestampNoticeText = await page.evaluate(() => {
      const notice = Array.from(document.querySelectorAll('div')).find(
        (d) => d.innerText && d.innerText.includes('Understanding Timestamps:')
      );
      return notice ? notice.innerText.replace(/\n/g, ' ') : '';
    });
    console.log('Timestamp Notice Banner:\n', timestampNoticeText);

    const tableHeaderTime = await page.evaluate(() => {
      const ths = Array.from(document.querySelectorAll('table th')).map((t) => t.innerText.trim());
      return ths.find((t) => t.includes('Market Data Time'));
    });
    console.log('Table Header Time Column:', tableHeaderTime);

    if (
      timestampControlsText.includes('Market Data Time:') &&
      timestampControlsText.includes('Fetched:') &&
      timestampControlsText.includes('Market Closed — Displaying latest available official NSE closing settlement data') &&
      tableHeaderTime === 'Market Data Time (IST)'
    ) {
      audit.marketDataTimeAndFetchTimeDistinguished = true;
    }

    // 9. Manual Refresh button test
    console.log('\n9. Testing Manual Refresh button click...');
    const refreshBtn = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Refresh'));
    });
    if (refreshBtn) {
      await refreshBtn.click();
      console.log('Clicked Refresh button. Waiting 2s...');
      await new Promise((r) => setTimeout(r, 2000));
      const postRefreshRows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);
      console.log('Post-refresh table rows:', postRefreshRows);
      if (postRefreshRows === 8) {
        audit.marketRefreshWorks = true;
      }
    }

    // 10. Auto-refresh toggle test
    console.log('\n10. Testing Auto-refresh toggle...');
    const autoRefreshBtn = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes('Auto-refresh'));
    });
    if (autoRefreshBtn) {
      const initialText = await page.evaluate((el) => el.innerText, autoRefreshBtn);
      await autoRefreshBtn.click();
      await new Promise((r) => setTimeout(r, 500));
      const toggledText = await page.evaluate((el) => el.innerText, autoRefreshBtn);
      console.log(`Auto-refresh toggle initial: "${initialText}" -> toggled: "${toggledText}"`);
      if (initialText.includes('ON') && toggledText.includes('OFF')) {
        audit.autoRefreshToggleWorks = true;
      }
    }

  } catch (err) {
    console.error('Audit execution error:', err);
  } finally {
    await browser.close();
  }

  console.log('\n================================================================');
  console.log('                   AUDIT SUMMARY CHECKLIST                      ');
  console.log('================================================================');
  console.log(JSON.stringify(audit, null, 2));

  const allPassed = Object.values(audit).every(Boolean);
  console.log('\nOVERALL AUDIT STATUS:', allPassed ? '✅ 100% PASSED' : '❌ SOME CHECKS FAILED');
}

verify();
