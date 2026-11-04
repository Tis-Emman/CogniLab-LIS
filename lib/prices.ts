import { supabase } from './supabaseClient';
import { TEST_PRICING } from './mockData';

export interface TestPrice {
  section: string;
  test_name: string;
  price: number;
  updated_by?: string | null;
  updated_at?: string | null;
}

const key = (section: string, test: string) => `${section.toUpperCase()}::${test.trim().toLowerCase()}`;

/** Built-in default price for a test (used until the admin sets one). */
export const defaultPrice = (section: string, testName: string): number | null => {
  const sec = (TEST_PRICING as Record<string, Record<string, number>>)[section] || {};
  const hit = Object.entries(sec).find(([name]) => name.trim().toLowerCase() === testName.trim().toLowerCase());
  return hit ? hit[1] : null;
};

/** Prices saved by the admin (migration 011). Empty if the table doesn't exist yet. */
export const fetchTestPrices = async (): Promise<TestPrice[]> => {
  const { data, error } = await supabase.from('test_prices').select('*');
  if (error) {
    console.warn('[test_prices] not available:', error.message);
    return [];
  }
  return (data as TestPrice[]) || [];
};

/** Effective price: admin price, else built-in default, else null (not priced). */
export const buildPriceLookup = (saved: TestPrice[]) => {
  const map = new Map(saved.map((p) => [key(p.section, p.test_name), Number(p.price)]));
  return (section: string, testName: string): number | null =>
    map.get(key(section, testName)) ?? defaultPrice(section, testName);
};

export const saveTestPrice = async (section: string, testName: string, price: number, updatedBy?: string) => {
  const { error } = await supabase.from('test_prices').upsert(
    [{ section, test_name: testName, price, updated_by: updatedBy ?? null, updated_at: new Date().toISOString() }],
    { onConflict: 'section,test_name' },
  );
  if (error) throw new Error(error.message);
};

/** Resolves prices for a list of requested tests; lists the ones without a price. */
export const priceRequestedTests = async (tests: { section: string; test_name: string }[]) => {
  const lookup = buildPriceLookup(await fetchTestPrices());
  const priced = tests.map((t) => ({ ...t, price: lookup(t.section, t.test_name) }));
  const missing = priced.filter((t) => t.price === null).map((t) => t.test_name);
  return { priced, missing };
};
