import { BadGatewayException, INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureHttpApi } from '../src/common/configure-http-api';
import { DrizzleService } from '../src/database/drizzle.service';
import { users } from '../src/database/schema';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import { CloudinaryService } from '../src/modules/media/cloudinary.service';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const ROUTE = '/media/avatar';
const PROFILE_ROUTE = '/profile/me/avatar';
const COVER_ROUTE = '/profile/me/cover';
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const IMAGE = Buffer.from('89504e470d0a1a0a', 'hex');
const SECURE_URL = 'https://res.cloudinary.com/example/image/upload/avatar.png';

describe('Backend avatar and cover uploads', () => {
  let app: INestApplication<App>;
  const returning = jest.fn<
    Promise<({ avatarUrl: string } | { id: string })[]>,
    [unknown]
  >();
  const where = jest.fn<{ returning: typeof returning }, [SQL]>(() => ({
    returning,
  }));
  const set = jest.fn<
    { where: typeof where },
    [{ avatarUrl?: string; coverUrl?: string; updatedAt: Date }]
  >(() => ({ where }));
  const update = jest.fn<{ set: typeof set }, [typeof users]>(() => ({ set }));
  const uploadImage = jest.fn((_image: Buffer, publicId: string) =>
    Promise.resolve({ publicId, secureUrl: SECURE_URL }),
  );

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DrizzleService)
      .useValue({ db: { update } })
      .overrideProvider(AuthSessionService)
      .useValue({ verifyAccessToken: () => Promise.resolve({ sub: USER_ID }) })
      .overrideProvider(CloudinaryService)
      .useValue({ uploadImage })
      .compile();
    app = module.createNestApplication();
    configureHttpApi(app);
    await app.init();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    returning.mockResolvedValue([{ avatarUrl: SECURE_URL }]);
  });
  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  function authenticatedUpload(route = ROUTE) {
    return request(app.getHttpServer())
      .post(route)
      .set('Authorization', 'Bearer test-token');
  }

  it('requires a Bearer token before accepting a file', async () => {
    await request(app.getHttpServer())
      .post(ROUTE)
      .attach('file', IMAGE, 'avatar.png')
      .expect(401);
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('accepts exactly 2 MiB, uses the authenticated owner, and wraps the response', async () => {
    const image = Buffer.alloc(MAX_BYTES);
    IMAGE.copy(image);
    const response = await authenticatedUpload()
      .attach('file', image, 'avatar.png')
      .expect(201);
    const publicId = uploadImage.mock.calls[0]?.[1];
    expect(publicId).toMatch(
      new RegExp(`^orange-social/avatars/${USER_ID}/[a-f0-9-]{36}$`),
    );
    expect(uploadImage).toHaveBeenCalledWith(image, publicId);
    expect(response.body).toEqual({
      success: true,
      data: { publicId, secureUrl: SECURE_URL },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    ['avatar.jpg', 'ffd8ff'],
    ['avatar.webp', '524946461000000057454250'],
  ])('accepts the image signature for %s', async (filename, signature) => {
    await authenticatedUpload()
      .attach('file', Buffer.from(signature, 'hex'), filename)
      .expect(201);
  });

  it('rejects missing files, multiple files, and extra fields', async () => {
    await authenticatedUpload().expect(400);
    await authenticatedUpload()
      .field('userId', 'ignored')
      .attach('file', IMAGE, 'avatar.png')
      .expect(400);
    await authenticatedUpload()
      .attach('file', IMAGE, 'avatar.png')
      .attach('file', IMAGE, 'other.png')
      .expect(400);
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('rejects non-image bytes despite the declared MIME type', async () => {
    await authenticatedUpload()
      .attach('file', Buffer.from('Not an image'), 'avatar.png')
      .expect(415);
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('rejects oversized files before calling Cloudinary', async () => {
    await authenticatedUpload()
      .attach('file', Buffer.alloc(MAX_BYTES + 1), 'avatar.png')
      .expect(413);
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('updates only the authenticated active user with the Cloudinary URL', async () => {
    const response = await authenticatedUpload(PROFILE_ROUTE)
      .attach('file', IMAGE, 'avatar.png')
      .expect(200);
    expect(uploadImage).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(users);
    expect(set.mock.calls[0][0].avatarUrl).toBe(SECURE_URL);
    expect(set.mock.calls[0][0].updatedAt).toBeInstanceOf(Date);
    const filter = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(filter.sql).toBe(
      '("users"."id" = $1 and "users"."deleted_at" is null)',
    );
    expect(filter.params).toEqual([USER_ID]);
    expect(returning).toHaveBeenCalledWith({ avatarUrl: users.avatarUrl });
    expect(response.body).toEqual({
      success: true,
      data: { avatarUrl: SECURE_URL },
    });
  });

  it('does not upload or write when the profile request has no token or injects a URL', async () => {
    await request(app.getHttpServer())
      .post(PROFILE_ROUTE)
      .attach('file', IMAGE, 'avatar.png')
      .expect(401);
    await authenticatedUpload(PROFILE_ROUTE)
      .field('avatarUrl', 'https://example.org/not-the-uploaded-image.png')
      .attach('file', IMAGE, 'avatar.png')
      .expect(400);
    expect(uploadImage).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('does not change the stored avatar if Cloudinary fails', async () => {
    uploadImage.mockRejectedValueOnce(new BadGatewayException());
    await authenticatedUpload(PROFILE_ROUTE)
      .attach('file', IMAGE, 'avatar.png')
      .expect(502);
    expect(update).not.toHaveBeenCalled();
  });

  it('does not report success when the DB write fails or no active user remains', async () => {
    returning.mockRejectedValueOnce(new Error('test write failure'));
    await authenticatedUpload(PROFILE_ROUTE)
      .attach('file', IMAGE, 'avatar.png')
      .expect(500);
    returning.mockResolvedValueOnce([]);
    await authenticatedUpload(PROFILE_ROUTE)
      .attach('file', IMAGE, 'avatar.png')
      .expect(404);
  });

  it('accepts a 5 MiB cover and updates only the authenticated active user', async () => {
    const image = Buffer.alloc(MAX_COVER_BYTES);
    IMAGE.copy(image);
    returning.mockResolvedValueOnce([{ id: USER_ID }]);

    const response = await authenticatedUpload(COVER_ROUTE)
      .attach('file', image, 'cover.png')
      .expect(200);

    const publicId = uploadImage.mock.calls[0]?.[1];
    expect(publicId).toMatch(
      new RegExp(`^orange-social/covers/${USER_ID}/[a-f0-9-]{36}$`),
    );
    expect(uploadImage).toHaveBeenCalledWith(image, publicId);
    expect(update).toHaveBeenCalledWith(users);
    expect(set.mock.calls[0][0]).toEqual({
      coverUrl: SECURE_URL,
      updatedAt: expect.any(Date) as Date,
    });
    const filter = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(filter.sql).toBe(
      '("users"."id" = $1 and "users"."deleted_at" is null)',
    );
    expect(filter.params).toEqual([USER_ID]);
    expect(response.body).toEqual({
      success: true,
      data: { coverUrl: SECURE_URL },
    });
  });

  it('rejects unauthenticated and invalid cover uploads before calling Cloudinary', async () => {
    await request(app.getHttpServer())
      .post(COVER_ROUTE)
      .attach('file', IMAGE, 'cover.png')
      .expect(401);
    await authenticatedUpload(COVER_ROUTE).expect(400);
    await authenticatedUpload(COVER_ROUTE)
      .field('coverUrl', 'https://example.org/extra.png')
      .attach('file', IMAGE, 'cover.png')
      .expect(400);
    await authenticatedUpload(COVER_ROUTE)
      .attach('file', Buffer.from('Not an image'), 'cover.png')
      .expect(415);
    await authenticatedUpload(COVER_ROUTE)
      .attach('file', Buffer.alloc(MAX_COVER_BYTES + 1), 'cover.png')
      .expect(413);
    expect(uploadImage).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('keeps the existing cover if Cloudinary fails', async () => {
    uploadImage.mockRejectedValueOnce(new BadGatewayException());
    await authenticatedUpload(COVER_ROUTE)
      .attach('file', IMAGE, 'cover.png')
      .expect(502);
    expect(update).not.toHaveBeenCalled();
  });

  it('does not return success when no active profile was updated', async () => {
    returning.mockResolvedValueOnce([]);
    await authenticatedUpload(COVER_ROUTE)
      .attach('file', IMAGE, 'cover.png')
      .expect(404);
  });
});
