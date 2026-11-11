import { IsUUID } from 'class-validator';

export class CompleteProfileImageDto {
  @IsUUID()
  uploadId!: string;
}
