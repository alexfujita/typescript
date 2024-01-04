import { asyncQuery } from '../utils/db';
import { Connection, QueryResults } from 'mysql';

interface Username {
  username: string;
  full_name: string;
  bio: string;
  profile_picture: string;
  media_count: number;
  followed_by: number;
  follows: number;
  last_scraped: string;
}

interface Post {
  post_url: string;
  like_count: number;
  comment_count: number;
  location_id: string;
  location_name: string;
  last_scraped: string;
}

/**
 * キーワードでフィルターされた内容を保存する
 */
export async function updateIgUserStats(
  dbConnection: Connection,
  user: Username
): Promise<{
  affectedRows: number;
  changedRows: number;
  message: string;
} | null> {
  const query = `
      UPDATE
        instagram_users
      SET
        ?
      WHERE
        username = '${user.username}'
    ;`;
  const inserts = [user];
  const result = await asyncQuery(dbConnection, query, inserts);
  return result;
}

export async function updateKnsFilteredInstagramPost(
  dbConnection: Connection,
  post: Post
): Promise<{
  affectedRows: number;
  changedRows: number;
  message: string;
} | null> {
  const query = `
      UPDATE
        kns_filtered_instagram_posts
      SET
        ?
      WHERE
        post_url = '${post.post_url}'
    ;`;
  const inserts = [post];
  const result = await asyncQuery(dbConnection, query, inserts);
  return result;
}
