"""File storage service utilizing MinIO object storage."""

import io
import uuid
import logging
import json
from datetime import timedelta
from pathlib import Path
from typing import Optional
from fastapi import UploadFile
from minio import Minio
from app.config import settings

logger = logging.getLogger("wajood_storage")

# Graceful Initialization: Client ko global define kiya, par logic block mein rakha
try:
    minio_client = Minio(
        settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_SECURE,
    )
    
    bucket_name = settings.MINIO_BUCKET_NAME
    if not minio_client.bucket_exists(bucket_name):
        minio_client.make_bucket(bucket_name)
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": "*",
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{bucket_name}/*"],
                }
            ],
        }
        minio_client.set_bucket_policy(bucket_name, json.dumps(policy))
        logger.info(f"✅ Created MinIO bucket '{bucket_name}' with public-read policy.")
    
    STORAGE_ENABLED = True
except Exception as e:
    logger.warning(f"Failed to auto-configure MinIO bucket storage layout: {e}")
    minio_client = None
    STORAGE_ENABLED = False

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}


def validate_file(file: UploadFile) -> Optional[str]:
    """Validate file type. Returns error message or None."""
    if not file.filename:
        return "No filename provided."

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return f"File type '{ext}' not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"

    return None


async def upload_photo(file: UploadFile, folder: str = "photos") -> str:
    """Upload file object to MinIO bucket and return its public access URL."""
    if not STORAGE_ENABLED:
        return "https://via.placeholder.com/150"

    ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    filename = f"{folder}/{uuid.uuid4().hex}{ext}"
    
    content = await file.read()
    
    # Save locally first
    upload_dir = Path(settings.UPLOAD_DIR) / folder
    upload_dir.mkdir(parents=True, exist_ok=True)
    local_path = Path(settings.UPLOAD_DIR) / filename
    with open(local_path, "wb") as f:
        f.write(content)
        
    content_stream = io.BytesIO(content)
    length = len(content)

    try:
        minio_client.put_object(
            bucket_name=settings.MINIO_BUCKET_NAME,
            object_name=filename,
            data=content_stream,
            length=length,
            content_type=file.content_type or "application/octet-stream",
        )
        
        return f"/uploads/{filename}"
    except Exception as e:
        logger.error(f"Failed to upload photo to MinIO: {e}")
        raise RuntimeError(f"Object storage upload error: {e}")


def get_photo_url(filename: str) -> str:
    """Return secure presigned access URL for a filename."""
    if not STORAGE_ENABLED or not minio_client:
        return ""
    try:
        return minio_client.presigned_get_object(
            bucket_name=settings.MINIO_BUCKET_NAME,
            object_name=filename,
            expires=timedelta(days=7),
        )
    except Exception as e:
        logger.error(f"Failed to generate presigned URL: {e}")
        return ""


def delete_photo(filename: str) -> bool:
    """Remove object from MinIO."""
    if not filename or not STORAGE_ENABLED or not minio_client:
        return False
    try:
        minio_client.remove_object(settings.MINIO_BUCKET_NAME, filename)
        return True
    except Exception as e:
        logger.error(f"Failed to remove object from MinIO: {e}")
        return False


# Backward compatibility aliases
async def save_upload(file: UploadFile, subfolder: str = "photos") -> str:
    return await upload_photo(file, folder=subfolder)


def delete_file(file_url: str) -> bool:
    if not file_url or not STORAGE_ENABLED:
        return False
    prefix = f"/{settings.MINIO_BUCKET_NAME}/"
    if prefix in file_url:
        filename = file_url.split(prefix)[1]
        return delete_photo(filename)
    return False