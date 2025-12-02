-- Add tweet and thread to content_type enum
ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'tweet';
ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'thread';