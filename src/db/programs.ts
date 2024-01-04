import { asyncQuery } from '../utils/db';
import { Connection, QueryResults } from 'mysql';

/**
 * Get Active Profile Scrape Programs for apify client
 */
export async function findProgramIdsByActvProfileScrape(
  dbConnection: Connection
): Promise<string[] | null> {
  const query = `
    SELECT
      id
    FROM
      programs
    WHERE
      actv_profile_scrape_instagram = 1
  ;`;
  let result;
  try {
    result = await asyncQuery(dbConnection, query, []);
    if (
      result !== null &&
      typeof result[0] !== 'undefined' &&
      result.length > 0
    ) {
      // 配列で返す
      result = result.map(r => r.id);
    }
  } catch (e) {
    console.error(e);
    return null;
  }
  return result;
}

/**
 * Get Active Post Scrape Programs for apify client
 */
export async function findProgramIdsByActvPostScrape(
  dbConnection: Connection
): Promise<string[] | null> {
  const query = `
    SELECT
      id
    FROM
      programs
    WHERE
      actv_post_scrape_instagram = 1
    ;`;
  let result;
  try {
    result = await asyncQuery(dbConnection, query, []);
    if (
      result !== null &&
      typeof result[0] !== 'undefined' &&
      result.length > 0
    ) {
      // 配列で返す
      result = result.map(r => r.id);
    }
  } catch (e) {
    console.error(e);
    return null;
  }
  return result;
}
