import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  primaryKey,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

// =====================
// ENUMS
// =====================

export const privacyEnum = pgEnum("privacy", [
  "public", "friends", "only_me"
]);

export const requestStatusEnum = pgEnum("request_status", [
  "pending", "accepted", "rejected", "cancelled"
]);

export const reactionEnum = pgEnum("reaction_type", [
  "like", "love"
]);

export const mediaTypeEnum = pgEnum("media_type", [
  "image", "video"
]);

export const groupTypeEnum = pgEnum("group_type", [
  "public", "private"
]);

export const groupRoleEnum = pgEnum("group_role", [
  "admin", "moderator", "member"
]);

export const memberStatusEnum = pgEnum("member_status", [
  "pending", "approved", "rejected"
]);

// =====================
// 1. USERS
// =====================

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  email: varchar("email", { length: 255 }).notNull(),
  username: varchar("username", { length: 50 }).notNull(),
  passwordHash: text("password_hash").notNull(),

  fullName: varchar("full_name", { length: 150 }).notNull(),
  bio: text("bio"),
  dateOfBirth: timestamp("date_of_birth", {
    mode: "date",
    withTimezone: true,
  }),
  avatarUrl: text("avatar_url"),
  coverUrl: text("cover_url"),

  isEmailVerified: boolean("is_email_verified")
    .default(false).notNull(),

  tokenVersion: integer("token_version")
    .default(0).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow().notNull(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow().notNull(),

  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("users_email_unique")
    .on(sql`lower(${t.email})`),

  uniqueIndex("users_username_unique")
    .on(sql`lower(${t.username})`),

  check("users_token_version_check", sql`${t.tokenVersion} >= 0`),
]);

// =====================
// 2. FRIEND REQUESTS
// =====================

export const friendRequests = pgTable("friend_requests", {
  id: uuid("id").defaultRandom().primaryKey(),

  senderId: uuid("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  receiverId: uuid("receiver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  status: requestStatusEnum("status")
    .default("pending").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow().notNull(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow().notNull(),
}, (t) => [
  index("friend_requests_receiver_idx").on(t.receiverId),

  index("friend_requests_sender_idx").on(t.senderId),

  uniqueIndex("friend_requests_pending_unique")
    .on(t.senderId, t.receiverId)
    .where(sql`${t.status} = 'pending'`),

  check("friend_requests_no_self",
    sql`${t.senderId} <> ${t.receiverId}`),
]);

// =====================
// 3. FRIENDSHIPS
// =====================

export const friendships = pgTable("friendships", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  friendId: uuid("friend_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.friendId] }),

  index("friendships_friend_idx").on(t.friendId),

  check("friendships_no_self", sql`${t.userId} <> ${t.friendId}`),
]);

// =====================
// 4. FOLLOWS
// =====================

export const follows = pgTable("follows", {
  followerId: uuid("follower_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  followingId: uuid("following_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.followerId, t.followingId] }),

  index("follows_following_idx").on(t.followingId),

  check("follows_no_self",
    sql`${t.followerId} <> ${t.followingId}`),
]);

// =====================
// 5. GROUPS
// =====================

export const groups = pgTable("groups", {
  id: uuid("id").defaultRandom().primaryKey(),

  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  coverUrl: text("cover_url"),

  type: groupTypeEnum("type").default("public").notNull(),

  memberCount: integer("member_count").default(0).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow().notNull(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow().notNull(),

  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  index("groups_owner_idx").on(t.ownerId),

  check("groups_member_count_check",
    sql`${t.memberCount} >= 0`),
]);

// =====================
// 6. GROUP MEMBERS
// =====================

export const groupMembers = pgTable("group_members", {
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  role: groupRoleEnum("role").default("member").notNull(),

  status: memberStatusEnum("status")
    .default("pending").notNull(),

  joinedAt: timestamp("joined_at", { withTimezone: true })
    .defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.groupId, t.userId] }),

  index("group_members_user_idx").on(t.userId),

  index("group_members_group_status_idx")
    .on(t.groupId, t.status),
]);

// =====================
// 7. POSTS
// =====================

export const posts = pgTable("posts", {
  id: uuid("id").defaultRandom().primaryKey(),

  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  groupId: uuid("group_id")
    .references(() => groups.id, { onDelete: "cascade" }),

  content: text("content"),

  privacy: privacyEnum("privacy")
    .default("public").notNull(),

  reactionCount: integer("reaction_count").default(0).notNull(),
  commentCount: integer("comment_count").default(0).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow().notNull(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow().notNull(),

  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  index("posts_author_created_idx")
    .on(t.authorId, t.createdAt),

  index("posts_group_created_idx")
    .on(t.groupId, t.createdAt),

  check("posts_reaction_count_check",
    sql`${t.reactionCount} >= 0`),

  check("posts_comment_count_check",
    sql`${t.commentCount} >= 0`),
]);

// =====================
// 8. POST MEDIA
// =====================

export const postMedia = pgTable("post_media", {
  id: uuid("id").defaultRandom().primaryKey(),

  postId: uuid("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),

  type: mediaTypeEnum("type").notNull(),

  url: text("url").notNull(),
  storageKey: text("storage_key").notNull(),

  position: integer("position").default(0).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow().notNull(),
}, (t) => [
  index("post_media_post_idx").on(t.postId),

  uniqueIndex("post_media_position_unique")
    .on(t.postId, t.position),

  uniqueIndex("post_media_one_video_unique")
    .on(t.postId)
    .where(sql`${t.type} = 'video'`),

  check("post_media_position_check",
    sql`${t.position} >= 0`),
]);

// =====================
// 9. POST TAGS
// =====================

export const postTags = pgTable("post_tags", {
  postId: uuid("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.postId, t.userId] }),

  index("post_tags_user_idx").on(t.userId),
]);

// =====================
// 10. POST REACTIONS
// =====================

export const postReactions = pgTable("post_reactions", {
  postId: uuid("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  type: reactionEnum("type").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.postId, t.userId] }),

  index("post_reactions_user_idx").on(t.userId),
]);

// =====================
// 11. COMMENTS
// =====================

export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),

  postId: uuid("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),

  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  parentId: uuid("parent_id")
    .references((): AnyPgColumn => comments.id, {
      onDelete: "cascade",
    }),

  rootId: uuid("root_id")
    .references((): AnyPgColumn => comments.id, {
      onDelete: "set null",
    }),

  depth: integer("depth").default(0).notNull(),

  content: text("content").notNull(),

  reactionCount: integer("reaction_count").default(0).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow().notNull(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow().notNull(),

  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (t) => [
  index("comments_post_created_idx")
    .on(t.postId, t.createdAt),

  index("comments_parent_idx").on(t.parentId),

  index("comments_root_idx").on(t.rootId),

  index("comments_author_idx").on(t.authorId),

  check("comments_depth_check",
    sql`${t.depth} BETWEEN 0 AND 2`),

  check("comments_reaction_count_check",
    sql`${t.reactionCount} >= 0`),

  check("comments_no_self_parent",
    sql`${t.parentId} IS NULL OR ${t.parentId} <> ${t.id}`),
]);

// =====================
// 12. COMMENT REACTIONS
// =====================

export const commentReactions = pgTable("comment_reactions", {
  commentId: uuid("comment_id")
    .notNull()
    .references(() => comments.id, { onDelete: "cascade" }),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  type: reactionEnum("type").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.commentId, t.userId] }),

  index("comment_reactions_user_idx").on(t.userId),
]);

// =====================
// 13. COMMENT MENTIONS
// =====================

export const commentMentions = pgTable("comment_mentions", {
  commentId: uuid("comment_id")
    .notNull()
    .references(() => comments.id, { onDelete: "cascade" }),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.commentId, t.userId] }),

  index("comment_mentions_user_idx").on(t.userId),
]);

// =====================
// 14. NOTIFICATIONS
// =====================

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),

  recipientId: uuid("recipient_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  actorId: uuid("actor_id")
    .references(() => users.id, { onDelete: "set null" }),

  type: varchar("type", { length: 50 }).notNull(),

  content: text("content").notNull(),
  link: text("link"),

  isRead: boolean("is_read").default(false).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow().notNull(),
}, (t) => [
  index("notifications_recipient_created_idx")
    .on(t.recipientId, t.createdAt),

  index("notifications_recipient_read_idx")
    .on(t.recipientId, t.isRead),

  index("notifications_actor_idx").on(t.actorId),
]);

// =====================
// 15. STORIES
// =====================

export const stories = pgTable("stories", {
  id: uuid("id").defaultRandom().primaryKey(),

  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  type: mediaTypeEnum("type").notNull(),

  mediaUrl: text("media_url").notNull(),
  storageKey: text("storage_key").notNull(),

  privacy: privacyEnum("privacy")
    .default("friends").notNull(),

  viewCount: integer("view_count").default(0).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow().notNull(),

  expiresAt: timestamp("expires_at", { withTimezone: true })
    .default(sql`now() + interval '24 hours'`).notNull(),
}, (t) => [
  index("stories_author_idx").on(t.authorId),

  index("stories_expires_idx").on(t.expiresAt),

  check("stories_view_count_check",
    sql`${t.viewCount} >= 0`),

  check("stories_expiry_check",
    sql`${t.expiresAt} > ${t.createdAt}`),
]);

// =====================
// 16. STORY VIEWS
// =====================

export const storyViews = pgTable("story_views", {
  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),

  viewerId: uuid("viewer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  viewedAt: timestamp("viewed_at", { withTimezone: true })
    .defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.storyId, t.viewerId] }),

  index("story_views_viewer_idx").on(t.viewerId),
]);