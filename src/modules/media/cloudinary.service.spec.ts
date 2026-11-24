import { PassThrough } from 'node:stream';
import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UploadApiOptions, UploadApiResponse } from 'cloudinary';
import { CloudinaryService } from './cloudinary.service';

type UploadCallback = (
  error?: Error,
  result?: Pick<UploadApiResponse, 'public_id' | 'secure_url'>,
) => void;

const mockConfigure = jest.fn<void, [unknown]>();
const mockUploadStream = jest.fn<
  PassThrough,
  [UploadApiOptions, UploadCallback]
>();

jest.mock('cloudinary', () => ({
  v2: {
    config: (options: unknown) => mockConfigure(options),
    uploader: {
      upload_stream: (...args: [UploadApiOptions, UploadCallback]) =>
        mockUploadStream(...args),
    },
  },
}));

const PUBLIC_ID = 'orange-social/avatars/test/avatar';
const SECURE_URL = 'https://res.cloudinary.com/example/image/upload/avatar.png';
const IMAGE = Buffer.from('89504e470d0a1a0a', 'hex');

function createService(apiSecret = 'test-secret') {
  return new CloudinaryService(
    new ConfigService({
      CLOUDINARY_CLOUD_NAME: 'test-cloud',
      CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: apiSecret,
    }),
  );
}

describe('CloudinaryService.uploadImage', () => {
  beforeEach(() => {
    mockConfigure.mockReset();
    mockUploadStream.mockReset();
  });

  it('passes validated bytes and controlled options to the SDK', async () => {
    mockUploadStream.mockImplementation((_options, done) => {
      const stream = new PassThrough();
      stream.once('data', (chunk: Buffer) => {
        expect(chunk).toEqual(IMAGE);
        done(undefined, { public_id: PUBLIC_ID, secure_url: SECURE_URL });
      });
      return stream;
    });

    await expect(
      createService().uploadImage(IMAGE, PUBLIC_ID),
    ).resolves.toEqual({
      publicId: PUBLIC_ID,
      secureUrl: SECURE_URL,
    });
    expect(mockUploadStream.mock.calls[0]?.[0]).toMatchObject({
      public_id: PUBLIC_ID,
      resource_type: 'image',
      overwrite: false,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      timeout: 15_000,
    });
    expect(mockConfigure).toHaveBeenCalledTimes(1);
  });

  it('fails without contacting the SDK if configuration is missing', () => {
    expect(() => createService('').uploadImage(IMAGE, PUBLIC_ID)).toThrow(
      ServiceUnavailableException,
    );
    expect(mockUploadStream).not.toHaveBeenCalled();
  });

  it('uses the video resource type and formats for post videos', async () => {
    const videoId = 'orange-social/posts/test/video';
    const videoUrl = 'https://res.cloudinary.com/example/video/upload/post.mp4';
    const video = Buffer.from('000000186674797069736f6d', 'hex');
    mockUploadStream.mockImplementation((_options, done) => {
      const stream = new PassThrough();
      stream.once('data', (chunk: Buffer) => {
        expect(chunk).toEqual(video);
        done(undefined, { public_id: videoId, secure_url: videoUrl });
      });
      return stream;
    });

    await expect(createService().uploadVideo(video, videoId)).resolves.toEqual({
      publicId: videoId,
      secureUrl: videoUrl,
    });
    expect(mockUploadStream.mock.calls[0]?.[0]).toMatchObject({
      public_id: videoId,
      resource_type: 'video',
      overwrite: false,
      allowed_formats: ['mp4', 'webm'],
    });
  });

  it('maps provider errors to a generic gateway failure', async () => {
    mockUploadStream.mockImplementation((_options, done) => {
      done(new Error('internal provider error'));
      return new PassThrough();
    });

    await expect(createService().uploadImage(IMAGE, PUBLIC_ID)).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('rejects an unexpected asset or a non-HTTPS URL', async () => {
    for (const result of [
      { public_id: 'other-asset', secure_url: SECURE_URL },
      { public_id: PUBLIC_ID, secure_url: SECURE_URL.replace('https', 'http') },
    ]) {
      mockUploadStream.mockImplementation((_options, done) => {
        done(undefined, result);
        return new PassThrough();
      });
      await expect(
        createService().uploadImage(IMAGE, PUBLIC_ID),
      ).rejects.toThrow(BadGatewayException);
    }
  });
});
