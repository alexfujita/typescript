// @flow
import { Context, Callback } from 'aws-lambda';
import ApifyClient from 'apify-client';
import moment from 'moment-timezone';
import { Connection } from 'mysql';
import {
  findProgramIdsByActvPostScrape,
  findProgramIdsByActvProfileScrape
} from '../db/programs';
import {
  findPostUrls,
  findPostUrlsByParams,
  countPostUrls
} from '../db/kns-filtered-instagram-posts';
import {
  postToSlack,
  slackMessage,
  slackError,
  slackDone,
  slackCatch
} from '../utils/slack';

import {
  establishDbConnection,
  closeDbConnection,
  asyncQuery
} from '../utils/db';

const {
  APIFY_ID,
  APIFY_TOKEN,
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_DATABASE,
  ENV_NAME,
  PROXY_URL,
  POST_SCRAPER_ID,
  SLACK_CHANNEL,
  SLACK_WEBHOOK
} = process.env;

/**
 *
 * @param event
 * @param context
 * @param callback
 * This handler fetches a post list from RDS and calls an Apify scraper with the list as options.
 * For running specific programs (all keys, except programId are optionals):
 * sls invoke -s prod -f post-apify-client --data '{"queryStringParameters": {"programIds": [100000001], "start": "2020-07-01", "end": "2020-07-30", "limit": 50}}
 * sls invoke -s prod -f post-apify-client --path file.json
 */

export const handler = async (
  event: any = {},
  context: Context,
  callback: Callback
): Promise<any> => {
  let _dbConnection: Connection | null = null;

  const slackUsername: string = `[ ${ENV_NAME} - post-apify-client ]`;

  let start;
  let end;
  let limit;
  let offset;
  if (typeof event.queryStringParameters !== 'undefined') {
    start = event.queryStringParameters.start;
    end = event.queryStringParameters.end;
    limit = event.queryStringParameters.limit;
    offset = event.queryStringParameters.offset;
  }

  try {
    const dbConnection: Connection = await establishDbConnection(
      DB_HOST,
      DB_USER,
      DB_PASSWORD,
      DB_DATABASE
    );

    // finallyで参照するために変数に格納しておく
    _dbConnection = dbConnection;

    const apifyClient = new ApifyClient({
      userID: APIFY_ID,
      token: APIFY_TOKEN
    });

    // programs to be scraped
    let programIds;
    let urls;
    // randomize the list to be sent between 50 and 80 simulate non-programmatic access by users.
    const random: number = Math.floor(Math.random() * (300 - 250) + 250);

    // Array of programs
    if (typeof event.queryStringParameters === 'undefined') {
      programIds = await findProgramIdsByActvPostScrape(dbConnection);
      urls = await findPostUrls(dbConnection, programIds, random);
      // By program id
    } else {
      programIds = event.queryStringParameters.programIds;
      urls = await findPostUrlsByParams(
        dbConnection,
        programIds,
        start,
        end,
        limit,
        offset
      );
    }

    // posts to be scraped
    console.info(JSON.stringify(urls));

    // optional param for slack notification when program id is specified
    let programIdsArg;

    // optional param for slack notification >> total of posts to be scraped
    let count = null;

    if (programIds.length === 1) {
      programIdsArg = programIds[0];
    } else {
      programIdsArg = null;
    }

    count = await countPostUrls(dbConnection, programIds, start, end);

    if (0 < urls.length) {
      try {
        await postToSlack({
          username: slackUsername,
          text: slackMessage(urls, count, programIdsArg, POST_SCRAPER_ID),
          icon_emoji: ':postbox:'
        });

        await apifyClient.tasks.runTask({
          taskId: POST_SCRAPER_ID,
          token: APIFY_TOKEN,
          input: {
            search: 'Nature',
            searchType: 'user',
            directUrls: [...urls],
            resultsType: 'details',
            proxy: {
              useApifyProxy: false,
              proxyUrls: [PROXY_URL],
              proxyUrl: PROXY_URL
            },
            expandOwners: false,
            extendOutputFunction: '($) => { return {} }'
          }
        });
      } catch (error) {
        console.error('Could not send task to Apify: ', error);
        await postToSlack({
          username: slackUsername,
          text: slackError(POST_SCRAPER_ID, error),
          icon_emoji: ':fire_engine:'
        });
      }
    } else {
      await postToSlack({
        username: slackUsername,
        text: slackDone(urls),
        icon_emoji: ':checkered_flag:'
      });
    }
  } catch (err) {
    console.error(err);
    await postToSlack({
      username: slackUsername,
      text: slackCatch(POST_SCRAPER_ID, err),
      icon_emoji: ':fire_engine:'
    });

    return callback(err);
  } finally {
    if (_dbConnection !== null) {
      await closeDbConnection(_dbConnection);
    }
  }
};
