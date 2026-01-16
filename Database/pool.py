from dbutils.pooled_db import PooledDB
import pymysql
from pymysql.cursors import DictCursor


pool = PooledDB(
    creator=pymysql,
    maxconnections=20,      
    mincached=2,            
    maxcached=5,            
    maxshared=0,            
    blocking=True,          
    ping=1,                 
    host="localhost",
    user="root",
    password="",
    database="sprava",
    port=3306,
    charset='utf8mb4',
    cursorclass=DictCursor,
    autocommit=True
)

def get_cursor():
    conn = pool.connection()
    return conn, conn.cursor()