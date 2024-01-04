import axios from 'axios';

interface SlackErr {
  name: string;
  message: string;
  stack: string;
}

interface SlackObj {
  username: string;
  text: string;
  icon_emoji: string;
}

const { ENV_NAME, SLACK_WEBHOOK, SLACK_CHANNEL } = process.env;

/**
 * post message to slack
 * @param param object data
 */
export async function postToSlack(data: SlackObj) {
  const { username, text, icon_emoji } = data;
  try {
    const payload = {
      channel: SLACK_CHANNEL,
      username,
      text,
      icon_emoji
    };

    return axios.post(SLACK_WEBHOOK, payload);
  } catch (error) {
    console.info(error.response);
    return error.response;
  }
}

/**
 * Slack send message
 * @param urls Array
 * @param scraperId string
 */
export const slackMessage = (
  arr: string[],
  count: number | null = null,
  programId: number | null = null,
  scraperId: string
) => {
  return `
      Sending ${arr.length} / ${count !== null ? count : ''} records to apify ${
    programId !== null ? programId : ''
  }
      https://my.apify.com/tasks/${scraperId}#/runs
    `;
};

/**
 * Slack error message
 * @param scraperId string
 * @param error object
 */
export const slackError = (scraperId: string, error: SlackErr) => {
  return `
    Could not send data to apify:
    ID :: ${scraperId} ::
    ERROR NAME :: ${error.name} ::
    ERROR MESSAGE ::${error.message} ::
    ERROR STACK :: ${error.stack} ::
`;
};

/**
 * Slack done message
 * @param urls Array
 * @param scraper_id string
 */
export const slackDone = (arr: string[]) => {
  return `No data to send to apify for now [${arr.length}]`;
};

/**
 * Slack catch error
 * @param scraperId string
 * @param error function
 */
export const slackCatch = (scraperId: string, error: SlackErr) => {
  return `
      Catch Error:
      ENV :: ${ENV_NAME.toUpperCase()} ::
      ID :: ${scraperId} ::
      ERROR NAME :: ${error.name} ::
      ERROR MESSAGE ::${error.message} ::
      ERROR STACK :: ${error.stack} ::
  `;
};
