export interface User {
  id: number;
  google_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
  last_login: string;
}

export interface Picture {
  id: number;
  user_id: number;
  user?: User;
  original_r2_key: string;
  compressed_r2_key: string;
  thumbnail_r2_key: string;
  original_url?: string;
  compressed_url?: string;
  thumbnail_url?: string;
  original_filename: string;
  original_size: number;
  compressed_size: number;
  width: number;
  height: number;
  mime_type: string;
  description: string | null;
  frame?: string | null;
  uploaded_at: string;
  taken_at: string | null;
  tags?: Tag[];
  like_count?: number;
  dislike_count?: number;
  user_like?: boolean | null;
  albums?: AlbumRef[];
  camera_make: string | null;
  camera_model: string | null;
  lens_model: string | null;
  f_number: number | null;
  exposure_time: string | null;
  iso: number | null;
  focal_length: number | null;
}

export interface AlbumRef {
  id: number;
  title: string;
}

export interface Album {
  id: number;
  user_id: number;
  title: string;
  cover_picture_id: number | null;
  cover_thumbnail_url?: string;
  created_at: string;
  picture_count?: number;
}

export interface Tag {
  id: number;
  name: string;
  count?: number;
  created_at?: string;
}

export interface Like {
  id: number;
  user_id: number;
  picture_id: number;
  is_like: boolean;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: number;
  expires_at: string;
  created_at: string;
}

export interface PictureUploadMetadata {
  userId: number;
  originalKey: string;
  compressedKey: string;
  thumbnailKey: string;
  originalFilename: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  mimeType: string;
  description?: string;
  frame?: string;
  cameraMake?: string | null;
  cameraModel?: string | null;
  lensModel?: string | null;
  fNumber?: number | null;
  exposureTime?: string | null;
  iso?: number | null;
  focalLength?: number | null;
  takenAt?: string | null;
}

export interface GetPicturesFilters {
  userId?: number;
  tags?: string[];
  offset?: number;
  limit?: number;
}

export interface CameraInfo {
  camera_make: string | null;
  camera_model: string | null;
  photo_count: number;
}

export interface CompressionResult {
  original: Buffer;
  compressed: Buffer;
  thumbnail: Buffer;
  metadata: {
    width: number;
    height: number;
    format: string;
    originalSize: number;
    compressedSize: number;
    cameraInfo: {
      cameraMake: string | null;
      cameraModel: string | null;
      lensModel: string | null;
      fNumber: number | null;
      exposureTime: string | null;
      iso: number | null;
      focalLength: number | null;
      takenAt: string | null;
    };
  };
}
