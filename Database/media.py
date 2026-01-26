from fastapi import UploadFile, File
from pathlib import Path

class MediaDatabase:
    def __init__(self, app):
        self.app = app
        pass

    def init_table(self):
        conn, cursor = self.app.get_cursor()
        try:
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS media (
                id INT PRIMARY KEY AUTO_INCREMENT,
                filename VARCHAR(255) NOT NULL,
                file_size FLOAT NOT NULL,
                message_id INT NOT NULL,
                FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
            )
            """)
            return self;
        finally:
            cursor.close()
            conn.close()

    def get_media_info(self, media_id):
        conn, cursor = self.app.get_cursor()
        try:
            cursor.execute("SELECT id, filename, file_size, message_id FROM media WHERE id = %s", (media_id,))
            result = cursor.fetchone()
            if not result:
                return None
            
            media_info = {
                "id": result["id"],
                "filename": result["filename"],
                "file_size": result["file_size"],
                "message_id": result["message_id"]
            }
            return media_info
        finally:
            cursor.close()
            conn.close()

    def get_file(self, media_id):
        conn, cursor = self.app.get_cursor()
        try:
            cursor.execute("SELECT filename FROM media WHERE id = %s", (media_id,))
            result = cursor.fetchone()
            if not result:
                return None
            
            filename = result["filename"]
            file_ext = Path(filename).suffix
            media_dir = Path("media/uploads")
            file_path = media_dir / f"{media_id}{file_ext}"
            
            if not file_path.exists():
                return None
            
            return file_path
        finally:
            cursor.close()
            conn.close()

    async def create_media(self, message_id, file: UploadFile = File(...)):
        conn, cursor = self.app.get_cursor()
        media_dir = Path("media/uploads")
        media_dir.mkdir(parents=True, exist_ok=True)
        contents = await file.read()
        file_size = len(contents) / (1024 * 1024)  
        if file_size > 10:
            return {
                "status_code": 413,
                "message": "File size exceeds the maximum limit of 10 MB."
            }
        
        try:
            cursor.execute("""
            INSERT INTO media (filename, file_size, message_id)
            VALUES (%s, %s, %s)
            """, (file.filename, file_size, message_id))
            media_id = cursor.lastrowid

            file_ext = Path(file.filename).suffix
            new_filename = f"{media_id}{file_ext}"

            with open(media_dir / new_filename, "wb") as buffer:
                buffer.write(contents)
            
            return {
                "status_code": 200,
                "message": "File uploaded successfully.",
                "media_id": media_id,
                "filename": file.filename,
                "file_size": file_size,
                "message_id": message_id
            }
        except Exception as e:
            self.delete_file(media_id, file_ext)
            return {
                "status_code": 500,
                "message": f"An error occurred while saving the file: {str(e)}"
            }
        finally:
            file.close()
            cursor.close()
            conn.close()

    def get_all_media_ids_for_message(self, message_id):
        conn, cursor = self.app.get_cursor()
        try:
            cursor.execute("SELECT id, filename FROM media WHERE message_id = %s", (message_id,))
            results = cursor.fetchall()

            media_ids = []
            for media in results:
                media_id = media["id"]
                filename = media["filename"]
                file_ext = Path(filename).suffix
                media_dir = Path("media/uploads")
                file_path = media_dir / f"{media_id}{file_ext}"
                if file_path.exists():
                    media_ids.append(media_id)

            return media_ids
            
        finally:
            cursor.close()
            conn.close()

    def delete_media(self, media_id):
        conn, cursor = self.app.get_cursor()
        try:
            cursor.execute("SELECT filename FROM media WHERE id = %s", (media_id,))
            result = cursor.fetchone()
            if result:
                filename = result[0]
                file_ext = Path(filename).suffix
                self.delete_file(media_id, file_ext)

            cursor.execute("DELETE FROM media WHERE id = %s", (media_id,))
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    def delete_all_media_for_message(self, message_id):
        conn, cursor = self.app.get_cursor()
        try:
            cursor.execute("SELECT id, filename FROM media WHERE message_id = %s", (message_id,))
            results = cursor.fetchall()
            for media_id, filename in results:
                file_ext = Path(filename).suffix
                self.delete_file(media_id, file_ext)

            cursor.execute("DELETE FROM media WHERE message_id = %s", (message_id,))
            conn.commit()
        finally:
            cursor.close()
            conn.close()

    def delete_file(self, media_id, file_ext):
        media_dir = Path("media/uploads")
        file_path = media_dir / f"{media_id}{file_ext}"
        if file_path.exists():
            file_path.unlink()

    def save_avatar(self, filename, contents):
        media_dir = Path("media/avatars")
        media_dir.mkdir(parents=True, exist_ok=True)
        file_path = media_dir / filename
        with open(file_path, "wb") as buffer:
            buffer.write(contents)

    

