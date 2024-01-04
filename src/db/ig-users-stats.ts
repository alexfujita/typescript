import { asyncQuery } from '../utils/db';
import { Connection, QueryResults } from 'mysql';

export async function findUsernames(
  dbConnection: Connection,
  programIds: string[] | null,
  limit: number
): Promise<string[] | null> {
  const query = `
    SELECT
      distinct(username)
    FROM
      instagram_users as i
    INNER JOIN
      users as u
    ON
      i.ig_uid = u.ig_uid
    WHERE
      u.pid IN (?)
    AND
      (is_private IS NULL OR is_private IS FALSE)
    AND
      username IS NOT NULL
    AND
      LENGTH(i.ig_uid) > 15
    AND
      DATE(i.created) BETWEEN DATE_SUB(LAST_DAY(NOW()), INTERVAL DAY(LAST_DAY(NOW())) - 1 DAY) AND CURRENT_DATE()  
    AND
      (last_scraped IS NULL OR last_scraped <=  LAST_DAY(CURDATE() - INTERVAL 1 MONTH))
    LIMIT ?;
  `;

  const inserts = [programIds, limit];
  let result;
  try {
    result = await asyncQuery(dbConnection, query, inserts);
    if (
      result !== null &&
      typeof result[0] !== 'undefined' &&
      result.length > 0
    ) {
      // Convert array of objects to array of username urls
      result = result.map((r) => `https://www.instagram.com/${r.username}/`);
    }
  } catch (e) {
    console.error(e);
    return null;
  }
  return result;
}

/**
 *
 * @param dbConnection
 * @param programIds
 * @param limit
 * Return >> Array of usernames for scraping
 */
export async function findUsernamesByParams(
  dbConnection: Connection,
  programIds: string[] | null,
  start: string,
  end: string,
  limit: number,
  offset: number
): Promise<string[] | null> {
  const wherecreated = await whereCreated(start, end);
  const wherelimit = await whereLimit(limit);
  const whereoffset = await whereOffset(offset);
  const query = `
    SELECT
      distinct(username)
    FROM
      instagram_users as i
    INNER JOIN
      users as u
    ON
      i.ig_uid = u.ig_uid
    WHERE
      u.pid IN (?)
    AND
      username IS NOT NULL
    AND
      (is_private IS NULL OR is_private IS FALSE)  
    AND
      LENGTH(i.ig_uid) > 15
    AND
      (last_scraped IS NULL OR last_scraped <=  LAST_DAY(CURDATE() - INTERVAL 1 MONTH))  
    ${wherecreated}
    ${wherelimit}
    ${whereoffset}
  ;`;

  const inserts = [programIds, limit];

  console.info(query);
  let result;
  try {
    result = await asyncQuery(dbConnection, query, inserts);
    if (
      result !== null &&
      typeof result[0] !== 'undefined' &&
      result.length > 0
    ) {
      // Convert array of objects to array of username urls
      result = result.map((r) => `https://www.instagram.com/${r.username}/`);
    }
  } catch (e) {
    console.error(e);
    return null;
  }
  return result;
}

/**
 *
 * @param dbConnection
 * @param programIds array
 * return >> number of total usernames to be scraped
 */
export async function countUsernames(
  dbConnection: Connection,
  programIds: string[] | null,
  start: string,
  end: string
): Promise<number> {
  const wherecreated = await whereCreated(start, end);
  const query = `
    SELECT sum(username_count) sum
    FROM (
      SELECT
        count(distinct(username)) as username_count
      FROM
        instagram_users as i
      INNER JOIN
        users as u
      ON
        i.ig_uid = u.ig_uid
      WHERE
        u.pid IN (?)
      AND
        username IS NOT NULL
      AND
        (is_private IS FALSE OR is_private IS NULL) 
      AND
        LENGTH(i.ig_uid) > 15
      AND
        (last_scraped IS NULL OR last_scraped <=  LAST_DAY(CURDATE() - INTERVAL 1 MONTH))
      ${wherecreated}
    ) u
  `;

  const inserts = [programIds];
  let result;
  try {
    result = await asyncQuery(dbConnection, query, inserts);
    if (
      result !== null &&
      typeof result[0] !== 'undefined' &&
      result.length > 0
    ) {
      return parseInt(result[0].sum);
    }
  } catch (e) {
    console.error(e);
    return null;
  }
}

/**
 *
 * @param dbConnection
 * @param username string
 * return >> true if scrape error code = null, false if != null
 */
export async function isScrapeErrorCodeNull(
  dbConnection: Connection,
  username: string
): Promise<boolean | null> {
  const query = `
    SELECT
      scrape_error_code
    FROM
      instagram_users
    WHERE
      username = ?
  `;

  const inserts = [username];
  let result;
  try {
    result = await asyncQuery(dbConnection, query, inserts);
    if (
      result !== null &&
      typeof result[0] !== 'undefined' &&
      result.length > 0 &&
      result[0]['scrape_error_code'] === null
    ) {
      return true;
    } else {
      return false;
    }
  } catch (e) {
    console.error(e);
    return null;
  }
}

/**
 *
 * @param start string date
 * @param end string date
 */
async function whereCreated(
  start: string | undefined,
  end: string | undefined
) {
  // define created condition
  let whereCreated = '';
  if (start !== undefined && end !== undefined) {
    whereCreated = `AND DATE(i.created) BETWEEN '${start}' AND '${end}'`;
  } else {
    // CURRENT MONTH BASE
    whereCreated =
      'AND DATE(i.created) BETWEEN DATE_SUB(LAST_DAY(NOW()), INTERVAL DAY(LAST_DAY(NOW())) - 1 DAY) AND CURRENT_DATE()';
  }
  return whereCreated;
}

/**
 *
 * @param limit number
 */
async function whereLimit(limit: number | undefined) {
  let whereLimit = '';
  if (limit !== undefined) {
    whereLimit = `LIMIT ${limit}`;
  }
  return whereLimit;
}

/**
 *
 * @param offset number
 */
async function whereOffset(offset: number | undefined) {
  let whereOffset = '';
  if (offset !== undefined) {
    whereOffset = `OFFSET ${offset}`;
  }
  return whereOffset;
}
