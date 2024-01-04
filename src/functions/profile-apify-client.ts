// @flow
import { Context, Callback } from 'aws-lambda';
import ApifyClient from 'apify-client';
import moment from 'moment-timezone';
import { Connection } from 'mysql';
import { findProgramIdsByActvProfileScrape } from '../db/programs';
import {
  findUsernames,
  findUsernamesByParams,
  countUsernames
} from '../db/ig-users-stats';
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
  PROFILE_SCRAPER_ID,
  SLACK_CHANNEL,
  SLACK_WEBHOOK
} = process.env;

/**
 * This handler fetches a post list from RDS and calls an Apify scraper with the list as options.
 * For running specific programs (all keys, except programId are optionals):
 * sls invoke -s prod -f profile-apify-client --data '{"queryStringParameters": {"programIds": [100000001], "start": "2020-07-01", "end": "2020-07-30", "limit": 50, "offset": 0}}'
 */
export const handler = async (
  event: any = {},
  context: Context,
  callback: Callback
): Promise<any> => {
  let _dbConnection: Connection | null = null;

  const slackUsername: string = `[ ${ENV_NAME} - profile-apify-client ]`;

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

    // randomize the list to be sent between 35 and 60 simulate non-programmatic access by users.
    const random: number = Math.floor(Math.random() * (100 - 80) + 80);

    // programs to be scraped
    let programIds: string[] | null;
    let usernames: string[] | null;

    // Array of programs
    if (typeof event.queryStringParameters === 'undefined') {
      programIds = await findProgramIdsByActvProfileScrape(dbConnection);
      usernames = await findUsernames(dbConnection, programIds, random);
      // By program id
    } else {
      programIds = event.queryStringParameters.programIds;
      usernames = await findUsernamesByParams(
        dbConnection,
        programIds,
        start,
        end,
        limit,
        offset
      );
    }

    console.info(usernames);

    // optional param for slack notification when program id is specified
    let programIdsArg;

    // optional param for slack notification >> total of posts to be scraped
    let count = await countUsernames(dbConnection, programIds, start, end);

    if (programIds.length === 1) {
      programIdsArg = programIds[0];
    } else {
      programIdsArg = null;
    }

    if (0 < usernames.length) {
      try {
        await postToSlack({
          username: slackUsername,
          text: slackMessage(
            usernames,
            count,
            programIdsArg,
            PROFILE_SCRAPER_ID
          ),
          icon_emoji: ':postbox:'
        });

        await apifyClient.tasks.runTask({
          taskId: PROFILE_SCRAPER_ID,
          token: APIFY_TOKEN,
          input: {
            search: 'Nature',
            searchType: 'user',
            directUrls: [...usernames],
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
          text: slackError(PROFILE_SCRAPER_ID, error),
          icon_emoji: ':fire_engine:'
        });
      }
    } else {
      await postToSlack({
        username: slackUsername,
        text: slackDone(usernames),
        icon_emoji: ':checkered_flag:'
      });
    }
  } catch (err) {
    console.error('Unhandled Error: ', err.name, err.message, err.stack);

    await postToSlack({
      username: slackUsername,
      text: slackCatch(PROFILE_SCRAPER_ID, err),
      icon_emoji: ':fire_engine:'
    });

    return callback(err);
  } finally {
    if (_dbConnection !== null) {
      await closeDbConnection(_dbConnection);
    }
  }
};
