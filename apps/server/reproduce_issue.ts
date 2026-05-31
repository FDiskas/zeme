import { buildComprehensiveReport } from './src/services/report-service';
import { renderReportPdf } from './src/services/pdf';

async function run() {
  const cadastralRegNo = '4400/0001:0007';
  console.log(`Starting reproduction for cadastralRegNo: ${cadastralRegNo}`);
  
  try {
    console.log('Step 1: buildComprehensiveReport');
    // The grep showed it might take 2 arguments: cadastralRegNo and optionally address
    const reportDataValue = await buildComprehensiveReport(cadastralRegNo, "Fake Address");
    console.log('buildComprehensiveReport success');

    if (process.env.DISABLE_PDF !== 'true') {
      console.log('Step 2: renderReportPdf');
      const pdf = await renderReportPdf(reportDataValue);
      console.log('renderReportPdf success', pdf ? "PDF generated" : "No PDF");
    } else {
      console.log('Step 2: Skipped (DISABLE_PDF=true)');
    }
  } catch (error) {
    console.error('Error caught:');
    console.error(error);
    if (error instanceof Error) {
      console.error('Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

run();
