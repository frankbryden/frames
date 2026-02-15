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
  uploaded_at: string;
  tags?: Tag[];
  like_count?: number;
  dislike_count?: number;
  user_like?: boolean | null;
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
}

export interface GetPicturesFilters {
  userId?: number;
  tags?: string[];
  offset?: number;
  limit?: number;
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
  };
}
