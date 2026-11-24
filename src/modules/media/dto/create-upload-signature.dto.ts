import { IsIn } from 'class-validator';
import type { UploadPurpose } from '../types/media.types';

export class CreateUploadSignatureDto {
  @IsIn(['avatar'])
  purpose!: UploadPurpose;
}
