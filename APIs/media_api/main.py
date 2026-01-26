from fastapi import HTTPException, Header, UploadFile, File
from pathlib import Path
from fastapi.responses import FileResponse


class MediaAPI:
    def __init__(self, app):
        self.app = app

        self.get_media()
        self.get_avatar()
        self.get_message_media()
        self.get_media_download()
        self.upload_media()

    def _get_user_from_token(self, authorization):
        if not authorization:
            raise HTTPException(status_code=401, detail="No authorization header given")
        
        user = self.app.users_cache.get_user_by_token(authorization)
        if not user: 
            raise HTTPException(status_code=401, detail="No user found with this token")
        
        return user
    

    def get_media(self):
        @self.app.get("/media/", tags=["Media"], description="Retrieve a media informations by its ID.")
        def root(media_id: int, authorization: str = Header(None)):
            self._get_user_from_token(authorization=authorization)
            media_info = self.app.medias.get_media_info(media_id)
            if not media_info:
                raise HTTPException(status_code=404, detail="Media not found")
            return media_info
    

    def get_media_download(self):
        @self.app.get("/media/download/", tags=["Media"], description="Download a media file by its ID.")
        def root(media_id: int):
            media_path = self.app.medias.get_file(media_id)
            if not media_path:
                raise HTTPException(status_code=404, detail="Media not found")

            return FileResponse(media_path)
        
    def get_avatar(self):
        @self.app.get("/media/avatar", tags=["Media"], description="Retrieve a user's avatar by its ID.")
        def root(avatar_id: str, authorization: str = Header(None)):
            self._get_user_from_token(authorization)

            media_dir = Path("media/avatars")
            file_path = media_dir / avatar_id

            
            if not file_path.exists():
                avatar_suffix = Path(avatar_id).suffix
                if not avatar_suffix:
                    matches = list(media_dir.glob(f"{avatar_id}.*"))
                    if matches:
                        file_path = matches[0]
                    else:
                        raise HTTPException(status_code=404, detail="Avatar not found")

            return FileResponse(file_path)
        
    def get_message_media(self):
        @self.app.get("/media/message/", tags=["Media"], description="Retrieve all media IDs associated with a specific message.")
        def root(message_id: int, authorization: str = Header(None)):
            self._get_user_from_token(authorization)

            media_ids = self.app.medias.get_all_media_ids_for_message(message_id)
            if not media_ids:
                raise HTTPException(status_code=404, detail="No media found for this message")

            return media_ids
        
    def upload_media(self):
        @self.app.post("/media/upload", tags=["Media"], description="Upload a media file associated with a specific message.")
        async def root(message_id: int, file: UploadFile = File(...), authorization: str = Header(None)):
            self._get_user_from_token(authorization)

            result = await self.app.medias.create_media(message_id, file)
            return result
        
    