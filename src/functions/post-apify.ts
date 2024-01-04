import { Connection } from 'mysql';
import { Context, Callback } from 'aws-lambda';
import { establishDbConnection, closeDbConnection } from '../utils/db';
import { updateKnsFilteredInstagramPost } from '../db/update';
import S3 from 'aws-sdk/clients/s3';
import moment from 'moment-timezone';
import { postToSlack, slackError, slackCatch } from '../utils/slack';

const s3 = new S3();

export const handler = async (
  event: any = {},
  context: Context,
  callback: Callback
): Promise<any> => {
  // finallyで参照するために大きいスコープでConnectionを保持するための変数
  let _dbConnection: Connection | null = null;

  const {
    ENV_NAME,
    DB_HOST,
    DB_USER,
    DB_PASSWORD,
    DB_DATABASE,
    POST_SCRAPER_ID
  } = process.env;

  const slackUsername: string = `[ ${ENV_NAME} - post-apify ]`;

  try {
    // establish db connection
    const dbConnection: Connection = await establishDbConnection(
      DB_HOST,
      DB_USER,
      DB_PASSWORD,
      DB_DATABASE
    );

    // finallyで参照するために変数に格納しておく
    _dbConnection = dbConnection;

    const srcBucket = event.Records[0].s3.bucket.name;
    const srcKey = decodeURIComponent(
      event.Records[0].s3.object.key.replace(/\+/g, ' ')
    );

    let params;
    let response;
    try {
      params = {
        Bucket: srcBucket,
        Key: srcKey
      };
      response = await s3.getObject(params).promise();
    } catch (error) {
      console.error(error);
      return;
    }

    const records = JSON.parse(response.Body.toString('utf-8'));

    try {
      if (0 < records.length) {
        let affectedRows = [];
        let changedRows = [];
        for (const record of records) {
          const {
            url,
            commentsCount,
            likesCount,
            locationId,
            locationName
          } = record;
          const post: any = {};
          post['post_url'] = `${url}/`;
          post['comment_count'] = commentsCount;
          post['like_count'] = likesCount;
          post['location_id'] = locationId;
          post['location_name'] = locationName;
          post['last_scraped'] = moment()
            .tz('Asia/Tokyo')
            .format('YYYY-MM-DD HH:mm:ss');
          const update = await updateKnsFilteredInstagramPost(
            dbConnection,
            post
          );
          console.info(post);
          console.info(update.message);
          affectedRows.push(update.affectedRows);
          changedRows.push(update.changedRows);
        }

        const affectedRowsSum = affectedRows.reduce(
          (partial_sum, a) => partial_sum + a,
          0
        );
        const changedRowsSum = changedRows.reduce(
          (partial_sum, a) => partial_sum + a,
          0
        );

        const text = `records: ${records.length}, affected rows: ${affectedRowsSum}, changed rows: ${changedRowsSum}`;
        console.info(text);
        await postToSlack({
          username: slackUsername,
          text,
          icon_emoji: ':mailbox_with_mail:'
        });
      }
    } catch (error) {
      console.error(error);
      await postToSlack({
        username: slackUsername,
        text: slackError(POST_SCRAPER_ID, error),
        icon_emoji: ':mailbox_with_no_mail:'
      });
    }

    s3.deleteObject(params);

    return callback(
      null,
      `Successfully updated ${records.length} post records`
    );
  } catch (err) {
    console.error(err);
    await postToSlack({
      username: slackUsername,
      text: slackCatch(POST_SCRAPER_ID, err),
      icon_emoji: ':mailbox_closed:'
    });
    return callback(err);
  } finally {
    if (_dbConnection !== null) {
      await closeDbConnection(_dbConnection);
    }
  }
};
