import {
  BadGatewayException,
  INestApplication,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureHttpApi } from '../src/common/configure-http-api';
import { DrizzleService } from '../src/database/drizzle.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import { CloudinaryService } from '../src/modules/media/cloudinary.service';
import { PostsRepository } from '../src/modules/posts/repositories/posts.repository';
import type { PostRecord } from '../src/modules/posts/types/post.types';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const POST_ID = '00000000-0000-4000-8000-000000000002';
const IMAGE = Buffer.from('89504e470d0a1a0a', 'hex');
const VIDEO = Buffer.from('000000186674797069736f6d', 'hex');
const NOW = new Date('2026-11-23T12:00:00.000Z');
const IMAGE_URL = 'https://res.cloudinary.com/example/image/upload/post.png';
const VIDEO_URL = 'https://res.cloudinary.com/example/video/upload/post.mp4';

describe('Creating and listing personal posts', () => {
  let app: INestApplication<App>;
  const record: PostRecord = {
    id: POST_ID,
    author: {
      id: USER_ID,
      fullName: 'Test User',
      username: 'test',
      avatarUrl: null,
    },
    content: null,
    media: [],
    privacy: 'public',
    reactionCount: 0,
    commentCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  };
  const insertPost = jest.fn<
    ReturnType<PostsRepository['insertPost']>,
    Parameters<PostsRepository['insertPost']>
  >((_userId, content, files) =>
    Promise.resolve({
      ...record,
      content,
      media: files.map(({ type, url }, index) => ({
        id: `attachment-${index}`,
        type,
        url,
      })),
    }),
  );
  const listOwnPosts = jest.fn(() =>
    Promise.resolve({ items: [record], nextCursor: POST_ID, hasMore: true }),
  );
  const listPublicByAuthor = jest.fn(() =>
    Promise.resolve({ items: [record], nextCursor: POST_ID, hasMore: true }),
  );
  const uploadImage = jest.fn((_image: Buffer, publicId: string) =>
    Promise.resolve({ publicId, secureUrl: IMAGE_URL }),
  );
  const uploadVideo = jest.fn((_video: Buffer, publicId: string) =>
    Promise.resolve({ publicId, secureUrl: VIDEO_URL }),
  );

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DrizzleService)
      .useValue({ db: {} })
      .overrideProvider(AuthSessionService)
      .useValue({ verifyAccessToken: () => Promise.resolve({ sub: USER_ID }) })
      .overrideProvider(CloudinaryService)
      .useValue({ uploadImage, uploadVideo })
      .overrideProvider(PostsRepository)
      .useValue({ insertPost, listOwnPosts, listPublicByAuthor })
      .compile();
    app = module.createNestApplication();
    configureHttpApi(app);
    await app.init();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  beforeEach(() => jest.clearAllMocks());

  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  function create() {
    return request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', 'Bearer test-token');
  }

  function list(query = '') {
    return request(app.getHttpServer())
      .get(`/posts/me${query}`)
      .set('Authorization', 'Bearer test-token');
  }

  it('creates a text-only post with public privacy and trims the edges only', async () => {
    const response = await create()
      .send({ content: '  Line 1\nLine 2  ' })
      .expect(201);
    expect(insertPost).toHaveBeenCalledWith(USER_ID, 'Line 1\nLine 2', []);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: POST_ID,
        content: 'Line 1\nLine 2',
        media: [],
        privacy: 'public',
      },
    });
  });

  it('allows media without text, preserving the upload order', async () => {
    const response = await create()
      .field('content', '   ')
      .attach('files', VIDEO, 'clip.mp4')
      .attach('files', IMAGE, 'photo.png')
      .expect(201);
    const [videoKey, imageKey] = [
      uploadVideo.mock.calls[0][1],
      uploadImage.mock.calls[0][1],
    ];
    expect(videoKey).toMatch(`orange-social/posts/${USER_ID}/`);
    expect(imageKey).toMatch(`orange-social/posts/${USER_ID}/`);
    expect(insertPost).toHaveBeenCalledWith(USER_ID, null, [
      { type: 'video', url: VIDEO_URL, storageKey: videoKey },
      { type: 'image', url: IMAGE_URL, storageKey: imageKey },
    ]);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        content: null,
        privacy: 'public',
        media: [
          { id: 'attachment-0', type: 'video', url: VIDEO_URL },
          { id: 'attachment-1', type: 'image', url: IMAGE_URL },
        ],
      },
    });
    expect(response.body).not.toHaveProperty('data.media.0.storageKey');
  });

  it('rejects missing authentication, blank input, and forged metadata', async () => {
    await request(app.getHttpServer())
      .post('/posts')
      .attach('files', IMAGE, 'photo.png')
      .expect(401);
    await create().send({ content: '  ' }).expect(400);
    await create()
      .send({ content: 'x'.repeat(5001) })
      .expect(400);
    await create()
      .field('privacy', 'only_me')
      .attach('files', IMAGE, 'photo.png')
      .expect(400);
    await create().send({ content: 'hello', authorId: POST_ID }).expect(400);
    expect(insertPost).not.toHaveBeenCalled();
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('validates all files before any upload or DB write', async () => {
    await create()
      .attach('files', IMAGE, 'photo.png')
      .attach('files', Buffer.from('invalid'), 'fake.png')
      .expect(415);
    await create()
      .attach('files', VIDEO, 'one.mp4')
      .attach('files', VIDEO, 'two.mp4')
      .expect(400);
    const oversized = Buffer.alloc(5 * 1024 * 1024 + 1);
    IMAGE.copy(oversized);
    await create().attach('files', oversized, 'big.png').expect(413);
    expect(insertPost).not.toHaveBeenCalled();
    expect(uploadImage).not.toHaveBeenCalled();
    expect(uploadVideo).not.toHaveBeenCalled();
  });

  it('does not create a post when Cloudinary fails', async () => {
    uploadVideo.mockRejectedValueOnce(new BadGatewayException());
    await create().attach('files', VIDEO, 'clip.mp4').expect(502);
    expect(insertPost).not.toHaveBeenCalled();
  });

  it('lists by the authenticated owner and validates pagination and query fields', async () => {
    const response = await list(`?limit=1&cursor=${POST_ID}`).expect(200);
    expect(listOwnPosts).toHaveBeenCalledWith(USER_ID, {
      limit: 1,
      cursor: POST_ID,
    });
    expect(response.body).toMatchObject({
      success: true,
      data: { items: [{ id: POST_ID }], nextCursor: POST_ID },
    });
    await list('?limit=51').expect(400);
    await list('?cursor=bad').expect(400);
    await list(`?authorId=${POST_ID}`).expect(400);
    expect(listOwnPosts).toHaveBeenCalledTimes(1);
  });

  it('requires authentication and routes author requests only to the public listing', async () => {
    const url = `/posts?authorId=${USER_ID}&limit=1&cursor=${POST_ID}`;
    await request(app.getHttpServer()).get(url).expect(401);
    const response = await request(app.getHttpServer())
      .get(url)
      .set('Authorization', 'Bearer test-token')
      .expect(200);
    expect(listPublicByAuthor).toHaveBeenCalledWith(USER_ID, {
      authorId: USER_ID,
      limit: 1,
      cursor: POST_ID,
    });
    expect(listOwnPosts).not.toHaveBeenCalled();
    expect(response.body).toMatchObject({
      success: true,
      data: {
        items: [{ id: POST_ID, privacy: 'public' }],
        nextCursor: POST_ID,
      },
    });
  });

  it('rejects invalid cursors and returns 404 for missing or deleted authors', async () => {
    const url = `/posts?authorId=${USER_ID}`;
    await request(app.getHttpServer())
      .get(`${url}&cursor=invalid`)
      .set('Authorization', 'Bearer test-token')
      .expect(400);
    expect(listPublicByAuthor).not.toHaveBeenCalled();
    listPublicByAuthor.mockRejectedValueOnce(new NotFoundException());
    await request(app.getHttpServer())
      .get(url)
      .set('Authorization', 'Bearer test-token')
      .expect(404);
  });
});
