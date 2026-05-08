export const POST_WITH_AUTHOR_AND_SERVER_SELECT =
  "*, profiles!posts_user_id_fkey(username, display_name, avatar_url, public_key), servers(name, slug)";

export const POST_WITH_AUTHOR_AND_SERVER_LITE_SELECT =
  "*, profiles!posts_user_id_fkey(username, display_name, avatar_url), servers(name, slug)";

export const COMMENT_WITH_AUTHOR_SELECT =
  "id, content, created_at, profiles!comments_user_id_fkey(username, avatar_url)";

export const SERVER_MEMBER_WITH_PROFILE_SELECT =
  "user_id, profiles!server_members_user_id_fkey(username, display_name)";
