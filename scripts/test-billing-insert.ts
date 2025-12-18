import { logTokenUsage } from '../lib/adk/billing';
import { ensureUserOrg } from '../lib/db/utils';

async function main() {
  const email = 'nickarinard@gmail.com';
  
  try {
    console.log(`Ensuring org for ${email}...`);
    const org = await ensureUserOrg(email);
    console.log('Org:', org);

    console.log('Logging test usage...');
    await logTokenUsage(
      org.id,
      email,
      { tokens: 500, promptTokens: 400, completionTokens: 100, cost: 0.00005, model: 'test-model' },
      'test_agent'
    );

    console.log('Done. Check billing page.');
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
